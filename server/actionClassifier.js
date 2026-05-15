/**
 * actionClassifier.js
 * Classifies every hero action as brilliant/best/good/inaccuracy/mistake/blunder.
 * Uses rule-based logic for clear-cut sizing decisions (free) and a single
 * compact Haiku batch call for strategic decisions (cheap — ~$0.01-0.05/session).
 *
 * Returns: { [handNumber]: [{quality, note}] }
 *   where the array index matches the index in hand.heroActions.
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_QUALITIES = new Set(["brilliant","best","good","inaccuracy","mistake","blunder"]);

// ── Rule-based classifier ─────────────────────────────────────────────────────
// Returns {quality, note} for clear mechanical issues, or null if AI is needed.

function ruleClassify(action, bigBlind, openRaiseSeen) {
  const { action: act, street, amount, sizingRatio } = action;

  if (street === "preflop") {
    // Limp: hero calls exactly BB into an unraised pot
    if (act === "call" && !openRaiseSeen && Math.abs(amount - bigBlind) < 0.01) {
      return { quality: "inaccuracy", note: "Limping gives the BB a free play — raise or fold." };
    }
    // Min-raise (to less than 2.2x BB)
    if (act === "raise" && amount <= bigBlind * 2.2) {
      return { quality: "inaccuracy", note: `Min-raise to ${amount} gives callers excellent pot odds.` };
    }
  }

  if (sizingRatio !== null && sizingRatio !== undefined) {
    // Tiny bet (< 15% pot)
    if (["bet","bet_allin"].includes(act) && sizingRatio < 0.15) {
      return { quality: "inaccuracy", note: `${Math.round(sizingRatio * 100)}% pot bet — too small to build value or achieve fold equity.` };
    }
    // Massive overbet on non-river streets
    if (["bet","bet_allin"].includes(act) && street !== "river" && sizingRatio > 2.5) {
      return { quality: "mistake", note: `${Math.round(sizingRatio * 100)}% overbet on the ${street} — awkwardly polarizes your range early.` };
    }
  }

  return null; // needs AI
}

// ── AI batch classifier ───────────────────────────────────────────────────────

function buildBatchPrompt(items, bigBlind) {
  const lines = items.map(({ id, action, hand }) => {
    const { action: act, street, amount, sizingRatio } = action;
    const board = hand.board?.length ? `board=[${hand.board.join(",")}]` : "";
    const sizing = sizingRatio != null ? ` sizing=${Math.round(sizingRatio * 100)}%pot` : "";
    const pot = action.potAtAction != null ? ` pot=${action.potAtAction}` : "";
    const cards = hand.yourHand?.length ? ` hole=[${hand.yourHand.join(",")}]` : "";
    return `[${id}] H#${hand.handNumber} ${street}: ${act} ${amount}${pot}${sizing} ${board}${cards}`.trim();
  });

  return `You are a poker coach. Classify each decision as one of: brilliant, best, good, inaccuracy, mistake, blunder.
Respond with ONLY lines in exactly this format (one per action, no extras):
[id] quality | note (≤12 words)

Big blind = ${bigBlind}

${lines.join("\n")}`;
}

async function batchAIClassify(items, bigBlind) {
  if (items.length === 0) return {};

  const prompt = buildBatchPrompt(items, bigBlind);

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: Math.min(4096, items.length * 40 + 256),
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0]?.text ?? "";
  const result = {};

  for (const line of text.split("\n")) {
    const m = line.match(/^\[(\d+)\]\s*(\w+)\s*\|\s*(.+)/);
    if (!m) continue;
    const [, idStr, quality, note] = m;
    const q = quality.toLowerCase();
    if (VALID_QUALITIES.has(q)) {
      result[parseInt(idStr, 10)] = { quality: q, note: note.trim() };
    }
  }

  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────

async function classifyHeroActions(heroHands, heroName, bigBlind) {
  const notes = {};       // handNumber → array of {quality, note}
  const aiQueue = [];     // items that need AI classification
  let globalId = 0;       // stable ID for batch prompt

  for (const hand of heroHands) {
    notes[hand.handNumber] = [];
    let openRaiseSeen = false;

    for (const action of hand.heroActions) {
      const placeholder = notes[hand.handNumber].length;
      notes[hand.handNumber].push(null); // reserve slot

      const ruled = ruleClassify(action, bigBlind, openRaiseSeen);
      if (ruled) {
        notes[hand.handNumber][placeholder] = ruled;
      } else {
        aiQueue.push({ id: globalId++, handNumber: hand.handNumber, idx: placeholder, action, hand });
      }

      // Track if any raise has opened preflop before next hero action
      if (action.street === "preflop" && ["raise","raise_allin"].includes(action.action)) {
        openRaiseSeen = true;
      }
    }
  }

  // Run AI batch (one call for the whole session)
  if (aiQueue.length > 0) {
    const aiResults = await batchAIClassify(aiQueue, bigBlind);
    for (const item of aiQueue) {
      const res = aiResults[item.id];
      notes[item.handNumber][item.idx] = res ?? { quality: "good", note: "Reasonable play in context." };
    }
  }

  // Fill any remaining nulls (shouldn't happen, but safety net)
  for (const arr of Object.values(notes)) {
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) arr[i] = { quality: "good", note: "" };
    }
  }

  return notes;
}

module.exports = { classifyHeroActions };
