import Chat from "./components/Chat";
import { motion } from "framer-motion";

function WifiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path
        d="M3 9.5C8.5 4.9 15.5 4.9 21 9.5M6.5 13C10.1 9.9 13.9 9.9 17.5 13M10 16.5C11.4 15.4 12.6 15.4 14 16.5M12 20H12.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path
        d="M12 8.8A3.2 3.2 0 1 0 12 15.2A3.2 3.2 0 1 0 12 8.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15.1L20.8 16.2L19.2 19L17.5 18.5C16.9 19 16.2 19.4 15.4 19.7L15.1 21.5H8.9L8.6 19.7C7.8 19.4 7.1 19 6.5 18.5L4.8 19L3.2 16.2L4.6 15.1C4.5 14.7 4.5 14.4 4.5 14C4.5 13.6 4.5 13.3 4.6 12.9L3.2 11.8L4.8 9L6.5 9.5C7.1 9 7.8 8.6 8.6 8.3L8.9 6.5H15.1L15.4 8.3C16.2 8.6 16.9 9 17.5 9.5L19.2 9L20.8 11.8L19.4 12.9C19.5 13.3 19.5 13.6 19.5 14C19.5 14.4 19.5 14.7 19.4 15.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path
        d="M7 18.5L3.5 20L4.8 16.6C3.7 15.2 3 13.4 3 11.5C3 6.8 7 3 12 3C17 3 21 6.8 21 11.5C21 16.2 17 20 12 20H7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 11.5H8.51M12 11.5H12.01M15.5 11.5H15.51"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FloatingIcon({ className, children, delay = 0, yOffset = -20, xOffset = 10, duration = 8 }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-lg shadow-slate-950/10 backdrop-blur ${className}`}
      aria-hidden="true"
      animate={{
        y: [0, yOffset, 0],
        x: [0, xOffset, 0],
        rotate: [0, 6, -6, 0],
        opacity: [0.15, 0.4, 0.15],
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay,
      }}
    >
      <div className="h-10 w-10">{children}</div>
    </motion.div>
  );
}

function App() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 lg:px-8">
      <FloatingIcon 
        className="left-[6%] top-[18%] hidden text-cyan-200/25 lg:block"
        delay={0}
        yOffset={-25}
        xOffset={15}
        duration={9}
      >
        <WifiIcon />
      </FloatingIcon>
      <FloatingIcon 
        className="right-[8%] top-[22%] hidden text-violet-200/25 lg:block"
        delay={2}
        yOffset={-20}
        xOffset={-12}
        duration={10}
      >
        <SettingsIcon />
      </FloatingIcon>
      <FloatingIcon 
        className="bottom-[20%] left-[10%] hidden text-fuchsia-200/25 lg:block"
        delay={4}
        yOffset={25}
        xOffset={20}
        duration={12}
      >
        <ChatBubbleIcon />
      </FloatingIcon>
      <FloatingIcon 
        className="bottom-[14%] right-[12%] hidden text-sky-100/20 xl:block"
        delay={1}
        yOffset={22}
        xOffset={-18}
        duration={11}
      >
        <WifiIcon />
      </FloatingIcon>

      <div className="mx-auto flex h-[94vh] w-full max-w-6xl flex-col">
        <header className="px-2 pb-1 sm:px-4">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300">
            SupportFix AI
          </p>
        </header>

        <div className="min-h-0 flex flex-1 flex-col">
          <Chat />
        </div>
      </div>
    </main>
  );
}

export default App;
