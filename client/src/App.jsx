import React, { useState } from "react";
import { analyzeSession } from "./api.js";
import Upload from "./components/Upload.jsx";
import PlayerSelect from "./components/PlayerSelect.jsx";
import Dashboard from "./components/Dashboard.jsx";

function AnalyzingScreen({ heroName, handCount }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
        <div style={{
          width: "36px", height: "36px",
          border: "3px solid var(--border2)",
          borderTopColor: "var(--gold)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>
          Analyzing as {heroName}
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text3)", animation: "pulse 2s ease infinite" }}>
          Claude is reviewing {handCount} hands — 15–30 seconds
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("upload");
  const [uploadResult, setUploadResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  async function handleUploaded(result) {
    setUploadResult(result);

    if (result.suggestedHero) {
      // Hero detected — skip player select and go straight to analysis
      setScreen("analyzing");
      try {
        const analysis = await analyzeSession(result.sessionId, result.suggestedHero);
        setAnalysisResult(analysis);
        setScreen("review");
      } catch {
        // Analysis failed — fall back to manual player selection
        setScreen("select");
      }
    } else {
      setScreen("select");
    }
  }

  function handleAnalyzed(result) {
    setAnalysisResult(result);
    setScreen("review");
  }

  function handleReset() {
    setUploadResult(null);
    setAnalysisResult(null);
    setScreen("upload");
  }

  if (screen === "upload")    return <Upload onUploaded={handleUploaded} />;
  if (screen === "analyzing") return <AnalyzingScreen heroName={uploadResult?.suggestedHero} handCount={uploadResult?.handCount} />;
  if (screen === "select")    return <PlayerSelect uploadResult={uploadResult} onAnalyze={handleAnalyzed} onReset={handleReset} />;
  if (screen === "review")    return <Dashboard analysisResult={analysisResult} sessionId={uploadResult?.sessionId} onReset={handleReset} />;

  return null;
}
