"use client";

import React, { useState } from "react";

interface GrammarItem {
  id: string;
  original: string;
  replacement: string;
  explanation?: string;
}

export default function StoryWritingPage() {
  const [storyText, setStoryText] = useState(
      "One day, Little Red Riding Hood walk through the forest and see a strange bird sitting on a tree. She were curious and decided to follow it, but she don't tell her grandmother where she was going. After a while, she finds herself lost"
  );

  const [activeTab, setActiveTab] = useState<"S" | "G" | null>(null);
  const [activeMode, setActiveMode] = useState<"grammar" | "generate" | null>(
      null
  );
  const [grammarList, setGrammarList] = useState<GrammarItem[]>([]);
  const [storyIdeas, setStoryIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const runAssistant = async (mode: "grammar" | "generate") => {
    setActiveMode(mode);
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyText, mode }),
      });
      const data = await res.json();
      if (mode === "grammar") {
        setGrammarList(data.grammar || []);
      } else {
        setStoryIdeas(data.ideas || []);
      }
    } catch (err) {
      console.error("Failed to fetch from Groq:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tab: "S" | "G") => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  const handleAcceptGrammar = (item: GrammarItem) => {
    if (item.original && storyText.includes(item.original)) {
      setStoryText((prev) => prev.replace(item.original, item.replacement));
    }
    setGrammarList((prev) => prev.filter((g) => g.id !== item.id));
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
                onClick={() => handleTabClick("S")}
                className="h-10 w-12 rounded-r border border-l-0 border-gray-700 bg-[#ebdcf5] text-lg font-bold text-[#4a1d3d]"
            >
              S
            </button>
            <button
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
            <div className="fixed top-0 right-0 z-20 flex h-full w-[340px] flex-col border-l-2 border-gray-500 bg-[#d6e8eb] p-4 font-sans text-gray-900 shadow-lg">
              <div className="mb-4 flex items-center justify-between border-b border-gray-400 pb-2">
                <h2 className="font-serif text-lg font-bold text-gray-900">
                  {activeTab === "S" ? "Suggestions" : "Guidelines"}
                </h2>
                <button
                    onClick={() => setActiveTab(null)}
                    className="px-2 text-sm font-bold text-gray-900 hover:text-black"
                >
                  X
                </button>
              </div>

              {activeTab === "S" ? (
                  <>
                    {/* 2 Simple Buttons */}
                    <div className="mb-4 flex gap-2">
                      <button
                          onClick={() => runAssistant("grammar")}
                          disabled={loading}
                          className="flex-1 rounded border border-gray-600 bg-[#e3dff0] py-2 text-xs font-bold text-gray-900 hover:bg-[#d4cef0]"
                      >
                        Check Grammar
                      </button>
                      <button
                          onClick={() => runAssistant("generate")}
                          disabled={loading}
                          className="flex-1 rounded border border-gray-600 bg-[#ebdcf5] py-2 text-xs font-bold text-gray-900 hover:bg-[#dec7ed]"
                      >
                        Generate
                      </button>
                    </div>

                    {/* Simple Output List */}
                    <div className="flex-1 space-y-2 overflow-y-auto text-gray-900">
                      {loading && (
                          <p className="text-xs font-medium text-gray-900">
                            Loading...
                          </p>
                      )}

                      {!loading &&
                          activeMode === "grammar" &&
                          (grammarList.length === 0 ? (
                              <p className="text-xs text-gray-900">
                                No grammar mistakes found.
                              </p>
                          ) : (
                              grammarList.map((item) => (
                                  <div
                                      key={item.id}
                                      className="rounded border border-gray-500 bg-[#b8ced3] p-2.5 text-xs text-gray-900"
                                  >
                                    <p className="mb-1">
                          <span className="mr-2 line-through text-red-700 font-medium">
                            {item.original}
                          </span>
                                      <span className="font-bold text-[#0a4d68]">
                            {item.replacement}
                          </span>
                                    </p>
                                    {item.explanation && (
                                        <p className="mb-2 text-gray-800">
                                          {item.explanation}
                                        </p>
                                    )}
                                    <button
                                        onClick={() => handleAcceptGrammar(item)}
                                        className="rounded bg-[#0a4d68] px-2.5 py-1 font-medium text-white"
                                    >
                                      Accept
                                    </button>
                                  </div>
                              ))
                          ))}

                      {!loading &&
                          activeMode === "generate" &&
                          storyIdeas.map((idea, index) => (
                              <div
                                  key={index}
                                  className="rounded border border-gray-500 bg-[#e3dff0] p-2.5 text-xs font-medium text-gray-900"
                              >
                                {idea}
                              </div>
                          ))}
                    </div>
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