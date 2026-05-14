require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { parsePokerNowLog, extractPlayers, filterHandsForHero } = require("./parser");
const { analyzeSession } = require("./analyzer");

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
