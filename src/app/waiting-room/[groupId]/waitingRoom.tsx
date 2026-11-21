"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase-lobbies/supabase-client";
import styles from "./waitingRoom.module.css";

type Props = { groupId: string };

type Player = { id: string; name: string };
type Instruction = { title: string; body: string };

type WaitingRoomData = {
  assigned: boolean;
  status: string;
  groupId: string | null;
  myId: string;
  students: Player[];
  instructions: Instruction[];
};

const SLOT_COUNT = 6;

const FALLBACK_TIP: Instruction = {
  title: "Get ready!",
  body: "Your teacher will start the story soon.",
};

export default function WaitingRoom({ groupId }: Props) {
  /* Backend logic */
  const [data, setData] = useState<WaitingRoomData | null>(null);
  const [tip, setTip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* TEMP */
  const [debug, setDebug] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWaitingRoom() {
      try {
        if (!supabase) {
          throw new Error("Supabase is not configured.");
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        /* TEMP */
        const session = sessionData.session;
        if (!cancelled) {
          setDebug (
            session
            ? `Signed in as ${session.user.email ?? session.user.id}`
            : `No session found · sb- keys: ${
                Object.keys(localStorage).filter((k) => k.startsWith("sb-")).length
            }`
          );
        }

        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("You must be signed in.");
        }

        const response = await fetch("/api/supabase/waiting-room", {
          headers: { Authorization: `Bearer ${token}` },
        });

        /* TEMP */
        if (!cancelled) setDebug((d) => `${d} · API ${response.status}`);

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Could not load waiting room.");
        }

        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load waiting room."
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

  // Rotate the "how to play" tips every 6 seconds
  const tipCount = data?.instructions.length ?? 0;

  useEffect(() => {
    if (!tipCount) return;
    const timer = setInterval(() => setTip((n) => (n + 1) % tipCount), 6000);
    return () => clearInterval(timer);
  }, [tipCount]);

  /* What to show */
  const ready = !loading && !error && data?.assigned ? data : null;

  const heading = loading
    ? "Loading waiting room…"
    : error
      ? "Could not load waiting room"
      : !data?.assigned
        ? "Waiting for teacher to make groups…"
        : "Waiting for members…";

  const currentTip = ready?.instructions[tip] ?? FALLBACK_TIP;

  /* Frontend / Layout for UI */
  return (
    <main className={styles.page} data-group-id={groupId}>
      <div className={styles.frame} aria-hidden />

      <div className={styles.spread}>
        <section className={`${styles.leaf} ${styles.leafLeft}`}>
          <img src="/assets/Clouds.svg" alt="" className={`${styles.art} ${styles.clouds}`} />
          <div className={styles.leafBox}>
            <div className={styles.storyCol}>
              <img src="/assets/poster_card.svg" alt="Collab Storytelling" className={`${styles.art} ${styles.cardArt}`} />
              <img src="/assets/Moons.svg" alt="" className={`${styles.art} ${styles.moons}`} />
              <img src="/assets/stars.svg" alt="" className={`${styles.art} ${styles.stars}`} />
              <img src="/assets/Animated_star1.svg" alt="" className={`${styles.art} ${styles.star1}`} />
              <img src="/assets/Animated_star2.svg" alt="" className={`${styles.art} ${styles.star2}`} />
              <img src="/assets/Animated_star3.svg" alt="" className={`${styles.art} ${styles.star3}`} />
            </div>
          </div>
        </section>

        <section className={`${styles.leaf} ${styles.leafRight}`}>
          <div className={styles.leafBox}>
            <div className={styles.rightCol}>
              <header className={styles.heading}>
                <h1
                  className={`${styles.headingText} ${
                    heading.length > 24 ? styles.headingLong : ""
                  }`}
                >
                  {heading}
                </h1>
                <div className={styles.divider} aria-hidden>
                  <img src="/assets/divider_sparkle.svg" alt="" className={styles.dividerArt} />
                </div>
              </header>

              {error && (
                <p className={styles.message} role="alert">
                  {error}
                </p>
              )}

              {ready && (
                <>
                  <ul className={styles.members} aria-label="Group members">
                    {Array.from({ length: SLOT_COUNT }, (_, i) => {
                      const player = ready.students[i];

                      if (!player) {
                        return (
                          <li
                            key={`empty-${i}`}
                            className={`${styles.slot} ${styles.slotEmpty}`}
                            aria-label="Waiting for a member"
                          >
                            <span className={styles.qmark} aria-hidden>?</span>
                          </li>
                        );
                      }

                      const isYou = player.id === ready.myId;

                      return (
                        <li
                          key={`member-${player.id}`}
                          className={`${styles.slot} ${styles.slotFilled} ${isYou ? styles.slotYou : ""}`}
                        >
                          {isYou && <span className={styles.youBadge}>You</span>}
                          <span className={styles.avatar} aria-hidden>
                            {player.name[0]?.toUpperCase() ?? "?"}
                          </span>
                          <span className={styles.memberName}>{player.name}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className={styles.info} aria-live="polite">
                    <p className={styles.teacherLine}>
                      <img src="/assets/spark.svg" alt="" aria-hidden className={styles.spark} />
                      Your teacher will start the story soon
                      <img src="/assets/spark.svg" alt="" aria-hidden className={styles.spark} />
                    </p>
                    <div className={styles.infoRule} aria-hidden />
                    <h2 className={styles.howTitle}>{currentTip.title}</h2>
                    <p className={styles.howBody}>{currentTip.body}</p>

                    {ready.instructions.length > 0 && (
                      <div className={styles.dots}>
                        {ready.instructions.map((_, n) => (
                          <button
                            key={n}
                            type="button"
                            aria-label={`Show tip ${n + 1}`}
                            aria-current={n === tip}
                            onClick={() => setTip(n)}
                            className={`${styles.dot} ${n === tip ? styles.dotOn : ""}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
      <div className={styles.crease} aria-hidden />

      {/* TEMP */}
      {process.env.NODE_ENV === "development" && (
        <p className={styles.debug}>{debug}</p>
      )}
    </main>
  );
}