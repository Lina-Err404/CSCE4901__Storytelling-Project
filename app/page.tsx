
"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { AuthScreen } from "./auth-screen";
import { auth, authConfigurationMissing } from "./firebase-client";
import { StudentLobby } from "./student-lobby";

type Student = { studentId: string; displayName: string };
type SchoolClass = { classId: string; name: string };
type Lobby = {
  lobbyId: string;
  joinCode: string;
  status: "open" | "locked";
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const currentUser = auth?.currentUser;

  if (!currentUser) {
    throw new Error("Sign in is required.");
  }
  headers.set("Authorization", `Bearer ${await currentUser.getIdToken()}`);

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export default function Home() {
  const demoMode = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR === "true";
  const [user, setUser] = useState<User | null>(() => demoMode ? ({ uid: "local-dev-teacher" } as User) : null);
  const [userRole, setUserRole] = useState<"teacher" | null>(() => demoMode ? "teacher" : null);
  const [authReady, setAuthReady] = useState(demoMode);
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState("Class Lobby");
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const devBypass = demoMode || !auth || authConfigurationMissing;
  const isTeacher = userRole === "teacher" || devBypass;

  const lobbyCode = lobby?.joinCode || "------";
  const joinedCount = joinedIds.length;
  const started = lobby?.status === "locked";

  useEffect(() => {
    let current = true;
    if (demoMode || !auth || authConfigurationMissing) {
      setUser({ uid: "local-dev-teacher" } as User);
      setUserRole("teacher");
      setAuthReady(true);
      setAuthError("Local demo mode enabled. Opening the host lobby.");
      return () => {
        current = false;
      };
    }
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setUserRole(null);
      setAuthError("");
      if (nextUser) {
        try {
          const token = await nextUser.getIdTokenResult();
          if (current && token.claims.role === "teacher") setUserRole("teacher");
        } catch {
          if (current) setAuthError("Could not verify your account role. Sign in again.");
        }
      }
      if (current) setAuthReady(true);
    });

    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !isTeacher) return;
    let cancelled = false;

    async function loadClasses() {
      setLoading(true);
      try {
        const result = await api<{ classes: SchoolClass[] }>("/classes");
        if (cancelled) return;
        setClasses(result.classes);
        setClassId((previous) => result.classes.some((item) => item.classId === previous)
          ? previous
          : result.classes[0]?.classId || "");
      } catch (reason) {
        if (!cancelled) {
          if (demoMode) {
            const demoClass = { classId: "demo-class", name: "Demo Class" };
            setClasses([demoClass]);
            setClassId(demoClass.classId);
            setError("");
          } else {
            setError(reason instanceof Error ? reason.message : "Could not load your classes.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadClasses();
    return () => {
      cancelled = true;
    };
  }, [user, isTeacher]);

  useEffect(() => {
    if (!user || !isTeacher) {
      setStudents([]);
      setJoinedIds([]);
      setLobby(null);
      return;
    }
    if (!classId) {
      setStudents([]);
      setJoinedIds([]);
      setLobby(null);
      return;
    }
    let cancelled = false;

    async function loadClass() {
      setLoading(true);
      setError("");
      try {
        const [roster, lobbies] = await Promise.all([
          api<{ students: Student[] }>(`/classes/${classId}/roster`),
          api<{ lobbies: Lobby[] }>(`/lobbies?classId=${encodeURIComponent(classId)}`),
        ]);
        if (cancelled) return;
        setStudents(roster.students);
        const currentLobby = lobbies.lobbies[0] || null;
        setLobby(currentLobby);
        if (currentLobby) {
          const participation = await api<{ students: Student[] }>(
            `/lobbies/${currentLobby.lobbyId}/students`,
          );
          if (!cancelled) {
            setJoinedIds(participation.students.map((student) => student.studentId));
          }
        } else {
          setJoinedIds([]);
        }
      } catch (reason) {
        if (!cancelled) {
          if (demoMode) {
            setStudents([]);
            setJoinedIds([]);
            setLobby(null);
            setError("");
          } else {
            setError(reason instanceof Error ? reason.message : "Could not load the class.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadClass();
    return () => {
      cancelled = true;
    };
  }, [user, isTeacher, classId]);

  useEffect(() => {
    if (!lobby) return;

    const refreshParticipation = async () => {
      try {
        const result = await api<{ students: Student[] }>(
          `/lobbies/${lobby.lobbyId}/students`,
        );
        setJoinedIds(result.students.map((student) => student.studentId));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not refresh participation.");
      }
    };

    const timer = window.setInterval(refreshParticipation, 5000);
    return () => window.clearInterval(timer);
  }, [lobby]);

  async function createLobby() {
    if (!classId || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<{ lobbyId: string; joinCode: string }>("/lobbies", {
        method: "POST",
        body: JSON.stringify({ classId }),
      });
      setLobby({ ...created, status: "open" });
      setJoinedIds([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a lobby.");
    } finally {
      setBusy(false);
    }
  }

  async function startSession() {
    if (!lobby || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/lobbies/${lobby.lobbyId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "locked" }),
      });
      setLobby({ ...lobby, status: "locked" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the session.");
    } finally {
      setBusy(false);
    }
  }

  async function importRoster(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !classId) return;

    const body = new FormData();
    body.set("file", file);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ imported: number; rejected: { row: number; reason: string }[] }>(
        `/classes/${classId}/roster`,
        { method: "POST", body },
      );
      const roster = await api<{ students: Student[] }>(`/classes/${classId}/roster`);
      setStudents(roster.students);
      if (result.rejected.length) {
        setError(`Imported ${result.imported}; ${result.rejected.length} row(s) were rejected.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import the roster.");
    } finally {
      setBusy(false);
    }
  }

  async function createClass(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newClassName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<SchoolClass>("/classes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setClasses((current) => [...current, created]);
      setClassId(created.classId);
      setNewClassName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the class.");
    } finally {
      setBusy(false);
    }
  }

  async function closeLobby() {
    if (!lobby || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/lobbies/${lobby.lobbyId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      setLobby(null);
      setJoinedIds([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not close the lobby.");
    } finally {
      setBusy(false);
    }
  }

  async function kickStudent(studentId: string) {
    if (!lobby || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/lobbies/${lobby.lobbyId}/students/${encodeURIComponent(studentId)}`, {
        method: "DELETE",
      });
      setJoinedIds((current) => current.filter((id) => id !== studentId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the student.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!lobby) return;
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

  if (!authReady) {
    return <main className="p-8 text-sm text-slate-600">Checking sign-in...</main>;
  }
  if (!devBypass && !user) return <AuthScreen />;
  if (!devBypass && !isTeacher) {
    return (
      <>
        <StudentLobby user={user as User} />
        {authError && <p role="alert" className="fixed bottom-4 left-4 rounded bg-rose-50 p-3 text-sm text-rose-800">{authError}</p>}
      </>
    );
  }

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

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
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
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                ● Teacher
              </span>
              <button onClick={() => auth && void signOut(auth)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                Sign out
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}
            {loading && (
              <p role="status" className="text-sm text-slate-500">
                Connecting to your classroom...
              </p>
            )}
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
                <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                      Your class
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight">
                      {classes.find((item) => item.classId === classId)?.name || "Choose a class"}
                    </h2>
                  </div>
                  <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                    {started ? "Session started" : lobby ? "Lobby open" : "No active lobby"}
                  </span>
                </div>

                {classes.length > 0 ? (
                  <label className="block max-w-sm text-sm font-semibold">
                    Class
                    <select
                      value={classId}
                      onChange={(event) => setClassId(event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                    >
                      {classes.map((item) => <option key={item.classId} value={item.classId}>{item.name}</option>)}
                    </select>
                  </label>
                ) : !loading ? (
                  <form onSubmit={createClass} className="flex max-w-lg flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
                    <label className="min-w-56 flex-1 text-sm font-semibold">
                      Create your first class
                      <input
                        required
                        maxLength={80}
                        value={newClassName}
                        onChange={(event) => setNewClassName(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </label>
                    <button disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Create class</button>
                  </form>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label: "Students in class",
                      value: String(students.length),
                      note: "Rostered students",
                    },
                    {
                      label: "Students joined",
                      value: String(joinedCount),
                      note: "Live lobby",
                    },
                    {
                      label: "Waiting to join",
                      value: String(Math.max(0, students.length - joinedCount)),
                      note: "Not yet joined",
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

                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">
                          Code-based access
                        </p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          Any student with a valid lobby code can join this session.
                        </p>
                      </div>

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <input
                          id="roster-file"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={importRoster}
                          disabled={busy || !classId}
                          className="sr-only"
                        />
                        <label
                          htmlFor="roster-file"
                          className={`inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${busy ? "pointer-events-none opacity-50" : ""}`}
                        >
                          {busy ? "Working..." : "Import student roster CSV"}
                        </label>
                        <p className="mt-2 text-xs text-slate-500">
                          CSV columns: studentId,name
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
                        disabled={!lobby || copied}
                        className="mt-4 w-full rounded-xl border border-indigo-200 px-4 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50"
                      >
                        {copied ? "Code copied" : "Copy lobby code"}
                      </button>

                      <p className="mt-3 text-center text-xs text-slate-400">
                        {lobby ? "Share this code with students on your roster." : "Create a lobby to generate an invitation code."}
                      </p>
                      {!lobby && (
                        <button
                          onClick={createLobby}
                          disabled={busy || loading || !classId}
                          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Create class lobby
                        </button>
                      )}
                      {lobby && !started && (
                        <button
                          onClick={closeLobby}
                          disabled={busy}
                          className="mt-3 w-full rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Close lobby
                        </button>
                      )}
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
                        Rostered ({students.length})
                      </span>
                    </div>

                    <div className="mt-2 divide-y divide-slate-100">
                      {students
                        .slice(0, showAll ? students.length : 4)
                        .map((student) => (
                          <div
                            key={student.studentId}
                            className="flex items-center justify-between gap-3 py-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700">
                                {student.displayName
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {student.displayName}
                                </p>
                                <p className="text-sm text-slate-500">
                                  ID: {student.studentId}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                joinedIds.includes(student.studentId)
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {joinedIds.includes(student.studentId) ? "Joined" : "Not joined"}
                            </span>
                            {lobby && joinedIds.includes(student.studentId) && (
                              <button
                                onClick={() => void kickStudent(student.studentId)}
                                disabled={busy}
                                className="shrink-0 rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                                aria-label={`Remove ${student.displayName} from lobby`}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                    </div>

                    {students.length > 4 && (
                      <button
                        onClick={() => setShowAll(!showAll)}
                        className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {showAll ? "Show fewer students" : "View all students"}
                      </button>
                    )}
                    {!students.length && !loading && (
                      <p className="py-8 text-center text-sm text-slate-500">
                        No students on the roster yet. Import a CSV to add the class list.
                      </p>
                    )}
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
                    onClick={startSession}
                    disabled={started || busy || !lobby}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {started ? "Session started" : lobby ? "Start story session" : "Create a lobby first"}
                  </button>
                </div>

              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
