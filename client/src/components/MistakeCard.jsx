import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, XCircle, Info } from "lucide-react";

const TYPE_CONFIG = {
  blunder: {
    label: "Blunder",
    color: "var(--blunder)",
    dim: "var(--blunder-dim)",
    border: "rgba(224,85,85,0.25)",
    icon: XCircle,
  },
  inaccuracy: {
    label: "Inaccuracy",
    color: "var(--inaccuracy)",
    dim: "var(--inaccuracy-dim)",
    border: "rgba(224,154,42,0.25)",
    icon: AlertTriangle,
  },
  missed_opportunity: {
    label: "Missed Opportunity",
    color: "var(--missed)",
    dim: "var(--missed-dim)",
    border: "rgba(90,138,224,0.25)",
    icon: Info,
  },
};

export default function MistakeCard({ mistake, index }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[mistake.type] || TYPE_CONFIG.inaccuracy;
  const Icon = config.icon;

  return (
    <div
      style={{
        ...styles.card,
        borderColor: expanded ? config.border : "var(--border)",
        animationDelay: `${index * 0.06}s`,
      }}
      className="fade-in"
    >
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.typeTag(config)}>
          <Icon size={11} />
          <span>{config.label}</span>
        </div>

        <div style={styles.titleRow}>
          <span style={styles.handNum}>#{mistake.handNumber}</span>
          <span style={styles.title}>{mistake.title}</span>
          {mistake.severity === 3 && <span style={styles.severityDot} />}
        </div>

        <div style={styles.categoryChip}>{mistake.category}</div>

        <button style={styles.expandBtn}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div style={styles.body}>
          <p style={styles.explanation}>{mistake.explanation}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius2)",
    overflow: "hidden",
    transition: "border-color 0.2s ease",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    flexWrap: "wrap",
  },
  typeTag: (config) => ({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: config.dim,
    color: config.color,
    border: `1px solid ${config.border}`,
    borderRadius: "4px",
    padding: "2px 7px",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    fontWeight: 500,
    flexShrink: 0,
  }),
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
  },
  handNum: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--text3)",
    flexShrink: 0,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "14px",
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  severityDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--blunder)",
    flexShrink: 0,
    animation: "pulse 2s ease infinite",
  },
  categoryChip: {
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "2px 7px",
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text3)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flexShrink: 0,
    marginLeft: "auto",
  },
  expandBtn: {
    background: "none",
    border: "none",
    color: "var(--text3)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: "0 2px",
    flexShrink: 0,
  },
  body: {
    padding: "0 14px 14px",
    borderTop: "1px solid var(--border)",
    paddingTop: "12px",
  },
  explanation: {
    color: "var(--text2)",
    fontSize: "13px",
    lineHeight: 1.7,
  },
};
