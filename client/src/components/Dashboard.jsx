import React, { useState } from "react";
import { RotateCcw, ChevronDown, ChevronUp, Star, AlertTriangle, Lightbulb } from "lucide-react";
import MistakeCard from "./MistakeCard.jsx";
import SizingBreakdown from "./SizingBreakdown.jsx";
import HandsTab from "./HandsTab.jsx";

const GRADE_COLORS = {
  "A+": "#45a876", A: "#45a876", "A-": "#5cb88a",
  "B+": "#7ec87a", B: "#7ec87a", "B-": "#a8c870",
  "C+": "#c8880c", C: "#c8880c", "C-": "#c87830",
  D: "#e07840", F: "#e05555",
};

function PokerChipRing({ score, grade }) {
  const innerR = 46;
  const outerR = 58;
  const cx = 65, cy = 65;
  const innerCirc = 2 * Math.PI * innerR;
  const filled = (score / 100) * innerCirc;
  const gradeColor = GRADE_COLORS[grade] || "var(--gold)";

  // Chip notch effect on the outer ring
  const outerCirc = 2 * Math.PI * outerR;
  const notches = 24;
  const notchLen = (outerCirc / notches) * 0.55;
  const notchGap = (outerCirc / notches) * 0.45;

  return (
    <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        {/* Chip outer edge notches */}
        <circle
          cx={cx} cy={cy} r={outerR}
          fill="none"
          stroke={gradeColor}
          strokeWidth="5"
          strokeOpacity="0.3"
          strokeDasharray={`${notchLen} ${notchGap}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* Progress track */}
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="var(--bg3)" strokeWidth="9" />
        {/* Progress fill */}
        <circle
          cx={cx} cy={cy} r={innerR}
          fill="none"
          stroke={gradeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${innerCirc}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 1.1s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "1px",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontWeight: 500,
          fontSize: "32px", lineHeight: 1, color: gradeColor,
          letterSpacing: "-0.02em",
        }}>{score}</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "12px",
          fontWeight: 400, color: gradeColor, opacity: 0.75,
          letterSpacing: "0.08em",
        }}>{grade}</span>
      </div>
    </div>
  );
}

export default function Dashboard({ analysisResult, sessionId, onReset }) {
  const { heroName, handCount, bigBlind, review } = analysisResult;
  const { sessionScore, grade, headline, summary, mistakes, positives, leaks, coachingTip, stats, sizingIssuesCount } = review;

  const [activeTab, setActiveTab] = useState("review");
  const [showPositives, setShowPositives] = useState(false);
  const [showLeaks, setShowLeaks] = useState(true);

  const flaggedCount = (mistakes || []).filter(m => m.handNumber != null).length;
  const blunders     = mistakes.filter((m) => m.type === "blunder");
  const inaccuracies = mistakes.filter((m) => m.type === "inaccuracy");
  const missed       = mistakes.filter((m) => m.type === "missed_opportunity");

  return (
    <div style={{ ...styles.page, ...(activeTab === "hands" ? { padding: "24px 24px 16px" } : {}) }}>
      <div style={{
        ...styles.container,
        maxWidth:      activeTab === "hands" ? "1140px" : "720px",
        paddingBottom: activeTab === "hands" ? 0 : "60px",
      }}>

        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.heroInfo}>
            <span style={styles.heroName}>{heroName}</span>
            <span style={styles.sessionMeta}>{handCount} hands · BB={bigBlind}</span>
          </div>
          <button style={styles.resetBtn} onClick={onReset}>
            <RotateCcw size={13} />
            New Session
          </button>
        </div>

        {/* Tab bar */}
        <div style={styles.tabBar}>
          {[
            { id: "review", label: "Session Review" },
            { id: "hands",  label: `Hands${flaggedCount > 0 ? ` (${flaggedCount} flagged)` : ""}` },
          ].map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tabBtn,
                color:        activeTab === tab.id ? "var(--text)"  : "var(--text3)",
                borderBottom: activeTab === tab.id ? "2px solid var(--gold)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "hands" && (
          <HandsTab sessionId={sessionId} heroName={heroName} review={review} />
        )}

        {activeTab === "review" && <>

        {/* Hero section */}
        <div style={styles.hero} className="fade-in">
          <PokerChipRing score={sessionScore} grade={grade} />
          <div style={styles.heroText}>
            <h1 style={styles.headline}>{headline}</h1>
            <p style={styles.summary}>{summary}</p>
          </div>
        </div>

        {/* Mistake counts */}
        <div style={styles.mistakeCounts}>
          {[
            { label: "Blunders",     count: blunders.length,     color: "var(--blunder)",    dim: "var(--blunder-dim)" },
            { label: "Inaccuracies", count: inaccuracies.length, color: "var(--inaccuracy)", dim: "var(--inaccuracy-dim)" },
            { label: "Missed",       count: missed.length,       color: "var(--missed)",     dim: "var(--missed-dim)" },
          ].map((item) => (
            <div key={item.label} style={{ ...styles.countCard, background: item.dim, border: `1px solid ${item.color}30` }}>
              <span style={{ ...styles.countNum, color: item.color }}>{item.count}</span>
              <span style={styles.countLabel}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <SizingBreakdown stats={stats} sizingIssuesCount={sizingIssuesCount} />

        {/* Mistakes feed — chess.com list style */}
        {mistakes.length > 0 && (
          <div style={styles.section}>
            <div style={styles.feedHeader}>
              <AlertTriangle size={14} color="var(--inaccuracy)" />
              <h3 style={styles.sectionTitle}>Mistakes & Inaccuracies</h3>
              <span style={styles.feedCount}>{mistakes.length}</span>
            </div>
            <div style={styles.feedPanel}>
              {mistakes
                .sort((a, b) => (b.severity || 1) - (a.severity || 1))
                .map((m, i) => (
                  <MistakeCard key={i} mistake={m} index={i} />
                ))}
            </div>
          </div>
        )}

        {/* Strategic leaks */}
        {leaks && leaks.length > 0 && (
          <div style={styles.section}>
            <button style={styles.toggleHeader} onClick={() => setShowLeaks(!showLeaks)}>
              <div style={styles.feedHeader}>
                <AlertTriangle size={14} color="var(--blunder)" />
                <h3 style={styles.sectionTitle}>Strategic Leaks</h3>
                <span style={styles.feedCount}>{leaks.length}</span>
              </div>
              {showLeaks ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
            </button>
            {showLeaks && (
              <div style={styles.leakList}>
                {leaks.map((leak, i) => (
                  <div key={i} style={styles.leakCard}>
                    <div style={styles.leakAccent} />
                    <div>
                      <div style={styles.leakTitle}>{leak.leak}</div>
                      <p style={styles.leakDesc}>{leak.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Positives */}
        {positives && positives.length > 0 && (
          <div style={styles.section}>
            <button style={styles.toggleHeader} onClick={() => setShowPositives(!showPositives)}>
              <div style={styles.feedHeader}>
                <Star size={14} color="var(--positive)" />
                <h3 style={styles.sectionTitle}>What You Did Well</h3>
                <span style={{ ...styles.feedCount, color: "var(--positive)", borderColor: "rgba(69,168,118,0.3)" }}>{positives.length}</span>
              </div>
              {showPositives ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
            </button>
            {showPositives && (
              <div style={styles.positiveList}>
                {positives.map((p, i) => (
                  <div key={i} style={styles.positiveCard}>
                    {p.handNumber && (
                      <span style={styles.posHandNum}>#{p.handNumber}</span>
                    )}
                    <div style={styles.posTitle}>{p.title}</div>
                    <p style={styles.posDesc}>{p.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Coaching tip */}
        {coachingTip && (
          <div style={styles.coachingTip}>
            <div style={styles.coachingHeader}>
              <Lightbulb size={14} color="var(--gold)" />
              <span style={styles.coachingLabel}>Focus for next session</span>
            </div>
            <p style={styles.coachingText}>{coachingTip}</p>
          </div>
        )}

        {/* Suit watermark footer */}
        <div style={styles.suitRow} aria-hidden>
          {["♠", "♥", "♦", "♣"].map(s => (
            <span key={s} style={styles.suitMark}>{s}</span>
          ))}
        </div>

        </>}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    display: "flex",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: "720px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    paddingBottom: "60px",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
  },
  tabBtn: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    padding: "10px 18px",
    fontSize: "13px",
    fontFamily: "var(--font-body)",
    marginBottom: "-1px",
    transition: "color 0.15s",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "8px",
  },
  heroInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  heroName: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "18px",
    color: "var(--text)",
  },
  sessionMeta: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text3)",
  },
  resetBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text2)",
    padding: "7px 12px",
    fontSize: "12px",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
  },
  hero: {
    display: "flex",
    gap: "24px",
    alignItems: "center",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius3)",
    padding: "24px",
  },
  heroText: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  headline: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "18px",
    color: "var(--text)",
    lineHeight: 1.3,
  },
  summary: {
    color: "var(--text2)",
    fontSize: "13px",
    lineHeight: 1.75,
  },
  mistakeCounts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
  },
  countCard: {
    borderRadius: "var(--radius2)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  countNum: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "28px",
    lineHeight: 1,
  },
  countLabel: {
    fontSize: "11px",
    color: "var(--text3)",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  feedHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "0",
  },
  sectionTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--text)",
  },
  feedCount: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text3)",
    border: "1px solid var(--border2)",
    borderRadius: "4px",
    padding: "1px 6px",
  },
  feedPanel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius2)",
    padding: "0 16px",
    marginTop: "10px",
  },
  toggleHeader: {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 0,
    width: "100%",
  },
  leakList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "10px",
  },
  leakCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "12px 14px",
    display: "flex",
    gap: "12px",
  },
  leakAccent: {
    width: "3px",
    borderRadius: "2px",
    background: "var(--blunder)",
    flexShrink: 0,
    opacity: 0.6,
  },
  leakTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "13px",
    color: "var(--text)",
    marginBottom: "4px",
  },
  leakDesc: {
    color: "var(--text2)",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  positiveList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "10px",
  },
  positiveCard: {
    background: "var(--positive-dim)",
    border: "1px solid rgba(69,168,118,0.18)",
    borderRadius: "var(--radius)",
    padding: "12px 14px",
  },
  posHandNum: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text3)",
    display: "block",
    marginBottom: "2px",
  },
  posTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "13px",
    color: "var(--positive)",
    marginBottom: "4px",
  },
  posDesc: {
    color: "var(--text2)",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  coachingTip: {
    background: "var(--gold-dim)",
    border: "1px solid rgba(200,136,12,0.22)",
    borderRadius: "var(--radius2)",
    padding: "16px 18px",
  },
  coachingHeader: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    marginBottom: "8px",
  },
  coachingLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--gold)",
  },
  coachingText: {
    color: "var(--text2)",
    fontSize: "14px",
    lineHeight: 1.75,
    fontStyle: "italic",
  },
  suitRow: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    paddingTop: "8px",
  },
  suitMark: {
    fontSize: "18px",
    color: "var(--text3)",
    opacity: 0.4,
  },
};
