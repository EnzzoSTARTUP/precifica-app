// Casamento de ingredientes falados com o catálogo base (nome + sinônimos), sem IA.
import { dbAdmin } from "./db.ts";

export type ItemCatalogo = {
  id: string; nome: string; sinonimos: string[]; categoria: string; unidade_compra: string;
  qtd_padrao: number; preco_medio: number; fator_aproveitamento: number; rendimento_preparo: number;
};

export const normalizar = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "com", "sem", "para", "o", "a", "os", "as", "um", "uma", "tipo", "fresco", "fresca", "cru", "crua"]);
const singular = (t: string) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);
export const tokens = (v: unknown) => normalizar(v).split(" ").filter((t) => t && !PALAVRAS_VAZIAS.has(t)).map(singular);

let cache: { lista: ItemCatalogo[]; em: number } | null = null;

export async function carregarCatalogo(): Promise<ItemCatalogo[]> {
  if (cache && Date.now() - cache.em < 5 * 60 * 1000) return cache.lista;
  const { data, error } = await dbAdmin().from("catalogo_base")
    .select("id, nome, sinonimos, categoria, unidade_compra, qtd_padrao, preco_medio, fator_aproveitamento, rendimento_preparo")
    .eq("ativo", true);
  if (error) throw error;
  cache = { lista: (data || []) as ItemCatalogo[], em: Date.now() };
  return cache.lista;
}

type Indexado = { item: ItemCatalogo; nomes: string[]; toks: string[][] };

function indexar(lista: ItemCatalogo[]): Indexado[] {
  return lista.map((item) => {
    const nomes = [item.nome, ...(item.sinonimos || [])].map(normalizar);
    return { item, nomes, toks: nomes.map(tokens) };
  });
}

// devolve o item do catálogo mais provável para um nome falado, ou null
export function casar(nome: string, lista: ItemCatalogo[]): { item: ItemCatalogo; metodo: "exato" | "contido" | "similar" } | null {
  const idx = indexar(lista);
  const n = normalizar(nome);
  if (!n) return null;
  const exato = idx.find((c) => c.nomes.includes(n));
  if (exato) return { item: exato.item, metodo: "exato" };

  const tk = tokens(nome);
  if (tk.length === 0) return null;
  const setN = new Set(tk);

  // todos os tokens de um nome do catálogo aparecem no que foi falado (ou vice-versa)
  let melhor: { c: Indexado; score: number } | null = null;
  for (const c of idx) {
    for (const ct of c.toks) {
      if (ct.length === 0) continue;
      const setC = new Set(ct);
      const inter = [...setC].filter((t) => setN.has(t)).length;
      if (inter === 0) continue;
      const contido = inter === setC.size || inter === setN.size;
      const jaccard = inter / (setC.size + setN.size - inter);
      const score = (contido ? 1 : 0) + jaccard;
      if (!melhor || score > melhor.score) melhor = { c, score };
    }
  }
  if (!melhor) return null;
  if (melhor.score >= 1) return { item: melhor.c.item, metodo: "contido" };
  if (melhor.score >= 0.5) return { item: melhor.c.item, metodo: "similar" };
  return null;
}
