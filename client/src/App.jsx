import React, { useState } from "react";
import Upload from "./components/Upload.jsx";
import PlayerSelect from "./components/PlayerSelect.jsx";
import Dashboard from "./components/Dashboard.jsx";

// App has 3 screens:
//   "upload"  → drag-and-drop CSV
//   "select"  → pick player name
//   "review"  → full session dashboard

export default function App() {
  const [screen, setScreen] = useState("upload");
  const [uploadResult, setUploadResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  function handleUploaded(result) {
    setUploadResult(result);
    setScreen("select");
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

  if (screen === "upload") {
    return <Upload onUploaded={handleUploaded} />;
  }

  if (screen === "select") {
    return (
      <PlayerSelect
        uploadResult={uploadResult}
        onAnalyze={handleAnalyzed}
        onReset={handleReset}
      />
    );
  }

  if (screen === "review") {
    return (
      <Dashboard
        analysisResult={analysisResult}
        onReset={handleReset}
      />
    );
  }

  return null;
}
