export const UNIDADES = ["kg", "g", "L", "ml", "un", "m2"];

export const hoje = () => new Date().toISOString().slice(0, 10);

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
