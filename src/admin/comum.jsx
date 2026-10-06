import { C } from "../theme";

export const CATEGORIAS_INSUMO = [
  ["carne_bovina", "Carne bovina"], ["carne_suina", "Suínos e embutidos"], ["aves", "Aves"], ["peixes_frutos_mar", "Peixes e frutos do mar"],
  ["laticinios", "Laticínios"], ["ovos", "Ovos"], ["hortifruti", "Hortifruti"], ["graos_cereais", "Grãos e cereais"], ["massas_farinhas", "Massas e farinhas"],
  ["paes_padaria", "Pães e padaria"], ["oleos_gorduras", "Óleos e gorduras"], ["temperos_condimentos", "Temperos e condimentos"], ["molhos_conservas", "Molhos e conservas"],
  ["bebidas", "Bebidas"], ["doces_confeitaria", "Doces e confeitaria"], ["japonesa", "Japonesa"], ["arabe", "Árabe"], ["mexicana", "Mexicana"], ["chinesa", "Chinesa"],
  ["embalagens", "Embalagens"], ["descartaveis", "Descartáveis"], ["outros", "Outros"],
];
export const nomeCategoria = (id) => CATEGORIAS_INSUMO.find(([k]) => k === id)?.[1] || id;
export const UNIDADES_COMPRA = ["kg", "g", "L", "ml", "un", "m2"];

export const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(isFinite(n) ? n : 0);
export const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
export const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

export function Btn({ children, primario, perigo, pequeno, style, ...rest }) {
  const base = primario
    ? { background: C.ink, color: "#fff", border: "none" }
    : perigo
      ? { background: "#fff", color: C.red, border: `1.5px solid ${C.red}` }
      : { background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}` };
  return (
    <button className="btn" {...rest}
      style={{ ...base, borderRadius: 8, padding: pequeno ? "7px 12px" : "11px 16px", fontSize: pequeno ? 12.5 : 13.5, fontWeight: 700, opacity: rest.disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  );
}

export function Tag({ cor, fundo, children }) {
  return <span className="mono tag" style={{ background: fundo, color: cor }}>{children}</span>;
}

export function TagStatus({ status }) {
  const m = {
    ativo: ["Ativo", C.ok, C.okSoft], inativo: ["Inativo", C.red, C.redSoft], cadastro_incompleto: ["Cadastro incompleto", C.warn, C.warnSoft],
    pendente: ["Pendente", C.warn, C.warnSoft], aprovado: ["Aprovado", C.ok, C.okSoft], rejeitado: ["Rejeitado", C.red, C.redSoft],
  }[status] || [status, C.ink70, "#EFEFEC"];
  return <Tag cor={m[1]} fundo={m[2]}>{m[0]}</Tag>;
}

export function Campo({ rot, children, largura }) {
  return (
    <label style={{ display: "block", width: largura, minWidth: 0 }}>
      <div className="lbl" style={{ marginBottom: 5 }}>{rot}</div>
      <div className="fld">{children}</div>
    </label>
  );
}

export function Entrada({ valor, onChange, tipo = "text", ...rest }) {
  return <input type={tipo} className={`inp ${tipo === "number" ? "numi" : ""}`} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 14, padding: "10px 3px" }} {...rest} />;
}

export function Selecao({ valor, onChange, opcoes }) {
  return (
    <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)}
      style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 600, padding: "10px 0", width: "100%" }}>
      {opcoes.map(([v, l]) => <option key={v} value={v}>{l ?? v}</option>)}
    </select>
  );
}

export function Busca({ valor, onChange, placeholder = "buscar" }) {
  return (
    <div className="fld" style={{ flex: 1, minWidth: 180 }}>
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="inp" style={{ fontSize: 14, padding: "10px 3px" }} />
    </div>
  );
}

export function Modal({ titulo, onClose, children, largura = 560 }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(24,24,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 24, maxWidth: largura, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 19 }}>{titulo}</div>
          <button className="btn" onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: C.ink45, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Aviso({ children, forte }) {
  return (
    <div style={{ background: forte ? C.redSoft : "#EFEFEC", borderRadius: 8, padding: "11px 13px", marginTop: 11 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: forte ? C.red : C.ink70, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function Vazio({ children }) {
  return <div style={{ fontSize: 13.5, color: C.ink70, padding: "18px 0", lineHeight: 1.55 }}>{children}</div>;
}

export const th = { textAlign: "left", padding: "8px 8px", fontSize: 12 };
export const td = { padding: "11px 8px", fontSize: 13.5, verticalAlign: "top" };
