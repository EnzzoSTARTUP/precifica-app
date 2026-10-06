import { C } from "../theme";

export const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(isFinite(n) ? n : 0);
export const brlSec = (n) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(isFinite(n) ? n : 0);
export const pct = (n) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;
export const num = (n, d = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(isFinite(n) ? n : 0);
export const dataBR = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");

export const corCMV = (v) => (v <= 0 ? C.ink45 : v <= 35 ? C.ok : v <= 45 ? C.warn : C.red);
export const bgCMV = (v) => (v <= 0 ? "transparent" : v <= 35 ? C.okSoft : v <= 45 ? C.warnSoft : C.redSoft);
export const corMC = (v) => (v <= 0 ? C.red : v >= 30 ? C.ok : C.warn);
export const bgMC = (v) => (v <= 0 ? C.redSoft : v >= 30 ? C.okSoft : C.warnSoft);
