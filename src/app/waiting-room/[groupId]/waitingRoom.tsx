"use client";

import { useEffect, useState } from "react";
import { Fondamento, Nunito } from "next/font/google";
import { supabase } from "../../supabase-lobbies/supabase-client";
import styles from "./waitingRoom.module.css";

const display = Fondamento({ weight: "400", subsets: ["latin"] });
const ui = Nunito({ weight: ["700", "800"], subsets: ["latin"] });

type Player = {
  id: string;
  name: string;
};

type Instruction = {
  title: string;
  body: string;
};

type WaitingRoomData = {
  assigned: boolean;
  status: string;
  groupId: string | null;
  myId: string;
  students: Player[];
  instructions: Instruction[];
};

const MAX_PLAYERS = 6;

function Sparkle({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"
      />
    </svg>
  );
}

export default function WaitingRoom({
  groupId,
}: {
  groupId: string;
}) {
  const [data, setData] = useState<WaitingRoomData | null>(null);
  const [tip, setTip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWaitingRoom() {
      try {
        if (!supabase) {
          throw new Error("Supabase is not configured.");
        }

        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("You must be signed in.");
        }

        const response = await fetch("/api/supabase/waiting-room", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ?? "Could not load waiting room."
          );
        }

        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load waiting room."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWaitingRoom();

    const refresh = setInterval(() => {
      void loadWaitingRoom();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, [groupId]);

  useEffect(() => {
    if (!data?.instructions.length) return;

    const timer = setInterval(
      () =>
        setTip(
          (n) => (n + 1) % data.instructions.length
        ),
      6000
    );

    return () => clearInterval(timer);
  }, [data?.instructions]);

  if (loading) {
    return (
      <main className={`${styles.page} ${ui.className}`}>
        <div className={styles.frame}>
          <div className={styles.layout}>
            <div className={styles.lobby}>
              <h2
                className={`${styles.heading} ${display.className}`}
              >
                Loading waiting room...
              </h2>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={`${styles.page} ${ui.className}`}>
        <div className={styles.frame}>
          <div className={styles.layout}>
            <div className={styles.lobby}>
              <h2
                className={`${styles.heading} ${display.className}`}
              >
                Could not load waiting room
              </h2>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!data?.assigned) {
    return (
      <main className={`${styles.page} ${ui.className}`}>
        <div className={styles.frame}>
          <div className={styles.layout}>
            <div className={styles.panel}>
              <div className={styles.panelInner}>
                <Sparkle className={styles.star1} size={44} />
                <Sparkle className={styles.star2} size={26} />
                <h1
                  className={`${styles.title} ${display.className}`}
                >
                  Collab
                  <br />
                  Storytelling
                </h1>
              </div>
            </div>

            <div className={styles.lobby}>
              <h2
                className={`${styles.heading} ${display.className}`}
              >
                Waiting for teacher to make groups...
              </h2>

              <div className={styles.divider}>
                <span />
                <Sparkle size={18} />
                <span />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const players = data.students;
  const instructions = data.instructions;

  const slots = Array.from(
    { length: MAX_PLAYERS },
    (_, i) => players[i] ?? null
  );

  const currentTip =
    instructions[tip] ?? {
      title: "Get ready!",
      body: "Your teacher will start the story soon.",
    };

  return (
    <main className={`${styles.page} ${ui.className}`}>
      <div className={styles.frame}>
        <div className={styles.layout}>
          <div className={styles.panel}>
            <div className={styles.panelInner}>
              <Sparkle className={styles.star1} size={44} />
              <Sparkle className={styles.star2} size={26} />

              <h1
                className={`${styles.title} ${display.className}`}
              >
                Collab
                <br />
                Storytelling
              </h1>
            </div>
          </div>

          <div className={styles.lobby}>
            <h2
              className={`${styles.heading} ${display.className}`}
            >
              Waiting for members...
            </h2>

            <div className={styles.divider}>
              <span />
              <Sparkle size={18} />
              <span />
            </div>

            <ul className={styles.grid}>
              {slots.map((player, i) =>
                player ? (
                  <li
                    key={player.id}
                    className={`${styles.card} ${
                      player.id === data.myId
                        ? styles.you
                        : ""
                    }`}
                  >
                    {player.id === data.myId && (
                      <span className={styles.badge}>YOU</span>
                    )}

                    <div className={styles.avatar}>
                      {player.name[0]?.toUpperCase() ?? "?"}
                    </div>

                    <span className={styles.name}>
                      {player.name}
                    </span>
                  </li>
                ) : (
                  <li
                    key={`empty-${i}`}
                    className={styles.empty}
                    aria-label="Empty spot"
                  >
                    ?
                  </li>
                )
              )}
            </ul>

            <section
              className={styles.howto}
              aria-live="polite"
            >
              <p className={styles.status}>
                <Sparkle size={10} /> Your teacher will start
                the story soon <Sparkle size={10} />
              </p>

              <h2>{currentTip.title}</h2>
              <p>{currentTip.body}</p>

              <div className={styles.dots}>
                {instructions.map((_, n) => (
                  <button
                    key={n}
                    aria-label={`Show tip ${n + 1}`}
                    onClick={() => setTip(n)}
                    className={
                      n === tip
                        ? styles.dotActive
                        : styles.dot
                    }
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