import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { C, globalCss } from "./theme";

const MIN_SENHA = 8;

export default function Auth() {
  const [modo, setModo] = useState("entrar"); // entrar | cadastrar
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const submeter = async (e) => {
    e.preventDefault();
    setErro("");
    setAviso("");
    if (!email || !senha) return;
    if (modo === "cadastrar" && senha.length < MIN_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        setAviso("Conta criada com sucesso.");
      }
    } catch (err) {
      setErro(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: "Montserrat, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{globalCss}</style>

      <div className="card" style={{ padding: 28, width: "100%", maxWidth: 360 }}>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1, marginBottom: 4 }}>Prezo</div>
        <div className="lbl" style={{ fontSize: 12.5, marginBottom: 22 }}>Custo · Markup · Preço</div>

        <div style={{ display: "flex", gap: 22, marginBottom: 18 }}>
          {[{ id: "entrar", l: "Entrar" }, { id: "cadastrar", l: "Criar conta" }].map((m) => (
            <button key={m.id} type="button" className="btn" onClick={() => { setModo(m.id); setErro(""); setAviso(""); }}
              style={{ background: "none", border: "none", padding: "0 0 3px", fontSize: 14, fontWeight: modo === m.id ? 600 : 400,
                color: modo === m.id ? C.ink : C.ink45, borderBottom: `2px solid ${modo === m.id ? C.ink : "transparent"}` }}>
              {m.l}
            </button>
          ))}
        </div>

        <form onSubmit={submeter}>
          <div className="fld" style={{ marginBottom: 10 }}>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" className="inp" />
          </div>
          <div className="fld" style={{ marginBottom: modo === "cadastrar" ? 6 : 16 }}>
            <input type="password" required autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              minLength={modo === "cadastrar" ? MIN_SENHA : undefined}
              value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="senha" className="inp" />
          </div>
          {modo === "cadastrar" && (
            <div className="lbl" style={{ fontSize: 11.5, marginBottom: 16 }}>Mínimo de {MIN_SENHA} caracteres</div>
          )}

          {erro && (
            <div style={{ background: C.redSoft, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: C.red, fontWeight: 600 }}>
              {erro}
            </div>
          )}
          {aviso && (
            <div style={{ background: C.okSoft, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: C.ok, fontWeight: 600 }}>
              {aviso}
            </div>
          )}

          <button type="submit" className="btn" disabled={carregando}
            style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: 13, fontSize: 14.5, fontWeight: 700, opacity: carregando ? 0.6 : 1 }}>
            {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
