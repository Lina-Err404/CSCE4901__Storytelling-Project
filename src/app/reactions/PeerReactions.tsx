"use client";

import { useState, useEffect } from "react";

interface PeerReactionsProps {
  segmentId: string;
  currentUserId: string;
  readOnly?: boolean; // R7 (true on own page) vs R6 (false on peer's page)
}

const TOP_FOUR_REACTIONS = [
  { id: "heart", label: "❤️", name: "Love" },
  { id: "fire", label: "🔥", name: "Fire" },
  { id: "mindblown", label: "😲", name: "Shock" },
  { id: "sparkle", label: "✨", name: "Magic" },
];

export default function PeerReactions({
  segmentId,
  currentUserId,
  readOnly = false,
}: PeerReactionsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReacted, setUserReacted] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // fetch reactions (R7: View Reactions)
  useEffect(() => {
    if (!segmentId) return;
    async function fetchReactions() {
      try {
        const res = await fetch(`/api/reactions?segmentId=${segmentId}`);
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
          const mine = data.reactions?.find(
            (r: any) => r.student_id === currentUserId
          );
          if (mine) setUserReacted(mine.reaction_type);
        }
      } catch {
        // Backend route not wired yet; falls back to local state cleanly
      }
    }
    fetchReactions();
  }, [segmentId, currentUserId]);

  // handle reaction click (R6: Send Reaction)
  const handleReact = async (reactionType: string) => {
    if (readOnly) return;

    setAnimatingId(reactionType);
    setTimeout(() => setAnimatingId(null), 300);

    // Optimistic UI update (handles switching reactions or clicking for the first time)
    setCounts((prev) => {
      const next = { ...prev };
      if (userReacted && userReacted !== reactionType && next[userReacted] > 0) {
        next[userReacted] -= 1;
      }
      if (userReacted !== reactionType) {
        next[reactionType] = (next[reactionType] || 0) + 1;
      }
      return next;
    });
    setUserReacted(reactionType);

    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId,
          studentId: currentUserId,
          reactionType,
        }),
      });
    } catch {
      // Backend route pending integration
    }
  };

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[#d7cce7] bg-[#f5f0fa]/95 px-3 py-1.5 shadow-sm">
      <span className="text-xs font-semibold text-[#514267]">
        {readOnly ? "Your Reactions:" : "React:"}
      </span>
      <div className="flex gap-1.5">
        {TOP_FOUR_REACTIONS.map((rx) => {
          const isSelected = userReacted === rx.id;
          const isBumping = animatingId === rx.id;
          return (
            <button
              key={rx.id}
              type="button"
              disabled={readOnly}
              onClick={() => handleReact(rx.id)}
              title={readOnly ? `${rx.name} reactions` : `React with ${rx.name}`}
              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs transition-transform ${
                isSelected
                  ? "border-[#0a4d68] bg-[#e3dff0] font-bold text-[#0a4d68]"
                  : "border-[#ccd9df] bg-white text-slate-700 hover:bg-slate-50"
              } ${isBumping ? "scale-125" : "scale-100"} ${
                readOnly ? "cursor-default opacity-90" : "cursor-pointer"
              }`}
            >
              <span>{rx.label}</span>
              <span>{counts[rx.id] || 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}