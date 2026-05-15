import React, { useState, useEffect, useCallback } from "react";
import { SkipBack, AlertTriangle, TrendingUp } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const SUIT_SYM   = { h: "♥", d: "♦", c: "♣", s: "♠" };
const SUIT_COLOR = { h: "#c0392b", d: "#c0392b", c: "#111", s: "#111" };
const INVESTING  = new Set(["small_blind","big_blind","call","bet","raise","call_allin","bet_allin","raise_allin"]);
const STREETS    = ["preflop","flop","turn","river"];
const STREET_LABEL = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };

const MISTAKE_META = {
  blunder:            { color: "#e05555", bg: "rgba(224,85,85,0.12)", label: "Blunder"          },
  inaccuracy:         { color: "#e09a2a", bg: "rgba(224,154,42,0.12)", label: "Inaccuracy"       },
  missed_opportunity: { color: "#5a8ae0", bg: "rgba(90,138,224,0.12)", label: "Missed Opportunity" },
};

// Per-action quality badges (Chess.com-style)
const ACTION_QUALITY = {
  brilliant:  { color: "#4bc8be", bg: "rgba(75,200,190,0.10)",  label: "Brilliant",   icon: "✦"  },
  best:       { color: "#5db55d", bg: "rgba(93,181,93,0.10)",   label: "Best",        icon: "!!" },
  good:       { color: "#7aaa6a", bg: "rgba(122,170,106,0.08)", label: "Good",        icon: "!"  },
  inaccuracy: { color: "#e8c84a", bg: "rgba(232,200,74,0.10)",  label: "Inaccuracy",  icon: "?!" },
  mistake:    { color: "#e8964a", bg: "rgba(232,150,74,0.10)",  label: "Mistake",     icon: "?"  },
  blunder:    { color: "#e05555", bg: "rgba(224,85,85,0.10)",   label: "Blunder",     icon: "??" },
};

const FORCED_ACTIONS = new Set(["small_blind", "big_blind"]);

// Table geometry — all percentages of the container
const TX = 50;   // center x
const TY = 46;   // center y (slightly above midpoint to leave room at bottom)
const RX = 36;   // oval half-width
const RY = 25;   // oval half-height

// ── Seat position helpers ─────────────────────────────────────────────────────

// seatIndex 0 = hero (bottom). Others go counterclockwise from hero's perspective.
function seatPos(i, n) {
  const a = Math.PI / 2 + (i / n) * 2 * Math.PI;
  return {
    left: `${TX + RX * Math.cos(a)}%`,
    top:  `${TY + RY * 1.28 * Math.sin(a)}%`,
  };
}

function chipPos(i, n) {
  const a = Math.PI / 2 + (i / n) * 2 * Math.PI;
  return {
    left: `${TX + RX * 0.62 * Math.cos(a)}%`,
    top:  `${TY + RY * 0.62 * Math.sin(a)}%`,
  };
}

// ── Action formatting ─────────────────────────────────────────────────────────

function shortLabel(a) {
  switch (a.action) {
    case "small_blind":  return `SB ${a.amount}`;
    case "big_blind":    return `BB ${a.amount}`;
    case "fold":         return "FOLD";
    case "check":        return "CHECK";
    case "call":         return `CALL ${a.amount}`;
    case "call_allin":   return `ALL IN ${a.amount}`;
    case "bet":          return `BET ${a.amount}`;
    case "bet_allin":    return `ALL IN ${a.amount}`;
    case "raise":        return `RAISE ${a.amount}`;
    case "raise_allin":  return `ALL IN ${a.amount}`;
    default:             return a.action.toUpperCase();
  }
}

function longDesc(a, isHero) {
  const who = isHero ? "You" : a.player;
  switch (a.action) {
    case "small_blind":  return `${who} post${isHero ? "" : "s"} small blind (${a.amount})`;
    case "big_blind":    return `${who} post${isHero ? "" : "s"} big blind (${a.amount})`;
    case "fold":         return `${who} fold${isHero ? "" : "s"}`;
    case "check":        return `${who} check${isHero ? "" : "s"}`;
    case "call":         return `${who} call${isHero ? "" : "s"} ${a.amount}`;
    case "call_allin":   return `${who} call${isHero ? "" : "s"} ${a.amount} and ${isHero ? "are" : "is"} all-in`;
    case "bet":          return `${who} bet${isHero ? "" : "s"} ${a.amount}`;
    case "bet_allin":    return `${who} bet${isHero ? "" : "s"} ${a.amount} and ${isHero ? "are" : "is"} all-in`;
    case "raise":        return `${who} raise${isHero ? "" : "s"} to ${a.amount}`;
    case "raise_allin":  return `${who} raise${isHero ? "" : "s"} to ${a.amount} and ${isHero ? "are" : "is"} all-in`;
    default:             return `${who} ${a.action}`;
  }
}

// ── Step builder ──────────────────────────────────────────────────────────────

function buildSteps(hand, heroName) {
  if (!hand?.streets) return [];

  const boardAt = {
    preflop: [],
    flop:    (hand.board ?? []).slice(0, 3),
    turn:    (hand.board ?? []).slice(0, 4),
    river:   (hand.board ?? []).slice(0, 5),
  };

  const playerStatus = {};
  hand.players.forEach(p => { playerStatus[p] = "active"; });

  const steps = [];
  let pot = 0;
  const log = [];
  let streetBets    = {};
  let actionLabels  = {};
  let heroActionIdx = 0; // running count of hero actions seen, for actionNotes lookup

  for (const street of STREETS) {
    const actions = hand.streets[street] ?? [];

    if (street !== "preflop") {
      // Always emit a street-reveal step when new cards appeared on the board,
      // regardless of whether there are actions (catches hands where all players
      // checked silently or where street data was mis-attributed by the parser).
      const prevStreet   = STREETS[STREETS.indexOf(street) - 1];
      const prevBoardLen = boardAt[prevStreet]?.length ?? 0;
      const boardExpanded = boardAt[street].length > prevBoardLen;

      if (!boardExpanded && actions.length === 0) continue;

      streetBets   = {};
      actionLabels = {};
      steps.push({ type: "street", street, board: boardAt[street], pot, playerStatus: { ...playerStatus }, streetBets: {}, actionLabels: {}, action: null, log: [...log] });
    }

    for (const action of actions) {
      const { player } = action;
      // PokerNow "calls X" = total to match, not additional chips.
      // Subtract what the player already has in this street to get the real contribution.
      const prevContrib = streetBets[player] ?? 0;
      const additional  = Math.max(0, (action.amount ?? 0) - prevContrib);
      if (INVESTING.has(action.action)) pot += additional;

      if (action.action === "fold") playerStatus[player] = "folded";
      if (["call_allin","bet_allin","raise_allin"].includes(action.action)) playerStatus[player] = "allin";

      if (INVESTING.has(action.action)) {
        streetBets[player] = action.amount ?? 0; // track total contribution this street
      }

      actionLabels[player] = shortLabel(action);

      const isHeroAction = player === heroName;
      const thisHeroIdx  = isHeroAction ? heroActionIdx : -1;
      if (isHeroAction) heroActionIdx++;

      const entry = { ...action, potAfter: pot };
      log.push(entry);

      steps.push({
        type: "action",
        street,
        board: boardAt[street],
        pot,
        playerStatus: { ...playerStatus },
        streetBets:   { ...streetBets },
        actionLabels: { ...actionLabels },
        action: entry,
        log:    [...log],
        heroActionIdx: thisHeroIdx,
      });
    }
  }

  // Result step
  const resultLabels = {};
  (hand.winners ?? []).forEach(w => { resultLabels[w.player] = `+${w.amount}`; });
  steps.push({
    type: "result",
    street: "river",
    board:  hand.board ?? [],
    pot,
    playerStatus: { ...playerStatus },
    streetBets: {},
    actionLabels: resultLabels,
    action: null,
    log: [...log],
    winners: hand.winners ?? [],
  });

  return steps;
}

// ── Card components ───────────────────────────────────────────────────────────

function CardFace({ card, size = "sm" }) {
  const suit = card.slice(-1).toLowerCase();
  const rank = card.slice(0, -1).toUpperCase().replace("T", "10");
  const lg = size === "lg";
  return (
    <div style={{
      background: "#f5f0e8", border: "1px solid #bbb",
      borderRadius: lg ? "6px" : "4px",
      width: lg ? "44px" : "30px", height: lg ? "60px" : "42px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontWeight: 800,
      fontSize: lg ? "16px" : "12px", color: SUIT_COLOR[suit] || "#111",
      fontFamily: "var(--font-display)", lineHeight: 1, gap: "2px", flexShrink: 0,
    }}>
      <span>{rank}</span>
      <span style={{ fontSize: lg ? "13px" : "11px" }}>{SUIT_SYM[suit] || suit}</span>
    </div>
  );
}

function CardBack({ size = "sm" }) {
  const lg = size === "lg";
  return (
    <div style={{
      background: "linear-gradient(135deg, #1c2a4a 25%, #2a3a5a 100%)",
      border: "1px solid #3a4a6a", borderRadius: lg ? "6px" : "4px",
      width: lg ? "44px" : "30px", height: lg ? "60px" : "42px", flexShrink: 0,
    }} />
  );
}

// ── Player seat ───────────────────────────────────────────────────────────────

function Seat({ player, seatIndex, n, isHero, step, hand, mistakes }) {
  const pos    = seatPos(seatIndex, n);
  const cPos   = chipPos(seatIndex, n);
  const status = step.playerStatus[player] ?? "active";
  const isFolded      = status === "folded";
  const isAllin       = status === "allin";
  const isActor       = step.action?.player === player;
  const activeMistake = isActor && isHero
    ? (mistakes.find(m => !m.street || step.street === m.street) ?? null)
    : null;
  const isMistake     = !!activeMistake;
  const mm            = isMistake ? (MISTAKE_META[activeMistake.type] ?? MISTAKE_META.inaccuracy) : null;
  const label        = step.actionLabels[player];
  const chipAmt      = step.streetBets[player];
  const isWinner     = step.type === "result" && step.winners?.some(w => w.player === player);

  // Cards to show:
  //  - Hero: always show hole cards if known from CSV ("Your hand is ...")
  //  - Others: reveal at showdown if PokerNow logged a "showed" entry
  const shownAtShowdown = hand.shows?.find(s => s.player === player);
  let cards = null;
  if (isHero && hand.yourHand?.length) {
    cards = hand.yourHand;
  } else if (shownAtShowdown && step.type === "result") {
    cards = shownAtShowdown.cards;
  }

  const borderColor = isMistake   ? mm.color
                    : isWinner    ? "var(--positive)"
                    : isActor     ? "var(--gold)"
                    : isFolded    ? "transparent"
                    : "rgba(255,255,255,0.12)";

  const bgColor = isMistake ? mm.bg
                : isActor   ? "rgba(201,168,76,0.1)"
                : "rgba(10,10,15,0.82)";

  return (
    <>
      {/* Chip amount */}
      {chipAmt > 0 && !isFolded && (
        <div style={{
          position: "absolute", ...cPos,
          transform: "translate(-50%,-50%)",
          background: "#c9a84c", color: "#0a0a0f",
          fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "12px",
          borderRadius: "10px", padding: "2px 8px",
          zIndex: 3, whiteSpace: "nowrap",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}>
          {chipAmt}
        </div>
      )}

      {/* Seat box */}
      <div style={{
        position: "absolute", ...pos,
        transform: "translate(-50%,-50%)",
        width: "130px",
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "8px 10px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
        opacity: isFolded ? 0.35 : 1,
        transition: "border-color 0.2s, background 0.2s, opacity 0.2s",
        zIndex: 4,
        backdropFilter: "blur(6px)",
      }}>
        {/* Name */}
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: isHero ? 700 : 400,
          color: isHero ? "#f0cc6e" : "var(--text)",
          maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {isHero ? "You" : player.split(" ")[0].slice(0, 11)}
        </span>

        {/* Cards */}
        {!isFolded && (
          <div style={{ display: "flex", gap: "3px" }}>
            {cards
              ? cards.map((c, i) => <CardFace key={i} card={c} />)
              : <><CardBack /><CardBack /></>
            }
          </div>
        )}

        {/* Stack */}
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.35)",
        }}>
          {(hand.stacks[player] ?? 0).toLocaleString()}
        </span>

        {/* Action / result label */}
        {label && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
            color: isWinner ? "var(--positive)"
                 : isActor  ? (isHero ? "#f0cc6e" : "var(--text2)")
                 : "rgba(255,255,255,0.3)",
            textAlign: "center",
          }}>
            {label}
          </span>
        )}

        {/* All-in badge */}
        {isAllin && !isFolded && (
          <span style={{
            background: "rgba(224,85,85,0.2)", color: "#e05555",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: "3px", fontFamily: "var(--font-mono)",
            fontSize: "8px", padding: "1px 5px",
          }}>ALL IN</span>
        )}
      </div>
    </>
  );
}

// ── Community cards ───────────────────────────────────────────────────────────

function CommunityCards({ board }) {
  const slots = [0, 1, 2, 3, 4];
  return (
    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
      {slots.map(i =>
        board[i]
          ? <CardFace key={i} card={board[i]} size="lg" />
          : <div key={i} style={{
              width: "32px", height: "44px",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: "5px", flexShrink: 0,
            }} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HandReplayer({ hand, hero, flagged, actionNotes }) {
  const [idx, setIdx] = useState(0);
  const steps = buildSteps(hand, hero);

  const prev  = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next  = useCallback(() => setIdx(i => Math.min(steps.length - 1, i + 1)), [steps.length]);
  const reset = useCallback(() => setIdx(0), []);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [prev, next]);

  if (steps.length === 0) {
    return (
      <div style={{ padding: "24px", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "12px", textAlign: "center" }}>
        No hand action data available.
      </div>
    );
  }

  const step     = steps[idx];
  const isHeroAct = step.action?.player === hero;

  // Normalise: flagged may be a single object (legacy) or an array (multi-street mistakes).
  const mistakes = Array.isArray(flagged) ? flagged : (flagged ? [flagged] : []);

  // Which mistake applies to the current step?  Match on street if the AI provided one.
  const activeMistake = isHeroAct
    ? (mistakes.find(m => !m.street || step.street === m.street) ?? null)
    : null;

  // At the result step show the highest-severity mistake as a recap.
  const resultMistake = step.type === "result" && mistakes.length > 0
    ? mistakes.reduce((best, m) => ((m.severity || 1) >= (best.severity || 1) ? m : best), mistakes[0])
    : null;

  const displayMistake = activeMistake ?? resultMistake;
  const isMistake      = !!activeMistake;
  const mm             = displayMistake
    ? (MISTAKE_META[displayMistake.type] ?? MISTAKE_META.inaccuracy)
    : null;

  // Per-action note from the Haiku classifier (skipped for forced blinds)
  const actionNote = isHeroAct && step.heroActionIdx >= 0 && !FORCED_ACTIONS.has(step.action?.action)
    ? (actionNotes?.[step.heroActionIdx] ?? null)
    : null;
  const aqm = actionNote ? (ACTION_QUALITY[actionNote.quality] ?? ACTION_QUALITY.good) : null;

  // Rotate hand.players so hero is at index 0 while preserving the original
  // clockwise seat order. This keeps adjacent seats visually adjacent.
  const heroIdx = hand.players.indexOf(hero);
  const orderedPlayers = heroIdx === -1
    ? [hero, ...hand.players]
    : Array.from({ length: hand.players.length }, (_, i) => hand.players[(heroIdx + i) % hand.players.length]);
  const n = orderedPlayers.length;

  return (
    <div style={styles.wrapper}>

      {/* ── Oval poker table ── */}
      <div style={styles.tableWrap}>
        {/* Felt */}
        <div style={styles.felt} />

        {/* Community cards + pot (centered on table) */}
        <div style={styles.centerArea}>
          <CommunityCards board={step.board} />
          <div style={styles.potArea}>
            <span style={styles.potLabel}>POT</span>
            <span style={styles.potAmt}>{Number(step.pot.toFixed(2))}</span>
          </div>
        </div>

        {/* Street badge */}
        <div style={styles.streetBadge}>
          {step.type === "result"  ? "Showdown"
         : step.type === "street" ? `${STREET_LABEL[step.street]} dealt`
         : STREET_LABEL[step.street]}
        </div>

        {/* Step counter */}
        <div style={styles.stepCounter}>{idx + 1} / {steps.length}</div>

        {/* Player seats */}
        {orderedPlayers.map((player, i) => (
          <Seat
            key={player}
            player={player}
            seatIndex={i}
            n={n}
            isHero={player === hero}
            step={step}
            hand={hand}
            mistakes={mistakes}
          />
        ))}
      </div>

      {/* ── Action narrative ── */}
      <div style={styles.narrativeArea}>
        {step.type === "action" && (
          <div style={{
            ...styles.narrative,
            borderColor: aqm ? aqm.color : (isMistake ? mm?.color : "var(--border)"),
            background:  aqm ? aqm.bg    : (isMistake ? mm?.bg    : "var(--surface)"),
            flexDirection: "column", alignItems: "flex-start", gap: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", width: "100%" }}>
              <span style={{ fontWeight: 700, color: isHeroAct ? "var(--gold2)" : "var(--text)" }}>
                {isHeroAct ? "You" : step.action.player}
              </span>
              <span style={{ color: "var(--text2)" }}>{longDesc(step.action, isHeroAct).split(" ").slice(1).join(" ")}</span>
              {aqm && (
                <span style={{ ...styles.mistakeBadge, color: aqm.color, background: aqm.color + "22", border: `1px solid ${aqm.color}44`, marginLeft: "auto" }}>
                  {aqm.icon} {aqm.label}
                </span>
              )}
              {!aqm && isMistake && (
                <span style={{ ...styles.mistakeBadge, color: mm.color, background: mm.color + "22", border: `1px solid ${mm.color}44`, marginLeft: "auto" }}>
                  {mm.label}
                </span>
              )}
            </div>
            {actionNote?.note && (
              <span style={{ fontSize: "12px", color: "var(--text2)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
                {actionNote.note}
              </span>
            )}
          </div>
        )}

        {step.type === "street" && (
          <div style={styles.streetReveal}>
            {STREET_LABEL[step.street]} — new cards dealt
          </div>
        )}

        {step.type === "result" && (
          <div style={styles.resultRow}>
            {step.winners.map((w, i) => (
              <span key={i} style={{ color: w.player === hero ? "var(--positive)" : "var(--text2)", fontSize: "13px" }}>
                {w.player === hero ? "You" : w.player} collected {w.amount}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Mistake coaching panel ──
           Show when:  the action is flagged AND (no per-action note, or the note also flags a problem)
           Always show at the result/showdown step as a recap.
           Suppress when the per-action note already says "good/best/brilliant" — the two panels
           would conflict when they refer to different actions on the same street.        ── */}
      {!!mm && !!displayMistake && (isMistake || step.type === "result") &&
       (step.type === "result" || !actionNote || ["inaccuracy","mistake","blunder"].includes(actionNote.quality)) && (
        <div style={{ ...styles.mistakePanel, borderColor: mm.color, background: mm.bg }}>
          <div style={styles.mistakePanelHead}>
            <AlertTriangle size={13} color={mm.color} />
            <span style={{ color: mm.color, fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {mm.label} — {displayMistake.title ?? displayMistake.category ?? ""}
            </span>
          </div>
          <p style={styles.mistakeText}>{displayMistake.explanation || displayMistake.description}</p>
          <div style={styles.coachingRow}>
            <TrendingUp size={12} color="var(--gold)" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--gold)", letterSpacing: "0.04em" }}>
              Focus: identify what the better play would be given the board and betting action.
            </span>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={styles.controls}>
        <button style={styles.ctrlBtn} onClick={reset} disabled={idx === 0} title="Restart">
          <SkipBack size={13} />
        </button>
        <button style={{ ...styles.ctrlBtn, minWidth: "80px" }} onClick={prev} disabled={idx === 0}>
          ← Prev
        </button>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
        <button style={{ ...styles.ctrlBtn, minWidth: "80px" }} onClick={next} disabled={idx === steps.length - 1}>
          Next →
        </button>
      </div>
      <p style={styles.keyHint}>← → arrow keys</p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    display: "flex", flexDirection: "column", gap: "10px",
    marginTop: "2px",
  },

  // Table uses padding-bottom trick for a responsive fixed-aspect container
  tableWrap: {
    position: "relative",
    width: "100%",
    paddingBottom: "72%",   // height = 72% of width — tall enough to fit larger seats
    background: "var(--bg3)",
    borderRadius: "var(--radius2)",
    overflow: "hidden",
    border: "1px solid var(--border)",
  },

  felt: {
    position: "absolute",
    left: `${TX - RX}%`,
    top:  `${TY - RY * 1.28}%`,
    width: `${RX * 2}%`,
    height: `${RY * 2 * 1.28}%`,
    borderRadius: "50%",
    background: "radial-gradient(ellipse at 40% 35%, #1e5c38 0%, #0f3520 60%, #0a2518 100%)",
    boxShadow: "0 0 0 6px #1a1008, 0 0 0 9px rgba(0,0,0,0.5), inset 0 0 50px rgba(0,0,0,0.35)",
  },

  centerArea: {
    position: "absolute",
    left: "50%", top: `${TY}%`,
    transform: "translate(-50%, -50%)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
    zIndex: 2,
  },

  potArea: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1px",
  },
  potLabel: {
    fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
  },
  potAmt: {
    fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "20px",
    color: "#f0cc6e",
  },

  streetBadge: {
    position: "absolute", left: "12px", top: "10px",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "11px",
    color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.07em",
    zIndex: 5,
  },
  stepCounter: {
    position: "absolute", right: "12px", top: "10px",
    fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)",
    zIndex: 5,
  },

  narrativeArea: {
    minHeight: "36px",
  },
  narrative: {
    padding: "10px 14px", borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px",
    fontSize: "14px",
  },
  mistakeBadge: {
    borderRadius: "4px", padding: "2px 8px", fontSize: "11px",
    fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em",
  },
  streetReveal: {
    textAlign: "center", padding: "10px",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "12px",
    color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em",
    borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
  },
  resultRow: {
    padding: "10px 14px", background: "var(--surface)",
    borderRadius: "var(--radius)", border: "1px solid var(--border)",
    display: "flex", flexDirection: "column", gap: "4px",
  },

  mistakePanel: {
    border: "1px solid", borderRadius: "var(--radius2)", padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  mistakePanelHead: {
    display: "flex", alignItems: "center", gap: "8px",
  },
  mistakeText: {
    fontSize: "13px", color: "var(--text2)", lineHeight: 1.7, margin: 0,
  },
  coachingRow: {
    display: "flex", alignItems: "flex-start", gap: "6px",
    paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)",
  },

  controls: {
    display: "flex", alignItems: "center", gap: "8px",
  },
  ctrlBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", color: "var(--text2)",
    padding: "8px 12px", fontSize: "13px", fontFamily: "var(--font-body)",
    cursor: "pointer", flexShrink: 0,
  },
  progressTrack: {
    flex: 1, height: "3px", background: "var(--bg3)",
    borderRadius: "2px", overflow: "hidden",
  },
  progressFill: {
    height: "100%", background: "var(--gold)",
    borderRadius: "2px", transition: "width 0.2s ease",
  },
  keyHint: {
    fontFamily: "var(--font-mono)", fontSize: "11px",
    color: "var(--text3)", textAlign: "center",
  },
};
