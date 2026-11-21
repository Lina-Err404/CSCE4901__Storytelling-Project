"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase-lobbies/supabase-client";
import styles from "./joinLobby.module.css";

const SLOT_COUNT = 5;

type Player = { id: string; name: string; icon: string }; // can pass real players in later

export default function JoinLobby({ players = [] }: { players?: Player[] }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkAssignment() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/supabase/waiting-room", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const payload = await res.json();
      if (!cancelled && payload.assigned && payload.groupId) {
        router.replace(`/waiting-room/${encodeURIComponent(payload.groupId)}`);
      }
    }

    void checkAssignment();
    const timer = setInterval(() => void checkAssignment(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);
    <main className={styles.page}>
      {/* Background Content */}
      {/* Stars */}
      <img src="/assets/BG_stars.svg" alt="" aria-hidden className={styles.stars} />

      {/* Waves Borders Component*/}
      <img src="/assets/left_wave_cropped.svg" alt="" aria-hidden className={`${styles.wave} ${styles.waveTL}`} />
      <img src="/assets/right_wave_cropped.svg" alt="" aria-hidden className={`${styles.wave} ${styles.waveBR}`} />

      {/* Foreground Content */}
      <div className={styles.content}>
        <div className={styles.sparkle} aria-hidden>

          {/* Sparkle Components*/}
          <img src="/assets/sparkle_ring.svg"  alt="" className={`${styles.layer} ${styles.ring}`} />
          <img src="/assets/sparkle_outer.svg" alt="" className={`${styles.layer} ${styles.outer}`} />
          <img src="/assets/sparkle_inner.svg" alt="" className={`${styles.layer} ${styles.inner}`} />
          <img src="/assets/sparkle_small.svg" alt="" className={styles.small} />
        </div>

        <h1 className={styles.title}>You're in!</h1>
        <p className={styles.subtitle}>Waiting for host to make groups...</p>

        {/* Player Slots*/}
        <ul className={styles.slots} aria-label="Players in lobby">
          {Array.from({ length: SLOT_COUNT }, (_, i) => (
            <li key={i} 
              style={{ "--i": i } as React.CSSProperties}
              className={[
              styles.slot,
              i === 0 && styles.slotYou,
              i === 1 && styles.slotNext,
            ].filter(Boolean).join(" ")}
            >
              {players[i] && (
              <img src={players[i].icon} alt={players[i].name} className={styles.slotIcon} />
            )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}