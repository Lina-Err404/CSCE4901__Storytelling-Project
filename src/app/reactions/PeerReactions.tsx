/*
use this to import onto a page:
import PeerReactions from "@/app/reactions/PeerReactions";
*/

"use client";

import { useState, useEffect } from "react";

interface PeerReactionsProps {
  segmentId: string;
  currentUserId: string;
}

// some quick placeholder reactions, still working
const TOP_FOUR_REACTIONS = [
  { id: "heart", label: "❤️", name: "Love" },
  { id: "fire", label: "🔥", name: "Fire" },
  { id: "mindblown", label: "😲", name: "Shock" },
  { id: "sparkle", label: "✨", name: "Magic" },
];

export default function PeerReactions({ segmentId, currentUserId }: PeerReactionsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReacted, setUserReacted] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // fetch reactions (R7: View Reactions)
  useEffect(() => {
    async function fetchReactions() {
      try {
        const res = await fetch(`/api/reactions?segmentId=${segmentId}`);
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
          const mine = data.reactions?.find((r: any) => r.student_id === currentUserId);
          if (mine) setUserReacted(mine.reaction_type);
        }
      } catch (err) {
        console.error("Failed to load reactions", err);
      }
    }
    fetchReactions();
  }, [segmentId, currentUserId]);

  // handle reaction click (R6: Send Reaction)
  const handleReact = async (reactionType: string) => {
    setAnimatingId(reactionType);
    setTimeout(() => setAnimatingId(null), 300);

    // UI update
    setCounts((prev) => ({
      ...prev,
      [reactionType]: (prev[reactionType] || 0) + 1,
    }));
    setUserReacted(reactionType);

    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId, studentId: currentUserId, reactionType }),
      });
    } catch (err) {
      console.error("Failed to save reaction", err);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#d7cce7] bg-[#f5f0fa] p-3 shadow-sm">
      <span className="text-xs font-semibold text-[#514267]">Reactions:</span>
      <div className="flex gap-2">
        {TOP_FOUR_REACTIONS.map((rx) => {
          const isSelected = userReacted === rx.id;
          const isBumping = animatingId === rx.id;
          return (
            <button
              key={rx.id}
              onClick={() => handleReact(rx.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-transform ${
                isSelected
                  ? "border-[#0a4d68] bg-[#e3dff0] font-bold text-[#0a4d68]"
                  : "border-[#ccd9df] bg-white text-slate-700 hover:bg-slate-50"
              } ${isBumping ? "scale-125" : "scale-100"}`}
            >
              <span>{rx.label}</span>
              <span className="text-xs">{counts[rx.id] || 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}