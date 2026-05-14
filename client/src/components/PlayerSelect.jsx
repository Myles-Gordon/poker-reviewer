import React, { useState } from "react";
import { Users, ChevronDown, ArrowRight, RotateCcw } from "lucide-react";

export default function PlayerSelect({ uploadResult, onAnalyze, onReset }) {
  const { players, handCount, bigBlind, filename } = uploadResult;
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const { analyzeSession } = await import("../api.js");
      const result = await analyzeSession(uploadResult.sessionId, selected);
      onAnalyze(result);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* File info */}
        <div style={styles.fileInfo}>
          <div style={styles.fileIcon}>♠</div>
          <div>
            <div style={styles.filename}>{filename}</div>
            <div style={styles.fileMeta}>
              <span style={styles.chip}>{handCount} hands</span>
              <span style={styles.chip}>BB = {bigBlind}</span>
            </div>
          </div>
          <button style={styles.resetBtn} onClick={onReset} title="Upload different file">
            <RotateCcw size={14} />
          </button>
        </div>

        <div style={styles.divider} />

        {/* Player selection */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            <Users size={14} color="var(--text3)" />
            <span>Select your player name</span>
          </div>

          <div style={styles.selectWrapper}>
            <select
              style={styles.select}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">— choose a player —</option>
              {players.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown size={14} style={styles.chevron} />
          </div>

          {selected && (
            <div style={styles.selectedPreview}>
              Reviewing as <strong style={{ color: "var(--gold2)" }}>{selected}</strong>
            </div>
          )}
        </div>

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <button
          style={{
            ...styles.analyzeBtn,
            ...((!selected || loading) ? styles.analyzeBtnDisabled : {}),
          }}
          onClick={handleAnalyze}
          disabled={!selected || loading}
        >
          {loading ? (
            <>
              <div style={styles.btnSpinner} />
              <span>Analyzing with AI...</span>
            </>
          ) : (
            <>
              <span>Analyze Session</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {loading && (
          <p style={styles.loadingNote}>
            Claude is reviewing {handCount} hands. This takes 15–30 seconds.
          </p>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius3)",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    animation: "fadeIn 0.35s ease both",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  fileIcon: {
    fontSize: "28px",
    flexShrink: 0,
  },
  filename: {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    color: "var(--text)",
    fontWeight: 500,
    marginBottom: "4px",
    wordBreak: "break-all",
  },
  fileMeta: {
    display: "flex",
    gap: "6px",
  },
  chip: {
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text2)",
  },
  resetBtn: {
    marginLeft: "auto",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text3)",
    padding: "6px 8px",
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  divider: {
    height: "1px",
    background: "var(--border)",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "var(--text3)",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  selectWrapper: {
    position: "relative",
  },
  select: {
    width: "100%",
    background: "var(--bg3)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius)",
    color: "var(--text)",
    padding: "10px 36px 10px 12px",
    fontSize: "14px",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    appearance: "none",
    outline: "none",
  },
  chevron: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text3)",
    pointerEvents: "none",
  },
  selectedPreview: {
    fontSize: "13px",
    color: "var(--text2)",
    fontFamily: "var(--font-mono)",
  },
  error: {
    color: "var(--blunder)",
    background: "var(--blunder-dim)",
    border: "1px solid rgba(224,85,85,0.2)",
    borderRadius: "var(--radius)",
    padding: "10px 14px",
    fontSize: "13px",
  },
  analyzeBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "var(--gold)",
    color: "#0a0a0f",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "12px 20px",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  analyzeBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  btnSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(0,0,0,0.2)",
    borderTopColor: "#0a0a0f",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  loadingNote: {
    textAlign: "center",
    color: "var(--text3)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    animation: "pulse 2s ease infinite",
  },
};
