import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const TYPE_CONFIG = {
  blunder: {
    label: "Blunder",
    color: "var(--blunder)",
    dim: "var(--blunder-dim)",
  },
  inaccuracy: {
    label: "Inaccuracy",
    color: "var(--inaccuracy)",
    dim: "var(--inaccuracy-dim)",
  },
  missed_opportunity: {
    label: "Missed",
    color: "var(--missed)",
    dim: "var(--missed-dim)",
  },
};

export default function MistakeCard({ mistake, index }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[mistake.type] || TYPE_CONFIG.inaccuracy;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        animationDelay: `${index * 0.04}s`,
      }}
      className="fade-in"
    >
      <div
        style={styles.row}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Severity square */}
        <div style={{ ...styles.typeDot, background: config.color }} />

        {/* Type label */}
        <span style={{ ...styles.typeLabel, color: config.color }}>
          {config.label}
        </span>

        {/* Hand number */}
        {mistake.handNumber != null && (
          <span style={styles.handNum}>#{mistake.handNumber}</span>
        )}

        {/* Title */}
        <span style={styles.title}>{mistake.title}</span>

        {/* Category */}
        {mistake.category && (
          <span style={styles.category}>{mistake.category}</span>
        )}

        {/* Expand */}
        <span style={styles.chevron}>
          {expanded
            ? <ChevronUp size={13} color="var(--text3)" />
            : <ChevronDown size={13} color="var(--text3)" />
          }
        </span>
      </div>

      {expanded && (
        <div style={styles.explanation} className="slide-down">
          <div style={styles.explanationBar(config.color)} />
          <p style={styles.explanationText}>{mistake.explanation}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 2px",
    cursor: "pointer",
    userSelect: "none",
  },
  typeDot: {
    width: "9px",
    height: "9px",
    borderRadius: "2px",
    flexShrink: 0,
  },
  typeLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    flexShrink: 0,
    width: "68px",
  },
  handNum: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text3)",
    flexShrink: 0,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "14px",
    color: "var(--text)",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  category: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--text3)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  explanation: {
    display: "flex",
    gap: "12px",
    paddingLeft: "19px",
    paddingBottom: "13px",
    paddingRight: "4px",
  },
  explanationBar: (color) => ({
    width: "2px",
    borderRadius: "2px",
    background: color,
    flexShrink: 0,
    opacity: 0.5,
  }),
  explanationText: {
    color: "var(--text2)",
    fontSize: "13px",
    lineHeight: 1.75,
  },
};
