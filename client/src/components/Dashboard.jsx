import React, { useState } from "react";
import { RotateCcw, ChevronDown, ChevronUp, Star, AlertTriangle, Lightbulb } from "lucide-react";
import MistakeCard from "./MistakeCard.jsx";
import SizingBreakdown from "./SizingBreakdown.jsx";
import HandsTab from "./HandsTab.jsx";

const GRADE_COLORS = {
  "A+": "#45a876", A: "#45a876", "A-": "#5cb88a",
  "B+": "#7ec87a", B: "#7ec87a", "B-": "#a8c870",
  "C+": "#c9a84c", C: "#c9a84c", "C-": "#c88840",
  D: "#e07840", F: "#e05555",
};

function ScoreRing({ score, grade }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  const gradeColor = GRADE_COLORS[grade] || "var(--gold)";

  return (
    <div style={styles.ringWrapper}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--bg3)" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke={gradeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div style={styles.ringInner}>
        <span style={{ ...styles.scoreNum, color: gradeColor }}>{score}</span>
        <span style={{ ...styles.gradeLabel, color: gradeColor }}>{grade}</span>
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

  const blunders = mistakes.filter((m) => m.type === "blunder");
  const inaccuracies = mistakes.filter((m) => m.type === "inaccuracy");
  const missed = mistakes.filter((m) => m.type === "missed_opportunity");

  return (
    <div style={styles.page}>
      <div style={styles.container}>

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
                color:       activeTab === tab.id ? "var(--text)"  : "var(--text3)",
                borderBottom: activeTab === tab.id ? "2px solid var(--gold)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hands tab */}
        {activeTab === "hands" && (
          <HandsTab sessionId={sessionId} heroName={heroName} review={review} />
        )}

        {/* Review tab content below — hidden when hands tab is active */}
        {activeTab === "review" && <>

        {/* Hero section */}
        <div style={styles.hero} className="fade-in">
          <ScoreRing score={sessionScore} grade={grade} />
          <div style={styles.heroText}>
            <h1 style={styles.headline}>{headline}</h1>
            <p style={styles.summary}>{summary}</p>
          </div>
        </div>

        {/* Mistake counts */}
        <div style={styles.mistakeCounts}>
          {[
            { label: "Blunders", count: blunders.length, color: "var(--blunder)", dim: "var(--blunder-dim)" },
            { label: "Inaccuracies", count: inaccuracies.length, color: "var(--inaccuracy)", dim: "var(--inaccuracy-dim)" },
            { label: "Missed", count: missed.length, color: "var(--missed)", dim: "var(--missed-dim)" },
          ].map((item) => (
            <div key={item.label} style={{ ...styles.countCard, background: item.dim, border: `1px solid ${item.color}22` }}>
              <span style={{ ...styles.countNum, color: item.color }}>{item.count}</span>
              <span style={styles.countLabel}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <SizingBreakdown stats={stats} sizingIssuesCount={sizingIssuesCount} />

        {/* Mistakes feed */}
        {mistakes.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <AlertTriangle size={15} color="var(--inaccuracy)" />
              Mistakes & Inaccuracies
            </h3>
            <div style={styles.mistakeList}>
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
              <h3 style={styles.sectionTitle}>
                <AlertTriangle size={15} color="var(--blunder)" />
                Strategic Leaks
              </h3>
              {showLeaks ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
            </button>
            {showLeaks && (
              <div style={styles.leakList}>
                {leaks.map((leak, i) => (
                  <div key={i} style={styles.leakCard}>
                    <div style={styles.leakTitle}>{leak.leak}</div>
                    <p style={styles.leakDesc}>{leak.description}</p>
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
              <h3 style={styles.sectionTitle}>
                <Star size={15} color="var(--positive)" />
                What You Did Well
              </h3>
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
              <Lightbulb size={15} color="var(--gold)" />
              <span style={styles.coachingLabel}>Focus for next session</span>
            </div>
            <p style={styles.coachingText}>{coachingTip}</p>
          </div>
        )}

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
    gap: "0",
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
  ringWrapper: {
    position: "relative",
    flexShrink: 0,
    width: "130px",
    height: "130px",
  },
  ringInner: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
  },
  scoreNum: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "30px",
    lineHeight: 1,
  },
  gradeLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "14px",
    fontWeight: 500,
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
    lineHeight: 1.7,
  },
  mistakeCounts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
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
    gap: "12px",
  },
  sectionTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    gap: "7px",
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
  mistakeList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  leakList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  leakCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid var(--blunder)",
    borderRadius: "var(--radius)",
    padding: "12px 14px",
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
    lineHeight: 1.6,
  },
  positiveList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  positiveCard: {
    background: "var(--positive-dim)",
    border: "1px solid rgba(69,168,118,0.2)",
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
    lineHeight: 1.6,
  },
  coachingTip: {
    background: "var(--gold-dim)",
    border: "1px solid rgba(201,168,76,0.25)",
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
    lineHeight: 1.7,
    fontStyle: "italic",
  },
};
