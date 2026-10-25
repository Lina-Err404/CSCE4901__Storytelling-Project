"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../firebase-client";
import { StudentLobby } from "../student-lobby";

export default function JoinPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (!auth) {
      router.replace("/");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/");
        return;
      }

      setUser(currentUser);
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, [router]);

  if (checkingAuth || !user) {
    return (
      <main className="p-8 text-sm text-slate-600">
        Checking sign-in...
      </main>
    );
  }

  return <StudentLobby user={user} />;
}