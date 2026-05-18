import React, { useState, useRef } from "react";
import { AlertCircle } from "lucide-react";

const FLOAT_SUITS = [
  { s: "♥", top: "8%",  left: "7%",  size: 38, delay: "0s",   dur: "9s"  },
  { s: "♣", top: "80%", left: "8%",  size: 30, delay: "2.5s", dur: "7.5s"},
  { s: "♦", top: "12%", right: "6%", size: 44, delay: "1s",   dur: "8s"  },
  { s: "♠", top: "76%", right: "7%", size: 34, delay: "3.5s", dur: "10s" },
];

function CornerBracket({ top, left }) {
  return (
    <div style={{
      position: "absolute",
      [top ? "top" : "bottom"]: 16,
      [left ? "left" : "right"]: 16,
      width: 22,
      height: 22,
      borderTop:    top  ? "1.5px solid rgba(200,136,12,0.6)" : "none",
      borderBottom: !top ? "1.5px solid rgba(200,136,12,0.6)" : "none",
      borderLeft:   left ? "1.5px solid rgba(200,136,12,0.6)" : "none",
      borderRight: !left ? "1.5px solid rgba(200,136,12,0.6)" : "none",
    }} />
  );
}

export default function UploadScreen({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a PokerNow CSV file (.csv)");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { uploadLog } = await import("../api.js");
      const result = await uploadLog(file);
      onUploaded(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div style={st.page}>

      {/* Massive background watermark */}
      <div style={st.watermark} aria-hidden>♠</div>

      {/* Ambient floating suits */}
      {FLOAT_SUITS.map((f, i) => (
        <span key={i} aria-hidden style={{
          position: "fixed",
          top: f.top, left: f.left, right: f.right,
          fontSize: f.size + "px",
          color: "var(--text)",
          opacity: 0.05,
          animation: `floatSuit ${f.dur} ease-in-out ${f.delay} infinite`,
          userSelect: "none", pointerEvents: "none", lineHeight: 1,
        }}>{f.s}</span>
      ))}

      <div style={st.content}>

        {/* Suit pip row */}
        <div style={st.pipRow} aria-hidden>
          {["♠", "♥", "♦", "♣"].map((sym, i) => (
            <span
              key={sym}
              className="fade-in"
              style={{ ...st.pip, animationDelay: `${i * 0.07}s` }}
            >{sym}</span>
          ))}
        </div>

        {/* Title block */}
        <div style={st.titleBlock}>
          <h1
            className="fade-in"
            style={{ ...st.wordPoker, animationDelay: "0.15s" }}
          >
            POKER
          </h1>

          <div
            className="scale-in-x"
            style={{ ...st.rule, animationDelay: "0.35s" }}
          />

          <p
            className="fade-in"
            style={{ ...st.wordReviewer, animationDelay: "0.45s" }}
          >
            REVIEWER
          </p>
        </div>

        {/* Tagline */}
        <p
          className="fade-in"
          style={{ ...st.tagline, animationDelay: "0.55s" }}
        >
          Session analysis powered by AI — like Chess.com, but for poker
        </p>

        {/* Drop zone */}
        <div
          className="fade-in"
          style={{
            ...st.dropzone,
            ...(dragging ? st.dropzoneDragging : {}),
            ...(loading  ? st.dropzoneLoading  : {}),
            animationDelay: "0.65s",
          }}
          onClick={() => !loading && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef} type="file" accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />

          <CornerBracket top={true}  left={true}  />
          <CornerBracket top={true}  left={false} />
          <CornerBracket top={false} left={true}  />
          <CornerBracket top={false} left={false} />

          {loading ? (
            <div style={st.loadingState}>
              <div style={st.spinner} />
              <span style={st.loadingText}>Parsing your session…</span>
            </div>
          ) : (
            <div style={st.uploadInner}>
              <span style={st.uploadArrow}>↑</span>
              <p style={st.uploadPrimary}>Drop your PokerNow log here</p>
              <p style={st.uploadSecondary}>or click to browse · CSV only</p>
            </div>
          )}
        </div>

        {error && (
          <div className="fade-in" style={st.error}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Instructions */}
        <div
          className="fade-in"
          style={{ ...st.instructions, animationDelay: "0.75s" }}
        >
          <p style={st.instructionsLabel}>How to export from PokerNow</p>
          <ol style={st.instructionsList}>
            <li>Open your PokerNow game room</li>
            <li>Click <em style={{ color: "var(--text)", fontStyle: "italic" }}>Ledger</em> in the top menu</li>
            <li>Click <em style={{ color: "var(--text)", fontStyle: "italic" }}>Download Full Log</em> (CSV)</li>
            <li>Upload that file here</li>
          </ol>
        </div>

      </div>
    </div>
  );
}

const st = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    position: "relative",
    overflow: "hidden",
  },

  watermark: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: "68vh",
    lineHeight: 1,
    color: "var(--text)",
    opacity: 0.028,
    userSelect: "none",
    pointerEvents: "none",
    zIndex: 0,
  },

  content: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "28px",
    width: "100%",
    maxWidth: "560px",
  },

  pipRow: {
    display: "flex",
    gap: "18px",
    alignItems: "center",
  },
  pip: {
    fontSize: "13px",
    color: "var(--gold)",
    opacity: 0.7,
    letterSpacing: "0.05em",
  },

  titleBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    width: "100%",
  },
  wordPoker: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "clamp(64px, 13vw, 96px)",
    letterSpacing: "-0.02em",
    color: "var(--text)",
    lineHeight: 1,
    margin: 0,
  },
  rule: {
    width: "100%",
    height: "1px",
    background: "linear-gradient(90deg, transparent, var(--gold) 20%, var(--gold) 80%, transparent)",
    transformOrigin: "left center",
  },
  wordReviewer: {
    fontFamily: "var(--font-display)",
    fontWeight: 400,
    fontSize: "13px",
    letterSpacing: "0.55em",
    textTransform: "uppercase",
    color: "var(--text3)",
    margin: 0,
  },

  tagline: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontStyle: "italic",
    fontSize: "18px",
    color: "var(--text2)",
    textAlign: "center",
    lineHeight: 1.6,
    maxWidth: "400px",
  },

  dropzone: {
    width: "100%",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius2)",
    background: "var(--surface)",
    padding: "44px 32px",
    cursor: "pointer",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
  },
  dropzoneDragging: {
    borderColor: "var(--gold)",
    boxShadow: "0 8px 40px rgba(200,136,12,0.2), 0 0 0 1px var(--gold)",
    background: "var(--gold-dim)",
  },
  dropzoneLoading: {
    cursor: "default",
    opacity: 0.7,
  },

  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "2px solid var(--border2)",
    borderTopColor: "var(--gold)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "var(--text2)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  },

  uploadInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  uploadArrow: {
    fontSize: "28px",
    color: "var(--gold)",
    lineHeight: 1,
    opacity: 0.8,
    marginBottom: "4px",
    display: "block",
  },
  uploadPrimary: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "16px",
    color: "var(--text)",
    margin: 0,
  },
  uploadSecondary: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--text3)",
    margin: 0,
  },

  error: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--blunder)",
    background: "var(--blunder-dim)",
    border: "1px solid rgba(224,85,85,0.22)",
    borderRadius: "var(--radius)",
    padding: "10px 14px",
    fontSize: "13px",
    width: "100%",
  },

  instructions: {
    width: "100%",
    borderTop: "1px solid var(--border)",
    paddingTop: "20px",
  },
  instructionsLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--text3)",
    marginBottom: "10px",
  },
  instructionsList: {
    paddingLeft: "18px",
    color: "var(--text2)",
    fontSize: "13px",
    lineHeight: 1.7,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
};
