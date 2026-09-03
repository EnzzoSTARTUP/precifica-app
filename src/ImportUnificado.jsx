import { useState } from "react";
import { C } from "./theme";
import { uid, normalizarTexto } from "./lib/util";
import {
  detectarLinhaCabecalho, chutarColunasInsumos, chutarColunasProdutos, classificarAbas,
  parseInsumosLinhas, parseProdutosBlocos, mergeInsumos, mergeProdutos,
} from "./lib/importEngines";

const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(isFinite(n) ? n : 0);

export default function ImportUnificado({ insumos, produtos, canais, onSaveInsumos, onSaveProdutos, onSaveCanais, onClose }) {
  const [etapa, setEtapa] = useState("upload"); // upload | revisar | feito
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [xlsxMod, setXlsxMod] = useState(null);
  const [sheets, setSheets] = useState([]); // [{ nome, aoa, headerIdx, headers }]
  const [insumosSheet, setInsumosSheet] = useState("");
  const [produtosSheet, setProdutosSheet] = useState("");
  const [mapaInsumos, setMapaInsumos] = useState({});
  const [mapaProdutos, setMapaProdutos] = useState({});
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

      const info = wb.SheetNames.map((nome) => {
        const ws = wb.Sheets[nome];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
        const headerIdx = detectarLinhaCabecalho(aoa);
        const headers = (aoa[headerIdx] || []).map((h) => String(h || "").trim());
        return { nome, aoa, headerIdx, headers };
      });
      setSheets(info);

      const { insumosSheet: aI, produtosSheet: aP } = classificarAbas(info.map((s) => ({ nome: s.nome, headers: s.headers })));
      const infoI = info.find((s) => s.nome === aI);
      const infoP = info.find((s) => s.nome === aP);
      setInsumosSheet(aI || "");
      setProdutosSheet(aP || "");
      setMapaInsumos(infoI ? chutarColunasInsumos(infoI.headers) : {});
      setMapaProdutos(infoP ? chutarColunasProdutos(infoP.headers) : {});
      setEtapa("revisar");
    } catch (e) {
      setErro("Não consegui ler esse arquivo. Confirme que é um .xlsx, .xls ou .csv válido.");
    } finally {
      setCarregando(false);
    }
  };

  const trocarAbaInsumos = (nome) => {
    setInsumosSheet(nome);
    const info = sheets.find((s) => s.nome === nome);
    setMapaInsumos(info ? chutarColunasInsumos(info.headers) : {});
  };
  const trocarAbaProdutos = (nome) => {
    setProdutosSheet(nome);
    const info = sheets.find((s) => s.nome === nome);
    setMapaProdutos(info ? chutarColunasProdutos(info.headers) : {});
  };

  const infoInsumos = sheets.find((s) => s.nome === insumosSheet);
  const infoProdutos = sheets.find((s) => s.nome === produtosSheet);

  const insumosResult = infoInsumos && mapaInsumos.nome != null && mapaInsumos.preco != null
    ? parseInsumosLinhas(infoInsumos.aoa.slice(infoInsumos.headerIdx + 1), mapaInsumos)
    : { validas: [], invalidas: [] };

  const insumosMerge = mergeInsumos(insumos, insumosResult.validas);
  const insumosPorNomeEfetivo = new Map(insumosMerge.lista.map((i) => [normalizarTexto(i.nome), i]));

  const produtosResult = infoProdutos && mapaProdutos.nome != null && mapaProdutos.preco != null
    ? parseProdutosBlocos(infoProdutos.aoa.slice(infoProdutos.headerIdx + 1), mapaProdutos, insumosPorNomeEfetivo)
    : { validos: [], invalidos: [] };

  const nadaDetectado = insumosResult.validas.length === 0 && produtosResult.validos.length === 0;

  const confirmarImportacao = () => {
    let canalId = canais[0]?.id ?? null;
    if (!canalId && produtosResult.validos.length > 0) {
      const novoCanal = { id: uid(), nome: "Venda Salão", comissao: 0, embalagem: 0 };
      canalId = novoCanal.id;
      onSaveCanais([novoCanal]);
    }

    if (insumosResult.validas.length > 0) onSaveInsumos(insumosMerge.lista);

    let prodMerge = { criados: 0, atualizados: 0 };
    if (produtosResult.validos.length > 0) {
      prodMerge = mergeProdutos(produtos, produtosResult.validos, canalId, mapaProdutos.ingrediente != null);
      onSaveProdutos(prodMerge.lista);
    }

    setResultado({
      insumosCriados: insumosMerge.criados, insumosAtualizados: insumosMerge.atualizados,
      produtosCriados: prodMerge.criados, produtosAtualizados: prodMerge.atualizados,
      ingredientesFaltando: produtosResult.validos.filter((p) => p.naoEncontrados > 0).length,
      custosSuspeitos: produtosResult.validos.filter((p) => p.custoImplausivel > 0).length,
    });
    setEtapa("feito");
  };

  const SelectAba = ({ value, onChange }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ border: `1.5px solid ${C.rule}`, borderRadius: 8, background: "#fff", padding: "6px 8px", fontSize: 12.5, fontWeight: 600 }}>
      <option value="">— nenhuma —</option>
      {sheets.map((s) => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
    </select>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(24,24,26,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 26, maxWidth: 620, width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div className="serif" style={{ fontSize: 21 }}>Importar do Excel</div>
          <button className="btn" onClick={onClose} style={{ background: "none", border: "none", color: C.ink45, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {etapa === "upload" && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.55, marginBottom: 18 }}>
              Suba a planilha do cliente (.xlsx, .xls ou .csv) — pode ter várias abas. O sistema identifica sozinho onde estão os insumos e onde estão os pratos, e preenche os dois de uma vez.
            </div>
            <label className="btn card tap" style={{ display: "block", textAlign: "center", padding: "26px 16px", cursor: carregando ? "default" : "pointer", borderStyle: "dashed", opacity: carregando ? 0.6 : 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{carregando ? "Lendo arquivo…" : "Escolher arquivo"}</span>
              <input type="file" accept=".xlsx,.xls,.csv" disabled={carregando} style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && abrirArquivo(e.target.files[0])} />
            </label>
            {erro && <div style={{ marginTop: 12, background: C.redSoft, color: C.red, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{erro}</div>}
          </div>
        )}

        {etapa === "revisar" && (
          <div style={{ paddingTop: 10 }}>
            {/* Insumos */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Insumos</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="lbl" style={{ fontSize: 11.5 }}>aba:</span>
                <SelectAba value={insumosSheet} onChange={trocarAbaInsumos} />
              </div>
            </div>
            {insumosResult.validas.length > 0 ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="mono tag" style={{ background: C.okSoft, color: C.ok }}>{insumosResult.validas.length} detectados</span>
                  {insumosResult.invalidas.length > 0 && <span className="mono tag" style={{ background: C.warnSoft, color: C.warn }}>{insumosResult.invalidas.length} ignorados</span>}
                  {insumosResult.duplicatas > 0 && (
                    <span className="mono tag" style={{ background: C.warnSoft, color: C.warn }}>
                      {insumosResult.duplicatas} duplicado{insumosResult.duplicatas !== 1 ? "s" : ""} na planilha — usando a última ocorrência
                    </span>
                  )}
                </div>
                <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, maxHeight: 160, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {insumosResult.validas.map((l, i) => (
                        <tr key={i} className="row">
                          <td style={{ padding: "6px 10px", fontSize: 13 }}>{l.nome}</td>
                          <td style={{ padding: "6px 10px", fontSize: 12.5, textAlign: "right", color: C.ink45 }}>{l.unidade}</td>
                          <td className="mono" style={{ padding: "6px 10px", fontSize: 13, textAlign: "right" }}>{brl(l.precoPacote)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.ink45, paddingBottom: 6 }}>Nenhum insumo detectado{insumosSheet ? " nessa aba" : ""}.</div>
            )}

            {/* Produtos */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Produtos</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="lbl" style={{ fontSize: 11.5 }}>aba:</span>
                <SelectAba value={produtosSheet} onChange={trocarAbaProdutos} />
              </div>
            </div>
            {produtosResult.validos.length > 0 ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="mono tag" style={{ background: C.okSoft, color: C.ok }}>{produtosResult.validos.length} detectados</span>
                  {produtosResult.invalidos.length > 0 && <span className="mono tag" style={{ background: C.warnSoft, color: C.warn }}>{produtosResult.invalidos.length} ignorados</span>}
                  {produtosResult.validos.some((p) => p.naoEncontrados > 0) && (
                    <span className="mono tag" style={{ background: C.redSoft, color: C.red }}>
                      {produtosResult.validos.filter((p) => p.naoEncontrados > 0).length} com ingrediente não encontrado
                    </span>
                  )}
                  {produtosResult.validos.some((p) => p.custoImplausivel > 0) && (
                    <span className="mono tag" style={{ background: C.warnSoft, color: C.warn }}>
                      {produtosResult.validos.filter((p) => p.custoImplausivel > 0).length} com custo de ingrediente implausível
                    </span>
                  )}
                </div>
                <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, maxHeight: 220, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {produtosResult.validos.map((p, i) => (
                        <tr key={i} className="row">
                          <td style={{ padding: "6px 10px", fontSize: 13 }}>{p.nome}</td>
                          <td style={{ padding: "6px 10px", fontSize: 12, color: p.naoEncontrados > 0 || p.custoImplausivel > 0 ? C.red : C.ink45 }}>
                            {p.itens.length > 0 ? p.itens.map((it) => it._nome).join(", ") : "—"}
                            {p.custoImplausivel > 0 && ` (ingrediente ignorado — custo maior que o preço de venda, confira a unidade)`}
                          </td>
                          <td className="mono" style={{ padding: "6px 10px", fontSize: 13, textAlign: "right" }}>{brl(p.preco)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.ink45, paddingBottom: 6 }}>Nenhum produto detectado{produtosSheet ? " nessa aba" : ""}.</div>
            )}

            <div style={{ fontSize: 12, color: C.ink45, marginTop: 16, lineHeight: 1.55 }}>
              Item com nome igual a um já cadastrado tem os dados atualizados; os demais são criados — nada é apagado.
              {canais.length === 0 && produtosResult.validos.length > 0 && <> Um canal <b>"Venda Salão"</b> será criado pra receber os preços dos pratos.</>}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn" onClick={() => setEtapa("upload")}
                style={{ background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Voltar
              </button>
              <button className="btn" disabled={nadaDetectado} onClick={confirmarImportacao}
                style={{ background: nadaDetectado ? C.rule : C.ink, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                Importar tudo
              </button>
            </div>
          </div>
        )}

        {etapa === "feito" && resultado && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ background: C.okSoft, borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ok, marginBottom: 8 }}>Importação concluída</div>
              <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.6 }}>
                <b>Insumos:</b> {resultado.insumosCriados} novo{resultado.insumosCriados !== 1 ? "s" : ""} · {resultado.insumosAtualizados} atualizado{resultado.insumosAtualizados !== 1 ? "s" : ""}<br />
                <b>Produtos:</b> {resultado.produtosCriados} novo{resultado.produtosCriados !== 1 ? "s" : ""} · {resultado.produtosAtualizados} atualizado{resultado.produtosAtualizados !== 1 ? "s" : ""}
              </div>
              {resultado.ingredientesFaltando > 0 && (
                <div style={{ fontSize: 13, color: C.warn, marginTop: 8, fontWeight: 600 }}>
                  {resultado.ingredientesFaltando} produto{resultado.ingredientesFaltando !== 1 ? "s" : ""} com ingrediente não localizado — vale conferir manualmente.
                </div>
              )}
              {resultado.custosSuspeitos > 0 && (
                <div style={{ fontSize: 13, color: C.warn, marginTop: 8, fontWeight: 600 }}>
                  {resultado.custosSuspeitos} produto{resultado.custosSuspeitos !== 1 ? "s" : ""} com ingrediente ignorado por custo implausível (provável unidade incompatível na planilha) — confira manualmente.
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
