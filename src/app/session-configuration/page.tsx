
"use client";

import Link from "next/link";

const configurationOptions = [
  { title: "Breakout Rooms", action: "Edit", description: "Manage student breakout groups." },
  { title: "Timer", action: "Set", description: "Set the time limit for the activity." },
  { title: "Prompt Assignment", action: "Set", description: "Configure story prompts." },
  { title: "Assign Roles", action: "Edit", description: "Assign storytelling roles to students." },
  { title: "Word Limit", action: "Set", description: "Set the maximum number of words." },
  { title: "Presentation Mode", action: "Disabled", description: "Configure story presentation." },
];

export default function SessionConfigurationPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#080d25] to-[#164b96] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl rounded-2xl border-2 border-white/80 bg-[#0b1535]/60 p-8 shadow-2xl">
        
        <div className="mb-8">
          <Link
            href="/supabase-lobbies"
            className="inline-block mb-6 text-white/80 hover:text-white"
          >
            ← Back to Lobby
          </Link>

          <h1 className="text-4xl font-bold text-center mb-3">
            Session Configuration
          </h1>

          <p className="text-center text-white/80">
            Configure your storytelling activity before starting the session.
          </p>
        </div>

        <div className="space-y-4">
          {configurationOptions.map((option) => (
            <div
              key={option.title}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-white/20 bg-white/10 p-5"
            >
              <div>
                <h2 className="text-xl font-semibold">{option.title}</h2>
                <p className="text-sm text-white/70 mt-1">
                  {option.description}
                </p>
              </div>

              {option.title === "Timer" ? (
                <Link
                  href="/timer"
                  className="rounded-lg bg-white px-8 py-3 text-center font-semibold text-[#172c55] hover:bg-gray-200 transition"
                >
                  Set
                </Link>
              ) : (
                <button
                  disabled
                  className="rounded-lg bg-white/20 px-8 py-3 font-semibold text-white/60 cursor-not-allowed"
                >
                  {option.action}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            disabled
            className="rounded-xl bg-purple-400/60 px-12 py-4 text-lg font-semibold text-white/70 cursor-not-allowed"
          >
            Start Session
          </button>
        </div>
      </div>
    </main>
  );
}
