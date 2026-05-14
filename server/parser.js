/**
 * parser.js
 * Parses PokerNow CSV log files into structured hand histories.
 *
 * PokerNow logs are ordered newest-first, so we reverse before processing.
 * Each row has: entry, order, time
 *
 * Key entry types we care about:
 *   -- starting hand #N --
 *   -- ending hand #N --
 *   Player stacks: ...
 *   "NAME" posts a blind of AMOUNT
 *   "NAME" calls AMOUNT
 *   "NAME" raises to AMOUNT
 *   "NAME" bets AMOUNT
 *   "NAME" folds
 *   "NAME" checks
 *   "NAME" collected AMOUNT from pot
 *   Flop/Turn/River: [cards]
 */

const { parse } = require("csv-parse/sync");

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

  for (const row of rows) {
    const entry = row["entry"] || row["Entry"] || "";

    // ── Start of a new hand ──────────────────────────────────────────────
    const handStartMatch = entry.match(/--\s*starting hand\s*#?(\d+)/i);
    if (handStartMatch) {
      if (currentHand) hands.push(finalizeHand(currentHand));
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

    // ── Street transitions ────────────────────────────────────────────────
    const flopMatch = entry.match(/^flop:\s*\[(.+)\]/i);
    if (flopMatch) {
      currentStreet = "flop";
      currentHand.board.push(...parseCards(flopMatch[1]));
      continue;
    }
    const turnMatch = entry.match(/^turn:\s*\[(.+)\]/i);
    if (turnMatch) {
      currentStreet = "turn";
      currentHand.board.push(...parseCards(turnMatch[1]));
      continue;
    }
    const riverMatch = entry.match(/^river:\s*\[(.+)\]/i);
    if (riverMatch) {
      currentStreet = "river";
      currentHand.board.push(...parseCards(riverMatch[1]));
      continue;
    }

    // ── Player actions ────────────────────────────────────────────────────
    const foldMatch = entry.match(/"([^"]+)"\s+folds/i);
    if (foldMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(foldMatch[1]),
        action: "fold",
        amount: 0,
      });
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

    // All-in variants
    const allInBetMatch = entry.match(/"([^"]+)"\s+bets\s+([\d.]+)\s+and is all.?in/i);
    if (allInBetMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(allInBetMatch[1]),
        action: "bet_allin",
        amount: parseFloat(allInBetMatch[2]),
      });
      continue;
    }

    const allInRaiseMatch = entry.match(/"([^"]+)"\s+raises to\s+([\d.]+)\s+and is all.?in/i);
    if (allInRaiseMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(allInRaiseMatch[1]),
        action: "raise_allin",
        amount: parseFloat(allInRaiseMatch[2]),
      });
      continue;
    }

    const allInCallMatch = entry.match(/"([^"]+)"\s+calls\s+([\d.]+)\s+and is all.?in/i);
    if (allInCallMatch) {
      pushAction(currentHand, currentStreet, {
        player: cleanPlayerName(allInCallMatch[1]),
        action: "call_allin",
        amount: parseFloat(allInCallMatch[2]),
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
  // Calculate pot size from actions
  const totalInvested = hand.actions
    .filter((a) => ["small_blind","big_blind","call","bet","raise","call_allin","bet_allin","raise_allin"].includes(a.action))
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  hand.potSize = totalInvested;

  // Annotate sizing context for each bet/raise
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
  // Sum all investments up to (not including) this action
  let pot = 0;
  for (const a of hand.actions) {
    if (a === targetAction) break;
    if (["small_blind","big_blind","call","bet","raise","call_allin","bet_allin","raise_allin"].includes(a.action)) {
      pot += a.amount || 0;
    }
  }
  return pot;
}

function categorizeSizing(ratio, action, bigBlind) {
  if (ratio === null) return "unknown";
  if (action === "raise" || action === "raise_allin") {
    // Preflop open-raises are typically 2-3x BB, not pot-relative
    return null; // handled separately for preflop
  }
  if (ratio < 0.2) return "very_small";
  if (ratio < 0.4) return "small";
  if (ratio < 0.65) return "medium";
  if (ratio < 0.85) return "standard"; // ~75% pot
  if (ratio < 1.15) return "pot";
  if (ratio < 1.6) return "overbet";
  return "large_overbet";
}

function parseCards(cardStr) {
  return cardStr.split(",").map((c) => c.trim()).filter(Boolean);
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

module.exports = { parsePokerNowLog, extractPlayers, filterHandsForHero };
