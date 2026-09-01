import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { C, globalCss } from "./theme";

export default function ConfirmEmail() {
  const [status, setStatus] = useState("confirmando"); // confirmando | ok | erro
  const [erro, setErro] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    const type = params.get("type") || "signup";

    if (!token_hash) {
      setStatus("erro");
      setErro("Link de confirmação inválido.");
      return;
    }

    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        setStatus("erro");
        setErro(
          error.message.toLowerCase().includes("expired") || error.message.toLowerCase().includes("invalid")
            ? "Este link expirou ou já foi usado. Peça um novo cadastro ou reenvie a confirmação."
            : error.message
        );
        return;
      }
      setStatus("ok");
      window.history.replaceState({}, "", "/");
      setTimeout(() => window.location.reload(), 1200);
    });
  }, []);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: "Montserrat, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{globalCss}</style>
      <div className="card" style={{ padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Precifica</div>
        {status === "confirmando" && <div style={{ fontSize: 14, color: C.ink70 }}>Confirmando seu e-mail…</div>}
        {status === "ok" && <div style={{ fontSize: 14, color: C.ok, fontWeight: 600 }}>E-mail confirmado! Entrando…</div>}
        {status === "erro" && (
          <div>
            <div style={{ fontSize: 14, color: C.red, fontWeight: 600, marginBottom: 14 }}>{erro}</div>
            <a href="/" style={{ fontSize: 13, color: C.ink, textDecoration: "underline" }}>Voltar para o login</a>
          </div>
        )}
      </div>
    </div>
  );
}
