import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { carregarPerfil } from "./lib/perfil";
import App from "./App";
import Auth from "./Auth";
import ConfirmEmail from "./ConfirmEmail";
import DefinirSenha from "./DefinirSenha";
import Admin from "./admin/Admin";
import Cadastro from "./cadastro/Cadastro";
import { C } from "./theme";

const Carregando = () => <div style={{ background: C.paper, minHeight: "100vh" }} />;

export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = carregando, null = deslogado
  const [perfil, setPerfil] = useState(undefined);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPerfil(session === null ? null : undefined); return; }
    let ativo = true;
    carregarPerfil().then((p) => { if (ativo) setPerfil(p); }).catch(() => { if (ativo) setPerfil(null); });
    return () => { ativo = false; };
  }, [session?.user?.id]);

  // rotas públicas (não dependem de sessão)
  if (path === "/auth/confirm") return <ConfirmEmail />;
  if (path === "/cadastro") return <Cadastro />;

  if (session === undefined) return <Carregando />;
  if (path === "/auth/definir-senha") return <DefinirSenha session={session} />;
  if (!session) return <Auth />;

  if (path === "/admin") {
    if (perfil === undefined) return <Carregando />;
    if (!perfil?.admin) { window.location.replace("/"); return <Carregando />; }
    return <Admin perfil={perfil} />;
  }

  return <App key={session.user.id} perfil={perfil ?? null} />;
}
