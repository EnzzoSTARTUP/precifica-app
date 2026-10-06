import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { C, globalCss } from "../theme";
import Empresas from "./Empresas";
import Catalogo from "./Catalogo";
import Canais from "./Canais";
import Categorias from "./Categorias";
import FilaRevisao from "./FilaRevisao";

const ABAS = [
  { id: "empresas", l: "Empresas" },
  { id: "catalogo", l: "Catálogo de insumos" },
  { id: "canais", l: "Canais e taxas" },
  { id: "categorias", l: "Categorias" },
  { id: "fila", l: "Fila de revisão" },
];

export default function Admin({ perfil }) {
  const [aba, setAba] = useState(() => new URLSearchParams(window.location.search).get("aba") || "empresas");
  const trocar = (id) => { setAba(id); window.history.replaceState({}, "", `/admin?aba=${id}`); };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: "Montserrat, system-ui, sans-serif" }}>
      <style>{globalCss}</style>
      <style>{`
        .adm-wrap { max-width: 1100px; margin: 0 auto; padding: 22px 16px 80px; }
        .adm-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .adm-tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid ${C.rule}; margin-bottom: 20px; }
        .adm-tab { background: none; border: none; padding: 10px 12px; font-size: 13.5px; font-weight: 600; color: ${C.ink45}; border-bottom: 2px solid transparent; white-space: nowrap; }
        .adm-tab.on { color: ${C.ink}; border-bottom-color: ${C.ink}; }
        .adm-table { width: 100%; border-collapse: collapse; }
        .adm-table tr.row:hover { background: #FAFAF8; }
        .adm-scroll { overflow-x: auto; }
        @media (min-width: 940px) { .adm-wrap { padding: 36px 30px 64px; } }
      `}</style>

      <div className="adm-wrap">
        <div className="adm-top">
          <div>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1 }}>Prezo <span style={{ color: C.ink45, fontWeight: 600 }}>· Admin</span></div>
            <div className="lbl" style={{ marginTop: 4, fontSize: 12.5 }}>{perfil?.email}</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <a href="/" style={{ fontSize: 13, color: C.ink, textDecoration: "underline" }}>Voltar ao app</a>
            <button className="btn lbl" onClick={() => supabase.auth.signOut().then(() => window.location.replace("/"))}
              style={{ background: "none", border: "none", padding: 0, color: C.ink45, textDecoration: "underline" }}>Sair</button>
          </div>
        </div>

        <div className="adm-tabs">
          {ABAS.map((t) => (
            <button key={t.id} className={`btn adm-tab ${aba === t.id ? "on" : ""}`} onClick={() => trocar(t.id)}>{t.l}</button>
          ))}
        </div>

        {aba === "empresas" && <Empresas />}
        {aba === "catalogo" && <Catalogo />}
        {aba === "canais" && <Canais />}
        {aba === "categorias" && <Categorias />}
        {aba === "fila" && <FilaRevisao />}
      </div>
    </div>
  );
}
