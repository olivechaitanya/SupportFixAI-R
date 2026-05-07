import { useEffect, useMemo, useRef, useState } from "react";
import Message from "./Message";

const API_URL = "http://localhost:8000/chat";
const STORAGE_KEY = "supportfix-ai-history";
const QUICK_PROMPTS = [
  "My WiFi is not working",
  "I forgot my password",
  "My laptop is very slow",
  "My printer is not printing",
];

const starterMessages = [
  {
    id: crypto.randomUUID(),
    role: "bot",
    text: "Hello, I am SupportFix AI. Tell me what problem you are facing, for example: My WiFi is not working.",
    modelUsed: "Starter",
    toolCalled: false,
    usedLlm: false,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },
];

function createTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    return savedMessages ? JSON.parse(savedMessages) : starterMessages;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const messageEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) {
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmedInput,
      timestamp: createTimestamp(),
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedInput }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const providerError =
          errorPayload?.detail?.provider_error?.error || errorPayload?.detail?.provider_error;
        const message =
          errorPayload?.detail?.message ||
          errorPayload?.detail ||
          providerError ||
          "The backend could not process your request.";
        throw new Error(String(message));
      }

      const data = await response.json();
      const botMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        text: data.response,
        modelUsed: data.model_used,
        toolCalled: data.tool_called,
        usedLlm: data.used_llm,
        timestamp: createTimestamp(),
      };

      setMessages((currentMessages) => [...currentMessages, botMessage]);
    } catch (requestError) {
      setError(requestError.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyQuickPrompt(prompt) {
    setInput(prompt);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function clearHistory() {
    setMessages(starterMessages);
    setError("");
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-2 py-2 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => applyQuickPrompt(prompt)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200 backdrop-blur transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
              >
                {prompt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={clearHistory}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200 backdrop-blur transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            Clear history
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3 sm:px-4">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-3xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-lg shadow-cyan-950/10 backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-400/15 text-xs font-semibold text-cyan-200">
                  AI
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-200/80">
                    SupportFix AI
                  </p>
                  <p className="text-[11px] text-slate-400">Analyzing your issue</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-sky-300 [animation-delay:-0.15s]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-300" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-100 shadow-lg shadow-rose-950/10">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
              Request Failed
            </p>
            <p>{error}</p>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 px-2 pb-2 pt-1 sm:px-4">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="flex-1 rounded-[24px] border border-white/10 bg-black/20 p-1 shadow-lg shadow-cyan-950/5 backdrop-blur-md">
            <textarea
              rows="1"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your problem here..."
              className="min-h-[42px] w-full resize-none rounded-[16px] border border-transparent bg-transparent px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-[24px] bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/10 transition hover:from-cyan-300 hover:via-sky-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default Chat;
