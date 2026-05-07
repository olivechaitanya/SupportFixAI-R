import { motion } from "framer-motion";

function cleanText(text) {
  return text.replaceAll("**", "").trim();
}

function parseStep(stepText, index) {
  const cleanedStep = cleanText(stepText);
  const splitIndex = cleanedStep.indexOf(":");

  if (splitIndex > 0) {
    return {
      title: cleanedStep.slice(0, splitIndex).trim(),
      description: cleanedStep.slice(splitIndex + 1).trim(),
      index,
    };
  }

  return {
    title: `Step ${index}`,
    description: cleanedStep,
    index,
  };
}

function parseBotMessage(text) {
  const lines = text.split("\n");
  const stepRegex = /^\d+\.\s+(.*)$/;
  const steps = [];
  const introLines = [];
  const outroLines = [];
  let hasReachedSteps = false;

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const stepMatch = trimmedLine.match(stepRegex);

    if (stepMatch) {
      hasReachedSteps = true;
      steps.push(stepMatch[1]);
      return;
    }

    if (!trimmedLine) {
      if (!hasReachedSteps) {
        introLines.push("");
      } else {
        outroLines.push("");
      }
      return;
    }

    if (hasReachedSteps) {
      outroLines.push(trimmedLine);
      return;
    }

    introLines.push(trimmedLine);
  });

  return {
    intro: cleanText(introLines.join("\n").trim()),
    steps: steps.map((step, index) => parseStep(step, index + 1)),
    outro: cleanText(outroLines.join("\n").trim()),
  };
}

function Message({ message }) {
  const isUser = message.role === "user";
  const metadata = [];
  const parsedMessage = !isUser ? parseBotMessage(message.text) : null;

  if (!isUser && message.usedLlm) {
    metadata.push("LLM");
  }
  if (!isUser && message.modelUsed) {
    metadata.push(message.modelUsed);
  }
  if (!isUser && typeof message.toolCalled === "boolean") {
    metadata.push(message.toolCalled ? "Tool called" : "No tool");
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-[28px] px-4 py-3 shadow-xl ${
          isUser
            ? "rounded-br-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-950/10"
            : "rounded-bl-md border border-white/10 bg-white/5 text-slate-100 shadow-cyan-950/5 backdrop-blur"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-semibold ${
                isUser ? "bg-white/20 text-white" : "bg-cyan-400/15 text-cyan-200"
              }`}
            >
              {isUser ? "You" : "AI"}
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-75">
                {isUser ? "You" : "SupportFix AI"}
              </p>
              {metadata.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {metadata.map((item) => (
                    <span
                      key={item}
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                        isUser
                          ? "bg-white/15 text-white/85"
                          : "border border-white/10 bg-white/5 text-slate-200"
                      }`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] opacity-60">{message.timestamp}</p>
        </div>

        {isUser && <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>}

        {!isUser && parsedMessage && (
          <div className="space-y-4">
            {parsedMessage.intro && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                {parsedMessage.intro}
              </p>
            )}

            {parsedMessage.steps.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-3">
                  {parsedMessage.steps.map((step, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.15 + 0.2 }}
                      key={`${message.id}-${step.index}`}
                      className="group rounded-3xl border border-white/10 bg-white/5 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-950/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-cyan-950/10">
                          {step.index}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white transition group-hover:text-cyan-100">
                            {step.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {parsedMessage.outro && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                {parsedMessage.outro}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default Message;
