import { normalizarTexto, hoje, uid } from "./util";

export function parseNumeroBR(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/^R\$\s*/i, "");
  if (/,/.test(s) && /\./.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,/.test(s)) s = s.replace(",", ".");
  s = s.replace(/[^\d.\-]/g, "");
  return parseFloat(s);
}

export function normalizarUnidade(v) {
  const s = String(v || "").trim().toLowerCase();
  if (/^kg/.test(s)) return "kg";
  if (/^g(r|rama)?s?$/.test(s)) return "g";
  if (/^l(itro)?s?$/.test(s)) return "L";
  if (/^ml/.test(s)) return "ml";
  if (/^m2|m²/.test(s)) return "m2";
  if (/^un/.test(s)) return "un";
  return null;
}

export function detectarLinhaCabecalho(rows) {
  const limite = Math.min(rows.length, 15);
  let melhor = 0, melhorPontos = -1;
  for (let r = 0; r < limite; r++) {
    const linha = rows[r] || [];
    const pontos = linha.filter((c) => typeof c === "string" && c.trim() && c.trim().length <= 40).length;
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = r; }
  }
  return melhor;
}

function achar(headers, padroes) {
  for (const p of padroes) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || "").toLowerCase();
      if (p.test(h)) return i;
    }
  }
  return null;
}

const temHeader = (headers, re) => headers.some((h) => re.test(String(h || "").toLowerCase()));

export function chutarColunasInsumos(headers) {
  return {
    nome: achar(headers, [/insumo/, /mat[eé]ria.?prima/, /ingrediente/, /nome/, /descri/, /produto/]),
    unidade: achar(headers, [/unidade/, /medida/, /^un$/]),
    preco: achar(headers, [/pre[çc]o|valor|custo/]),
    qtd: achar(headers, [/quantidade/, /qtd/, /pacote/, /embalagem/]),
  };
}

export function chutarColunasProdutos(headers) {
  return {
    nome: achar(headers, [/prato/, /card[aá]pio/, /produto/, /item/, /descri/, /nome/]),
    preco: achar(headers, [/pre[çc]o.*venda/, /venda.*pre[çc]o/, /pre[çc]o/]),
    ingrediente: achar(headers, [/ingrediente.*descri/, /descri.*ingrediente/, /^descri/, /insumo/, /composi/, /ingrediente/]),
    gramatura: achar(headers, [/gramatura/, /peso/, /^qtd/, /quantidade/]),
    outros: achar(headers, [/\bsec\b/, /secund/, /outros/, /complement/, /demais/]),
  };
}

// pontua o quanto uma planilha "parece" ser uma lista de insumos vs. uma ficha técnica de produtos
export function pontuarAba(headers) {
  const h = headers.map((x) => String(x || "").toLowerCase());
  const has = (re) => h.some((x) => re.test(x));

  let insumos = 0;
  if (has(/insumo|mat[eé]ria.?prima/)) insumos += 2;
  if (has(/unidade/)) insumos += 2;
  if ((has(/valor/) || has(/pre[çc]o/)) && !has(/venda/)) insumos += 2;
  if (has(/gramatura/) || (has(/ingrediente/) && has(/descri/))) insumos -= 2;

  let produtos = 0;
  if (has(/prato|card[aá]pio/)) produtos += 3;
  if (has(/pre[çc]o.*venda/) || has(/venda.*pre[çc]o/)) produtos += 3;
  if (has(/gramatura/) || has(/peso/)) produtos += 2;
  if (has(/ingrediente|composi/)) produtos += 1;
  if (has(/cmv/) || has(/markup/)) produtos += 1;

  return { insumos, produtos };
}

// escolhe a melhor aba pra cada categoria, sem repetir a mesma aba nas duas
export function classificarAbas(sheets) {
  // sheets: [{ nome, headers }]
  const pontuados = sheets.map((s) => ({ ...s, pts: pontuarAba(s.headers) }));

  const melhorInsumos = pontuados.filter((s) => s.pts.insumos >= 4).sort((a, b) => b.pts.insumos - a.pts.insumos)[0] || null;
  const melhorProdutos = pontuados
    .filter((s) => s.pts.produtos >= 5 && s.nome !== melhorInsumos?.nome)
    .sort((a, b) => b.pts.produtos - a.pts.produtos)[0] || null;

  return {
    insumosSheet: melhorInsumos?.nome ?? null,
    produtosSheet: melhorProdutos?.nome ?? null,
  };
}

export function parseInsumosLinhas(linhasDados, mapa) {
  const linhas = linhasDados.map((linha) => {
    const nomeRaw = mapa.nome != null ? linha[mapa.nome] : null;
    const nome = nomeRaw != null ? String(nomeRaw).trim() : "";
    const preco = mapa.preco != null ? parseNumeroBR(linha[mapa.preco]) : NaN;
    const unidadeDetectada = mapa.unidade != null ? normalizarUnidade(linha[mapa.unidade]) : null;
    const unidade = unidadeDetectada || "kg";
    const qtdRaw = mapa.qtd != null ? parseNumeroBR(linha[mapa.qtd]) : 1;
    const qtdPacote = isFinite(qtdRaw) && qtdRaw > 0 ? qtdRaw : 1;
    const valido = nome.length > 0 && isFinite(preco) && preco > 0;
    return { nome, unidade, precoPacote: preco, qtdPacote, valido };
  }).filter((l) => l.nome || isFinite(l.precoPacote));
  return { validas: linhas.filter((l) => l.valido), invalidas: linhas.filter((l) => !l.valido) };
}

function agruparBlocos(linhasDados, colNome) {
  const blocos = [];
  let atual = null;
  for (const linha of linhasDados) {
    const nomeRaw = colNome != null ? linha[colNome] : null;
    const nome = nomeRaw != null ? String(nomeRaw).trim() : "";
    if (nome) {
      if (atual) blocos.push(atual);
      atual = { nome, linhas: [linha] };
    } else if (atual) {
      atual.linhas.push(linha);
    }
  }
  if (atual) blocos.push(atual);
  return blocos;
}

export function parseProdutosBlocos(linhasDados, mapa, insumosPorNome) {
  const blocos = agruparBlocos(linhasDados, mapa.nome);
  const parsed = blocos.map((bloco) => {
    const primeira = bloco.linhas[0];
    const preco = mapa.preco != null ? parseNumeroBR(primeira[mapa.preco]) : NaN;
    let outrosCustos = 0;
    const itens = [];
    let naoEncontrados = 0;

    for (const linha of bloco.linhas) {
      const ingredienteRaw = mapa.ingrediente != null ? linha[mapa.ingrediente] : null;
      const ingredienteNome = ingredienteRaw != null ? String(ingredienteRaw).trim() : "";
      const gramatura = mapa.gramatura != null ? parseNumeroBR(linha[mapa.gramatura]) : NaN;
      const outrosVal = mapa.outros != null ? parseNumeroBR(linha[mapa.outros]) : NaN;

      if (ingredienteNome && isFinite(gramatura) && gramatura > 0) {
        const insumo = insumosPorNome.get(normalizarTexto(ingredienteNome));
        if (insumo) itens.push({ insumoId: insumo.id, qtd: gramatura, perda: 0, _nome: insumo.nome });
        else {
          naoEncontrados++;
          if (isFinite(outrosVal) && outrosVal > 0) outrosCustos += outrosVal;
        }
      } else if (isFinite(outrosVal) && outrosVal > 0) {
        outrosCustos += outrosVal;
      }
    }

    const valido = bloco.nome.length > 0 && isFinite(preco) && preco > 0;
    return { nome: bloco.nome, preco, itens, outrosCustos, naoEncontrados, valido };
  });
  return { validos: parsed.filter((p) => p.valido), invalidos: parsed.filter((p) => !p.valido) };
}

export function mergeInsumos(existentes, validas) {
  const porNome = new Map(existentes.map((i) => [normalizarTexto(i.nome), i]));
  let lista = [...existentes];
  let criados = 0, atualizados = 0;
  for (const imp of validas) {
    const chave = normalizarTexto(imp.nome);
    const existente = porNome.get(chave);
    if (existente) {
      const idx = lista.findIndex((x) => x.id === existente.id);
      const mudouPreco = existente.precoPacote !== imp.precoPacote;
      const historico = mudouPreco
        ? [...(existente.historico || []), { d: hoje(), p: imp.precoPacote }].slice(-12)
        : (existente.historico || []);
      const atualizado = { ...existente, unidade: imp.unidade, precoPacote: imp.precoPacote, qtdPacote: imp.qtdPacote, historico };
      lista[idx] = atualizado;
      porNome.set(chave, atualizado);
      atualizados++;
    } else {
      const novo = { id: uid(), nome: imp.nome, unidade: imp.unidade, precoPacote: imp.precoPacote, qtdPacote: imp.qtdPacote, historico: [{ d: hoje(), p: imp.precoPacote }] };
      lista.push(novo);
      porNome.set(chave, novo);
      criados++;
    }
  }
  return { lista, criados, atualizados };
}

export function mergeProdutos(existentes, validos, canalId) {
  const porNome = new Map(existentes.map((p) => [normalizarTexto(p.nome), p]));
  let lista = [...existentes];
  let criados = 0, atualizados = 0;
  for (const imp of validos) {
    const chave = normalizarTexto(imp.nome);
    const existente = porNome.get(chave);
    const itensLimpos = imp.itens.map(({ insumoId, qtd, perda }) => ({ insumoId, qtd, perda }));
    if (existente) {
      const idx = lista.findIndex((x) => x.id === existente.id);
      lista[idx] = {
        ...existente,
        itens: itensLimpos.length ? itensLimpos : existente.itens,
        outrosCustos: imp.outrosCustos,
        precosCanal: { ...(existente.precosCanal || {}), ...(canalId ? { [canalId]: imp.preco } : {}) },
      };
      atualizados++;
    } else {
      const novo = {
        id: uid(), nome: imp.nome, rendimento: 1, maoDeObra: 0, outrosCustos: imp.outrosCustos,
        precosCanal: canalId ? { [canalId]: imp.preco } : {}, itens: itensLimpos,
      };
      lista.push(novo);
      porNome.set(chave, novo);
      criados++;
    }
  }
  return { lista, criados, atualizados };
}
