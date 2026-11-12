"use client";

import { useEffect, useState } from "react";
import { Fondamento, Nunito } from "next/font/google";
import styles from "./waitingRoom.module.css";

const display = Fondamento({ weight: "400", subsets: ["latin"] });
const ui = Nunito({ weight: ["700", "800"], subsets: ["latin"] });

// Placeholder data. We'll replace these with real values later.
const PLAYERS = [
  { id: "1", name: "Ezra" },
  { id: "2", name: "Alessia" },
  { id: "3", name: "Priya" },
];
const MY_ID = "2";
const MAX_PLAYERS = 6;

const TIPS = [
  { title: "How to play", body: "Each player adds one sentence at a time. Build on what came before!" },
  { title: "On your turn", body: "Your box lights up when it's your turn. Keep your sentence short." },
  { title: "Have fun", body: "There are no wrong answers. Silly stories are welcome." },
];

function Sparkle({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
    </svg>
  );
}

export default function WaitingRoom({ groupId }: { groupId: string }) {
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 6000);
    return () => clearInterval(timer);
  }, []);

  // Always show MAX_PLAYERS slots: real players first, then empty ones
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => PLAYERS[i] ?? null);

  return (
    <main className={`${styles.page} ${ui.className}`}>
      <div className={styles.frame}>
        <div className={styles.layout}>
          {/* LEFT: illustration */}
          <div className={styles.panel}>
            <div className={styles.panelInner}>
              <Sparkle className={styles.star1} size={44} />
              <Sparkle className={styles.star2} size={26} />
              <h1 className={`${styles.title} ${display.className}`}>
                Collab<br />Storytelling
              </h1>
            </div>
          </div>

          {/* RIGHT: lobby */}
          <div className={styles.lobby}>
            <h2 className={`${styles.heading} ${display.className}`}>Waiting for members...</h2>
            <div className={styles.divider}><span /><Sparkle size={18} /><span /></div>

            <ul className={styles.grid}>
              {slots.map((p, i) =>
                p ? (
                  <li key={p.id} className={`${styles.card} ${p.id === MY_ID ? styles.you : ""}`}>
                    {p.id === MY_ID && <span className={styles.badge}>YOU</span>}
                    <div className={styles.avatar}>{p.name[0].toUpperCase()}</div>
                    <span className={styles.name}>{p.name}</span>
                  </li>
                ) : (
                  <li key={`empty-${i}`} className={styles.empty} aria-label="Empty spot">?</li>
                )
              )}
            </ul>

            <section className={styles.howto} aria-live="polite">
              <p className={styles.status}>
                <Sparkle size={10} /> Your teacher will start the story soon <Sparkle size={10} />
              </p>
              <h2>{TIPS[tip].title}</h2>
              <p>{TIPS[tip].body}</p>
              <div className={styles.dots}>
                {TIPS.map((_, n) => (
                  <button
                    key={n}
                    aria-label={`Show tip ${n + 1}`}
                    onClick={() => setTip(n)}
                    className={n === tip ? styles.dotActive : styles.dot}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}