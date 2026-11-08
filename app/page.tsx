"use client";

import React, { useState } from "react";
import GrammarSuggestions from "@/components/grammar/GrammarSuggestions";

export default function StoryWritingPage() {
  const [storyText, setStoryText] = useState(
      "One day, Little Red Riding Hood walk through the forest and see a strange bird sitting on a tree. She were curious and decided to follow it, but she don't tell her grandmother where she was going. After a while, she finds herself lost"
  );

  const [activeTab, setActiveTab] = useState<"S" | "G" | null>(null);
  const [activeMode, setActiveMode] = useState<"grammar" | "generate">(
      "grammar"
  );
  const [storyIdeas, setStoryIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const generateStoryIdeas = async () => {
    const mode = "generate";
    setActiveMode(mode);
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyText, mode }),
      });
      const data = await res.json();
      setStoryIdeas(data.ideas || []);
    } catch (err) {
      console.error("Failed to fetch from Groq:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tab: "S" | "G") => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  return (
      <div className="relative flex h-screen w-screen items-center bg-[#919db9] font-serif text-gray-900">
        {/* Help Button */}
        <button className="absolute top-4 right-4 h-8 w-8 rounded-full border-2 border-gray-900 font-sans text-sm font-bold text-gray-900">
          ?
        </button>

        {/* Book + S/G Tabs */}
        <div className="flex items-center">
          {/* Simple Book Page */}
          <div className="flex h-[85vh] w-[480px] flex-col justify-between rounded-r-2xl border-r-4 border-gray-500 bg-[#d6e8eb] p-8 text-gray-900">
            <div>
              <h1 className="mb-2 text-2xl font-bold uppercase text-gray-900">
                Introduction
              </h1>
              <p className="mb-4 text-xs text-gray-800">
                Using the setting elements from before, write the introduction for
                the story.
              </p>

              {/* Writing Box */}
              <div className="flex h-[240px] flex-col border border-gray-500 bg-[#b8ced3] p-3 text-gray-900">
              <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Write your story here..."
                  className="w-full flex-1 resize-none bg-transparent font-sans text-sm text-gray-900 placeholder-gray-600 focus:outline-none"
              />
                <p className="pt-1 text-right text-xs font-bold text-gray-900">
                  When suddenly, the young girl found...
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <button className="rounded bg-[#0a4d68] px-4 py-1.5 font-sans text-xs font-semibold text-white">
                  Finished Writing!
                </button>
              </div>
            </div>
          </div>

          {/* Simple S and G Buttons */}
          <div className="flex flex-col gap-12">
            <button
                id="suggestions-toggle"
                aria-label="Suggestions"
                aria-expanded={activeTab === "S"}
                onClick={() => handleTabClick("S")}
                className="h-10 w-12 rounded-r border border-l-0 border-gray-700 bg-[#ebdcf5] text-lg font-bold text-[#4a1d3d]"
            >
              S
            </button>
            <button
                id="guidelines-toggle"
                aria-label="Guidelines"
                aria-expanded={activeTab === "G"}
                onClick={() => handleTabClick("G")}
                className="h-10 w-12 rounded-r border border-l-0 border-gray-700 bg-[#ccf2f4] text-lg font-bold text-[#143d3f]"
            >
              G
            </button>
          </div>
        </div>

        {/* Static Timer */}
        <div className="absolute right-6 bottom-6 text-center text-gray-900">
          <div className="text-xs font-bold text-gray-900">Time Left:</div>
          <div className="rounded-full border border-gray-500 bg-[#e3dff0] px-5 py-1 text-2xl font-bold text-gray-900">
            5:00
          </div>
        </div>

        {/* Simple Right-Side Pane */}
        {activeTab && (
            <div
                role="region"
                aria-labelledby="writing-panel-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setActiveTab(null);
                    document.getElementById(activeTab === "S" ? "suggestions-toggle" : "guidelines-toggle")?.focus();
                  }
                }}
                className="fixed right-0 bottom-0 left-0 z-20 flex max-h-[42dvh] flex-col rounded-t-3xl border border-[#bbcdd5] bg-[#edf3f4] p-4 font-sans text-gray-900 shadow-xl lg:top-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[360px] lg:rounded-none lg:p-5">
              <div className="mb-3 flex shrink-0 items-center justify-between border-b border-gray-400 pb-2">
                <h2 id="writing-panel-title" className="font-serif text-xl font-bold text-[#284b58]">
                  {activeTab === "S" ? "Suggestions" : "Guidelines"}
                </h2>
                <button
                    aria-label="Close writing panel"
                    onClick={() => {
                      setActiveTab(null);
                      document.getElementById(activeTab === "S" ? "suggestions-toggle" : "guidelines-toggle")?.focus();
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-slate-600 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a4d68]"
                >
                  X
                </button>
              </div>

              {activeTab === "S" ? (
                  <>
                    <GrammarSuggestions
                        text={storyText}
                        onTextChange={setStoryText}
                        showSuggestions={activeMode === "grammar"}
                        onShowSuggestions={() => setActiveMode("grammar")}
                        toolbarAction={
                          <button
                              onClick={generateStoryIdeas}
                              disabled={loading}
                              className="min-h-11 flex-1 rounded-xl border border-[#cbb8d5] bg-[#ebdcf5] px-3 py-2 text-sm font-semibold text-[#514267] hover:bg-[#dec7ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a4d68] disabled:cursor-wait disabled:opacity-60"
                          >
                            Generate
                          </button>
                        }
                    />

                    {activeMode === "generate" && (
                      <div className="flex-1 space-y-2 overflow-y-auto text-gray-900">
                        {loading && <p className="text-xs font-medium text-gray-900">Loading...</p>}
                        {!loading && storyIdeas.map((idea, index) => (
                              <div
                                  key={index}
                                  className="rounded border border-gray-500 bg-[#e3dff0] p-2.5 text-xs font-medium text-gray-900"
                              >
                                {idea}
                              </div>
                        ))}
                      </div>
                    )}
                  </>
              ) : (
                  <div className="space-y-2 rounded border border-gray-500 bg-[#b8ced3] p-3 text-xs text-gray-900">
                    <p className="font-bold text-gray-900">Grammar &amp; Writing Tips:</p>
                    <p>• Check that your verbs are in the same tense.</p>
                    <p>• Describe the setting using sensory details.</p>
                  </div>
              )}
            </div>
        )}
      </div>
  );
}
