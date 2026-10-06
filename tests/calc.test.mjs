import { test } from "node:test";
import assert from "node:assert/strict";
import { calc, calcFixasPct, custoInsumo, DEFAULT_CFG } from "../src/lib/calc.js";

// Implementação ANTIGA, copiada literalmente de src/App.jsx (commit 5fa67c1) — referência de regressão.
function calcAntigo(p, insumos, canais, cfg) {
  const fator = (u) => (u === "kg" || u === "L" ? 1000 : 1);
  const custoIns = (ins) => ins.precoPacote / (ins.qtdPacote * fator(ins.unidade));
  const totalFixas = (c) => (c.despesas || []).reduce((s, d) => s + (d.valor || 0), 0);
  const fixas = (c) => (c.modoFixas === "manual" ? c.despesasFixasManual || 0 : c.faturamentoMedio > 0 ? (totalFixas(c) / c.faturamentoMedio) * 100 : 0);
  if (!p) return null;
  let orfaos = 0;
  const custoInsumos = p.itens.reduce((s, it) => {
    const ins = insumos.find((i) => i.id === it.insumoId);
    if (!ins) { orfaos++; return s; }
    const aprov = 1 - (it.perda || 0) / 100;
    const rendPreparo = ins.rendimentoPreparo || 1;
    const bruto = (aprov > 0 ? it.qtd / aprov : it.qtd) / rendPreparo;
    return s + custoIns(ins) * bruto;
  }, 0);
  const rend = p.rendimento || 1;
  const custoUnid = custoInsumos / rend + (p.maoDeObra || 0) + (p.outrosCustos || 0);
  const fixasPct = fixas(cfg);
  const base = cfg.impostos + fixasPct + cfg.lucro;
  const precos = canais.map((canal) => {
    const soma = base + canal.comissao;
    const viavel = soma < 100;
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

const insumos = [
  { id: "arroz", nome: "Arroz cru", unidade: "kg", precoPacote: 5, qtdPacote: 1, rendimentoPreparo: 3 },
  { id: "file", nome: "Filé mignon", unidade: "kg", precoPacote: 79.9, qtdPacote: 1 },
  { id: "oleo", nome: "Óleo", unidade: "L", precoPacote: 8.5, qtdPacote: 0.9 },
  { id: "ovo", nome: "Ovo", unidade: "un", precoPacote: 18, qtdPacote: 30 },
  { id: "queijo", nome: "Mussarela", unidade: "g", precoPacote: 22.9, qtdPacote: 500 },
];
const canais = [
  { id: "salao", nome: "Salão", comissao: 4, embalagem: 0 },
  { id: "ifood", nome: "iFood", comissao: 27, embalagem: 2.5 },
  { id: "absurdo", nome: "Inviável", comissao: 90, embalagem: 1 },
];
const cfgs = {
  auto: { ...DEFAULT_CFG, faturamentoMedio: 450000, despesas: [{ id: "a", nome: "ocupacional", valor: 25967, categoria: "ocupacional" }, { id: "b", nome: "x", valor: 10829 }] },
  manual: { ...DEFAULT_CFG, modoFixas: "manual", despesasFixasManual: 33, impostos: 12, lucro: 20 },
  semFat: { ...DEFAULT_CFG },
};
const produtos = [
  { id: "p1", nome: "Filé com fritas", rendimento: 1, maoDeObra: 0, precosCanal: { salao: 45, ifood: 55 }, itens: [{ insumoId: "file", qtd: 200, perda: 20 }, { insumoId: "arroz", qtd: 150, perda: 0 }, { insumoId: "oleo", qtd: 30, perda: 0 }] },
  { id: "p2", nome: "Sem preço", rendimento: 4, maoDeObra: 1.5, outrosCustos: 0.7, precosCanal: {}, itens: [{ insumoId: "ovo", qtd: 2 }, { insumoId: "queijo", qtd: 80, perda: 0 }] },
  { id: "p3", nome: "Órfão", rendimento: 1, precosCanal: { salao: 10 }, itens: [{ insumoId: "nao-existe", qtd: 100, perda: 5 }, { insumoId: "ovo", qtd: 1 }] },
  { id: "p4", nome: "Vazio", rendimento: 1, precosCanal: {}, itens: [] },
];

const quase = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test("calc novo == calc antigo em todos os cenários", () => {
  for (const [nomeCfg, cfg] of Object.entries(cfgs)) {
    for (const p of produtos) {
      const novo = calc(p, { insumos, canais, cfg });
      const antigo = calcAntigo(p, insumos, canais, cfg);
      for (const k of ["custoInsumos", "custoUnid", "base", "fixasPct", "cmvPct", "precoRef", "orfaos"]) quase(novo[k], antigo[k], `${nomeCfg}/${p.nome}/${k}`);
      assert.equal(novo.precos.length, antigo.precos.length);
      novo.precos.forEach((c, i) => {
        const o = antigo.precos[i];
        for (const k of ["soma", "markup", "preco", "custoCanal", "definido", "cmvCanal", "mcCanal", "mcCanalPct", "desvio"]) quase(c[k], o[k], `${nomeCfg}/${p.nome}/${c.nome}/${k}`);
        for (const k of ["viavel", "confiavel", "atencao", "temDesvio"]) assert.equal(c[k], o[k], `${nomeCfg}/${p.nome}/${c.nome}/${k}`);
      });
    }
  }
  assert.equal(calc(null, { insumos, canais, cfg: cfgs.auto }), null);
});

test("valores conhecidos (caso do arroz 3x e markup)", () => {
  quase(custoInsumo(insumos[0]), 0.005, "arroz R$/g");
  const r = calc(produtos[0], { insumos, canais, cfg: cfgs.semFat });
  // arroz: 150g pronto / 3 = 50g cru * 0.005 = 0.25 ; filé: 200/(1-0.2)=250g * 0.0799 = 19.975 ; óleo: 30ml * 8.5/900 = 0.28333
  quase(r.custoInsumos, 0.25 + 19.975 + 30 * (8.5 / 900), "custoInsumos");
  quase(r.base, 21, "base = 6 + 0 + 15");
  quase(r.precos[0].markup, 1 / (1 - 0.25), "markup salão 25%");
  assert.equal(r.precos[2].viavel, false);
  quase(calcFixasPct(cfgs.auto), (36796 / 450000) * 100, "fixas auto");
});
