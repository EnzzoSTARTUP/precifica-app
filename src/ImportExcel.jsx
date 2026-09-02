import { useState } from "react";
import { C } from "./theme";
import { UNIDADES, hoje, uid, normalizarTexto } from "./lib/util";

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

function normalizarUnidade(v) {
  const s = String(v || "").trim().toLowerCase();
  if (/^kg/.test(s)) return "kg";
  if (/^g(r|rama)?s?$/.test(s)) return "g";
  if (/^l(itro)?s?$/.test(s)) return "L";
  if (/^ml/.test(s)) return "ml";
  if (/^m2|m²/.test(s)) return "m2";
  if (/^un/.test(s)) return "un";
  return null;
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
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || "").toLowerCase();
      if (padroes.some((p) => p.test(h))) return i;
    }
    return null;
  };
  return {
    nome: achar([/insumo/, /ingrediente/, /nome/, /descri/, /produto/]),
    unidade: achar([/unidade/, /medida/, /^un$/]),
    preco: achar([/pre[çc]o/, /valor/, /custo/]),
    qtd: achar([/quantidade/, /qtd/, /pacote/, /embalagem/]),
  };
}

export default function ImportExcel({ insumos, onSave, onClose }) {
  const [etapa, setEtapa] = useState("upload"); // upload | mapear | revisar | feito
  const [erro, setErro] = useState("");
  const [workbook, setWorkbook] = useState(null);
  const [sheetName, setSheetName] = useState("");
  const [rows, setRows] = useState([]); // array-of-arrays da planilha inteira
  const [headerIdx, setHeaderIdx] = useState(0);
  const [mapa, setMapa] = useState({ nome: null, unidade: null, preco: null, qtd: null });
  const [resultado, setResultado] = useState(null); // { criados, atualizados, ignorados }
  const [xlsxMod, setXlsxMod] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const abrirArquivo = async (file) => {
    setErro("");
    setCarregando(true);
    try {
      const XLSX = xlsxMod ?? (await import("xlsx"));
      if (!xlsxMod) setXlsxMod(XLSX);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      if (!wb.SheetNames.length) throw new Error("Nenhuma aba encontrada no arquivo.");
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

  const linhasParsed = linhasDados.map((linha) => {
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

  const validas = linhasParsed.filter((l) => l.valido);
  const invalidas = linhasParsed.filter((l) => !l.valido);

  const confirmarImportacao = () => {
    const porNome = new Map(insumos.map((i) => [normalizarTexto(i.nome), i]));
    let lista = [...insumos];
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
        lista[idx] = { ...existente, unidade: imp.unidade, precoPacote: imp.precoPacote, qtdPacote: imp.qtdPacote, historico };
        atualizados++;
      } else {
        const novo = { id: uid(), nome: imp.nome, unidade: imp.unidade, precoPacote: imp.precoPacote, qtdPacote: imp.qtdPacote, historico: [{ d: hoje(), p: imp.precoPacote }] };
        lista.push(novo);
        porNome.set(chave, novo);
        criados++;
      }
    }
    onSave(lista);
    setResultado({ criados, atualizados, ignorados: invalidas.length });
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
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 26, maxWidth: 560, width: "100%", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div className="serif" style={{ fontSize: 21 }}>Importar insumos do Excel</div>
          <button className="btn" onClick={onClose} style={{ background: "none", border: "none", color: C.ink45, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {etapa === "upload" && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.55, marginBottom: 18 }}>
              Suba a planilha de insumos/preços do cliente (.xlsx, .xls ou .csv). No próximo passo você indica quais colunas usar — não precisa estar num formato específico.
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
                <div className="lbl" style={{ marginBottom: 5 }}>Nome do insumo *</div>
                <Select campo="nome" obrigatorio />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Preço *</div>
                <Select campo="preco" obrigatorio />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Unidade (opcional — kg se não indicado)</div>
                <Select campo="unidade" />
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 5 }}>Quantidade no pacote (opcional — 1 se não indicado)</div>
                <Select campo="qtd" />
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
              <span className="mono tag" style={{ background: C.okSoft, color: C.ok }}>{validas.length} prontos pra importar</span>
              {invalidas.length > 0 && <span className="mono tag" style={{ background: C.warnSoft, color: C.warn }}>{invalidas.length} ignorados (sem nome ou preço)</span>}
            </div>

            <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: C.paperAlt }}>
                    <th className="lbl" style={{ textAlign: "left", padding: "8px 10px", fontSize: 11.5 }}>Nome</th>
                    <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 11.5 }}>Unidade</th>
                    <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 11.5 }}>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {validas.map((l, i) => (
                    <tr key={i} className="row">
                      <td style={{ padding: "7px 10px", fontSize: 13 }}>{l.nome}</td>
                      <td style={{ padding: "7px 10px", fontSize: 13, textAlign: "right", color: C.ink45 }}>{l.unidade}</td>
                      <td className="mono" style={{ padding: "7px 10px", fontSize: 13, textAlign: "right" }}>{brl(l.precoPacote)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 12, color: C.ink45, marginTop: 12, lineHeight: 1.5 }}>
              Insumos com o mesmo nome de um já cadastrado têm o preço atualizado; os demais são criados como novos.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn" onClick={() => setEtapa("mapear")}
                style={{ background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Voltar
              </button>
              <button className="btn" disabled={validas.length === 0} onClick={confirmarImportacao}
                style={{ background: validas.length ? C.ink : C.rule, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Importar {validas.length} insumo{validas.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {etapa === "feito" && resultado && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ background: C.okSoft, borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ok, marginBottom: 4 }}>Importação concluída</div>
              <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.5 }}>
                {resultado.criados} insumo{resultado.criados !== 1 ? "s" : ""} novo{resultado.criados !== 1 ? "s" : ""} · {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? "s" : ""}
                {resultado.ignorados > 0 && ` · ${resultado.ignorados} linha${resultado.ignorados !== 1 ? "s" : ""} ignorada${resultado.ignorados !== 1 ? "s" : ""}`}
              </div>
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
