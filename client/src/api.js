const BASE = "/api";

export async function uploadLog(file) {
  const form = new FormData();
  form.append("logFile", file);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export async function analyzeSession(sessionId, heroName) {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, heroName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Analysis failed");
  return data;
}

export async function fetchHands(sessionId, heroName) {
  const url = `${BASE}/session/${sessionId}/hands?hero=${encodeURIComponent(heroName)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch hands");
  return data;
}

export async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}
