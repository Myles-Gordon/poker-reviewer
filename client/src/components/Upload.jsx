import React, { useState, useRef } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";

export default function UploadScreen({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>♠</div>
        <h1 style={styles.title}>Poker Reviewer</h1>
        <p style={styles.subtitle}>Session analysis powered by AI — like Chess.com, but for poker</p>
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...styles.dropzone,
          ...(dragging ? styles.dropzoneDragging : {}),
          ...(loading ? styles.dropzoneLoading : {}),
        }}
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Parsing your session...</p>
          </div>
        ) : (
          <div style={styles.uploadContent}>
            <div style={styles.uploadIcon}>
              <Upload size={28} color="var(--gold)" strokeWidth={1.5} />
            </div>
            <p style={styles.uploadPrimary}>Drop your PokerNow log here</p>
            <p style={styles.uploadSecondary}>or click to browse — CSV files only</p>
          </div>
        )}
      </div>

      {error && (
        <div style={styles.error}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* How to export */}
      <div style={styles.instructions}>
        <div style={styles.instructionsTitle}>
          <FileText size={14} color="var(--text3)" />
          <span>How to export from PokerNow</span>
        </div>
        <ol style={styles.instructionsList}>
          <li>Go to your PokerNow game room</li>
          <li>Click <strong>Ledger</strong> in the top menu</li>
          <li>Click <strong>Download Full Log</strong> (CSV)</li>
          <li>Upload that file here</li>
        </ol>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    gap: "32px",
  },
  header: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  logo: {
    fontSize: "48px",
    lineHeight: 1,
    filter: "drop-shadow(0 0 20px rgba(201,168,76,0.5))",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "36px",
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    color: "var(--text2)",
    fontSize: "15px",
    maxWidth: "360px",
  },
  dropzone: {
    width: "100%",
    maxWidth: "480px",
    border: "2px dashed var(--border2)",
    borderRadius: "var(--radius3)",
    background: "var(--surface)",
    padding: "48px 32px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dropzoneDragging: {
    borderColor: "var(--gold)",
    background: "var(--gold-dim)",
    transform: "scale(1.01)",
  },
  dropzoneLoading: {
    cursor: "default",
    opacity: 0.8,
  },
  uploadContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  uploadIcon: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "var(--gold-dim)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "4px",
  },
  uploadPrimary: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "16px",
    color: "var(--text)",
  },
  uploadSecondary: {
    color: "var(--text3)",
    fontSize: "13px",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  spinner: {
    width: "32px",
    height: "32px",
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
  error: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--blunder)",
    background: "var(--blunder-dim)",
    border: "1px solid rgba(224,85,85,0.25)",
    borderRadius: "var(--radius)",
    padding: "10px 14px",
    fontSize: "13px",
    maxWidth: "480px",
    width: "100%",
  },
  instructions: {
    maxWidth: "480px",
    width: "100%",
    background: "var(--surface)",
    borderRadius: "var(--radius2)",
    border: "1px solid var(--border)",
    padding: "16px 20px",
  },
  instructionsTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "var(--text3)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "10px",
  },
  instructionsList: {
    paddingLeft: "20px",
    color: "var(--text2)",
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
};
