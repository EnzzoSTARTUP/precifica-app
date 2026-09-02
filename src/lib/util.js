export const UNIDADES = ["kg", "g", "L", "ml", "un", "m2"];

export const hoje = () => new Date().toISOString().slice(0, 10);

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

// trim + minúsculas + sem acento — pra casar nomes vindos de planilhas de clientes diferentes
export const normalizarTexto = (v) =>
  String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
