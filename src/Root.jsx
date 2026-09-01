import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import App from "./App";
import Auth from "./Auth";
import ConfirmEmail from "./ConfirmEmail";
import { C } from "./theme";

export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = carregando, null = deslogado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (window.location.pathname === "/auth/confirm") return <ConfirmEmail />;

  if (session === undefined) return <div style={{ background: C.paper, minHeight: "100vh" }} />;
  if (!session) return <Auth />;
  return <App key={session.user.id} />;
}
