import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../theme";
import { Btn, Modal, Campo, Entrada, Selecao, TagStatus, Vazio, Aviso, CATEGORIAS_INSUMO, UNIDADES_COMPRA, brl, dataHoraBR, th, td } from "./comum";

const FILTROS = [["pendente", "Pendentes"], ["aprovado", "Aprovados"], ["rejeitado", "Rejeitados"]];

export default function FilaRevisao() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("pendente");
  const [revisando, setRevisando] = useState(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("fila_revisao_insumos").select("*").eq("status", filtro).order("criado_em", { ascending: false }).limit(300);
    if (error) { setErro(error.message); setLista([]); return; }
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, [filtro]);

  const rejeitar = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fila_revisao_insumos").update({ status: "rejeitado", decidido_em: new Date().toISOString(), decidido_por: user?.id }).eq("id", item.id);
    if (error) return alert("Não deu: " + error.message);
    setRevisando(null); await carregar();
  };

  const aprovar = async (item, corpo) => {
    const { data: { user } } = await supabase.auth.getUser();
    let catalogoId = item.catalogo_id || null;
    if (corpo.adicionarCatalogo) {
      const { data, error } = await supabase.from("catalogo_base").insert({
        nome: corpo.nome.trim(), sinonimos: corpo.sinonimos, categoria: corpo.categoria, unidade_compra: corpo.unidade, qtd_padrao: Number(corpo.qtd_pacote) || 1,
        preco_medio: Number(corpo.preco) || 0, fator_aproveitamento: 100, rendimento_preparo: 1, origem_preco: "revisão admin",
      }).select("id").single();
      if (error) return alert("Não consegui criar no catálogo: " + error.message + (error.code === "23505" ? " (já existe um insumo com esse nome)" : ""));
      catalogoId = data.id;
      await supabase.from("catalogo_precos_historico").insert({ catalogo_id: catalogoId, preco: Number(corpo.preco) || 0, origem: "revisão admin" });
    }
    const { error } = await supabase.from("fila_revisao_insumos").update({
      status: "aprovado", nome: corpo.nome.trim(), unidade: corpo.unidade, qtd_pacote: Number(corpo.qtd_pacote) || 1, preco_estimado: Number(corpo.preco) || 0,
      catalogo_id: catalogoId, decidido_em: new Date().toISOString(), decidido_por: user?.id,
    }).eq("id", item.id);
    if (error) return alert("Não deu: " + error.message);
    setRevisando(null); await carregar();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {FILTROS.map(([v, l]) => (
            <button key={v} className="btn" onClick={() => setFiltro(v)}
              style={{ background: filtro === v ? C.ink : "#fff", color: filtro === v ? "#fff" : C.ink70, border: `1.5px solid ${filtro === v ? C.ink : C.rule}`, borderRadius: 999, padding: "7px 12px", fontSize: 12.5, fontWeight: 700 }}>{l}</button>
          ))}
        </div>
        <div className="lbl" style={{ marginLeft: "auto", maxWidth: 520, textAlign: "right", lineHeight: 1.5 }}>
          Insumos que a IA criou com preço estimado durante um cadastro. Aprovar corrige o preço e, se marcado, entra no catálogo base.
        </div>
      </div>
      {erro && <Aviso forte>Não consegui carregar a fila: {erro}</Aviso>}
      {lista && lista.length === 0 && !erro && <Vazio>Nada {filtro === "pendente" ? "pendente" : "aqui"} por enquanto.</Vazio>}
      {lista && lista.length > 0 && (
        <div className="card adm-scroll" style={{ padding: "4px 8px" }}>
          <table className="adm-table" style={{ minWidth: 700 }}>
            <thead><tr>
              <th className="lbl" style={th}>Insumo (como foi falado)</th><th className="lbl" style={th}>Estimativa da IA</th><th className="lbl" style={th}>Justificativa</th><th className="lbl" style={th}>Quando</th><th className="lbl" style={th}>Status</th>
            </tr></thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id} className="row tap" onClick={() => setRevisando(i)}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{i.nome}</div>{i.texto_origem && <div className="lbl" style={{ fontSize: 11.5 }}>"{i.texto_origem}"</div>}</td>
                  <td className="mono" style={td}>{brl(i.preco_estimado)} / {i.qtd_pacote} {i.unidade}</td>
                  <td style={{ ...td, fontSize: 12.5, color: C.ink70, maxWidth: 320 }}>{i.justificativa_ia || "—"}</td>
                  <td style={td}>{dataHoraBR(i.criado_em)}</td>
                  <td style={td}><TagStatus status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {revisando && <Revisar item={revisando} onClose={() => setRevisando(null)} onAprovar={aprovar} onRejeitar={rejeitar} />}
    </div>
  );
}

function Revisar({ item, onClose, onAprovar, onRejeitar }) {
  const [c, setC] = useState({ nome: item.nome, unidade: UNIDADES_COMPRA.includes(item.unidade) ? item.unidade : "kg", qtd_pacote: item.qtd_pacote, preco: item.preco_estimado, categoria: "outros", sinonimos: [], adicionarCatalogo: item.status === "pendente" });
  const set = (k, v) => setC({ ...c, [k]: v });
  const pendente = item.status === "pendente";
  return (
    <Modal titulo="Revisar insumo" onClose={onClose} largura={520}>
      {item.justificativa_ia && <Aviso>IA: {item.justificativa_ia}</Aviso>}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}><Campo rot="Nome"><Entrada valor={c.nome} onChange={(v) => set("nome", v)} disabled={!pendente} /></Campo></div>
        <Campo rot="Unidade de compra"><Selecao valor={c.unidade} onChange={(v) => set("unidade", v)} opcoes={UNIDADES_COMPRA.map((u) => [u, u])} /></Campo>
        <Campo rot="Tamanho do pacote"><Entrada tipo="number" valor={c.qtd_pacote} onChange={(v) => set("qtd_pacote", v)} disabled={!pendente} /></Campo>
        <Campo rot="Preço do pacote (R$)"><Entrada tipo="number" valor={c.preco} onChange={(v) => set("preco", v)} disabled={!pendente} /></Campo>
        <Campo rot="Categoria (se entrar no catálogo)"><Selecao valor={c.categoria} onChange={(v) => set("categoria", v)} opcoes={CATEGORIAS_INSUMO} /></Campo>
        <div style={{ gridColumn: "1 / -1" }}><Campo rot="Sinônimos (vírgula)"><Entrada valor={c.sinonimos.join(", ")} onChange={(v) => set("sinonimos", v.split(",").map((s) => s.trim()).filter(Boolean))} disabled={!pendente} /></Campo></div>
      </div>
      {pendente && (
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={c.adicionarCatalogo} onChange={(e) => set("adicionarCatalogo", e.target.checked)} /> adicionar ao catálogo base
        </label>
      )}
      {pendente ? (
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Btn perigo onClick={() => onRejeitar(item)} style={{ flex: 1 }}>Rejeitar</Btn>
          <Btn primario onClick={() => onAprovar(item, c)} style={{ flex: 1 }}>Aprovar</Btn>
        </div>
      ) : <div className="lbl" style={{ marginTop: 14 }}>Decidido em {dataHoraBR(item.decidido_em)}.</div>}
    </Modal>
  );
}
