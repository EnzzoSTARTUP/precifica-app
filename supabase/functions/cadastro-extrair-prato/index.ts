// Prato por voz/texto → ficha técnica estruturada, casada com o catálogo base.
// Entrada (multipart): audio=<arquivo> [cadastro_id=<uuid>]   ou   (json): { texto, cadastro_id? }
// Saída: { transcricao, prato: {nome, rendimento, itens[]}, insumos[], alertas[], uso }
import { preflight, json, erro, ipDoCliente } from "../_shared/http.ts";
import { dentroDoLimite, dentroDoLimiteGlobal, carregarRascunho, atualizarRascunho, dbAdmin } from "../_shared/db.ts";
import { validarAudio, transcrever } from "../_shared/transcricao.ts";
import { extrairPrato, estimarInsumos } from "../_shared/ia.ts";
import { carregarCatalogo, casar } from "../_shared/catalogo.ts";

const MAX_ITENS = 25;
const MAX_NOVOS_POR_RASCUNHO = 15;
const uid = () => crypto.randomUUID();
const hoje = () => new Date().toISOString().slice(0, 10);
const arred = (n: number, c = 4) => Math.round(n * 10 ** c) / 10 ** c;

// a unidade falada (g/ml/un) tem que bater com a família da unidade de compra do insumo
const familia = (u: string) => (u === "kg" || u === "g" ? "g" : u === "L" || u === "ml" ? "ml" : "un");

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return erro(req, "Método não permitido", 405);

  const ip = ipDoCliente(req);
  if (!(await dentroDoLimite(`ip:${ip}:extrair`, 3600, 20))) return erro(req, "Muitas tentativas. Espere um pouco e tente de novo.", 429);
  if (!(await dentroDoLimiteGlobal("ia"))) return erro(req, "Serviço temporariamente indisponível. Tente mais tarde.", 503);

  let texto = "";
  let cadastroId: string | null = null;
  let arquivo: File | null = null;
  const tipo = req.headers.get("content-type") || "";
  try {
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      const a = form.get("audio");
      if (a instanceof File) arquivo = a;
      texto = String(form.get("texto") || "").trim();
      cadastroId = String(form.get("cadastro_id") || "") || null;
    } else {
      const corpo = await req.json().catch(() => ({}));
      texto = String(corpo.texto || "").trim();
      cadastroId = corpo.cadastro_id || null;
    }
  } catch { return erro(req, "Não consegui ler o envio."); }

  const rascunho = cadastroId ? await carregarRascunho(cadastroId) : null;
  if (cadastroId && !rascunho) return erro(req, "Cadastro expirado ou inválido. Comece de novo.", 410);

  const uso: Record<string, number> = {};
  const alertas: string[] = [];

  // 1) transcrição
  let transcricao = texto;
  if (arquivo) {
    const inv = validarAudio(arquivo); if (inv) return erro(req, inv);
    if (rascunho && rascunho.transcricoes >= 3) return erro(req, "Limite de áudios deste cadastro atingido. Digite o prato ou crie a conta e continue lá dentro.", 429);
    try {
      const t = await transcrever(arquivo);
      transcricao = t.texto; uso.transcricao_ms = t.ms;
    } catch (e) { console.error(e); return erro(req, "Não consegui transcrever o áudio. Tente de novo em um lugar mais silencioso ou digite o prato.", 502); }
    if (rascunho) await atualizarRascunho(rascunho.id, { transcricoes: rascunho.transcricoes + 1, transcricao });
  }
  if (!transcricao || transcricao.length < 8) return erro(req, "Não entendi nada no áudio. Fale o nome do prato e os ingredientes com as quantidades.");
  if (transcricao.length > 4000) transcricao = transcricao.slice(0, 4000);

  // 2) extração
  if (rascunho && rascunho.extracoes >= 2 && !arquivo) return erro(req, "Limite de tentativas deste cadastro atingido.", 429);
  let extraido;
  try {
    const r = await extrairPrato(transcricao);
    extraido = r.prato; uso.ia_ms = r.ms; uso.tokens_entrada = r.tokens.entrada; uso.tokens_saida = r.tokens.saida;
  } catch (e) { console.error(e); return erro(req, "A IA não conseguiu montar a ficha. Tente descrever de novo, com os ingredientes e quantidades.", 502); }
  if (rascunho) await atualizarRascunho(rascunho.id, { extracoes: rascunho.extracoes + 1 });
  if (extraido.alerta) alertas.push(extraido.alerta);
  if (extraido.itens.length === 0) return erro(req, "Não identifiquei ingredientes. Diga, por exemplo: 'filé com fritas, 200 gramas de filé, 150 de batata'.");
  const itensExtraidos = extraido.itens.slice(0, MAX_ITENS);

  // 3) casamento com o catálogo
  const catalogo = await carregarCatalogo();
  const insumos: Record<string, unknown>[] = [];
  const itens: Record<string, unknown>[] = [];
  const semCatalogo: typeof itensExtraidos = [];

  for (const it of itensExtraidos) {
    const m = casar(it.nome, catalogo);
    if (m && familia(m.item.unidade_compra) === it.unidade) {
      const insumoId = uid();
      insumos.push({
        id: insumoId, nome: m.item.nome, unidade: m.item.unidade_compra, precoPacote: m.item.preco_medio, qtdPacote: m.item.qtd_padrao,
        rendimentoPreparo: m.item.rendimento_preparo, catalogoId: m.item.id, editado: false,
        historico: [{ d: hoje(), p: m.item.preco_medio }],
      });
      itens.push({ insumoId, qtd: arred(it.quantidade), perda: arred(100 - m.item.fator_aproveitamento, 1), nome: m.item.nome, nomeFalado: it.nome, unidade: it.unidade, medidaOriginal: it.medida_original, origem: it.origem, catalogoId: m.item.id, metodo: m.metodo, estimado: false });
    } else {
      semCatalogo.push(it);
    }
  }

  // 4) insumos fora do catálogo → estimativa pela IA (marcados) + fila do admin
  if (semCatalogo.length > 0) {
    const limitados = semCatalogo.slice(0, MAX_NOVOS_POR_RASCUNHO);
    let estimativas: Awaited<ReturnType<typeof estimarInsumos>>["itens"] = [];
    try { const e = await estimarInsumos(limitados.map((i) => i.nome)); estimativas = e.itens; uso.estimativa_ms = e.ms; }
    catch (e) { console.error(e); }
    const fila: Record<string, unknown>[] = [];
    limitados.forEach((it, i) => {
      const est = estimativas[i];
      const unidadeCompra = est && familia(est.unidade_compra) === it.unidade ? est.unidade_compra : it.unidade;
      const qtdPacote = est && familia(est.unidade_compra) === it.unidade ? est.qtd_padrao : 1;
      const preco = est ? est.preco_estimado : 0;
      const insumoId = uid();
      insumos.push({ id: insumoId, nome: it.nome, unidade: unidadeCompra, precoPacote: preco, qtdPacote, estimado: true, editado: false, historico: [{ d: hoje(), p: preco }] });
      itens.push({ insumoId, qtd: arred(it.quantidade), perda: 0, nome: it.nome, nomeFalado: it.nome, unidade: it.unidade, medidaOriginal: it.medida_original, origem: it.origem, estimado: true, justificativa: est?.justificativa ?? null });
      fila.push({ cadastro_id: rascunho?.id ?? null, insumo_id: insumoId, nome: it.nome, unidade: unidadeCompra, qtd_pacote: qtdPacote, preco_estimado: preco, justificativa_ia: est?.justificativa ?? null, texto_origem: it.medida_original });
    });
    if (rascunho && fila.length) {
      const { error } = await dbAdmin().from("fila_revisao_insumos").insert(fila);
      if (error) console.error("fila_revisao_insumos", error);
    }
    alertas.push(`${limitados.length} ingrediente${limitados.length > 1 ? "s" : ""} não ${limitados.length > 1 ? "estavam" : "estava"} no catálogo — preço estimado, confira: ${limitados.map((i) => i.nome).join(", ")}.`);
    if (semCatalogo.length > MAX_NOVOS_POR_RASCUNHO) alertas.push("Alguns ingredientes foram deixados de fora (limite por cadastro).");
  }
  if (itensExtraidos.some((i) => i.origem === "sugerido")) alertas.push("Quantidades marcadas como sugeridas foram estimadas — ajuste se precisar.");

  const prato = { nome: extraido.prato, rendimento: Math.max(1, Math.round(extraido.rendimento_porcoes || 1)), itens, confianca: extraido.confianca };
  if (rascunho) await atualizarRascunho(rascunho.id, { ficha: { prato, insumos, transcricao } });

  return json(req, { transcricao, prato, insumos, alertas, uso });
});
