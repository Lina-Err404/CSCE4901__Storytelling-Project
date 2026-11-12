import { Lexend } from "next/font/google";
import styles from "./joinLobby.module.css";

const lexend = Lexend({ subsets: ["latin"], weight: ["600", "800"] });

// Placeholder data. Replace this with real students later.
const SEATS = [{ you: true }, {}, {}, {}, {}];

export default function JoinLobby({ code }: { code: string }) {
  return (
    <main className={`${styles.page} ${lexend.className}`}>
      <svg className={styles.star} viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="52" className={styles.ring} />
        <path
          className={styles.starShape}
          d="M60 22C62 46 74 58 98 60C74 62 62 74 60 98C58 74 46 62 22 60C46 58 58 46 60 22Z"
        />
        <path className={styles.starShape} d="M92 10C93 17 96 20 103 21C96 22 93 25 92 32C91 25 88 22 81 21C88 20 91 17 92 10Z" />
      </svg>

      <h1 className={styles.heading}>You’re in!</h1>
      <p className={styles.sub}>Waiting for teacher to make groups...</p>

      <ul className={styles.seats} aria-label="Classmates who have joined">
        {SEATS.map((seat, i) => (
          <li key={i} className={`${styles.seat} ${seat.you ? styles.you : ""}`} />
        ))}
      </ul>
    </main>
  );
}