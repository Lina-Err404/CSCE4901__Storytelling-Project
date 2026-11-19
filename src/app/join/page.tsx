"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "../Login_Signup_Backend/supabase-client";
import { StudentLobby } from "../student-lobby";

export default function JoinPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (!supabase) {
      router.replace("/");
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const currentUser = data.session?.user ?? null;
      if (!currentUser) {
        router.replace("/");
        return;
      }
      setUser(currentUser);
      setCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const currentUser = session?.user ?? null;
      if (!currentUser) {
        router.replace("/");
        return;
      }
      setUser(currentUser);
      setCheckingAuth(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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