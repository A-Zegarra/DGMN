import { useEffect, useRef, useState } from "react";

import { CHAT_MAX_LENGTH } from "@digiworld/shared/constants";
import type { ChatMessage } from "@digiworld/shared/messages";

import type { WorldClient } from "../net/world-client";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({
  client,
  open = true,
  onClose,
}: {
  client: WorldClient;
  open?: boolean;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return client.subscribeChat((message) => {
      setMessages((previous) => [...previous.slice(-59), message]);
    });
  }, [client]);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "Enter" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (
        event.key === "Escape" &&
        document.activeElement === inputRef.current
      ) {
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    client.room.send("chat", { text });
    setDraft("");
  };

  return (
    <section className={`chat-panel panel ${open ? "is-open" : ""}`}>
      <header className="chat-header">
        <span className="panel-title">Chat de zona</span>
        <span className="chat-hint">Enter para escribir</span>
        <button
          type="button"
          className="chat-close"
          onClick={onClose}
          aria-label="Cerrar chat"
        >
          ×
        </button>
      </header>

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty">
            Aún no hay mensajes. Saluda a los demás domadores.
          </p>
        )}
        {messages.map((message, index) => (
          <p
            key={`${message.at}-${message.sessionId}-${index}`}
            className={`chat-message ${message.system ? "is-system" : ""}`}
          >
            <span className="chat-time">{formatTime(message.at)}</span>
            {!message.system && (
              <strong className="chat-author">{message.name}</strong>
            )}
            <span>{message.text}</span>
          </p>
        ))}
      </div>

      <div className="chat-composer">
        <input
          ref={inputRef}
          value={draft}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Escribe un mensaje…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <button type="button" onClick={sendMessage} disabled={!draft.trim()}>
          Enviar
        </button>
      </div>
    </section>
  );
}
