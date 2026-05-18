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

/**
 * Async generator — streams Claude coaching chunks for a specific hand.
 * Usage: for await (const text of streamHandChat(...)) { ... }
 */
export async function* streamHandChat(sessionId, heroName, handNumber, messages) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, heroName, handNumber, messages }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text)  yield parsed.text;
        } catch (e) {
          if (e.message.startsWith("HTTP") || e.message !== "Unexpected end of JSON input") throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
