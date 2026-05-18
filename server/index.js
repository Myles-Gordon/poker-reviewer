require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");

const { parsePokerNowLog, extractPlayers, filterHandsForHero, detectHero } = require("./parser");
const { analyzeSession } = require("./analyzer");

// ── Hand context builder (for chat endpoint) ──────────────────────────────────

// Convert raw card notation (e.g. "Td", "Ks") to human-readable form ("T♦", "K♠")
function formatCard(c) {
  if (!c) return c;
  const SUITS = { h: "♥", d: "♦", c: "♣", s: "♠" };
  const suit = c.slice(-1).toLowerCase();
  const rank = c.slice(0, -1).toUpperCase();
  return rank + (SUITS[suit] || suit);
}

function formatCards(cards) {
  if (!cards?.length) return "unknown";
  return cards.map(formatCard).join(" ");
}

function suitednessNote(cards) {
  if (!cards || cards.length < 2) return "";
  const suits = cards.map(c => c.slice(-1).toLowerCase());
  if (suits.every(s => s === suits[0])) return " (suited)";
  if (new Set(suits).size === suits.length) return " (rainbow)";
  return "";
}

// Describe the hero's hand strength vs the current board (simple, readable)
function describeHeroHolding(heroCards, board) {
  if (!heroCards?.length || !board?.length) return null;

  const RANKS = "23456789TJQKA";
  const rankOf = c => RANKS.indexOf(c.slice(0, -1).toUpperCase());
  const suitOf = c => c.slice(-1).toLowerCase();

  const heroRanks = heroCards.map(rankOf);
  const heroSuits = heroCards.map(suitOf);
  const boardRanks = board.map(rankOf);
  const allCards   = [...heroCards, ...board];
  const allRanks   = allCards.map(rankOf);
  const allSuits   = allCards.map(suitOf);

  // ── Flush / flush draw ────────────────────────────────────────────────────
  const suitCounts = {};
  for (const s of allSuits) suitCounts[s] = (suitCounts[s] ?? 0) + 1;
  const heroFlushSuit = heroSuits[0] === heroSuits[1] ? heroSuits[0] : null;
  const madeFlushed   = heroFlushSuit && (suitCounts[heroFlushSuit] ?? 0) >= 5;
  const flushDraw     = heroFlushSuit && (suitCounts[heroFlushSuit] ?? 0) === 4;

  // ── Straight check ────────────────────────────────────────────────────────
  const uniqueRanks = [...new Set(allRanks)].sort((a, b) => a - b);
  // Also handle A-low straight (A=12 treated as -1)
  if (uniqueRanks.includes(12)) uniqueRanks.unshift(-1);

  let madeStraight = false;
  let heroContributesStraight = false;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    const window = uniqueRanks.slice(i, i + 5);
    if (window[4] - window[0] === 4 && new Set(window).size === 5) {
      // Check hero cards are part of this straight
      if (heroRanks.some(r => window.includes(r)) ||
          (window.includes(-1) && heroRanks.includes(12))) {
        madeStraight = true;
        heroContributesStraight = true;
      } else {
        madeStraight = true; // board straight, hero doesn't need to contribute
      }
      break;
    }
  }

  // ── Straight draw (open-ended or gutshot) ─────────────────────────────────
  let straightDraw = false;
  if (!madeStraight) {
    for (let top = 3; top <= 12; top++) {
      const needed = [top - 4, top - 3, top - 2, top - 1, top];
      const have   = needed.filter(r => allRanks.includes(r) || (r === -1 && allRanks.includes(12)));
      const heroContrib = needed.filter(r => heroRanks.includes(r)).length;
      if (have.length === 4 && heroContrib >= 1) { straightDraw = true; break; }
    }
  }

  // ── Pair / board interaction ──────────────────────────────────────────────
  const boardRankCounts = {};
  for (const r of boardRanks) boardRankCounts[r] = (boardRankCounts[r] ?? 0) + 1;

  const hits = heroRanks.filter(r => boardRankCounts[r] > 0);
  const sortedBoard = [...boardRanks].sort((a, b) => b - a);

  // Trips: hero pairs a board rank that appears once, or hero has a pair that hits board
  const isTrips = hits.some(r => boardRankCounts[r] >= 2) ||
                  (heroRanks[0] === heroRanks[1] && boardRankCounts[heroRanks[0]] >= 1);

  // Quads / full house (simplified)
  const allRankCounts = {};
  for (const r of allRanks) allRankCounts[r] = (allRankCounts[r] ?? 0) + 1;
  const hasQuads    = Object.values(allRankCounts).some(c => c >= 4);
  const hasFullHouse = !hasQuads && Object.values(allRankCounts).filter(c => c >= 3).length >= 1 &&
                       Object.values(allRankCounts).filter(c => c >= 2).length >= 2;

  // ── Compose result ────────────────────────────────────────────────────────
  let strength;
  if (madeFlushed && madeStraight && heroContributesStraight) strength = "straight flush";
  else if (hasQuads)     strength = "four of a kind";
  else if (hasFullHouse) strength = "full house";
  else if (madeFlushed)  strength = "flush";
  else if (madeStraight && heroContributesStraight) strength = "straight";
  else if (isTrips)      strength = "trips";
  else if (hits.length >= 2) strength = "two pair";
  else if (hits.length === 1) {
    const pairRank = hits[0];
    if (pairRank === sortedBoard[0])                       strength = "top pair";
    else if (pairRank === sortedBoard[sortedBoard.length - 1]) strength = "bottom pair";
    else                                                    strength = "middle pair";
  } else if (heroRanks[0] === heroRanks[1]) {
    strength = heroRanks[0] > sortedBoard[0] ? "overpair" : "pocket pair (no pair with board)";
  } else {
    strength = "no pair (overcards)";
  }

  const draws = [];
  if (flushDraw)   draws.push("flush draw");
  if (straightDraw && !madeStraight) draws.push("straight draw");
  return draws.length ? `${strength} + ${draws.join(" + ")}` : strength;
}

function buildHandContext(hand, heroName, bigBlind) {
  const STREETS = ["preflop", "flop", "turn", "river"];
  const boardAt = {
    flop:  (hand.board ?? []).slice(0, 3),
    turn:  (hand.board ?? []).slice(0, 4),
    river: (hand.board ?? []).slice(0, 5),
  };

  const heroCards = hand.yourHand ?? [];
  const heroSuit  = heroCards.length === 2
    ? (heroCards[0].slice(-1) === heroCards[1].slice(-1) ? "suited" : "offsuit")
    : "";

  // Track running pot so Claude gets accurate per-street pot sizes
  const INVESTING = new Set(["small_blind","big_blind","call","bet","raise","call_allin","bet_allin","raise_allin"]);
  let runningPot = 0;
  const streetBetsAtStart = {}; // track per-player contributions per street to avoid double-counting calls

  const actionLines = STREETS.map(street => {
    const actions = hand.streets?.[street] ?? [];
    if (actions.length === 0) return null;

    const potAtStreetStart = runningPot;
    const streetBets = {};

    // Calculate pot contributions for this street
    for (const a of actions) {
      if (INVESTING.has(a.action) && a.amount) {
        const prev = streetBets[a.player] ?? 0;
        const additional = Math.max(0, a.amount - prev);
        runningPot += additional;
        streetBets[a.player] = a.amount;
      }
    }

    const board = boardAt[street] ?? [];
    const boardStr = street !== "preflop" && board.length
      ? ` [${formatCards(board)}${suitednessNote(board)}]`
      : "";

    const heroHolding = street !== "preflop" && board.length
      ? describeHeroHolding(heroCards, board)
      : null;

    const actStr = actions.map(a => {
      const who = a.player === heroName ? "Hero" : a.player.split(/[\s@]/)[0].slice(0, 10);
      let s = `${who} ${a.action}`;
      if (a.amount) s += ` ${a.amount}`;
      return s;
    }).join(", ");

    const potLabel = street === "preflop" ? "" : ` (pot: ${potAtStreetStart.toFixed(2)})`;
    const holdingLabel = heroHolding ? ` {Hero: ${heroHolding}}` : "";
    return `  ${street.charAt(0).toUpperCase() + street.slice(1)}${boardStr}${potLabel}${holdingLabel}: ${actStr}`;
  }).filter(Boolean);

  return [
    `Hand #${hand.handNumber} | ${hand.players?.length ?? "?"} players | BB: ${bigBlind}`,
    `Hero hole cards: ${formatCards(heroCards)}${heroSuit ? ` (${heroSuit})` : ""}`,
    `Hero stack: ${hand.heroStack ?? "unknown"}`,
    "",
    actionLines.join("\n"),
    "",
    `Result: ${hand.heroWon ? `Hero won ${hand.heroWinAmount}` : "Hero lost"}`,
  ].join("\n");
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }));
app.use(express.json());

// Multer: store CSV in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted"));
    }
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Accepts a PokerNow CSV, parses it, returns player list + hand count.
 * Frontend uses this to populate the player selector.
 */
app.post("/api/upload", upload.single("logFile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const csvText = req.file.buffer.toString("utf-8");
    const hands = parsePokerNowLog(csvText);

    if (hands.length === 0) {
      return res.status(400).json({
        error: "No hands found in this log file. Make sure it's a valid PokerNow CSV export.",
      });
    }

    const players = extractPlayers(hands);
    const suggestedHero = detectHero(hands);

    // Detect likely big blind from first hand
    const bigBlind = hands[0]?.blinds?.big || 1;

    // Store parsed hands in a temp session (in-memory for simplicity)
    // In production you'd use Redis or a DB
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    parsedSessions.set(sessionId, { hands, bigBlind, filename: req.file.originalname });

    res.json({
      sessionId,
      players,
      handCount: hands.length,
      bigBlind,
      filename: req.file.originalname,
      suggestedHero,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analyze
 * Body: { sessionId, heroName }
 * Filters hands for the hero, runs AI analysis, returns full review.
 */
app.post("/api/analyze", async (req, res) => {
  try {
    const { sessionId, heroName } = req.body;

    if (!sessionId || !heroName) {
      return res.status(400).json({ error: "sessionId and heroName are required" });
    }

    const session = parsedSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found. Please re-upload your log file." });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY is not configured. Add it to your .env file.",
      });
    }

    const heroHands = filterHandsForHero(session.hands, heroName);

    if (heroHands.length === 0) {
      return res.status(400).json({
        error: `No hands found for player "${heroName}". Check that the name matches exactly.`,
      });
    }

    console.log(`Analyzing ${heroHands.length} hands for ${heroName}...`);

    const review = await analyzeSession(heroHands, heroName, session.bigBlind);

    res.json({
      heroName,
      handCount: heroHands.length,
      bigBlind: session.bigBlind,
      review,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/session/:sessionId/hands?hero=Name
 * Returns all hands for the session, filtered to hero if provided.
 */
app.get("/api/session/:sessionId/hands", (req, res) => {
  const { sessionId } = req.params;
  const { hero } = req.query;

  const session = parsedSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found. Please re-upload your log file." });
  }

  const hands = hero ? filterHandsForHero(session.hands, hero) : session.hands;
  res.json({ hands, count: hands.length });
});

/**
 * POST /api/chat
 * Body: { sessionId, heroName, handNumber, messages }
 * Returns a Claude coaching reply as plain JSON.
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, heroName, handNumber, messages } = req.body;

    if (!sessionId || !heroName || handNumber == null || !Array.isArray(messages)) {
      return res.status(400).json({ error: "sessionId, heroName, handNumber, and messages are required" });
    }

    const session = parsedSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found. Please re-upload your log file." });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured." });
    }

    const heroHands = filterHandsForHero(session.hands, heroName);
    const hand = heroHands.find(h => h.handNumber === handNumber);
    if (!hand) {
      return res.status(404).json({ error: `Hand #${handNumber} not found.` });
    }

    const handContext = buildHandContext(hand, heroName, session.bigBlind);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are an expert poker coach reviewing a player's session hand by hand. The player is "${heroName}" with a big blind of ${session.bigBlind}. Be concise (2–4 sentences unless more detail is requested), specific to the actual hand data shown, and educational. Reference bet sizes, board texture, and position when relevant.

CRITICAL: Each street line includes a {Hero: X} tag that states the hero's exact hand strength at that point (e.g. {Hero: straight}, {Hero: top pair}, {Hero: flush draw}). These are computed facts — treat them as ground truth. NEVER contradict or override them with your own hand-reading. If {Hero: straight} appears on the flop, the hero flopped a straight; do not call it a draw.`,
      messages: [
        { role: "user",      content: `Hand context:\n${handContext}` },
        { role: "assistant", content: "I've reviewed the hand. What would you like to discuss?" },
        ...messages,
      ],
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ── In-memory session store (simple Map, resets on server restart) ────────────
const parsedSessions = new Map();

// Clean up sessions older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, _] of parsedSessions) {
    const ts = parseInt(id.slice(0, -7), 36);
    if (ts < cutoff) parsedSessions.delete(id);
  }
}, 10 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🃏 Poker Reviewer server running on http://localhost:${PORT}`);
  console.log(`   API key: ${process.env.ANTHROPIC_API_KEY ? "✓ configured" : "✗ MISSING — add to .env"}\n`);
});
