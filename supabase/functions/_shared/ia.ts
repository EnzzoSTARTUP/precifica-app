// Chamadas à API da Anthropic: extração de ficha técnica a partir de texto e estimativa de preço de insumo.
import Anthropic from "npm:@anthropic-ai/sdk@^0.90";
import { z } from "npm:zod@^3.23";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.90/helpers/zod";

export const MODELO = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5-5";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");
  _client = new Anthropic({ apiKey });
  return _client;
}

export const ItemSchema = z.object({
  nome: z.string().describe("Nome do ingrediente, limpo e no singular (ex.: 'filé mignon', 'arroz branco')"),
  quantidade: z.number().describe("Quantidade já convertida para a unidade informada"),
  unidade: z.enum(["g", "ml", "un"]),
  medida_original: z.string().describe("Como a pessoa falou (ex.: '1 colher de sopa', '200 gramas')"),
  origem: z.enum(["falado", "sugerido"]).describe("'sugerido' quando a quantidade não foi dita e você estimou uma porção típica"),
  observacao: z.string().nullable(),
});

export const PratoSchema = z.object({
  prato: z.string().describe("Nome do prato"),
  rendimento_porcoes: z.number().describe("Quantas porções/unidades a receita descrita rende; 1 quando é um prato individual"),
  itens: z.array(ItemSchema),
  confianca: z.enum(["alta", "media", "baixa"]),
  alerta: z.string().nullable().describe("Algo que a pessoa precisa conferir (ex.: ingrediente sem quantidade, áudio confuso)"),
});
export type PratoExtraido = z.infer<typeof PratoSchema>;

const SISTEMA_EXTRACAO = `Você monta fichas técnicas para restaurantes brasileiros a partir do que o cozinheiro fala.
Tarefa: a partir da transcrição, identificar o nome do prato e cada ingrediente com quantidade.

Regras:
- Converta medidas caseiras para g, ml ou un: colher de sopa = 15 ml (≈15 g para líquidos/molhos, ≈10 g para pós como farinha/açúcar, ≈12 g manteiga); colher de chá = 5 ml; xícara = 240 ml (≈200 g arroz cru, ≈120 g farinha, ≈180 g açúcar); concha = 100 ml; copo americano = 190 ml; fio de azeite/óleo = 5 ml; pitada = 1 g; dente de alho = 5 g; fatia de queijo = 20 g; fatia de pão de forma = 25 g; ovo = 1 un; unidade de pão de hambúrguer = 1 un.
- Peso de peças inteiras quando dito só "um/uma": tomate 120 g, cebola 100 g, batata 150 g, limão 1 un, banana 1 un.
- Use "un" só para coisas contadas (ovo, pão, folha de alga, lata, unidade de fruta). Líquidos em ml, o resto em g.
- Se faltar quantidade, estime uma porção típica de restaurante para UMA porção e marque origem = "sugerido".
- Quantidades são por receita como descrita; informe em rendimento_porcoes quantas porções isso rende (1 se não ficar claro).
- Não invente ingredientes que não foram ditos. Ignore conversa que não é ingrediente.
- Nome do ingrediente curto e genérico (ex.: "queijo mussarela", não "aquele queijo que a gente usa").
- Responda em português do Brasil.`;

export async function extrairPrato(transcricao: string): Promise<{ prato: PratoExtraido; ms: number; tokens: { entrada: number; saida: number } }> {
  const inicio = Date.now();
  const resp = await client().beta.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: SISTEMA_EXTRACAO,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: zodOutputFormat(PratoSchema) },
    messages: [{ role: "user", content: `Transcrição do cozinheiro:\n"""\n${transcricao.slice(0, 4000)}\n"""` }],
  } as any);
  if (resp.stop_reason === "refusal") throw new Error("A IA recusou processar esse áudio. Tente descrever o prato de outro jeito.");
  const texto = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const prato = PratoSchema.parse(JSON.parse(texto));
  return { prato, ms: Date.now() - inicio, tokens: { entrada: resp.usage?.input_tokens ?? 0, saida: resp.usage?.output_tokens ?? 0 } };
}

export const EstimativaSchema = z.object({
  itens: z.array(z.object({
    nome: z.string(),
    unidade_compra: z.enum(["kg", "g", "L", "ml", "un"]),
    qtd_padrao: z.number().describe("Tamanho típico do pacote comprado (ex.: 1 para 1 kg, 30 para bandeja de 30 ovos, 900 para 900 ml)"),
    preco_estimado: z.number().describe("Preço em reais desse pacote, em atacarejo do Rio de Janeiro"),
    justificativa: z.string(),
  })),
});

export async function estimarInsumos(nomes: string[]): Promise<{ itens: z.infer<typeof EstimativaSchema>["itens"]; ms: number }> {
  if (nomes.length === 0) return { itens: [], ms: 0 };
  const inicio = Date.now();
  const resp = await client().beta.messages.create({
    model: MODELO,
    max_tokens: 2000,
    system: "Você estima preços de compra de insumos de restaurante no Rio de Janeiro (atacarejo tipo Assaí/Atacadão), em reais. Seja realista e conservador. Responda em português do Brasil.",
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: zodOutputFormat(EstimativaSchema) },
    messages: [{ role: "user", content: `Estime unidade de compra, tamanho do pacote e preço para estes insumos, um por item, na mesma ordem:\n${nomes.map((n) => "- " + n).join("\n")}` }],
  } as any);
  if (resp.stop_reason === "refusal") throw new Error("A IA recusou estimar os preços.");
  const texto = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { itens: EstimativaSchema.parse(JSON.parse(texto)).itens, ms: Date.now() - inicio };
}
