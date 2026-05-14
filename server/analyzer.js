/**
 * analyzer.js
 * Sends structured hand data to Claude and returns a graded session review.
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Sizing issue detector (rule-based, no AI needed) ─────────────────────────

function detectSizingIssues(heroHands, heroName, bigBlind) {
  const issues = [];

  for (const hand of heroHands) {
    for (const action of hand.heroActions) {
      // Min-raise detection
      if (action.action === "raise" && action.street === "preflop") {
        const raiseAmount = action.amount;
        const minRaise = hand.blinds.big * 2;
        if (raiseAmount <= minRaise * 1.05) {
          issues.push({
            handNumber: hand.handNumber,
            type: "min_raise",
            severity: "inaccuracy",
            description: `Min-raised to ${raiseAmount} preflop (BB=${hand.blinds.big}). Min-raises give opponents excellent pot odds and signal weakness.`,
            action,
          });
        }
      }

      // Postflop sizing issues
      if (["bet", "bet_allin"].includes(action.action) && action.sizingRatio !== null) {
        if (action.sizingRatio < 0.2 && action.sizingRatio !== null) {
          issues.push({
            handNumber: hand.handNumber,
            type: "tiny_bet",
            severity: "inaccuracy",
            description: `Bet only ${Math.round(action.sizingRatio * 100)}% of pot on the ${action.street}. Extremely small bets rarely achieve fold equity or build the pot efficiently.`,
            action,
          });
        }

        if (action.sizingRatio > 2.0 && action.street !== "river") {
          issues.push({
            handNumber: hand.handNumber,
            type: "massive_overbet",
            severity: "inaccuracy",
            description: `Bet ${Math.round(action.sizingRatio * 100)}% of pot on the ${action.street}. Massive overbets on early streets can be exploitable and polarize your range awkwardly.`,
            action,
          });
        }
      }

      // Raise sizing on the flop/turn
      if (["raise", "raise_allin"].includes(action.action) && action.street !== "preflop") {
        if (action.sizingRatio !== null && action.sizingRatio < 0.3) {
          issues.push({
            handNumber: hand.handNumber,
            type: "weak_raise",
            severity: "inaccuracy",
            description: `Raised to only ${Math.round(action.sizingRatio * 100)}% of pot on the ${action.street}. Small raises postflop often give villains great odds to continue with draws.`,
            action,
          });
        }
      }
    }
  }

  return issues;
}

// ── Session stats builder ─────────────────────────────────────────────────────

function buildSessionStats(heroHands, heroName) {
  let totalHands = heroHands.length;
  let handsPlayed = 0; // voluntarily put $ in pot
  let handsRaisedPreflop = 0;
  let totalWon = 0;
  let totalInvested = 0;
  let wentToShowdown = 0;
  let wonAtShowdown = 0;
  let foldedToAggression = 0;
  let calledWithWorstHand = 0;

  for (const hand of heroHands) {
    const pfActions = hand.heroActions.filter((a) => a.street === "preflop");
    const voluntaryAction = pfActions.some((a) =>
      ["call", "raise", "raise_allin", "bet"].includes(a.action)
    );
    if (voluntaryAction) handsPlayed++;

    if (pfActions.some((a) => ["raise", "raise_allin"].includes(a.action))) {
      handsRaisedPreflop++;
    }

    const heroInvested = hand.heroActions
      .filter((a) =>
        ["call", "bet", "raise", "call_allin", "bet_allin", "raise_allin", "small_blind", "big_blind"].includes(a.action)
      )
      .reduce((s, a) => s + (a.amount || 0), 0);

    totalInvested += heroInvested;
    totalWon += hand.heroWinAmount;

    // Showdown: hero had actions past the flop and didn't fold
    const foldAction = hand.heroActions.find((a) => a.action === "fold");
    const reachedShowdown = !foldAction && hand.heroActions.some((a) => a.street === "river" || a.street === "turn");
    if (reachedShowdown) {
      wentToShowdown++;
      if (hand.heroWon) wonAtShowdown++;
    }
  }

  const vpip = totalHands > 0 ? ((handsPlayed / totalHands) * 100).toFixed(1) : 0;
  const pfr = totalHands > 0 ? ((handsRaisedPreflop / totalHands) * 100).toFixed(1) : 0;
  const wtsd = wentToShowdown > 0 ? ((wonAtShowdown / wentToShowdown) * 100).toFixed(1) : 0;
  const netPnl = totalWon - totalInvested;

  return {
    totalHands,
    handsPlayed,
    vpip: parseFloat(vpip),
    pfr: parseFloat(pfr),
    wentToShowdown,
    wonAtShowdown,
    wtsd: parseFloat(wtsd),
    netPnl: parseFloat(netPnl.toFixed(2)),
    totalWon: parseFloat(totalWon.toFixed(2)),
    totalInvested: parseFloat(totalInvested.toFixed(2)),
  };
}

// ── Claude prompt builder ─────────────────────────────────────────────────────

function buildPrompt(heroName, heroHands, stats, sizingIssues, bigBlind) {
  // Summarize hands for Claude — keep token count manageable
  const handSummaries = heroHands.slice(0, 60).map((hand) => {
    const heroActionsStr = hand.heroActions
      .map((a) => {
        let str = `[${a.street}] ${a.action}`;
        if (a.amount) str += ` ${a.amount}`;
        if (a.sizingLabel && a.sizingLabel !== "unknown") str += ` (sizing: ${a.sizingLabel}, ${Math.round((a.sizingRatio || 0) * 100)}% pot)`;
        return str;
      })
      .join(" → ");

    return `Hand #${hand.handNumber}: pot=${hand.potSize} | hero_stack=${hand.heroStack} | board=[${hand.board.join(",")}] | hero_actions: ${heroActionsStr || "none"} | hero_won: ${hand.heroWon} (${hand.heroWinAmount})`;
  });

  const sizingIssuesSummary = sizingIssues
    .slice(0, 20)
    .map((i) => `Hand #${i.handNumber}: ${i.type} — ${i.description}`)
    .join("\n");

  return `You are an expert poker coach reviewing a player's session in the style of Chess.com's game review. Your job is to give a holistic, insightful review — not just hand-by-hand stats, but patterns, tendencies, and strategic leaks.

PLAYER: ${heroName}
BIG BLIND: ${bigBlind}
SESSION STATS:
- Total hands dealt: ${stats.totalHands}
- VPIP: ${stats.vpip}% (industry standard for 6-max: 22-28%, full ring: 15-20%)
- PFR: ${stats.pfr}% (healthy PFR/VPIP ratio is ~0.7-0.8)
- Went to showdown / won at showdown: ${stats.wentToShowdown} / ${stats.wonAtShowdown} (${stats.wtsd}% W$SD)
- Net P&L: ${stats.netPnl} chips

PRE-DETECTED SIZING ISSUES (${sizingIssues.length} total):
${sizingIssuesSummary || "None detected"}

HAND HISTORIES (up to 60 hands):
${handSummaries.join("\n")}

---

Please respond ONLY with a valid JSON object (no markdown, no explanation outside the JSON) in exactly this structure:

{
  "sessionScore": <integer 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "headline": <one punchy sentence summarizing the session, max 12 words>,
  "summary": <3-5 sentence narrative overview of the player's session, identifying the 2-3 biggest strategic themes>,
  "mistakes": [
    {
      "handNumber": <int>,
      "type": <"blunder"|"inaccuracy"|"missed_opportunity">,
      "category": <"sizing"|"call"|"fold"|"aggression"|"passivity"|"bluff"|"value">,
      "title": <short title, max 6 words>,
      "explanation": <2-3 sentence explanation of why this was a mistake and what the better play would be>,
      "severity": <1-3, where 3 is most severe>
    }
  ],
  "positives": [
    {
      "handNumber": <int or null if session-wide>,
      "title": <short title>,
      "explanation": <1-2 sentences>
    }
  ],
  "leaks": [
    {
      "leak": <name of the strategic leak>,
      "description": <2-3 sentence description of the pattern and how to fix it>
    }
  ],
  "coachingTip": <one actionable tip to focus on for next session, 1-2 sentences>
}

Focus on patterns across hands, not just individual spots. Be honest but constructive. The mistakes array should have 3-8 entries max — focus on the most impactful ones.`;
}

// ── Main analyze function ─────────────────────────────────────────────────────

async function analyzeSession(heroHands, heroName, bigBlind = 1) {
  const stats = buildSessionStats(heroHands, heroName);
  const sizingIssues = detectSizingIssues(heroHands, heroName, bigBlind);

  const prompt = buildPrompt(heroName, heroHands, stats, sizingIssues, bigBlind);

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content[0].text.trim();

  // Strip potential markdown code fences
  const jsonText = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let review;
  try {
    review = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e.message}\n\nRaw: ${rawText.slice(0, 500)}`);
  }

  // Merge in the rule-based sizing issues as inaccuracies (deduplicate with AI findings)
  const aiHandNumbers = new Set(review.mistakes.map((m) => m.handNumber));
  const additionalSizingMistakes = sizingIssues
    .filter((i) => !aiHandNumbers.has(i.handNumber))
    .slice(0, 5)
    .map((i) => ({
      handNumber: i.handNumber,
      type: "inaccuracy",
      category: "sizing",
      title: i.type.replace(/_/g, " "),
      explanation: i.description,
      severity: 1,
    }));

  review.mistakes = [...review.mistakes, ...additionalSizingMistakes];
  review.stats = stats;
  review.sizingIssuesCount = sizingIssues.length;

  return review;
}

module.exports = { analyzeSession, buildSessionStats, detectSizingIssues };
