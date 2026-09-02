import { useState } from "react";
import { C } from "./theme";
import { uid, normalizarTexto } from "./lib/util";

const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(isFinite(n) ? n : 0);

function parseNumeroBR(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/^R\$\s*/i, "");
  if (/,/.test(s) && /\./.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,/.test(s)) s = s.replace(",", ".");
  s = s.replace(/[^\d.\-]/g, "");
  return parseFloat(s);
}

function detectarLinhaCabecalho(rows) {
  const limite = Math.min(rows.length, 15);
  let melhor = 0, melhorPontos = -1;
  for (let r = 0; r < limite; r++) {
    const linha = rows[r] || [];
    const pontos = linha.filter((c) => typeof c === "string" && c.trim() && c.trim().length <= 40).length;
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = r; }
  }
  return melhor;
}

function chutarColunas(headers) {
  const achar = (padroes) => {
    for (const p of padroes) {
      for (let i = 0; i < headers.length; i++) {
        const h = String(headers[i] || "").toLowerCase();
        if (p.test(h)) return i;
      }
    }
    return null;
  };
  return {
    nome: achar([/prato/, /produto/, /item/, /descri/, /nome/]),
    preco: achar([/pre[çc]o.*venda/, /venda.*pre[çc]o/, /pre[çc]o/]),
    ingrediente: achar([/ingrediente.*descri/, /descri.*ingrediente/, /^descri/, /insumo/, /composi/, /ingrediente/]),
    gramatura: achar([/gramatura/, /peso/, /^qtd/, /quantidade/]),
    outros: achar([/\bsec\b/, /secund/, /outros/, /complement/, /demais/]),
  };
}

// agrupa linhas em blocos — cada bloco começa numa linha com a coluna "nome" preenchida
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

function parseBloco(bloco, mapa, insumosPorNome) {
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
      if (insumo) {
        itens.push({ insumoId: insumo.id, qtd: gramatura, perda: 0, _nome: insumo.nome });
      } else {
        naoEncontrados++;
        if (isFinite(outrosVal) && outrosVal > 0) outrosCustos += outrosVal;
      }
    } else if (isFinite(outrosVal) && outrosVal > 0) {
      outrosCustos += outrosVal;
    }
  }

  const valido = bloco.nome.length > 0 && isFinite(preco) && preco > 0;
  return { nome: bloco.nome, preco, itens, outrosCustos, naoEncontrados, valido };
}

export default function ImportProdutosExcel({ produtos, insumos, canais, onSaveProdutos, onSaveCanais, onClose }) {
  const [etapa, setEtapa] = useState("upload"); // upload | mapear | revisar | feito
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [xlsxMod, setXlsxMod] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetName, setSheetName] = useState("");
  const [rows, setRows] = useState([]);
  const [headerIdx, setHeaderIdx] = useState(0);
  const [mapa, setMapa] = useState({ nome: null, preco: null, ingrediente: null, gramatura: null, outros: null });
  const [resultado, setResultado] = useState(null);

  const abrirArquivo = async (file) => {
    setErro("");
    setCarregando(true);
    try {
      const XLSX = xlsxMod ?? (await import("xlsx"));
      if (!xlsxMod) setXlsxMod(XLSX);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      if (!wb.SheetNames.length) throw new Error("Nenhuma aba encontrada.");
      setWorkbook(wb);
      selecionarAba(XLSX, wb, wb.SheetNames[0]);
    } catch (e) {
      setErro("Não consegui ler esse arquivo. Confirme que é um .xlsx, .xls ou .csv válido.");
    } finally {
      setCarregando(false);
    }
  };

  const selecionarAba = (XLSX, wb, nome) => {
    const ws = wb.Sheets[nome];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
    const hIdx = detectarLinhaCabecalho(aoa);
    const headers = (aoa[hIdx] || []).map((h) => String(h || "").trim());
    setSheetName(nome);
    setRows(aoa);
    setHeaderIdx(hIdx);
    setMapa(chutarColunas(headers));
    setEtapa("mapear");
  };

  const headers = rows[headerIdx] || [];
  const linhasDados = rows.slice(headerIdx + 1);

  const insumosPorNome = new Map(insumos.map((i) => [normalizarTexto(i.nome), i]));
  const blocos = agruparBlocos(linhasDados, mapa.nome);
  const parsed = blocos.map((b) => parseBloco(b, mapa, insumosPorNome));

  const validos = parsed.filter((p) => p.valido);
  const invalidos = parsed.filter((p) => !p.valido);
  const comIngredienteFaltando = validos.filter((p) => p.naoEncontrados > 0);

  const confirmarImportacao = () => {
    let canalPrincipalId;
    if (canais.length === 0) {
      const novoCanal = { id: uid(), nome: "Venda Salão", comissao: 0, embalagem: 0 };
      canalPrincipalId = novoCanal.id;
      onSaveCanais([novoCanal]);
    } else {
      canalPrincipalId = canais[0].id;
    }

    const porNome = new Map(produtos.map((p) => [normalizarTexto(p.nome), p]));
    let lista = [...produtos];
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
          precosCanal: { ...(existente.precosCanal || {}), [canalPrincipalId]: imp.preco },
        };
        atualizados++;
      } else {
        const novo = {
          id: uid(), nome: imp.nome, rendimento: 1, maoDeObra: 0,
          outrosCustos: imp.outrosCustos,
          precosCanal: { [canalPrincipalId]: imp.preco },
          itens: itensLimpos,
        };
        lista.push(novo);
        porNome.set(chave, novo);
        criados++;
      }
    }

    onSaveProdutos(lista);
    setResultado({ criados, atualizados, ignorados: invalidos.length, comIngredienteFaltando: comIngredienteFaltando.length });
    setEtapa("feito");
  };

  const Select = ({ campo, obrigatorio }) => (
    <select value={mapa[campo] ?? ""} onChange={(e) => setMapa({ ...mapa, [campo]: e.target.value === "" ? null : Number(e.target.value) })}
      style={{ border: `1.5px solid ${C.rule}`, borderRadius: 8, background: "#fff", padding: "9px 8px", fontSize: 13.5, fontWeight: 600, width: "100%" }}>
      <option value="">{obrigatorio ? "— selecione —" : "— nenhuma —"}</option>
      {headers.map((h, i) => (
        <option key={i} value={i}>{String(h || `Coluna ${i + 1}`)}</option>
      ))}
    </select>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(24,24,26,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 26, maxWidth: 580, width: "100%", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div className="serif" style={{ fontSize: 21 }}>Importar produtos do Excel</div>
          <button className="btn" onClick={onClose} style={{ background: "none", border: "none", color: C.ink45, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {etapa === "upload" && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.55, marginBottom: 18 }}>
              Suba a ficha técnica dos pratos (.xlsx, .xls ou .csv). Funciona com uma linha por prato, ou com o padrão comum de "ingrediente principal + linhas de complementos" — no próximo passo você indica as colunas.
            </div>
            <label className="btn card tap" style={{ display: "block", textAlign: "center", padding: "26px 16px", cursor: carregando ? "default" : "pointer", borderStyle: "dashed", opacity: carregando ? 0.6 : 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{carregando ? "Lendo arquivo…" : "Escolher arquivo"}</span>
              <input type="file" accept=".xlsx,.xls,.csv" disabled={carregando} style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && abrirArquivo(e.target.files[0])} />
            </label>
            {erro && <div style={{ marginTop: 12, background: C.redSoft, color: C.red, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{erro}</div>}
          </div>
        )}

        {etapa === "mapear" && (
          <div style={{ paddingTop: 10 }}>
            {workbook.SheetNames.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <div className="lbl" style={{ marginBottom: 5 }}>Aba da planilha</div>
                <select value={sheetName} onChange={(e) => selecionarAba(xlsxMod, workbook, e.target.value)}
                  style={{ border: `1.5px solid ${C.rule}`, borderRadius: 8, background: "#fff", padding: "9px 8px", fontSize: 13.5, fontWeight: 600, width: "100%" }}>
                  {workbook.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            <div style={{ fontSize: 13.5, color: C.ink70, marginBottom: 14, lineHeight: 1.5 }}>
              Detectei o cabeçalho na linha {headerIdx + 1}. Indique qual coluna é cada coisa:
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 6 }}>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Nome do prato *</div>
                <Select campo="nome" obrigatorio />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Preço de venda *</div>
                <Select campo="preco" obrigatorio />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Ingrediente principal (opcional)</div>
                <Select campo="ingrediente" />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Gramatura / quantidade do ingrediente (opcional)</div>
                <Select campo="gramatura" />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Outros custos / secundários — R$ (opcional)</div>
                <Select campo="outros" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn" onClick={() => setEtapa("upload")}
                style={{ background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Voltar
              </button>
              <button className="btn" disabled={mapa.nome == null || mapa.preco == null} onClick={() => setEtapa("revisar")}
                style={{ background: mapa.nome != null && mapa.preco != null ? C.ink : C.rule, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {etapa === "revisar" && (
          <div style={{ paddingTop: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span className="mono tag" style={{ background: C.okSoft, color: C.ok }}>{validos.length} pronto{validos.length !== 1 ? "s" : ""} pra importar</span>
              {invalidos.length > 0 && <span className="mono tag" style={{ background: C.warnSoft, color: C.warn }}>{invalidos.length} ignorado{invalidos.length !== 1 ? "s" : ""} (sem nome ou preço)</span>}
              {comIngredienteFaltando.length > 0 && <span className="mono tag" style={{ background: C.redSoft, color: C.red }}>{comIngredienteFaltando.length} com ingrediente não encontrado</span>}
            </div>

            <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: C.paperAlt }}>
                    <th className="lbl" style={{ textAlign: "left", padding: "8px 10px", fontSize: 11.5 }}>Prato</th>
                    <th className="lbl" style={{ textAlign: "left", padding: "8px 10px", fontSize: 11.5 }}>Ingrediente</th>
                    <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 11.5 }}>Outros custos</th>
                    <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 11.5 }}>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {validos.map((p, i) => (
                    <tr key={i} className="row">
                      <td style={{ padding: "7px 10px", fontSize: 13 }}>{p.nome}</td>
                      <td style={{ padding: "7px 10px", fontSize: 12.5, color: p.naoEncontrados > 0 ? C.red : C.ink45 }}>
                        {p.itens.length > 0 ? p.itens.map((it) => it._nome).join(", ") : "—"}
                        {p.naoEncontrados > 0 && ` (${p.naoEncontrados} não encontrado${p.naoEncontrados > 1 ? "s" : ""})`}
                      </td>
                      <td className="mono" style={{ padding: "7px 10px", fontSize: 13, textAlign: "right" }}>{p.outrosCustos > 0 ? brl(p.outrosCustos) : "—"}</td>
                      <td className="mono" style={{ padding: "7px 10px", fontSize: 13, textAlign: "right" }}>{brl(p.preco)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 12, color: C.ink45, marginTop: 12, lineHeight: 1.55 }}>
              Prato com nome igual a um já cadastrado tem o preço e o custo atualizados; os demais são criados. Ingrediente não encontrado nos insumos entra como valor em "outros custos" ao invés de ser itemizado — confira depois na ficha do produto.
              {canais.length === 0 && <> Um canal <b>"Venda Salão"</b> será criado automaticamente pra receber esses preços.</>}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn" onClick={() => setEtapa("mapear")}
                style={{ background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Voltar
              </button>
              <button className="btn" disabled={validos.length === 0} onClick={confirmarImportacao}
                style={{ background: validos.length ? C.ink : C.rule, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Importar {validos.length} produto{validos.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {etapa === "feito" && resultado && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ background: C.okSoft, borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ok, marginBottom: 4 }}>Importação concluída</div>
              <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.5 }}>
                {resultado.criados} produto{resultado.criados !== 1 ? "s" : ""} novo{resultado.criados !== 1 ? "s" : ""} · {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? "s" : ""}
                {resultado.ignorados > 0 && ` · ${resultado.ignorados} ignorado${resultado.ignorados !== 1 ? "s" : ""}`}
              </div>
              {resultado.comIngredienteFaltando > 0 && (
                <div style={{ fontSize: 13, color: C.warn, marginTop: 8, fontWeight: 600 }}>
                  {resultado.comIngredienteFaltando} produto{resultado.comIngredienteFaltando !== 1 ? "s" : ""} com ingrediente não localizado — vale conferir manualmente.
                </div>
              )}
            </div>
            <button className="btn" onClick={onClose}
              style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: 13, fontSize: 14, fontWeight: 700 }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
