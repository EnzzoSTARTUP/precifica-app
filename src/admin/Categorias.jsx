import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../theme";
import { Btn, Modal, Campo, Entrada, Vazio, Aviso, th, td } from "./comum";

const slugificar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const vazio = () => ({ nome: "", slug: "", ordem: 100, ativo: true, insumos_sugeridos: [], exemplos_pratos: [] });

export default function Categorias() {
  const [lista, setLista] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    const [c, i] = await Promise.all([
      supabase.from("categorias_restaurante").select("*").order("ordem").order("nome"),
      supabase.from("catalogo_base").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    if (c.error) { setErro(c.error.message); setLista([]); return; }
    setLista(c.data || []); setCatalogo(i.data || []);
  };
  useEffect(() => { carregar(); }, []);
  const nomeInsumo = (id) => catalogo.find((x) => x.id === id)?.nome || "?";

  const salvar = async (c) => {
    const corpo = { nome: c.nome.trim(), slug: (c.slug || slugificar(c.nome)).trim(), ordem: Number(c.ordem) || 100, ativo: c.ativo !== false, insumos_sugeridos: c.insumos_sugeridos || [], exemplos_pratos: c.exemplos_pratos || [] };
    if (!corpo.nome) return alert("Informe o nome.");
    const r = c.id ? await supabase.from("categorias_restaurante").update(corpo).eq("id", c.id) : await supabase.from("categorias_restaurante").insert(corpo);
    if (r.error) return alert("Não deu: " + r.error.message);
    setEditando(null); await carregar();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="lbl" style={{ maxWidth: 640, lineHeight: 1.5 }}>Categorias que aparecem como cartões no cadastro. Cada uma pode ter insumos sugeridos e exemplos de pratos.</div>
        <Btn primario onClick={() => setEditando(vazio())}>Nova categoria</Btn>
      </div>
      {erro && <Aviso forte>Não consegui carregar as categorias: {erro}</Aviso>}
      {lista && lista.length === 0 && !erro && <Vazio>Nenhuma categoria.</Vazio>}
      {lista && lista.length > 0 && (
        <div className="card adm-scroll" style={{ padding: "4px 8px" }}>
          <table className="adm-table" style={{ minWidth: 640 }}>
            <thead><tr><th className="lbl" style={th}>Categoria</th><th className="lbl" style={th}>Exemplos de pratos</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Insumos sugeridos</th><th className="lbl" style={th}>Ativa</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="row tap" onClick={() => setEditando({ ...c })} style={{ opacity: c.ativo ? 1 : 0.5 }}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{c.nome}</div><div className="lbl" style={{ fontSize: 11.5 }}>{c.slug}</div></td>
                  <td style={td}>{(c.exemplos_pratos || []).join(", ") || "—"}</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{(c.insumos_sugeridos || []).length}</td>
                  <td style={td}>{c.ativo ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <Modal titulo={editando.id ? "Editar categoria" : "Nova categoria"} onClose={() => setEditando(null)}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Campo rot="Nome"><Entrada valor={editando.nome} onChange={(v) => setEditando({ ...editando, nome: v, slug: editando.id ? editando.slug : slugificar(v) })} /></Campo>
            <Campo rot="Slug"><Entrada valor={editando.slug} onChange={(v) => setEditando({ ...editando, slug: v })} /></Campo>
            <div style={{ gridColumn: "1 / -1" }}><Campo rot="Exemplos de pratos (separe por vírgula)">
              <Entrada valor={(editando.exemplos_pratos || []).join(", ")} onChange={(v) => setEditando({ ...editando, exemplos_pratos: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Campo></div>
            <Campo rot="Ordem"><Entrada tipo="number" valor={editando.ordem} onChange={(v) => setEditando({ ...editando, ordem: v })} /></Campo>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, alignSelf: "end", paddingBottom: 10 }}>
              <input type="checkbox" checked={editando.ativo !== false} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} /> ativa
            </label>
          </div>

          <SeletorInsumos catalogo={catalogo} selecionados={editando.insumos_sugeridos || []} onChange={(ids) => setEditando({ ...editando, insumos_sugeridos: ids })} nomeInsumo={nomeInsumo} />

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Btn onClick={() => setEditando(null)} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn primario onClick={() => salvar(editando)} style={{ flex: 1 }}>Salvar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SeletorInsumos({ catalogo, selecionados, onChange, nomeInsumo }) {
  const [busca, setBusca] = useState("");
  const achados = busca.trim() ? catalogo.filter((i) => !selecionados.includes(i.id) && i.nome.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <div style={{ marginTop: 14 }}>
      <div className="lbl" style={{ marginBottom: 6 }}>Insumos sugeridos ({selecionados.length})</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {selecionados.map((id) => (
          <span key={id} className="mono tag" style={{ background: "#EFEFEC", color: C.ink, display: "inline-flex", gap: 6, alignItems: "center" }}>
            {nomeInsumo(id)}<button className="btn" onClick={() => onChange(selecionados.filter((x) => x !== id))} style={{ background: "none", border: "none", color: C.ink45, padding: 0, fontSize: 13 }}>×</button>
          </span>
        ))}
      </div>
      <div className="fld"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar insumo do catálogo para adicionar" className="inp" style={{ fontSize: 14, padding: "10px 3px" }} /></div>
      {achados.length > 0 && (
        <div className="card" style={{ marginTop: 6 }}>
          {achados.map((i) => (
            <div key={i.id} className="row tap" onClick={() => { onChange([...selecionados, i.id]); setBusca(""); }} style={{ padding: "9px 12px", fontSize: 13.5 }}>{i.nome}</div>
          ))}
        </div>
      )}
    </div>
  );
}
