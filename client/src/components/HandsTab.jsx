import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { fetchHands } from "../api.js";
import HandReplayer from "./HandReplayer.jsx";
import HandChat from "./HandChat.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────

const SUIT_SYM   = { h: "♥", d: "♦", c: "♣", s: "♠" };
const SUIT_COLOR = { h: "#e05555", d: "#e05555", c: "var(--text2)", s: "var(--text2)" };

const MISTAKE_META = {
  blunder:            { color: "var(--blunder)",    label: "Blunder"      },
  inaccuracy:         { color: "var(--inaccuracy)", label: "Inaccuracy"   },
  missed_opportunity: { color: "var(--missed)",     label: "Missed"       },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if hero voluntarily put chips in preflop (VPIP). */
function isVoluntaryPlay(hand) {
  return hand.heroActions?.some(a =>
    a.street === "preflop" &&
    ["call", "raise", "raise_allin", "bet", "bet_allin"].includes(a.action)
  ) ?? false;
}

/** Outcome dot color for the sidebar. */
function handOutcomeColor(hand) {
  const fold = hand.heroActions?.find(a => a.action === "fold");
  if (fold) return "var(--text3)";
  return hand.heroWon ? "var(--positive)" : "var(--blunder)";
}

// ── Mini card ─────────────────────────────────────────────────────────────────

function MiniCard({ card }) {
  const suit = card.slice(-1).toLowerCase();
  const rank = card.slice(0, -1).toUpperCase().replace("T", "10");
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: "11px",
      color: SUIT_COLOR[suit] || "var(--text2)", lineHeight: 1,
    }}>
      {rank}{SUIT_SYM[suit] || suit}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HandsTab({ sessionId, heroName, review }) {
  const [hands, setHands]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const selectedRef                 = useRef(null);

  // ── Mistake lookup: handNumber → array of mistakes ────────────────────────
  const mistakesByHand = {};
  const primaryByHand  = {};
  for (const m of (review?.mistakes || [])) {
    if (m.handNumber == null) continue;
    if (!mistakesByHand[m.handNumber]) mistakesByHand[m.handNumber] = [];
    mistakesByHand[m.handNumber].push(m);
  }
  for (const [num, arr] of Object.entries(mistakesByHand)) {
    primaryByHand[num] = arr.reduce(
      (best, m) => ((m.severity || 1) >= (best.severity || 1) ? m : best),
      arr[0]
    );
  }

  useEffect(() => {
    fetchHands(sessionId, heroName)
      .then(data => { setHands(data.hands); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, [sessionId, heroName]);

  // Auto-scroll sidebar to keep selected item in view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIdx]);

  const goPrev = useCallback(() => setCurrentIdx(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() =>
    setCurrentIdx(i => Math.min((hands?.length ?? 1) - 1, i + 1)),
    [hands]
  );
  const goNextPlayed = useCallback(() => {
    if (!hands) return;
    for (let i = currentIdx + 1; i < hands.length; i++) {
      if (isVoluntaryPlay(hands[i])) { setCurrentIdx(i); return; }
    }
  }, [hands, currentIdx]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return <div style={st.status}>Loading hands…</div>;
  if (error)   return <div style={{ ...st.status, color: "var(--blunder)" }}>{error}</div>;
  if (!hands?.length) return <div style={st.status}>No hands found.</div>;

  const currentHand   = hands[currentIdx];
  const hasNextPlayed = hands.slice(currentIdx + 1).some(isVoluntaryPlay);
  const primary       = primaryByHand[currentHand.handNumber];
  const mm            = primary ? (MISTAKE_META[primary.type] || MISTAKE_META.inaccuracy) : null;

  return (
    <div style={st.layout}>

      {/* ══════════ Col 1: Hand list sidebar ══════════ */}
      <aside style={st.sidebar}>
        <div style={st.sidebarHeader}>
          <span style={st.sidebarTitle}>HANDS</span>
          <span style={st.sidebarCount}>{hands.length}</span>
        </div>

        {/* Legend */}
        <div style={st.legend}>
          <div style={st.legendRow}>
            <span style={{ ...st.legendCircle, background: "var(--positive)" }} />
            <span style={st.legendLabel}>Won</span>
            <span style={{ ...st.legendCircle, background: "var(--blunder)" }} />
            <span style={st.legendLabel}>Lost</span>
            <span style={{ ...st.legendCircle, background: "var(--text3)" }} />
            <span style={st.legendLabel}>Folded</span>
          </div>
          <div style={st.legendRow}>
            {[
              { color: "var(--blunder)",    label: "Blunder"    },
              { color: "var(--inaccuracy)", label: "Inaccuracy" },
              { color: "var(--missed)",     label: "Missed Opp" },
            ].map(({ color, label }) => (
              <span key={label} style={st.legendPair}>
                <span style={{ ...st.legendTri, borderTopColor: color }} />
                <span style={{ ...st.legendLabel, marginRight: 0 }}>{label}</span>
              </span>
            ))}
          </div>
        </div>

        <div style={st.sidebarList}>
          {hands.map((hand, i) => {
            const hPrimary = primaryByHand[hand.handNumber];
            const hMm      = hPrimary
              ? (MISTAKE_META[hPrimary.type] || MISTAKE_META.inaccuracy)
              : null;
            const dotColor = handOutcomeColor(hand);
            const isActive = i === currentIdx;

            return (
              <button
                key={hand.handNumber}
                ref={isActive ? selectedRef : null}
                style={{
                  ...st.sidebarItem,
                  background: isActive ? "var(--surface2)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--gold)" : "3px solid transparent",
                }}
                onClick={() => setCurrentIdx(i)}
              >
                <span style={st.sidebarNum}>#{hand.handNumber}</span>
                <div style={st.sidebarCards}>
                  {hand.yourHand?.length
                    ? hand.yourHand.map((c, ci) => <MiniCard key={ci} card={c} />)
                    : <span style={st.sidebarDash}>—</span>
                  }
                </div>
                <div style={st.sidebarIndicators}>
                  {hMm && (
                    <span style={{
                      display: "inline-block",
                      width: 0, height: 0,
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderTop: `7px solid ${hMm.color}`,
                      flexShrink: 0,
                    }} />
                  )}
                  <span style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: dotColor, flexShrink: 0, display: "block",
                  }} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ══════════ Col 2: Nav + replayer ══════════ */}
      <div style={st.center}>

        <div style={st.navBar}>
          <button
            style={{ ...st.navBtn, opacity: currentIdx === 0 ? 0.35 : 1 }}
            disabled={currentIdx === 0}
            onClick={goPrev}
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          <div style={st.navCenter}>
            <span style={st.navHandNum}>Hand #{currentHand.handNumber}</span>
            {mm && <span style={{ ...st.navBadge, color: mm.color }}>{mm.label}</span>}
          </div>

          <div style={st.navRight}>
            {hasNextPlayed && (
              <button style={st.navBtn} onClick={goNextPlayed} title="Jump to next hand you voluntarily played">
                <SkipForward size={14} />
                Next Played
              </button>
            )}
            <button
              style={{ ...st.navBtn, opacity: currentIdx === hands.length - 1 ? 0.35 : 1 }}
              disabled={currentIdx === hands.length - 1}
              onClick={goNext}
            >
              Next Hand
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Hand replayer — `key` resets step counter on hand change */}
        <HandReplayer
          key={currentHand.handNumber}
          hand={currentHand}
          hero={heroName}
          flagged={mistakesByHand[currentHand.handNumber] || []}
          actionNotes={review?.actionNotes?.[currentHand.handNumber]}
        />
      </div>

      {/* ══════════ Col 3: Coach chat ══════════ */}
      <aside style={st.chatPanel}>
        <HandChat
          sessionId={sessionId}
          heroName={heroName}
          hand={currentHand}
          fillHeight
        />
      </aside>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = {
  status: {
    color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "13px",
    padding: "32px 0", textAlign: "center",
  },

  // Three-column shell. Fixed to viewport height — no page scroll needed.
  // Overhead: 24px page-top + ~57px topBar + 20px gap + ~41px tabBar + 20px gap + 16px page-bottom = 178px.
  layout: {
    display: "flex",
    margin: "0 -24px",
    height: "calc(100vh - 178px)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius2)",
    overflow: "hidden",
    background: "var(--bg2)",
  },

  // ── Col 1: hand list ──────────────────────────────────────────────────────
  sidebar: {
    width: "190px",
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px 10px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  sidebarTitle: {
    fontFamily: "var(--font-mono)", fontSize: "10px",
    textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)",
  },
  sidebarCount: {
    fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)",
    background: "var(--bg3)", borderRadius: "10px", padding: "1px 7px",
  },
  legend: {
    padding: "8px 10px",
    borderBottom: "1px solid var(--border)",
    display: "flex", flexDirection: "column", gap: "5px",
    flexShrink: 0,
  },
  legendRow: {
    display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
  },
  // Each triangle+label pair stays together and never splits across lines
  legendPair: {
    display: "inline-flex", alignItems: "center", gap: "3px",
    flexShrink: 0, whiteSpace: "nowrap",
  },
  // Circle for outcome dots in legend
  legendCircle: {
    width: "6px", height: "6px", borderRadius: "50%",
    flexShrink: 0, display: "inline-block",
  },
  // Downward triangle for mistake type indicators
  legendTri: {
    display: "inline-block",
    width: 0, height: 0,
    borderLeft: "4px solid transparent",
    borderRight: "4px solid transparent",
    borderTopWidth: "7px",
    borderTopStyle: "solid",
    flexShrink: 0,
  },
  legendLabel: {
    fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px",
  },
  // List fills remaining sidebar height and scrolls independently
  sidebarList: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  sidebarItem: {
    width: "100%", display: "flex", alignItems: "center", gap: "7px",
    padding: "7px 10px 7px 9px",
    border: "none", cursor: "pointer", transition: "background 0.1s", textAlign: "left",
  },
  sidebarNum: {
    fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text3)",
    minWidth: "28px", flexShrink: 0,
  },
  sidebarCards: {
    display: "flex", gap: "2px", flex: 1, overflow: "hidden", alignItems: "center",
  },
  sidebarDash: {
    fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)",
  },
  sidebarIndicators: {
    display: "flex", alignItems: "center", gap: "4px", flexShrink: 0,
  },

  // ── Col 2: nav + replayer ─────────────────────────────────────────────────
  // flex:1 takes remaining width; flex column so HandReplayer's wrapper fills height.
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "12px 14px",
    gap: "10px",
    minWidth: 0,
    overflow: "hidden",
  },
  navBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "10px", flexShrink: 0,
  },
  navBtn: {
    display: "flex", alignItems: "center", gap: "5px",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", color: "var(--text2)",
    padding: "7px 12px", fontSize: "12px", fontFamily: "var(--font-body)",
    cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s",
  },
  navCenter: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
  },
  navHandNum: {
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "17px", color: "var(--text)",
  },
  navBadge: {
    fontFamily: "var(--font-mono)", fontSize: "11px",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  navRight: {
    display: "flex", gap: "8px",
  },

  // ── Col 3: coach chat ─────────────────────────────────────────────────────
  chatPanel: {
    width: "280px",
    flexShrink: 0,
    borderLeft: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--surface)",
  },
};
