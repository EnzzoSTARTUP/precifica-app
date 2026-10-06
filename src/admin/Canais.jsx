import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../theme";
import { Btn, Modal, Campo, Entrada, Vazio, Aviso, brl, th, td } from "./comum";

const vazio = () => ({ nome: "", comissao_pct: 0, taxa_pagamento_pct: 0, outras_taxas_pct: 0, embalagem_padrao: 0, ordem: 100, ativo: true });
const total = (c) => Number(c.comissao_pct || 0) + Number(c.taxa_pagamento_pct || 0) + Number(c.outras_taxas_pct || 0);

export default function Canais() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("canais_padrao").select("*").order("ordem").order("nome");
    if (error) { setErro(error.message); setLista([]); return; }
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async (c) => {
    const corpo = { nome: c.nome.trim(), comissao_pct: Number(c.comissao_pct) || 0, taxa_pagamento_pct: Number(c.taxa_pagamento_pct) || 0, outras_taxas_pct: Number(c.outras_taxas_pct) || 0, embalagem_padrao: Number(c.embalagem_padrao) || 0, ordem: Number(c.ordem) || 100, ativo: c.ativo !== false };
    if (!corpo.nome) return alert("Informe o nome do canal.");
    const r = c.id ? await supabase.from("canais_padrao").update(corpo).eq("id", c.id) : await supabase.from("canais_padrao").insert(corpo);
    if (r.error) return alert("Não deu: " + r.error.message);
    setEditando(null); await carregar();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="lbl" style={{ maxWidth: 640, lineHeight: 1.5 }}>
          Taxas aplicadas por padrão a todo restaurante novo. No app, o canal recebe a soma das três porcentagens como "taxa do canal", e o restaurante pode ajustar livremente depois.
        </div>
        <Btn primario onClick={() => setEditando(vazio())}>Novo canal</Btn>
      </div>
      {erro && <Aviso forte>Não consegui carregar os canais: {erro}</Aviso>}
      {lista && lista.length === 0 && !erro && <Vazio>Nenhum canal padrão.</Vazio>}
      {lista && lista.length > 0 && (
        <div className="card adm-scroll" style={{ padding: "4px 8px" }}>
          <table className="adm-table" style={{ minWidth: 640 }}>
            <thead><tr>
              <th className="lbl" style={th}>Canal</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Comissão</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Taxa pagamento</th>
              <th className="lbl" style={{ ...th, textAlign: "right" }}>Outras</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Total</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Embalagem</th><th className="lbl" style={th}>Ativo</th>
            </tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="row tap" onClick={() => setEditando({ ...c })} style={{ opacity: c.ativo ? 1 : 0.5 }}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.nome}</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{c.comissao_pct}%</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{c.taxa_pagamento_pct}%</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{c.outras_taxas_pct}%</td>
                  <td className="mono" style={{ ...td, textAlign: "right", fontWeight: 700 }}>{total(c).toFixed(1)}%</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{brl(c.embalagem_padrao)}</td>
                  <td style={td}>{c.ativo ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <Modal titulo={editando.id ? "Editar canal" : "Novo canal"} onClose={() => setEditando(null)} largura={480}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}><Campo rot="Nome"><Entrada valor={editando.nome} onChange={(v) => setEditando({ ...editando, nome: v })} placeholder="iFood, WhatsApp, Salão…" /></Campo></div>
            <Campo rot="Comissão (%)"><Entrada tipo="number" valor={editando.comissao_pct} onChange={(v) => setEditando({ ...editando, comissao_pct: v })} /></Campo>
            <Campo rot="Taxa de pagamento (%)"><Entrada tipo="number" valor={editando.taxa_pagamento_pct} onChange={(v) => setEditando({ ...editando, taxa_pagamento_pct: v })} /></Campo>
            <Campo rot="Outras taxas (%)"><Entrada tipo="number" valor={editando.outras_taxas_pct} onChange={(v) => setEditando({ ...editando, outras_taxas_pct: v })} /></Campo>
            <Campo rot="Embalagem padrão (R$)"><Entrada tipo="number" valor={editando.embalagem_padrao} onChange={(v) => setEditando({ ...editando, embalagem_padrao: v })} /></Campo>
            <Campo rot="Ordem"><Entrada tipo="number" valor={editando.ordem} onChange={(v) => setEditando({ ...editando, ordem: v })} /></Campo>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, alignSelf: "end", paddingBottom: 10 }}>
              <input type="checkbox" checked={editando.ativo !== false} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} /> ativo
            </label>
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: C.ink70, marginTop: 12 }}>Total aplicado no app: {total(editando).toFixed(1)}%</div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Btn onClick={() => setEditando(null)} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn primario onClick={() => salvar(editando)} style={{ flex: 1 }}>Salvar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
