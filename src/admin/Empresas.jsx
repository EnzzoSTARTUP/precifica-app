import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../theme";
import { Btn, Busca, Modal, TagStatus, Vazio, Aviso, dataBR, dataHoraBR, th, td } from "./comum";

const STATUS = [["", "Todos"], ["ativo", "Ativos"], ["inativo", "Inativos"], ["cadastro_incompleto", "Cadastro incompleto"]];

export default function Empresas() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [aberta, setAberta] = useState(null);

  const carregar = async () => {
    const { data, error } = await supabase.from("admin_empresas").select("*").order("criado_em", { ascending: false });
    if (error) { setErro(error.message); setLista([]); return; }
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, []);

  const filtradas = (lista || []).filter((e) => {
    if (status && e.status !== status) return false;
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return [e.nome_fantasia, e.razao_social, e.cnpj, e.dono_email, e.cidade, e.bairro].some((v) => (v || "").toLowerCase().includes(q));
  });

  const mudarStatus = async (empresa, novo) => {
    const { error } = await supabase.rpc("admin_set_status", { p_empresa: empresa.id, p_status: novo });
    if (error) return alert("Não deu: " + error.message);
    await carregar();
    setAberta((a) => (a && a.id === empresa.id ? { ...a, status: novo } : a));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Busca valor={busca} onChange={setBusca} placeholder="buscar por nome, e-mail, CNPJ, cidade" />
        <div style={{ display: "flex", gap: 4 }}>
          {STATUS.map(([v, l]) => (
            <button key={v} className="btn" onClick={() => setStatus(v)}
              style={{ background: status === v ? C.ink : "#fff", color: status === v ? "#fff" : C.ink70, border: `1.5px solid ${status === v ? C.ink : C.rule}`, borderRadius: 999, padding: "7px 12px", fontSize: 12.5, fontWeight: 700 }}>{l}</button>
          ))}
        </div>
        <div className="lbl" style={{ marginLeft: "auto" }}>{lista ? `${filtradas.length} de ${lista.length}` : "…"}</div>
      </div>

      {erro && <Aviso forte>Não consegui carregar as empresas: {erro}. A migração v2 já foi aplicada no banco?</Aviso>}
      {lista && lista.length === 0 && !erro && <Vazio>Nenhum restaurante cadastrado ainda.</Vazio>}

      {filtradas.length > 0 && (
        <div className="card adm-scroll" style={{ padding: "4px 8px" }}>
          <table className="adm-table" style={{ minWidth: 760 }}>
            <thead><tr>
              <th className="lbl" style={th}>Restaurante</th><th className="lbl" style={th}>Dono</th><th className="lbl" style={th}>Status</th>
              <th className="lbl" style={{ ...th, textAlign: "right" }}>Pratos</th><th className="lbl" style={{ ...th, textAlign: "right" }}>Insumos</th>
              <th className="lbl" style={th}>Cadastro</th><th className="lbl" style={th}>Último uso</th>
            </tr></thead>
            <tbody>
              {filtradas.map((e) => (
                <tr key={e.id} className="row tap" onClick={() => setAberta(e)}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{e.nome_fantasia}</div><div className="lbl" style={{ fontSize: 11.5 }}>{[e.bairro, e.cidade].filter(Boolean).join(" · ") || (e.cnpj ? `CNPJ ${e.cnpj}` : "")}</div></td>
                  <td style={td}>{e.dono_email || "—"}</td>
                  <td style={td}><TagStatus status={e.status} /></td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{e.qtd_pratos}</td>
                  <td className="mono" style={{ ...td, textAlign: "right" }}>{e.qtd_insumos}</td>
                  <td style={td}>{dataBR(e.criado_em)}</td>
                  <td style={td}>{dataHoraBR(e.ultimo_uso || e.ultimo_acesso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberta && <DetalheEmpresa empresa={aberta} onClose={() => setAberta(null)} onStatus={mudarStatus} />}
    </div>
  );
}

function DetalheEmpresa({ empresa: e, onClose, onStatus }) {
  const [socios, setSocios] = useState(null);
  const [usuarios, setUsuarios] = useState(null);
  useEffect(() => {
    supabase.from("empresa_socios").select("*").eq("empresa_id", e.id).then(({ data }) => setSocios(data || []));
    supabase.from("perfis").select("user_id, email, nome, papel, criado_em, aceite_termos_em").eq("empresa_id", e.id).then(({ data }) => setUsuarios(data || []));
  }, [e.id]);
  const L = ({ r, v }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "8px 0", borderBottom: `1px solid ${C.ruleSoft}`, fontSize: 13.5 }}>
      <span style={{ color: C.ink70 }}>{r}</span><span style={{ textAlign: "right", fontWeight: 600 }}>{v || "—"}</span>
    </div>
  );
  const end = e.endereco || {};
  return (
    <Modal titulo={e.nome_fantasia} onClose={onClose} largura={640}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <TagStatus status={e.status} />
        {e.status !== "ativo" && <Btn pequeno primario onClick={() => onStatus(e, "ativo")}>Ativar</Btn>}
        {e.status !== "inativo" && <Btn pequeno perigo onClick={() => onStatus(e, "inativo")}>Desativar</Btn>}
      </div>
      <L r="Razão social" v={e.razao_social} />
      <L r="CNPJ" v={e.cnpj} />
      <L r="Endereço" v={[end.logradouro, end.numero, end.complemento, end.bairro || e.bairro, end.municipio || e.cidade, end.uf || e.uf, end.cep].filter(Boolean).join(", ")} />
      <L r="Categorias" v={(e.categorias || []).join(", ")} />
      <L r="CNAE" v={e.dados_cnpj?.cnae_fiscal_descricao || e.dados_cnpj?.cnae} />
      <L r="Situação cadastral" v={e.dados_cnpj?.situacao_cadastral || e.dados_cnpj?.situacao} />
      <L r="Telefone" v={e.dados_cnpj?.telefone} />
      <L r="Cadastro" v={dataHoraBR(e.criado_em)} />
      <L r="Último uso" v={dataHoraBR(e.ultimo_uso || e.ultimo_acesso)} />
      <L r="Pratos / insumos" v={`${e.qtd_pratos} / ${e.qtd_insumos}`} />

      <div className="lbl" style={{ margin: "18px 0 6px" }}>Usuários</div>
      {usuarios === null ? <Vazio>…</Vazio> : usuarios.length === 0 ? <Vazio>Nenhum usuário vinculado.</Vazio> : usuarios.map((u) => (
        <L key={u.user_id} r={u.email || u.user_id} v={`${u.papel === "admin_master" ? "admin · " : ""}${u.aceite_termos_em ? "termos aceitos" : "sem aceite"} · ${dataBR(u.criado_em)}`} />
      ))}

      <div className="lbl" style={{ margin: "18px 0 6px" }}>Quadro de sócios (visível só para admin)</div>
      {socios === null ? <Vazio>…</Vazio> : socios.length === 0 ? <Vazio>Sem dados de sócios.</Vazio> : socios.map((s) => <L key={s.id} r={s.nome} v={s.qualificacao} />)}
    </Modal>
  );
}
