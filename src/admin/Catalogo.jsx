import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../theme";
import { Btn, Busca, Modal, Campo, Entrada, Selecao, Tag, Vazio, Aviso, CATEGORIAS_INSUMO, nomeCategoria, UNIDADES_COMPRA, brl, dataBR, th, td } from "./comum";

const COLUNAS = "id, nome, sinonimos, categoria, unidade_compra, qtd_padrao, preco_medio, regiao, zona, fator_aproveitamento, rendimento_preparo, origem_preco, atualizado_em, ativo";
const vazio = () => ({ nome: "", sinonimos: [], categoria: "hortifruti", unidade_compra: "kg", qtd_padrao: 1, preco_medio: 0, regiao: "Rio de Janeiro", zona: "", fator_aproveitamento: 100, rendimento_preparo: 1, origem_preco: "manual", ativo: true });

export default function Catalogo() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState(null); // objeto do item (novo ou existente)
  const [msg, setMsg] = useState("");

  const carregar = async () => {
    const { data, error } = await supabase.from("catalogo_base").select(COLUNAS).order("nome");
    if (error) { setErro(error.message); setLista([]); return; }
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => (lista || []).filter((i) => {
    if (!mostrarInativos && !i.ativo) return false;
    if (cat && i.categoria !== cat) return false;
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return i.nome.toLowerCase().includes(q) || (i.sinonimos || []).some((s) => s.toLowerCase().includes(q));
  }), [lista, busca, cat, mostrarInativos]);

  const salvar = async (item) => {
    const corpo = {
      nome: item.nome.trim(), sinonimos: item.sinonimos, categoria: item.categoria, unidade_compra: item.unidade_compra,
      qtd_padrao: Number(item.qtd_padrao) || 1, preco_medio: Number(item.preco_medio) || 0, regiao: item.regiao || "Rio de Janeiro", zona: item.zona || null,
      fator_aproveitamento: Number(item.fator_aproveitamento) || 100, rendimento_preparo: Number(item.rendimento_preparo) || 1,
      origem_preco: item.origem_preco || "manual", ativo: item.ativo !== false, atualizado_em: new Date().toISOString(),
    };
    if (!corpo.nome) return alert("Informe o nome.");
    let id = item.id;
    const anterior = item.id ? lista.find((x) => x.id === item.id) : null;
    if (item.id) {
      const { error } = await supabase.from("catalogo_base").update(corpo).eq("id", item.id);
      if (error) return alert("Não deu: " + error.message);
    } else {
      const { data, error } = await supabase.from("catalogo_base").insert(corpo).select("id").single();
      if (error) return alert("Não deu: " + error.message);
      id = data.id;
    }
    if (!anterior || Number(anterior.preco_medio) !== corpo.preco_medio) {
      await supabase.from("catalogo_precos_historico").insert({ catalogo_id: id, preco: corpo.preco_medio, origem: corpo.origem_preco });
    }
    setEditando(null);
    await carregar();
  };

  const alternarAtivo = async (item) => {
    const { error } = await supabase.from("catalogo_base").update({ ativo: !item.ativo }).eq("id", item.id);
    if (error) return alert("Não deu: " + error.message);
    await carregar();
  };

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const linhas = (lista || []).map((i) => ({
      nome: i.nome, sinonimos: (i.sinonimos || []).join(" | "), categoria: i.categoria, unidade: i.unidade_compra, qtd_padrao: i.qtd_padrao,
      preco_medio: i.preco_medio, fator_aproveitamento: i.fator_aproveitamento, rendimento_preparo: i.rendimento_preparo, regiao: i.regiao, zona: i.zona || "",
      origem_preco: i.origem_preco || "", ativo: i.ativo ? "sim" : "não", atualizado_em: i.atualizado_em,
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "catalogo");
    XLSX.writeFile(wb, `prezo-catalogo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const importar = async (file) => {
    if (!file) return;
    setMsg("Lendo planilha…");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const porNome = new Map((lista || []).map((i) => [i.nome.toLowerCase(), i]));
      let criados = 0, atualizados = 0, ignorados = 0;
      for (const l of linhas) {
        const nome = String(l.nome || "").trim();
        const un = String(l.unidade || l.unidade_compra || "").trim();
        if (!nome || !UNIDADES_COMPRA.includes(un)) { ignorados++; continue; }
        const corpo = {
          nome, sinonimos: String(l.sinonimos || "").split("|").map((s) => s.trim()).filter(Boolean), categoria: String(l.categoria || "outros"),
          unidade_compra: un, qtd_padrao: Number(l.qtd_padrao) || 1, preco_medio: Number(String(l.preco_medio).replace(",", ".")) || 0,
          fator_aproveitamento: Number(l.fator_aproveitamento) || 100, rendimento_preparo: Number(l.rendimento_preparo) || 1,
          regiao: String(l.regiao || "Rio de Janeiro"), zona: String(l.zona || "") || null, origem_preco: String(l.origem_preco || "planilha"),
          ativo: !["não", "nao", "false", "0"].includes(String(l.ativo).toLowerCase()), atualizado_em: new Date().toISOString(),
        };
        const existente = porNome.get(nome.toLowerCase());
        if (existente) {
          const { error } = await supabase.from("catalogo_base").update(corpo).eq("id", existente.id);
          if (error) { ignorados++; continue; }
          if (Number(existente.preco_medio) !== corpo.preco_medio) await supabase.from("catalogo_precos_historico").insert({ catalogo_id: existente.id, preco: corpo.preco_medio, origem: "planilha" });
          atualizados++;
        } else {
          const { data, error } = await supabase.from("catalogo_base").insert(corpo).select("id").single();
          if (error) { ignorados++; continue; }
          await supabase.from("catalogo_precos_historico").insert({ catalogo_id: data.id, preco: corpo.preco_medio, origem: "planilha" });
          criados++;
        }
      }
      setMsg(`Importação: ${criados} novos · ${atualizados} atualizados · ${ignorados} ignorados (sem nome ou unidade inválida).`);
      await carregar();
    } catch (e) { setMsg("Não consegui ler a planilha: " + e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Busca valor={busca} onChange={setBusca} placeholder="buscar por nome ou sinônimo" />
        <div className="fld" style={{ width: 220 }}>
          <Selecao valor={cat} onChange={setCat} opcoes={[["", "Todas as categorias"], ...CATEGORIAS_INSUMO]} />
        </div>
        <label style={{ fontSize: 12.5, color: C.ink70, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} /> mostrar inativos
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="btn" style={{ background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Importar planilha<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { importar(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <Btn onClick={exportar}>Exportar</Btn>
          <Btn primario onClick={() => setEditando(vazio())}>Novo insumo</Btn>
        </div>
      </div>

      {erro && <Aviso forte>Não consegui carregar o catálogo: {erro}</Aviso>}
      {msg && <Aviso>{msg}</Aviso>}
      <div className="lbl" style={{ margin: "6px 0 10px" }}>
        {lista ? `${filtrados.length} de ${lista.length} insumos` : "…"} · preços são médias de referência do Rio de Janeiro; os marcados como "estimativa inicial" ainda não passaram pela análise de preços.
      </div>

      {lista && lista.length === 0 && !erro && <Vazio>Catálogo vazio. Rode o seed <code>supabase/seed/catalogo_base.sql</code> ou importe uma planilha.</Vazio>}

      {filtrados.length > 0 && (
        <div className="card adm-scroll" style={{ padding: "4px 8px" }}>
          <table className="adm-table" style={{ minWidth: 820 }}>
            <thead><tr>
              <th className="lbl" style={th}>Insumo</th><th className="lbl" style={th}>Categoria</th><th className="lbl" style={th}>Compra</th>
              <th className="lbl" style={{ ...th, textAlign: "right" }}>Preço</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Aprov.</th>
              <th className="lbl" style={{ ...th, textAlign: "right" }}>Rend.</th><th className="lbl" style={th}>Origem</th><th className="lbl" style={th}>Atualizado</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {filtrados.map((i) => (
                <tr key={i.id} className="row tap" onClick={() => setEditando({ ...i })} style={{ opacity: i.ativo ? 1 : 0.5 }}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{i.nome}</div>{i.sinonimos?.length > 0 && <div className="lbl" style={{ fontSize: 11.5 }}>{i.sinonimos.join(", ")}</div>}</td>
                  <td style={td}>{nomeCategoria(i.categoria)}</td>
                  <td className="mono" style={td}>{i.qtd_padrao} {i.unidade_compra}</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{brl(i.preco_medio)}</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{i.fator_aproveitamento}%</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{i.rendimento_preparo}×</td>
                  <td style={td}>{i.origem_preco === "estimativa inicial" ? <Tag cor={C.warn} fundo={C.warnSoft}>estimativa</Tag> : <span style={{ fontSize: 12.5 }}>{i.origem_preco || "—"}</span>}</td>
                  <td style={td}>{dataBR(i.atualizado_em)}</td>
                  <td style={td} onClick={(e) => e.stopPropagation()}><Btn pequeno onClick={() => alternarAtivo(i)}>{i.ativo ? "Inativar" : "Reativar"}</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && <EditarInsumo item={editando} onChange={setEditando} onSalvar={salvar} onClose={() => setEditando(null)} />}
    </div>
  );
}

function EditarInsumo({ item, onChange, onSalvar, onClose }) {
  const [hist, setHist] = useState(null);
  const set = (k, v) => onChange({ ...item, [k]: v });
  useEffect(() => {
    if (!item.id) { setHist([]); return; }
    supabase.from("catalogo_precos_historico").select("preco, origem, fonte, criado_em").eq("catalogo_id", item.id).order("criado_em", { ascending: false }).limit(12).then(({ data }) => setHist(data || []));
  }, [item.id]);
  return (
    <Modal titulo={item.id ? "Editar insumo" : "Novo insumo"} onClose={onClose}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ gridColumn: "1 / -1" }}><Campo rot="Nome"><Entrada valor={item.nome} onChange={(v) => set("nome", v)} /></Campo></div>
        <div style={{ gridColumn: "1 / -1" }}><Campo rot="Sinônimos (separe por vírgula) — ajudam o reconhecimento por voz">
          <Entrada valor={(item.sinonimos || []).join(", ")} onChange={(v) => set("sinonimos", v.split(",").map((s) => s.trim()).filter(Boolean))} />
        </Campo></div>
        <Campo rot="Categoria"><Selecao valor={item.categoria} onChange={(v) => set("categoria", v)} opcoes={CATEGORIAS_INSUMO} /></Campo>
        <Campo rot="Unidade de compra"><Selecao valor={item.unidade_compra} onChange={(v) => set("unidade_compra", v)} opcoes={UNIDADES_COMPRA.map((u) => [u, u])} /></Campo>
        <Campo rot="Tamanho do pacote (nessa unidade)"><Entrada tipo="number" valor={item.qtd_padrao} onChange={(v) => set("qtd_padrao", v)} /></Campo>
        <Campo rot="Preço médio do pacote (R$)"><Entrada tipo="number" valor={item.preco_medio} onChange={(v) => set("preco_medio", v)} /></Campo>
        <Campo rot="Aproveitamento padrão (%)"><Entrada tipo="number" valor={item.fator_aproveitamento} onChange={(v) => set("fator_aproveitamento", v)} /></Campo>
        <Campo rot="Rendimento no preparo (×)"><Entrada tipo="number" valor={item.rendimento_preparo} onChange={(v) => set("rendimento_preparo", v)} /></Campo>
        <Campo rot="Região"><Entrada valor={item.regiao} onChange={(v) => set("regiao", v)} /></Campo>
        <Campo rot="Bairro / zona (opcional)"><Entrada valor={item.zona || ""} onChange={(v) => set("zona", v)} /></Campo>
        <Campo rot="Origem do preço"><Entrada valor={item.origem_preco || ""} onChange={(v) => set("origem_preco", v)} placeholder="manual, fornecedor X, pesquisa…" /></Campo>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, alignSelf: "end", paddingBottom: 10 }}>
          <input type="checkbox" checked={item.ativo !== false} onChange={(e) => set("ativo", e.target.checked)} /> ativo
        </label>
      </div>

      {hist && hist.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="lbl" style={{ marginBottom: 6 }}>Histórico de preço</div>
          {hist.map((h, k) => (
            <div key={k} className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.ink70, padding: "3px 0", borderBottom: `1px solid ${C.ruleSoft}` }}>
              <span>{dataBR(h.criado_em)} · {h.origem || "—"}{h.fonte ? ` · ${h.fonte}` : ""}</span><span style={{ color: C.ink, fontWeight: 600 }}>{brl(h.preco)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <Btn onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
        <Btn primario onClick={() => onSalvar(item)} style={{ flex: 1 }}>Salvar</Btn>
      </div>
    </Modal>
  );
}
