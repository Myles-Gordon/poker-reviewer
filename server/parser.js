/**
 * parser.js
 * Parses PokerNow CSV log files into structured hand histories.
 *
 * PokerNow logs are ordered newest-first, so we reverse before processing.
 * Each row has: entry, order, time
 *
 * Actual PokerNow entry formats (from CSV analysis):
 *   -- starting hand #N --
 *   -- ending hand #N --
 *   Player stacks: "seat# \"Name @ id\" (chips) | ..."
 *   "NAME" posts a small blind of AMOUNT
 *   "NAME" posts a big blind of AMOUNT
 *   Your hand is Ah, Kd          ← NO brackets
 *   Flop:  [10♠, K♦, K♣]         ← brackets around all 3
 *   Turn: 3♦, 9♦, 8♥ [Q♦]        ← only new card in brackets
 *   River: 3♦, 9♦, 8♥, Q♦ [J♥]  ← only new card in brackets
 *   "NAME" folds
 *   "NAME" checks
 *   "NAME" calls AMOUNT
 *   "NAME" raises to AMOUNT
 *   "NAME" bets AMOUNT
 *   "NAME" calls AMOUNT and go all in
 *   "NAME" raises to AMOUNT and go all in
 *   "NAME" bets AMOUNT and go all in
 *   "NAME" collected AMOUNT from pot
 *   "NAME" shows a Kd, Qh.       ← NO brackets, trailing period
 *   Flop (second run): [...]     ← ignored
 */

const { parse } = require("csv-parse/sync");

// ── Card normalisation ────────────────────────────────────────────────────────
// PokerNow uses Unicode suit symbols; convert to single letters.
// Also strips trailing periods (showdown lines end with ".").
function normalizeCard(raw) {
  return raw
    .trim()
    .replace(/\.$/, "")
    .replace(/♠/g, "s")
    .replace(/♥/g, "h")
    .replace(/♦/g, "d")
    .replace(/♣/g, "c");
}

function parseCards(cardStr) {
  // Handle both comma-separated and space-separated lists.
  // Strip any surrounding brackets first.
  const cleaned = cardStr.replace(/[\[\]]/g, "").trim();
  const separator = cleaned.includes(",") ? "," : " ";
  return cleaned
    .split(separator)
    .map(normalizeCard)
    .filter(Boolean);
}

const INVESTING_ACTIONS = new Set([
  "small_blind","big_blind","call","bet","raise","call_allin","bet_allin","raise_allin",
]);

// ── Main parser ───────────────────────────────────────────────────────────────

function parsePokerNowLog(csvText) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // PokerNow logs are newest-first; reverse for chronological processing
  const rows = records.reverse();

  const hands = [];
  let currentHand = null;
  let currentStreet = "preflop";
  let hasPaidOut = false; // true once any pot is collected; subsequent folds are showdown mucks

  for (const row of rows) {
    const entry = row["entry"] || row["Entry"] || "";

    // ── Start of a new hand ──────────────────────────────────────────────
    const handStartMatch = entry.match(/--\s*starting hand\s*#?(\d+)/i);
    if (handStartMatch) {
      if (currentHand) hands.push(finalizeHand(currentHand));
      hasPaidOut = false;
      currentHand = {
        handNumber: parseInt(handStartMatch[1], 10),
        timestamp: row["at"] || row["time"] || "",
        players: [],
        stacks: {},
        blinds: { small: 0, big: 0 },
        actions: [],
        board: [],
        pots: [],
        winners: [],
        streets: { preflop: [], flop: [], turn: [], river: [] },
      };
      currentStreet = "preflop";
      continue;
    }

    if (!currentHand) continue;

    // ── End of hand ──────────────────────────────────────────────────────
    if (/--\s*ending hand/i.test(entry)) {
      hands.push(finalizeHand(currentHand));
      currentHand = null;
      continue;
    }

    // ── Skip second-run entries (bad beat runouts) ────────────────────────
    if (/\(second run\)/i.test(entry)) continue;

    // ── Player stacks at start of hand ───────────────────────────────────
    const stacksMatch = entry.match(/^Player stacks:\s*(.+)$/i);
    if (stacksMatch) {
      const stackParts = stacksMatch[1].split("|");
      for (const part of stackParts) {
        // Format: "seat# \"Name @ id\" (chips)"
        const m = part.trim().match(/"([^"]+)"\s*\((\d+(?:\.\d+)?)\)/);
        if (m) {
          const displayName = cleanPlayerName(m[1]);
          const chips = parseFloat(m[2]);
          currentHand.stacks[displayName] = chips;
          if (!currentHand.players.includes(displayName)) {
            currentHand.players.push(displayName);
          }
        }
      }
      continue;
    }

    // ── Blinds ────────────────────────────────────────────────────────────
    const blindMatch = entry.match(/"([^"]+)"\s+posts a\s+(small|big)\s+blind of\s+([\d.]+)/i);
    if (blindMatch) {
      const player = cleanPlayerName(blindMatch[1]);
      const type = blindMatch[2].toLowerCase();
      const amount = parseFloat(blindMatch[3]);
      if (type === "small") currentHand.blinds.small = amount;
      if (type === "big") currentHand.blinds.big = amount;
      pushAction(currentHand, currentStreet, { player, action: `${type}_blind`, amount });
      continue;
    }

    // ── Missing/missed blind ──────────────────────────────────────────────
    if (/posts a missing small blind/i.test(entry) || /posts a missed blind/i.test(entry)) {
      continue;
    }

    // ── Street transitions ────────────────────────────────────────────────
    // Flop: [card, card, card]
    const flopMatch = entry.match(/^flop\s*(?:\([^)]*\))?\s*:\s*\[(.+)\]/i);
    if (flopMatch) {
      currentStreet = "flop";
      currentHand.board = parseCards(flopMatch[1]).slice(0, 3);
      continue;
    }

    // Turn: existing_cards [new_card]  — only the bracketed card is new
    const turnMatch = entry.match(/^turn\s*:\s*(.+)\[(.+)\]/i);
    if (turnMatch) {
      currentStreet = "turn";
      const newCard = parseCards(turnMatch[2])[0];
      if (newCard) {
        currentHand.board = [...currentHand.board.slice(0, 3), newCard];
      }
      continue;
    }

    // River: existing_cards [new_card]
    const riverMatch = entry.match(/^river\s*:\s*(.+)\[(.+)\]/i);
    if (riverMatch) {
      currentStreet = "river";
      const newCard = parseCards(riverMatch[2])[0];
      if (newCard) {
        currentHand.board = [...currentHand.board.slice(0, 4), newCard];
      }
      continue;
    }

    // ── Hero hole cards ("Your hand is Ah, Kd") ──────────────────────────
    // PokerNow format: "Your hand is card, card" — NO brackets
    const yourHandMatch = entry.match(/^your hand is\s+(.+)$/i);
    if (yourHandMatch) {
      currentHand.yourHand = parseCards(yourHandMatch[1]);
      continue;
    }

    // ── Showdown reveals ─────────────────────────────────────────────────
    // Format: "Player" shows a Kd, Qh.   — NO brackets, trailing period
    // Also handles: "Player" showed a ...
    const showsMatch = entry.match(/"([^"]+)"\s+show(?:s|ed)\s+(?:a\s+)?([^[].+)/i);
    if (showsMatch) {
      const showPlayer = cleanPlayerName(showsMatch[1]);
      // Strip trailing period before parsing
      const cardStr = showsMatch[2].replace(/\.$/, "").trim();
      const shownCards = parseCards(cardStr);
      if (shownCards.length > 0) {
        if (!currentHand.shows) currentHand.shows = [];
        currentHand.shows.push({ player: showPlayer, cards: shownCards });
      }
      continue;
    }

    // ── Player actions — all-in variants FIRST (more specific) ───────────
    const allInRaiseMatch = entry.match(/"([^"]+)"\s+raises to\s+([\d.]+)\s+and (?:is|go(?:es)?)\s+all.?in/i);
    if (allInRaiseMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(allInRaiseMatch[1]),
        action: "raise_allin",
        amount: parseFloat(allInRaiseMatch[2]),
      });
      continue;
    }

    const allInBetMatch = entry.match(/"([^"]+)"\s+bets\s+([\d.]+)\s+and (?:is|go(?:es)?)\s+all.?in/i);
    if (allInBetMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(allInBetMatch[1]),
        action: "bet_allin",
        amount: parseFloat(allInBetMatch[2]),
      });
      continue;
    }

    const allInCallMatch = entry.match(/"([^"]+)"\s+calls\s+([\d.]+)\s+and (?:is|go(?:es)?)\s+all.?in/i);
    if (allInCallMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(allInCallMatch[1]),
        action: "call_allin",
        amount: parseFloat(allInCallMatch[2]),
      });
      continue;
    }

    // ── Regular player actions ────────────────────────────────────────────
    const foldMatch = entry.match(/"([^"]+)"\s+folds/i);
    if (foldMatch) {
      // Skip showdown mucks — folds logged after payout are not real actions
      if (!hasPaidOut) {
        pushAction(currentHand, currentStreet, {
          player: cleanPlayerName(foldMatch[1]),
          action: "fold",
          amount: 0,
        });
      }
      continue;
    }

    const checkMatch = entry.match(/"([^"]+)"\s+checks/i);
    if (checkMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(checkMatch[1]),
        action: "check",
        amount: 0,
      });
      continue;
    }

    const callMatch = entry.match(/"([^"]+)"\s+calls\s+([\d.]+)/i);
    if (callMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(callMatch[1]),
        action: "call",
        amount: parseFloat(callMatch[2]),
      });
      continue;
    }

    const betMatch = entry.match(/"([^"]+)"\s+bets\s+([\d.]+)/i);
    if (betMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(betMatch[1]),
        action: "bet",
        amount: parseFloat(betMatch[2]),
      });
      continue;
    }

    const raiseMatch = entry.match(/"([^"]+)"\s+raises to\s+([\d.]+)/i);
    if (raiseMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(raiseMatch[1]),
        action: "raise",
        amount: parseFloat(raiseMatch[2]),
      });
      continue;
    }

    // ── Pot collection (winner) ───────────────────────────────────────────
    const collectedMatch = entry.match(/"([^"]+)"\s+collected\s+([\d.]+)\s+from\s+(.+)/i);
    if (collectedMatch) {
      currentHand.winners.push({
        player: cleanPlayerName(collectedMatch[1]),
        amount: parseFloat(collectedMatch[2]),
        pot: collectedMatch[3].trim(),
      });
      hasPaidOut = true;
      continue;
    }

    // ── Pot sizes shown ───────────────────────────────────────────────────
    const potMatch = entry.match(/pot:\s*([\d.]+)/i);
    if (potMatch) {
      currentHand.pots.push(parseFloat(potMatch[1]));
    }
  }

  // Catch last hand if file doesn't end with "ending hand"
  if (currentHand) hands.push(finalizeHand(currentHand));

  return hands;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pushAction(hand, street, actionObj) {
  const streetKey = street || "preflop";
  hand.streets[streetKey] = hand.streets[streetKey] || [];
  hand.streets[streetKey].push(actionObj);
  hand.actions.push({ ...actionObj, street: streetKey });
}

function finalizeHand(hand) {
  // Track per-player contributions per street to avoid double-counting calls.
  // PokerNow "calls X" means the TOTAL bet to match, not the additional amount.
  let pot = 0;
  let streetContribs = {};
  let prevStreet = null;
  for (const a of hand.actions) {
    if (a.street !== prevStreet) { streetContribs = {}; prevStreet = a.street; }
    if (INVESTING_ACTIONS.has(a.action)) {
      const prev       = streetContribs[a.player] ?? 0;
      const additional = Math.max(0, (a.amount ?? 0) - prev);
      pot += additional;
      streetContribs[a.player] = a.amount ?? 0;
    }
  }
  hand.potSize = Math.round(pot * 100) / 100;

  hand.actions = hand.actions.map((a) => {
    if (["bet", "raise", "bet_allin", "raise_allin"].includes(a.action)) {
      a.potAtAction = estimatePotAtAction(hand, a);
      a.sizingRatio = a.potAtAction > 0 ? a.amount / a.potAtAction : null;
      a.sizingLabel = categorizeSizing(a.sizingRatio, a.action, hand.blinds.big);
    }
    return a;
  });

  return hand;
}

function estimatePotAtAction(hand, targetAction) {
  let pot = 0;
  let streetContribs = {};
  let prevStreet = null;
  for (const a of hand.actions) {
    if (a === targetAction) break;
    if (a.street !== prevStreet) { streetContribs = {}; prevStreet = a.street; }
    if (INVESTING_ACTIONS.has(a.action)) {
      const prev       = streetContribs[a.player] ?? 0;
      const additional = Math.max(0, (a.amount ?? 0) - prev);
      pot += additional;
      streetContribs[a.player] = a.amount ?? 0;
    }
  }
  return pot;
}

function categorizeSizing(ratio, action, bigBlind) {
  if (ratio === null) return "unknown";
  if (action === "raise" || action === "raise_allin") {
    return null;
  }
  if (ratio < 0.2) return "very_small";
  if (ratio < 0.4) return "small";
  if (ratio < 0.65) return "medium";
  if (ratio < 0.85) return "standard";
  if (ratio < 1.15) return "pot";
  if (ratio < 1.6) return "overbet";
  return "large_overbet";
}

function cleanPlayerName(raw) {
  // PokerNow names can include " @ <id>" suffix — strip it
  return raw.replace(/\s*@\s*[A-Za-z0-9_-]+$/, "").trim();
}

/**
 * Extract all unique player names from parsed hands
 */
function extractPlayers(hands) {
  const playerSet = new Set();
  for (const hand of hands) {
    for (const player of hand.players) {
      playerSet.add(player);
    }
  }
  return Array.from(playerSet).sort();
}

/**
 * Filter hands to only those involving a specific hero player,
 * and annotate each hand with hero-specific context.
 */
function filterHandsForHero(hands, heroName) {
  return hands
    .filter((h) => h.players.includes(heroName))
    .map((h) => ({
      ...h,
      heroActions: h.actions.filter((a) => a.player === heroName),
      heroStack: h.stacks[heroName] || null,
      heroWon: h.winners.some((w) => w.player === heroName),
      heroWinAmount: h.winners
        .filter((w) => w.player === heroName)
        .reduce((s, w) => s + w.amount, 0),
    }));
}

/**
 * Detect the hero player by cross-referencing "Your hand" cards with showdown reveals.
 * Returns the most frequently matched player name, or null if not enough data.
 */
function detectHero(hands) {
  const votes = {};

  for (const hand of hands) {
    if (!hand.yourHand?.length || !hand.shows?.length) continue;

    for (const show of hand.shows) {
      const yourNorm = hand.yourHand.map((c) => c.trim().toLowerCase());
      const showNorm = show.cards.map((c) => c.trim().toLowerCase());
      const isMatch =
        yourNorm.length === showNorm.length &&
        yourNorm.every((c) => showNorm.includes(c));

      if (isMatch) {
        votes[show.player] = (votes[show.player] || 0) + 1;
      }
    }
  }

  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

module.exports = { parsePokerNowLog, extractPlayers, filterHandsForHero, detectHero };
