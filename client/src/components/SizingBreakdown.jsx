import React from "react";
import { TrendingUp } from "lucide-react";

const STAT_INFO = {
  vpip: {
    label: "VPIP",
    desc: "Voluntarily Put $ In Pot",
    good: [22, 32],
    unit: "%",
  },
  pfr: {
    label: "PFR",
    desc: "Preflop Raise %",
    good: [16, 26],
    unit: "%",
  },
  wtsd: {
    label: "W$SD",
    desc: "Won $ at Showdown",
    good: [50, 60],
    unit: "%",
  },
};

function StatBar({ statKey, value }) {
  const info = STAT_INFO[statKey];
  if (!info || value === undefined) return null;

  const [lo, hi] = info.good;
  const inRange = value >= lo && value <= hi;
  const tooHigh = value > hi;
  const tooLow = value < lo;

  const barColor = inRange
    ? "var(--positive)"
    : tooHigh
    ? "var(--blunder)"
    : "var(--inaccuracy)";

  // Normalize bar width: 0–100% maps to 0–150 (150 being clearly too high)
  const barMax = hi * 2;
  const barWidth = Math.min((value / barMax) * 100, 100);

  const label = inRange
    ? "In range"
    : tooHigh
    ? "Too high"
    : "Too low";

  return (
    <div style={styles.stat}>
      <div style={styles.statHeader}>
        <span style={styles.statLabel}>{info.label}</span>
        <span style={styles.statDesc}>{info.desc}</span>
        <span style={{ ...styles.statBadge, color: barColor }}>
          {value}{info.unit} · {label}
        </span>
      </div>
      <div style={styles.barTrack}>
        {/* "good zone" overlay */}
        <div
          style={{
            ...styles.goodZone,
            left: `${(lo / barMax) * 100}%`,
            width: `${((hi - lo) / barMax) * 100}%`,
          }}
        />
        <div
          style={{
            ...styles.barFill,
            width: `${barWidth}%`,
            background: barColor,
          }}
        />
      </div>
      <div style={styles.rangeLine}>
        <span>0</span>
        <span style={{ marginLeft: `${(lo / barMax) * 100}%` }}>{lo}%</span>
        <span style={{ marginLeft: `${((hi - lo) / barMax) * 100 - 3}%` }}>{hi}%</span>
      </div>
    </div>
  );
}

export default function SizingBreakdown({ stats, sizingIssuesCount }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <TrendingUp size={15} color="var(--gold)" />
        <h3 style={styles.sectionTitle}>Session Stats</h3>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.bigStat}>
          <span style={styles.bigStatValue}>{stats.totalHands}</span>
          <span style={styles.bigStatLabel}>Hands Dealt</span>
        </div>
        <div style={styles.bigStat}>
          <span style={styles.bigStatValue}>{stats.handsPlayed}</span>
          <span style={styles.bigStatLabel}>Hands Played</span>
        </div>
        <div style={styles.bigStat}>
          <span
            style={{
              ...styles.bigStatValue,
              color: stats.netPnl >= 0 ? "var(--positive)" : "var(--blunder)",
            }}
          >
            {stats.netPnl >= 0 ? "+" : ""}
            {stats.netPnl}
          </span>
          <span style={styles.bigStatLabel}>Net P&L (chips)</span>
        </div>
        <div style={styles.bigStat}>
          <span
            style={{
              ...styles.bigStatValue,
              color: sizingIssuesCount > 5 ? "var(--inaccuracy)" : "var(--text2)",
            }}
          >
            {sizingIssuesCount}
          </span>
          <span style={styles.bigStatLabel}>Sizing Flags</span>
        </div>
      </div>

      <div style={styles.bars}>
        <StatBar statKey="vpip" value={stats.vpip} />
        <StatBar statKey="pfr" value={stats.pfr} />
        <StatBar statKey="wtsd" value={stats.wtsd} />
      </div>

      <p style={styles.note}>
        Green zone = typical 6-max range. These are baseline stats — context matters.
      </p>
    </div>
  );
}

const styles = {
  section: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius2)",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  sectionTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "16px",
    color: "var(--text)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
  },
  bigStat: {
    background: "var(--bg3)",
    borderRadius: "var(--radius)",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    textAlign: "center",
  },
  bigStatValue: {
    fontFamily: "var(--font-mono)",
    fontSize: "20px",
    fontWeight: 500,
    color: "var(--text)",
  },
  bigStatLabel: {
    fontSize: "10px",
    color: "var(--text3)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontFamily: "var(--font-mono)",
  },
  bars: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  statHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
  },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
  },
  statDesc: {
    fontSize: "11px",
    color: "var(--text3)",
  },
  statBadge: {
    marginLeft: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
  },
  barTrack: {
    height: "6px",
    background: "var(--bg3)",
    borderRadius: "3px",
    position: "relative",
    overflow: "hidden",
  },
  goodZone: {
    position: "absolute",
    top: 0,
    height: "100%",
    background: "rgba(69,168,118,0.15)",
  },
  barFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.8s ease",
  },
  rangeLine: {
    display: "flex",
    fontSize: "9px",
    color: "var(--text3)",
    fontFamily: "var(--font-mono)",
    gap: "0",
  },
  note: {
    fontSize: "11px",
    color: "var(--text3)",
    fontFamily: "var(--font-mono)",
  },
};
