import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader, Bot } from "lucide-react";
import { streamHandChat } from "../api.js";

const SUGGESTED = [
  "What should I have done differently?",
  "What range am I up against here?",
  "Was my bet size correct?",
  "Should I have folded preflop?",
];

export default function HandChat({ sessionId, heroName, hand, fillHeight }) {
  // Key by hand number so each hand starts a fresh conversation
  const handKey = hand?.handNumber ?? null;
  const [histories, setHistories] = useState({});
  const [streaming, setStreaming] = useState(false);
  const [input, setInput]         = useState("");
  const abortRef  = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const messages = handKey != null ? (histories[handKey] ?? []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Reset input when hand changes; cancel any in-flight stream
  useEffect(() => {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [handKey]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || streaming || handKey == null) return;

    const userMsg = { role: "user", content: trimmed };
    setHistories(h => ({ ...h, [handKey]: [...(h[handKey] ?? []), userMsg] }));
    setInput("");
    setStreaming(true);

    // Placeholder assistant message we'll stream into
    setHistories(h => ({
      ...h,
      [handKey]: [...(h[handKey] ?? []), { role: "assistant", content: "" }],
    }));

    let cancelled = false;
    abortRef.current = () => { cancelled = true; };

    try {
      const history = (histories[handKey] ?? []).slice(-10);
      const gen = streamHandChat(sessionId, heroName, handKey, [...history, userMsg]);

      for await (const chunk of gen) {
        if (cancelled) break;
        setHistories(h => {
          const prev = h[handKey] ?? [];
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return { ...h, [handKey]: updated };
        });
      }
    } catch (err) {
      if (!cancelled) {
        setHistories(h => {
          const prev = h[handKey] ?? [];
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: `Error: ${err.message}` };
          return { ...h, [handKey]: updated };
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [input, streaming, handKey, sessionId, heroName, histories]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isEmpty   = messages.length === 0;
  const hasHand   = handKey != null;
  const canSend   = !!input.trim() && hasHand && !streaming;

  return (
    <div style={{ ...st.panel, ...(fillHeight ? { height: "100%" } : {}) }}>

      {/* Header */}
      <div style={st.header}>
        <Bot size={13} color="var(--gold)" />
        <span style={st.headerTitle}>Hand Coach</span>
        {hasHand && <span style={st.headerHandNum}>Hand #{handKey}</span>}
      </div>

      {/* Messages */}
      <div style={st.messages}>
        {!hasHand && (
          <div style={st.placeholder}>
            Select a hand from the list to start coaching.
          </div>
        )}

        {hasHand && isEmpty && (
          <div style={st.emptyState}>
            <div style={st.emptyHint}>
              Ask anything about Hand #{handKey} — ranges, bet sizing, pot odds…
            </div>
            <div style={st.suggestions}>
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  style={st.suggestion}
                  onClick={() => sendMessage(s)}
                  disabled={streaming}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? st.userRow : st.assistantRow}>
            <div style={m.role === "user" ? st.userBubble : st.assistantBubble}>
              {m.content || (streaming && i === messages.length - 1
                ? <span style={st.cursor}>▍</span>
                : null
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={st.inputArea}>
        <textarea
          ref={inputRef}
          style={st.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={hasHand ? "Ask about this hand…" : "Select a hand first"}
          disabled={!hasHand || streaming}
          rows={2}
        />
        <button
          style={{ ...st.sendBtn, opacity: canSend ? 1 : 0.35 }}
          onClick={() => sendMessage()}
          disabled={!canSend}
        >
          {streaming
            ? <Loader size={13} style={{ animation: "spin 0.7s linear infinite" }} />
            : <Send size={13} />
          }
        </button>
      </div>
    </div>
  );
}

const st = {
  panel: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "11px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    background: "var(--surface)",
  },
  headerTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "12px",
    color: "var(--text)",
    flex: 1,
  },
  headerHandNum: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--text3)",
  },

  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  placeholder: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text3)",
    textAlign: "center",
    padding: "24px 8px",
    lineHeight: 1.6,
  },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  emptyHint: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text3)",
    lineHeight: 1.6,
    textAlign: "center",
    padding: "12px 4px 4px",
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  suggestion: {
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text2)",
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    padding: "7px 10px",
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.4,
    transition: "background 0.12s",
  },

  userRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  assistantRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  userBubble: {
    maxWidth: "88%",
    background: "var(--gold-dim)",
    border: "1px solid rgba(200,136,12,0.25)",
    borderRadius: "var(--radius2)",
    padding: "8px 10px",
    fontSize: "12px",
    color: "var(--text)",
    lineHeight: 1.6,
    fontFamily: "var(--font-body)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  assistantBubble: {
    maxWidth: "96%",
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius2)",
    padding: "8px 10px",
    fontSize: "12px",
    color: "var(--text2)",
    lineHeight: 1.65,
    fontFamily: "var(--font-body)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  cursor: {
    animation: "pulse 0.8s ease infinite",
    color: "var(--gold)",
  },

  inputArea: {
    display: "flex",
    gap: "6px",
    padding: "8px 10px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text)",
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    padding: "7px 9px",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
    minHeight: "52px",
  },
  sendBtn: {
    background: "var(--gold)",
    border: "none",
    borderRadius: "var(--radius)",
    color: "#0a0a0f",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
};
