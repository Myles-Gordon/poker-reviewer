import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { fetchHands } from "../api.js";
import HandReplayer from "./HandReplayer.jsx";

const MISTAKE_META = {
  blunder:            { color: "var(--blunder)",    dim: "var(--blunder-dim)",    label: "Blunder"      },
  inaccuracy:         { color: "var(--inaccuracy)", dim: "var(--inaccuracy-dim)", label: "Inaccuracy"   },
  missed_opportunity: { color: "var(--missed)",     dim: "var(--missed-dim)",     label: "Missed"       },
};

const STREET_LABEL = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };

function handOutcome(hand) {
  const fold = hand.heroActions?.find(a => a.action === "fold");
  if (fold) return { label: `Folded ${STREET_LABEL[fold.street] ?? fold.street}`, color: "var(--text3)" };
  if (hand.heroWon) {
    const atShowdown = hand.shows?.length > 0;
    return { label: atShowdown ? "Won at showdown" : "Won uncontested", color: "var(--positive)" };
  }
  return { label: "Lost at showdown", color: "var(--inaccuracy)" };
}

function MiniCards({ cards }) {
  if (!cards?.length) return <span style={styles.noBoard}>—</span>;
  return (
    <div style={styles.miniBoard}>
      {cards.map((card, i) => {
        const suit = card.slice(-1).toLowerCase();
        const rank = card.slice(0, -1).toUpperCase();
        return (
          <span key={i} style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            {rank}{({ h: "♥", d: "♦", c: "♣", s: "♠" }[suit] || suit)}
          </span>
        );
      })}
    </div>
  );
}

export default function HandsTab({ sessionId, heroName, review }) {
  const [hands, setHands]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [openHand, setOpenHand] = useState(null);
  const handRefs = useRef({});

  // Build mistake lookup by hand number — a hand can have multiple mistakes (one per street).
  const mistakesByHand = {};    // handNumber → array of mistakes
  const primaryByHand  = {};    // handNumber → most severe single mistake (for display)
  for (const m of (review?.mistakes || [])) {
    if (m.handNumber == null) continue;
    if (!mistakesByHand[m.handNumber]) mistakesByHand[m.handNumber] = [];
    mistakesByHand[m.handNumber].push(m);
  }
  for (const [num, arr] of Object.entries(mistakesByHand)) {
    primaryByHand[num] = arr.reduce(
      (best, m) => ((m.severity || 1) >= (best.severity || 1) ? m : best), arr[0]
    );
  }

  useEffect(() => {
    fetchHands(sessionId, heroName)
      .then(data => { setHands(data.hands); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, [sessionId, heroName]);

  const jumpToHand = useCallback((handNumber) => {
    setOpenHand(handNumber);
    setTimeout(() => {
      handRefs.current[handNumber]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  if (loading) return <div style={styles.status}>Loading hands…</div>;
  if (error)   return <div style={{ ...styles.status, color: "var(--blunder)" }}>{error}</div>;
  if (!hands?.length) return <div style={styles.status}>No hands found.</div>;

  const keyHands = hands.filter(h => primaryByHand[h.handNumber])
    .sort((a, b) => (primaryByHand[b.handNumber]?.severity || 1) - (primaryByHand[a.handNumber]?.severity || 1));

  return (
    <div style={styles.tab}>

      {/* Key hands */}
      {keyHands.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <AlertTriangle size={15} color="var(--inaccuracy)" />
            Key Hands — Review These First
          </h3>
          <div style={styles.keyScroll}>
            {keyHands.map(h => {
              const m    = primaryByHand[h.handNumber];
              const meta = MISTAKE_META[m.type] || MISTAKE_META.inaccuracy;
              return (
                <button
                  key={h.handNumber}
                  style={{ ...styles.keyCard, background: meta.dim, border: `1px solid ${meta.color}44` }}
                  onClick={() => jumpToHand(h.handNumber)}
                >
                  <span style={{ ...styles.keyType, color: meta.color }}>{meta.label}</span>
                  <span style={styles.keyNum}>#{h.handNumber}</span>
                  <p style={styles.keyDesc}>{m.explanation || m.description}</p>
                  <span style={styles.keyPot}>Pot: {h.potSize}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* All hands */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>All Hands ({hands.length})</h3>
        <div style={styles.handList}>
          {hands.map(hand => {
            const primary = primaryByHand[hand.handNumber];
            const isOpen  = openHand === hand.handNumber;
            const meta    = primary ? (MISTAKE_META[primary.type] || MISTAKE_META.inaccuracy) : null;

            return (
              <div
                key={hand.handNumber}
                ref={el => { handRefs.current[hand.handNumber] = el; }}
                style={styles.handRow}
              >
                <button
                  style={{ ...styles.handHeader, background: isOpen ? "var(--surface2)" : "var(--surface)" }}
                  onClick={() => setOpenHand(isOpen ? null : hand.handNumber)}
                >
                  <span style={styles.handNum}>#{hand.handNumber}</span>
                  <MiniCards cards={hand.yourHand} />
                  <div style={styles.tags}>
                    {meta && (
                      <span style={{ ...styles.tag, color: meta.color, background: meta.dim }}>
                        {meta.label}
                      </span>
                    )}
                    {(() => { const o = handOutcome(hand); return (
                      <span style={{ ...styles.tag, color: o.color }}>{o.label}</span>
                    ); })()}
                  </div>
                  <span style={styles.potLabel}>Pot {hand.potSize}</span>
                  {isOpen
                    ? <ChevronUp size={14} color="var(--text3)" />
                    : <ChevronDown size={14} color="var(--text3)" />
                  }
                </button>

                {isOpen && (
                  <HandReplayer
                    hand={hand}
                    hero={heroName}
                    flagged={mistakesByHand[hand.handNumber] || []}
                    actionNotes={review?.actionNotes?.[hand.handNumber]}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  tab:          { display: "flex", flexDirection: "column", gap: "24px" },
  status:       { color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "13px", padding: "32px 0", textAlign: "center" },
  section:      { display: "flex", flexDirection: "column", gap: "12px" },
  sectionTitle: {
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "15px",
    color: "var(--text)", display: "flex", alignItems: "center", gap: "7px",
  },

  /* Key hand cards */
  keyScroll:  { display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" },
  keyCard: {
    flexShrink: 0, width: "200px", borderRadius: "var(--radius2)",
    padding: "14px", cursor: "pointer", textAlign: "left",
    display: "flex", flexDirection: "column", gap: "6px",
    transition: "opacity 0.15s",
  },
  keyType: { fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" },
  keyNum:  { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "20px", color: "var(--text)" },
  keyDesc: {
    fontSize: "12px", color: "var(--text2)", lineHeight: 1.4,
    overflow: "hidden", display: "-webkit-box",
    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
  },
  keyPot: { fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)", marginTop: "4px" },

  /* All-hands list */
  handList:   { display: "flex", flexDirection: "column", gap: "4px" },
  handRow:    { borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)" },
  handHeader: {
    width: "100%", display: "flex", alignItems: "center", gap: "12px",
    padding: "9px 14px", border: "none", cursor: "pointer", transition: "background 0.12s",
  },
  handNum: { fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text3)", minWidth: "38px", flexShrink: 0 },
  miniBoard: { display: "flex", gap: "4px", flex: 1, flexWrap: "wrap" },
  noBoard:   { flex: 1, fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)" },
  tags:      { display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 },
  tag:       { borderRadius: "4px", padding: "2px 7px", fontSize: "11px", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" },
  potLabel:  { fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)", flexShrink: 0 },
};
