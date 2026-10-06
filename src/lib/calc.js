// Motor de cálculo do Prezo — funções puras, sem React.
// Usado pelo app, pelo cadastro público e pela ficha impressa; os números têm que ser os mesmos em todos.

export const DEFAULT_CFG = {
  lucro: 15, impostos: 6, modoFixas: "auto", despesasFixasManual: 0, faturamentoMedio: 0,
  despesas: [],
};

export const fator = (u) => (u === "kg" || u === "L" ? 1000 : 1);
export const baseUnit = (u) => (u === "kg" || u === "g" ? "g" : u === "L" || u === "ml" ? "ml" : u === "m2" ? "m²" : "un");

// perda típica no preparo — evita que o usuário tenha que adivinhar
export const PERDAS = [
  { termos: ["carne", "blend", "contrafile", "contrafilé", "picanha", "alcatra", "patinho", "acém", "acem", "costela", "bovino"], perda: 20, nota: "aparo e cocção" },
  { termos: ["frango", "peito", "coxa", "sobrecoxa"], perda: 18, nota: "aparo e cocção" },
  { termos: ["bacon", "linguiça", "linguica", "calabresa"], perda: 25, nota: "encolhe muito" },
  { termos: ["peixe", "salmão", "salmao", "tilápia", "tilapia", "camarão", "camarao"], perda: 30, nota: "limpeza" },
  { termos: ["batata", "cenoura", "mandioca", "abóbora", "abobora", "beterraba"], perda: 22, nota: "casca" },
  { termos: ["alface", "tomate", "cebola", "alho", "pimentão", "pimentao", "couve", "repolho"], perda: 15, nota: "limpeza" },
  { termos: ["limão", "limao", "laranja", "abacaxi", "manga", "melancia"], perda: 40, nota: "casca e caroço" },
  { termos: ["queijo", "mussarela", "cheddar", "requeijão", "requeijao"], perda: 0, nota: "" },
  { termos: ["couro", "tecido", "malha", "lona"], perda: 12, nota: "sobra de corte" },
];
export const perdaSugerida = (nome) => {
  const n = (nome || "").toLowerCase();
  const m = PERDAS.find((p) => p.termos.some((t) => n.includes(t)));
  return m || null;
};

export const totalFixas = (cfg) => (cfg.despesas || []).reduce((s, d) => s + (d.valor || 0), 0);
export function calcFixasPct(cfg) {
  if (cfg.modoFixas === "manual") return cfg.despesasFixasManual || 0;
  const t = totalFixas(cfg);
  return cfg.faturamentoMedio > 0 ? (t / cfg.faturamentoMedio) * 100 : 0;
}

// custo por unidade-base (g, ml ou un) do insumo, pelo preço do pacote comprado
export const custoInsumo = (ins) => ins.precoPacote / (ins.qtdPacote * fator(ins.unidade));

// quantidade crua a comprar para a quantidade pronta usada no prato
export const quantidadeBruta = (it, ins) => {
  const aprov = 1 - (it.perda || 0) / 100;
  const rendPreparo = ins.rendimentoPreparo || 1;
  return (aprov > 0 ? it.qtd / aprov : it.qtd) / rendPreparo;
};

export function calc(p, { insumos, canais, cfg }) {
  if (!p) return null;
  let orfaos = 0;
  const custoInsumos = (p.itens || []).reduce((s, it) => {
    const ins = insumos.find((i) => i.id === it.insumoId);
    if (!ins) { orfaos++; return s; }
    return s + custoInsumo(ins) * quantidadeBruta(it, ins);
  }, 0);
  const rend = p.rendimento || 1;
  const custoUnid = custoInsumos / rend + (p.maoDeObra || 0) + (p.outrosCustos || 0);

  const fixasPct = calcFixasPct(cfg);
  const base = cfg.impostos + fixasPct + cfg.lucro;

  const precos = canais.map((canal) => {
    const soma = base + canal.comissao;
    const viavel = soma < 100;             // acima disso a fórmula quebra (divisão por zero ou negativa)
    const confiavel = viavel;
    const atencao = confiavel && soma >= 65;
    const markup = viavel ? 1 / (1 - soma / 100) : 0;
    const custoCanal = custoUnid + (canal.embalagem || 0);
    const preco = confiavel ? custoCanal * markup : 0;
    const definido = p.precosCanal?.[canal.id] || 0;
    const cmvCanal = definido > 0 ? (custoUnid / definido) * 100 : 0;
    const varCanal = definido * (cfg.impostos + canal.comissao) / 100;
    const mcCanal = definido > 0 ? definido - custoUnid - (canal.embalagem || 0) - varCanal : 0;
    const mcCanalPct = definido > 0 ? (mcCanal / definido) * 100 : 0;
    const temDesvio = definido > 0 && confiavel && preco > 0;
    const desvio = temDesvio ? ((definido - preco) / preco) * 100 : 0;
    return { ...canal, soma, markup, preco, custoCanal, definido, cmvCanal, mcCanal, mcCanalPct, desvio, temDesvio, viavel, confiavel, atencao };
  });

  const prim = precos[0];
  const precoRef = prim?.definido || 0;
  const cmvPct = precoRef > 0 ? (custoUnid / precoRef) * 100 : 0;
  return { custoInsumos, custoUnid, base, fixasPct, precos, prim, cmvPct, precoRef, orfaos };
}
