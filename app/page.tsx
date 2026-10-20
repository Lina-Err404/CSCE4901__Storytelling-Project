
"use client";

import { useState } from "react";

const students = [
  { id: 1, name: "Alex Rivera", username: "AlexR", joined: true },
  { id: 2, name: "Jamie Lee", username: "JamieL", joined: true },
  { id: 3, name: "Maria Chen", username: "MariaC", joined: true },
  { id: 4, name: "Daniel Brown", username: "DanielB", joined: false },
  { id: 5, name: "Taylor Wilson", username: "TaylorW", joined: false },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Class Lobby");
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const lobbyCode = "ABC123";
  const joinedCount = students.filter((s) => s.joined).length;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(lobbyCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const navItems = [
    { label: "Class Lobby", icon: "⌂" },
    { label: "Students", icon: "♙" },
    { label: "Story Sections", icon: "▤" },
    { label: "Moderation", icon: "◇" },
    { label: "Settings", icon: "⚙" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-5 md:flex md:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-2xl text-white">
              📖
            </div>
            <div>
              <p className="font-bold">Collab</p>
              <p className="text-sm text-slate-500">Storytelling</p>
            </div>
          </div>

          <p className="mb-3 mt-10 text-xs font-bold uppercase tracking-widest text-slate-400">
            Teacher workspace
          </p>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === item.label
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
                {item.label === "Class Lobby" && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-indigo-50 p-4">
            <div className="text-xl">🛡️</div>
            <p className="mt-2 font-semibold text-indigo-950">
              A safe space to create
            </p>
            <p className="mt-1 text-sm leading-5 text-indigo-800">
              Your class, your stories, your rules.
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700">
              T
            </div>
            <div>
              <p className="text-sm font-semibold">Teacher account</p>
              <p className="text-xs text-slate-500">Host</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-8">
            <div>
              <p className="text-sm text-slate-500">
                Teacher workspace / {activeTab}
              </p>
              <h1 className="mt-1 text-xl font-bold md:text-2xl">
                {activeTab}
              </h1>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              ● Host
            </span>
          </header>

          <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
            {activeTab !== "Class Lobby" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8">
                <h2 className="text-xl font-bold">{activeTab}</h2>
                <p className="mt-2 text-slate-600">
                  This area belongs to the {activeTab.toLowerCase()} workflow.
                  It is not implemented by this R13 lobby prototype yet.
                </p>
                <button
                  onClick={() => setActiveTab("Class Lobby")}
                  className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
                >
                  Return to Class Lobby
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-indigo-600">
                      YOUR CLASS
                    </p>
                    <h2 className="mt-1 text-2xl font-bold">
                      Classroom Writing Session
                    </h2>
                    <p className="mt-2 text-slate-500">
                      Manage access and see which students have joined.
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
                    ● {started ? "Session started" : "Lobby open"}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label: "Students in class",
                      value: "24",
                      note: "Illustrative class roster",
                    },
                    {
                      label: "Students joined",
                      value: String(joinedCount),
                      note: "Demo participant data",
                    },
                    {
                      label: "Waiting to join",
                      value: String(students.length - joinedCount),
                      note: "In the sample list",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-sm text-slate-500">{item.label}</p>
                      <p className="mt-2 text-3xl font-bold">{item.value}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-5">
                  <div className="space-y-6 lg:col-span-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl">
                          🔐
                        </div>
                        <div>
                          <h3 className="font-bold">Class-only access</h3>
                          <p className="text-sm text-slate-500">
                            Restricted student participation
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="font-semibold text-emerald-900">
                          Only your class can participate
                        </p>
                        <p className="mt-1 text-sm leading-5 text-emerald-800">
                          The backend must verify each student's class
                          membership before allowing them to join.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="font-bold">Lobby invitation</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        Share the code with students in your class.
                      </p>

                      <div className="mt-5 rounded-2xl bg-indigo-50 px-4 py-6 text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
                          Lobby code
                        </p>
                        <p className="mt-2 text-3xl font-extrabold tracking-[0.2em] text-indigo-700">
                          {lobbyCode}
                        </p>
                      </div>

                      <button
                        onClick={copyCode}
                        className="mt-4 w-full rounded-xl border border-indigo-200 px-4 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50"
                      >
                        {copied ? "✓ Code copied" : "▢ Copy lobby code"}
                      </button>

                      <p className="mt-3 text-center text-xs text-slate-400">
                        Demo code — replace with the backend-generated code.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">
                          Student participation
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          See who is in the lobby.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium">
                        {joinedCount} joined
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-100 pb-4 text-sm">
                      <span className="rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-700">
                        All students ({students.length})
                      </span>
                      <span className="rounded-lg px-3 py-2 text-slate-500">
                        Joined ({joinedCount})
                      </span>
                    </div>

                    <div className="mt-2 divide-y divide-slate-100">
                      {students
                        .slice(0, showAll ? students.length : 4)
                        .map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center justify-between gap-3 py-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700">
                                {student.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {student.name}
                                </p>
                                <p className="text-sm text-slate-500">
                                  @{student.username}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                student.joined
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {student.joined ? "● Joined" : "Not joined"}
                            </span>
                          </div>
                        ))}
                    </div>

                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {showAll ? "Show fewer students" : "View all students"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-bold">Ready to begin?</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Start when your class is ready.
                    </p>
                  </div>
                  <button
                    onClick={() => setStarted(true)}
                    disabled={started}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {started ? "Session started" : "Start story session →"}
                  </button>
                </div>

                <p className="text-center text-xs leading-5 text-slate-400">
                  Frontend prototype · Sample students and lobby code only.
                  <br />
                  Access restrictions must be enforced by the backend.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
