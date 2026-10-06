import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { C, globalCss } from "./theme";

const MIN_SENHA = 8;

// Página do link de boas-vindas / recuperação: a sessão chega pelo link (hash na URL) e aqui a pessoa define a senha.
export default function DefinirSenha({ session }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setErro("");
    if (senha.length < MIN_SENHA) return setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
    if (senha !== confirma) return setErro("As senhas não são iguais.");
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) return setErro(error.message);
    setOk(true);
    setTimeout(() => window.location.replace("/"), 1200);
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: "Montserrat, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{globalCss}</style>
      <div className="card" style={{ padding: 28, width: "100%", maxWidth: 360 }}>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1, marginBottom: 4 }}>Prezo</div>
        <div className="lbl" style={{ fontSize: 12.5, marginBottom: 22 }}>Defina sua senha de acesso</div>

        {!session ? (
          <div>
            <div style={{ fontSize: 13.5, color: C.red, fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
              Este link expirou ou já foi usado. Peça um novo pelo "Esqueci a senha" na tela de entrada.
            </div>
            <a href="/" style={{ fontSize: 13, color: C.ink, textDecoration: "underline" }}>Ir para o login</a>
          </div>
        ) : ok ? (
          <div style={{ fontSize: 14, color: C.ok, fontWeight: 600 }}>Senha salva! Entrando…</div>
        ) : (
          <form onSubmit={salvar}>
            <div className="fld" style={{ marginBottom: 10 }}>
              <input type="password" required minLength={MIN_SENHA} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="nova senha" className="inp" />
            </div>
            <div className="fld" style={{ marginBottom: 6 }}>
              <input type="password" required minLength={MIN_SENHA} autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="repita a senha" className="inp" />
            </div>
            <div className="lbl" style={{ fontSize: 11.5, marginBottom: 16 }}>Mínimo de {MIN_SENHA} caracteres</div>
            {erro && <div style={{ background: C.redSoft, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: C.red, fontWeight: 600 }}>{erro}</div>}
            <button type="submit" className="btn" disabled={carregando}
              style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: 13, fontSize: 14.5, fontWeight: 700, opacity: carregando ? 0.6 : 1 }}>
              {carregando ? "Salvando…" : "Salvar senha e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
