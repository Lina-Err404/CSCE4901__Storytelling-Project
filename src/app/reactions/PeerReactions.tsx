/*
use this to import onto a page:
import PeerReactions from "@/app/reactions/PeerReactions";
*/

"use client";

import { useState, useEffect } from "react";

interface PeerReactionsProps {
  segmentId: string;
  currentUserId: string;
  readOnly?: boolean; // R7 (true on own page) vs R6 (false on peer's page)
}

interface ReactionOption {
  id: string;
  label: string;
  name: string;
}

// Flip to true once the port 4000 backend /reactions route is live
const USE_BACKEND_API = false;

// Full pool of age-appropriate reactions students can pick from
const REACTION_POOL: ReactionOption[] = [
  { id: "heart", label: "❤️", name: "Love" },
  { id: "fire", label: "🔥", name: "Fire" },
  { id: "mindblown", label: "😲", name: "Shock" },
  { id: "sparkle", label: "✨", name: "Magic" },
  { id: "thumbsup", label: "👍", name: "Great Job" },
  { id: "laugh", label: "😂", name: "Funny" },
  { id: "party", label: "🎉", name: "Celebrate" },
  { id: "star", label: "⭐", name: "Star" },
  { id: "clap", label: "👏", name: "Applause" },
  { id: "thinking", label: "🤔", name: "Curious" },
  { id: "rocket", label: "🚀", name: "Awesome" },
  { id: "idea", label: "💡", name: "Cool Idea" },
];

const DEFAULT_TOP_FOUR_IDS = ["heart", "fire", "mindblown", "sparkle"];

const SEGMENT_STORAGE_KEY = "collab_segment_reactions_v1";
const TOP_FOUR_STORAGE_PREFIX = "collab_user_top4_reactions_v1";

type StoredSegmentReactions = Record<
  string, // segmentId
  {
    counts: Record<string, number>;
    byUser: Record<string, string>; // studentId -> reactionId
  }
>;

function readAllSegmentReactions(): StoredSegmentReactions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEGMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAllSegmentReactions(data: StoredSegmentReactions) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEGMENT_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("collab-reactions-updated"));
  } catch {
    // ignore storage errors
  }
}

function readUserTopFour(userId: string): string[] {
  if (typeof window === "undefined") return DEFAULT_TOP_FOUR_IDS;
  try {
    const userRaw = window.localStorage.getItem(`${TOP_FOUR_STORAGE_PREFIX}_${userId}`);
    const fallbackRaw = window.localStorage.getItem(TOP_FOUR_STORAGE_PREFIX);
    const parsed = userRaw ? JSON.parse(userRaw) : fallbackRaw ? JSON.parse(fallbackRaw) : null;
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      parsed.every((id) => REACTION_POOL.some((r) => r.id === id))
    ) {
      return parsed;
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_TOP_FOUR_IDS;
}

function writeUserTopFour(userId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TOP_FOUR_STORAGE_PREFIX}_${userId}`, JSON.stringify(ids));
    window.localStorage.setItem(TOP_FOUR_STORAGE_PREFIX, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export default function PeerReactions({
  segmentId,
  currentUserId,
  readOnly = false,
}: PeerReactionsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReacted, setUserReacted] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Top 4 customization state
  const [topFourIds, setTopFourIds] = useState<string[]>(DEFAULT_TOP_FOUR_IDS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceSlot, setReplaceSlot] = useState<number>(0);

  // Load user's saved Top 4 reactions
  useEffect(() => {
    setTopFourIds(readUserTopFour(currentUserId));
    setPickerOpen(false);
  }, [currentUserId]);

  // Load reactions for this specific segmentId (R7: View Reactions)
  useEffect(() => {
    if (!segmentId) return;

    const loadFromLocal = () => {
      const all = readAllSegmentReactions();
      const seg = all[segmentId];
      setCounts(seg?.counts ? { ...seg.counts } : {});
      setUserReacted(seg?.byUser?.[currentUserId] ?? null);
    };

    loadFromLocal();

    async function fetchReactions() {
      if (!USE_BACKEND_API) return;
      try {
        const res = await fetch(`/api/reactions?segmentId=${segmentId}`);
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
          const mine = data.reactions?.find(
            (r: { student_id: string; reaction_type: string }) =>
              r.student_id === currentUserId
          );
          setUserReacted(mine ? mine.reaction_type : null);
        }
      } catch {
        // Falls back to local state cleanly
      }
    }

    fetchReactions();

    const onStorageSync = () => loadFromLocal();
    window.addEventListener("collab-reactions-updated", onStorageSync);
    window.addEventListener("storage", onStorageSync);
    return () => {
      window.removeEventListener("collab-reactions-updated", onStorageSync);
      window.removeEventListener("storage", onStorageSync);
    };
  }, [segmentId, currentUserId]);

  // Handle reaction click on a peer's story (R6: Give Reactions)
  const handleReact = async (reactionType: string) => {
    if (readOnly || !segmentId) return;

    setAnimatingId(reactionType);
    setTimeout(() => setAnimatingId(null), 300);

    const all = readAllSegmentReactions();
    const currentSeg = all[segmentId] ?? { counts: {}, byUser: {} };
    const nextCounts = { ...currentSeg.counts };
    const nextByUser = { ...currentSeg.byUser };
    const previousReaction = nextByUser[currentUserId] ?? null;

    // Clicking the same reaction toggles it off; clicking a new one switches it
    let nextSelected: string | null = reactionType;
    if (previousReaction === reactionType) {
      if (nextCounts[reactionType] > 0) nextCounts[reactionType] -= 1;
      delete nextByUser[currentUserId];
      nextSelected = null;
    } else {
      if (previousReaction && nextCounts[previousReaction] > 0) {
        nextCounts[previousReaction] -= 1;
      }
      nextCounts[reactionType] = (nextCounts[reactionType] || 0) + 1;
      nextByUser[currentUserId] = reactionType;
    }

    all[segmentId] = { counts: nextCounts, byUser: nextByUser };
    writeAllSegmentReactions(all);

    setCounts(nextCounts);
    setUserReacted(nextSelected);

    if (USE_BACKEND_API) {
      try {
        await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segmentId,
            studentId: currentUserId,
            reactionType: nextSelected,
          }),
        });
      } catch {
        // Backend route pending integration
      }
    }
  };

  // Swap an emoji from the pool into the user's Top 4 bar
  const handlePickEmoji = (emojiId: string) => {
    const existingIdx = topFourIds.indexOf(emojiId);
    if (existingIdx !== -1) {
      // If already in Top 4, focus that slot to replace next
      setReplaceSlot(existingIdx);
      return;
    }
    const next = [...topFourIds];
    next[replaceSlot] = emojiId;
    setTopFourIds(next);
    writeUserTopFour(currentUserId, next);
    setReplaceSlot((prev) => (prev + 1) % 4);
  };

  const handleResetTopFour = () => {
    setTopFourIds(DEFAULT_TOP_FOUR_IDS);
    writeUserTopFour(currentUserId, DEFAULT_TOP_FOUR_IDS);
    setReplaceSlot(0);
  };

  // Build the reactions to display on the bar
  const topFourOptions = topFourIds
    .map((id) => REACTION_POOL.find((r) => r.id === id))
    .filter((r): r is ReactionOption => Boolean(r));

  // If viewing own page (R7), also show any other emoji from the pool that received > 0 reactions
  const extraReceivedOptions = readOnly
    ? REACTION_POOL.filter(
        (r) => !topFourIds.includes(r.id) && (counts[r.id] || 0) > 0
      )
    : [];

  const displayedReactions = [...topFourOptions, ...extraReceivedOptions];

  return (
    <div className="relative flex items-center gap-2 rounded-2xl border border-[#d7cce7] bg-[#f5f0fa]/95 px-3 py-1.5 shadow-sm select-none">
      {/* Popover to customize Top 4 emojis */}
      {pickerOpen && !readOnly && (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-2xl border-2 border-[#514267] bg-white p-3 shadow-xl">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#514267]">
              Customize Your Top 4
            </span>
            <button
              type="button"
              onClick={handleResetTopFour}
              className="cursor-pointer text-[10px] font-semibold text-[#0a4d68] underline hover:opacity-80"
            >
              Reset
            </button>
          </div>

          {/* 4 active slots preview */}
          <div className="mb-2 flex items-center justify-center gap-1.5 rounded-xl bg-[#f5f0fa] p-1.5">
            {topFourOptions.map((rx, idx) => (
              <button
                key={rx.id}
                type="button"
                onClick={() => setReplaceSlot(idx)}
                title={`Slot ${idx + 1}: ${rx.name} (click to replace)`}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-base transition-transform ${
                  replaceSlot === idx
                    ? "scale-110 border-2 border-[#0a4d68] bg-white shadow-sm"
                    : "border-[#d7cce7] bg-white/70 opacity-80"
                }`}
              >
                {rx.label}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-center text-[10px] text-slate-500">
            Click a slot above, then pick an emoji below:
          </p>

          {/* Pool of 12 emojis */}
          <div className="grid grid-cols-6 gap-1.5">
            {REACTION_POOL.map((rx) => {
              const inTopFour = topFourIds.includes(rx.id);
              return (
                <button
                  key={rx.id}
                  type="button"
                  onClick={() => handlePickEmoji(rx.id)}
                  title={rx.name}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-base transition-transform hover:scale-110 ${
                    inTopFour
                      ? "border-[#0a4d68] bg-[#e3dff0] font-bold"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  {rx.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <span className="text-xs font-semibold text-[#514267]">
        {readOnly ? "Your Reactions:" : "React:"}
      </span>

      <div className="flex flex-wrap gap-1.5">
        {displayedReactions.map((rx) => {
          const isSelected = !readOnly && userReacted === rx.id;
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
                readOnly ? "cursor-default opacity-95" : "cursor-pointer"
              }`}
            >
              <span>{rx.label}</span>
              <span>{counts[rx.id] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* + / Edit Top 4 button on peer pages */}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          title="Customize your top 4 reactions"
          aria-label="Customize your top 4 reactions"
          className={`ml-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border text-xs font-bold transition-colors ${
            pickerOpen
              ? "border-[#0a4d68] bg-[#0a4d68] text-white"
              : "border-[#ccd9df] bg-white text-[#514267] hover:bg-slate-100"
          }`}
        >
          {pickerOpen ? "✓" : "+"}
        </button>
      )}
    </div>
  );
}