import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const devMode =
    process.env.NODE_ENV !== "production" &&
    (process.env.NEXT_PUBLIC_ALLOW_DEV_MODE === "true" ||
      process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR === "true");
  const [user, setUser] = useState<User | null>(() =>
    devMode ? ({ uid: "local-dev-teacher" } as User) : null,
  );
  const [userRole, setUserRole] = useState<"teacher" | null>(() =>
    devMode ? "teacher" : null,
  );
  const [authReady, setAuthReady] = useState(
    devMode || !auth || authConfigurationMissing,
  );
  const [authError, setAuthError] = useState(() => {
    if (devMode) return "Local dev mode enabled. Opening the host lobby.";
    if (!auth || authConfigurationMissing) {
      return "Firebase auth is not configured for this app.";
    }
    return "";
  });
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
  const isTeacher = userRole === "teacher";

  const lobbyCode = lobby?.joinCode || "------";
  const joinedCount = joinedIds.length;
  const started = lobby?.status === "locked";

  useEffect(() => {
    if (devMode || !auth || authConfigurationMissing) {
      return;
    }
    let current = true;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setUserRole(null);
        setStudents([]);
        setJoinedIds([]);
        setLobby(null);
      }
      setAuthError("");
      if (nextUser) {
        try {
          const token = await nextUser.getIdTokenResult();
          if (current && token.claims.role === "teacher") {
            setUserRole("teacher");
          }
        } catch {
          if (current) {
            setAuthError("Could not verify your account role. Sign in again.");
          }
        }
      }
      if (current) setAuthReady(true);
    });

    return () => {
      current = false;
      unsubscribe();
    };
  }, [devMode]);

  useEffect(() => {
    if (!user || !isTeacher) return;
    let cancelled = false;

    async function loadClasses() {
      setLoading(true);
      try {
        const result = await api<{ classes: SchoolClass[] }>("/classes");
        if (cancelled) return;
        setClasses(result.classes);
        const nextClassId = result.classes[0]?.classId || "";
        setClassId((previous) => {
          const resolved = result.classes.some((item) => item.classId === previous)
            ? previous
            : nextClassId;
          if (!resolved) {
            setStudents([]);
            setJoinedIds([]);
            setLobby(null);
          }
          return resolved;
        });
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load your classes.",
          );
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
    if (!user || !isTeacher || !classId) {
      return;
    }
    let cancelled = false;

    async function loadClass() {
      setLoading(true);
      setError("");
      try {
        const [roster, lobbies] = await Promise.all([
          api<{ students: Student[] }>(`/classes/${classId}/roster`),
          api<{ lobbies: Lobby[] }>(
            `/lobbies?classId=${encodeURIComponent(classId)}`,
          ),
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
            setJoinedIds(
              participation.students.map((student) => student.studentId),
            );
          }
        } else {
          setJoinedIds([]);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "Could not load the class.",
          );
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
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not refresh participation.",
        );
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
      const created = await api<{ lobbyId: string; joinCode: string }>(
        "/lobbies",
        {
          method: "POST",
          body: JSON.stringify({ classId }),
        },
      );
      setLobby({ ...created, status: "open" });
      setJoinedIds([]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create a lobby.",
      );
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
      setError(
        reason instanceof Error ? reason.message : "Could not start the session.",
      );
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
      const result = await api<{
        imported: number;
        rejected: { row: number; reason: string }[];
      }>(`/classes/${classId}/roster`, { method: "POST", body });
      const roster = await api<{ students: Student[] }>(
        `/classes/${classId}/roster`,
      );
      setStudents(roster.students);
      if (result.rejected.length) {
        setError(
          `Imported ${result.imported}; ${result.rejected.length} row(s) were rejected.`,
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not import the roster.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
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
      setError(
        reason instanceof Error ? reason.message : "Could not create the class.",
      );
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
      setError(
        reason instanceof Error ? reason.message : "Could not close the lobby.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function kickStudent(studentId: string) {
    if (!lobby || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/lobbies/${lobby.lobbyId}/students/${encodeURIComponent(studentId)}`,
        {
          method: "DELETE",
        },
      );
      setJoinedIds((current) => current.filter((id) => id !== studentId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not remove the student.",
      );
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

  function handleSignOut() {
    if (auth?.currentUser) {
      void signOut(auth);
    }
    setUser(null);
    setUserRole(null);
    setStudents([]);
    setJoinedIds([]);
    setLobby(null);
  }

  const navItems = [
    { label: "Class Lobby", icon: "⌂" },
    { label: "Students", icon: "♙" },
    { label: "Story Sections", icon: "▤" },
    { label: "Moderation", icon: "◇" },
    { label: "Settings", icon: "⚙" },
  ];

  if (!authReady) {
    return (
      <main className="p-8 text-sm text-slate-600">Checking sign-in...</main>
    );
  }
  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={(authedUser, role) => {
          setUser(authedUser);
          setUserRole(role === "teacher" ? "teacher" : null);
        }}
      />
    );
  }
  if (!isTeacher) {
    return (
      <>
        <StudentLobby user={user as User} />
        {authError && (
          <p
            role="alert"
            className="fixed bottom-4 left-4 rounded bg-rose-50 p-3 text-sm text-rose-800"
          >
            {authError}
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert h-[14px] w-4"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={14}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
          <Link href= "/manually-assigned"> Click here</Link> {/*TEMPORARY: I didn't know what page to use to link to the breakout room page. */}
        </div>
      </main>
    </div>
  );
  
}
