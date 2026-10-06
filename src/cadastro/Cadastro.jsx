import { C, globalCss } from "../theme";

// Fase 2: cadastro conversacional. Por enquanto só um aviso para a rota existir.
export default function Cadastro() {
  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: "Montserrat, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{globalCss}</style>
      <div className="card" style={{ padding: 28, width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1, marginBottom: 8 }}>Prezo</div>
        <div style={{ fontSize: 14, color: C.ink70, lineHeight: 1.5 }}>O cadastro rápido por voz está chegando. Enquanto isso, <a href="/" style={{ color: C.ink }}>entre pela tela inicial</a>.</div>
      </div>
    </div>
  );
}
