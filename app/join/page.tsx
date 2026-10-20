"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lexend } from "next/font/google";
import styles from "./join.module.css";

const lexend = Lexend({ subsets: ["latin"], weight: ["600", "800"] });

const CODE_LENGTH = 6;

export default function JoinLobbyPage() {
  const router = useRouter();
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const code = chars.join("");
  const isComplete = code.length === CODE_LENGTH;

  const clean = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  const handleChange = (index: number, value: string) => {
    const cleaned = clean(value);
    const next =
      cleaned.length > 1 && cleaned[0] !== chars[index]
        ? cleaned[0]
        : cleaned.slice(-1);
    setChars((prev) => prev.map((c, i) => (i === index ? next : c)));
    if (next && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      inputs.current[index + 1]?.focus();
    }
    if (e.key === "Enter" && isComplete) handleJoin();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = clean(e.clipboardData.getData("text")).slice(0, CODE_LENGTH);
    if (!pasted) return;
    setChars(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ""));
    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    if (!isComplete || isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/lobby/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode: code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to join lobby.");
        return;
      }
      router.push(`/lobby/${data.code ?? code}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={`${styles.page} ${lexend.className}`}>
      {/* Sun asset */}
      <Image src="/assets/Sun_Element.svg" alt="" width={72} height={72}/>
      {/* Code tiles */}
      <div className={styles.codeRow}>
        {chars.map((char, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            className={styles.tile}
            value={char}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            maxLength={2}
            autoComplete="off"
            aria-label={`Lobby code character ${i + 1} of ${CODE_LENGTH}`}
          />
        ))}
      </div>

      {/* Join button */}
      <div className={styles.joinRow}>
        <Image
            className={styles.side}
            src="/assets/Moon_1.svg"
            alt=""
            width={62}
            height={47}
        />
        <button
            type="button"
            className={styles.joinButton}
            onClick={handleJoin}
            disabled={!isComplete || isLoading}
        >
            <span>{isLoading ? "Joining..." : "Join"}</span>
        </button>
        <Image
            className={styles.side}
            src="/assets/Moon_2.svg"
            alt=""
            width={69}
            height={47}
        />
      </div>

      {error && (
        <p role="alert" className={styles.tagline}>
          {error}
        </p>
      )}
      <p className={styles.tagline}>Ready for your next story?</p>

      {/* Stars asset */}
      <Image src="/assets/Stars_Element.svg" alt="" width={90} height={34} />
    </main>
  );
}