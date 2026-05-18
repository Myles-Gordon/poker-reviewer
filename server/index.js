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

function buildHandContext(hand, heroName, bigBlind) {
  const STREETS = ["preflop", "flop", "turn", "river"];
  const boardAt = {
    flop:  (hand.board ?? []).slice(0, 3),
    turn:  (hand.board ?? []).slice(0, 4),
    river: (hand.board ?? []).slice(0, 5),
  };

  const actionLines = STREETS.map(street => {
    const actions = hand.streets?.[street] ?? [];
    if (actions.length === 0) return null;

    const boardStr = street !== "preflop" && boardAt[street]?.length
      ? ` [${boardAt[street].join(" ")}]`
      : "";

    const actStr = actions.map(a => {
      const who = a.player === heroName ? "Hero" : a.player.split(/[\s@]/)[0].slice(0, 10);
      let s = `${who} ${a.action}`;
      if (a.amount) s += ` ${a.amount}`;
      if (a.sizingRatio != null && a.sizingRatio > 0 && street !== "preflop") {
        s += ` (${Math.round(a.sizingRatio * 100)}% pot)`;
      }
      return s;
    }).join(", ");

    return `  ${street.charAt(0).toUpperCase() + street.slice(1)}${boardStr}: ${actStr}`;
  }).filter(Boolean);

  return [
    `Hand #${hand.handNumber} | ${hand.players?.length ?? "?"} players | Pot: ${hand.potSize} | BB: ${bigBlind}`,
    `Hero cards: ${hand.yourHand?.length ? hand.yourHand.join(" ") : "unknown"}`,
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
 * Streams a Claude coaching response about a specific hand via SSE.
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

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    req.on("close", () => { closed = true; });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = anthropic.messages.stream({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: `You are an expert poker coach reviewing a player's session hand by hand. The player is "${heroName}" with a big blind of ${session.bigBlind}. Be concise (2–4 sentences unless more detail is requested), specific to the actual hand data shown, and educational. Reference bet sizes, board texture, and position when relevant. Engage directly with the player's reasoning — explain whether it was correct and exactly why.`,
      messages: [
        { role: "user",      content: `Hand context:\n${handContext}` },
        { role: "assistant", content: "I've reviewed the hand. What would you like to discuss?" },
        ...messages,
      ],
    });

    for await (const chunk of stream) {
      if (closed) break;
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    if (!closed) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err) {
    console.error("Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
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
