import React, { useState, useEffect, useRef } from "react";
import { loadState, saveState, ConflitoVersao } from "./lib/storage";
import { supabase } from "./lib/supabaseClient";
import { C, globalCss } from "./theme";
import { UNIDADES, hoje, uid } from "./lib/util";
import { DEFAULT_CFG, fator, baseUnit, perdaSugerida, totalFixas, calcFixasPct, custoInsumo, quantidadeBruta, calc as calcPuro } from "./lib/calc";
import { brl, brlSec, pct, num, dataBR, corCMV, bgCMV, corMC, bgMC } from "./lib/formato";
import ImportUnificado from "./ImportUnificado";

// ————————————————————————————————————————————————
//  PREZO — custo, markup e preço por canal
//  Visual: claro, robusto e legível. Superfícies brancas, tipos grossos,
//  cores de status (verde/âmbar/vermelho) para leitura imediata.
//  Montserrat 500–800 · números tabulares em peso 700
//  A lógica de cálculo é idêntica à versão anterior.
// ————————————————————————————————————————————————

const ABAS = [{ id: "painel", l: "Painel" }, { id: "produtos", l: "Produtos" }, { id: "insumos", l: "Insumos" }, { id: "ajustes", l: "Ajustes" }];

// ————————————————————————— app —————————————————————————

export default function App({ perfil }) {
  const [tab, setTab] = useState("painel");
  const [insumos, setInsumos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [canais, setCanais] = useState([]);
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [loaded, setLoaded] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [confirmarSair, setConfirmarSair] = useState(false);
  const [avisoSync, setAvisoSync] = useState("");
  const versaoRef = useRef(null);
  const filaRef = useRef(Promise.resolve());

  useEffect(() => {
    (async () => {
      let data = {};
      try { data = await loadState(); } catch (_) { data = {}; }
      setInsumos(data.insumos ?? []);
      setProdutos(data.produtos ?? []);
      setCanais(data.canais ?? []);
      if (data.cfg) setCfg((p) => ({ ...p, ...data.cfg }));
      versaoRef.current = data.versao ?? null;
      setLoaded(true);
    })();
  }, []);

  const recarregar = async () => {
    try {
      const d = await loadState();
      setInsumos(d.insumos ?? []); setProdutos(d.produtos ?? []); setCanais(d.canais ?? []);
      setCfg({ ...DEFAULT_CFG, ...(d.cfg || {}) });
      versaoRef.current = d.versao ?? null;
    } catch (_) {}
  };
  // gravações em fila (uma por vez) com a versão que o servidor devolveu por último
  const save = (k, v, setter) => {
    setter(v);
    filaRef.current = filaRef.current.then(async () => {
      try {
        const r = await saveState({ [k]: v }, versaoRef.current);
        if (r && r.versao != null) versaoRef.current = r.versao;
      } catch (e) {
        if (e instanceof ConflitoVersao) {
          setAvisoSync("Seus dados foram atualizados por fora (ex.: preço do catálogo). Recarregamos a tela — confira sua última alteração.");
          await recarregar();
        }
      }
    });
  };
  const saveIns = (v) => save("insumos", v, setInsumos);
  const saveProd = (v) => save("produtos", v, setProdutos);
  const saveCanais = (v) => save("canais", v, setCanais);
  const saveCfg = (v) => save("cfg", v, setCfg);

  const removerCanal = (canalId) => {
    saveCanais(canais.filter((c) => c.id !== canalId));
    saveProd(produtos.map((p) => {
      if (!p.precosCanal?.[canalId]) return p;
      const { [canalId]: _, ...resto } = p.precosCanal;
      return { ...p, precosCanal: resto };
    }));
  };

  const usoDoInsumo = (insumoId) => produtos.filter((p) => p.itens.some((it) => it.insumoId === insumoId));

  const resetarTudo = () => {
    saveIns([]);
    saveProd([]);
    saveCanais([]);
    saveCfg({ ...DEFAULT_CFG });
  };

  const calc = (p) => calcPuro(p, { insumos, canais, cfg });

  if (!loaded) return <div style={{ background: C.paper, minHeight: "100vh" }} />;
  const produtoAberto = produtos.find((x) => x.id === aberto);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink, fontFamily: "Montserrat, system-ui, sans-serif" }}>
      <style>{globalCss}</style>

      <nav className="nav-side">
        <Marca />
        <div style={{ marginTop: 30 }}>
          {ABAS.map((t) => (
            <button key={t.id} className={`nav-item ${tab === t.id && !produtoAberto ? "on" : ""}`}
              onClick={() => { setAberto(null); setTab(t.id); }}>{t.l}</button>
          ))}
        </div>
        <div style={{ marginTop: "auto" }}>
          <div className="lbl" style={{ lineHeight: 1.6, fontSize: 12 }}>
            Dados salvos<br />na sua conta
          </div>
          {perfil?.admin && <a href="/admin" className="lbl" style={{ display: "block", marginTop: 10, color: C.ink, textDecoration: "underline" }}>Painel admin</a>}
          <button className="btn lbl" onClick={() => setConfirmarSair(true)}
            style={{ background: "none", border: "none", padding: 0, marginTop: 10, color: C.ink45, textDecoration: "underline" }}>
            Sair
          </button>
        </div>
      </nav>

      <div className="app-wrap">
        <div className="shell">
          <div className="brand-mobile" style={{ marginBottom: 26, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Marca />
            {perfil?.admin && <a href="/admin" className="lbl" style={{ color: C.ink, textDecoration: "underline", marginLeft: "auto", marginRight: 14 }}>Admin</a>}
            <button className="btn lbl" onClick={() => setConfirmarSair(true)}
              style={{ background: "none", border: "none", padding: 0, color: C.ink45, textDecoration: "underline" }}>
              Sair
            </button>
          </div>

          {avisoSync && (
            <div onClick={() => setAvisoSync("")} className="tap" style={{ background: C.warnSoft, color: C.warn, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginBottom: 18 }}>{avisoSync}</div>
          )}

          {produtoAberto ? (
            <Detalhe p={produtoAberto} insumos={insumos} cfg={cfg} calc={calc}
              onNovoInsumo={(ins) => saveIns([ins, ...insumos])}
              onDuplicar={(orig) => { const np = { ...orig, id: uid(), nome: orig.nome + " (cópia)" }; saveProd([np, ...produtos]); setAberto(np.id); }}
              onBack={() => setAberto(null)}
              onSave={(np) => saveProd(produtos.map((x) => (x.id === np.id ? np : x)))}
              onDelete={(id) => { saveProd(produtos.filter((x) => x.id !== id)); setAberto(null); }} />
          ) : (
            <>
              {tab === "painel" && <Painel produtos={produtos} calc={calc} cfg={cfg} onOpen={setAberto} />}
              {tab === "produtos" && (
                <Produtos produtos={produtos} insumos={insumos} canais={canais} calc={calc} onOpen={setAberto}
                  onNew={() => { const np = { id: uid(), nome: "Novo produto", rendimento: 1, maoDeObra: 0, precosCanal: {}, itens: [] }; saveProd([np, ...produtos]); setAberto(np.id); }}
                  onSaveInsumos={saveIns} onSaveProdutos={saveProd} onSaveCanais={saveCanais} />
              )}
              {tab === "insumos" && (
                <Insumos insumos={insumos} onSave={saveIns} custoInsumo={custoInsumo} usoDoInsumo={usoDoInsumo}
                  produtos={produtos} canais={canais} onSaveProdutos={saveProd} onSaveCanais={saveCanais} />
              )}
              {tab === "ajustes" && <Ajustes cfg={cfg} onSaveCfg={saveCfg} canais={canais} onSaveCanais={saveCanais} onRemoverCanal={removerCanal} produtos={produtos} onResetTudo={resetarTudo} />}
            </>
          )}
        </div>
      </div>

      {!produtoAberto && (
        <nav className="nav-bottom" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.paper, borderTop: `1px solid ${C.ink}` }}>
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex" }}>
            {ABAS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className="btn"
                style={{ flex: 1, background: "none", border: "none", padding: "14px 0 20px", fontSize: 13, fontWeight: 700, color: tab === t.id ? C.ink : C.ink45 }}>
                {t.l}
              </button>
            ))}
          </div>
        </nav>
      )}

      {confirmarSair && (
        <div onClick={() => setConfirmarSair(false)} style={{ position: "fixed", inset: 0, background: "rgba(24,24,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 24, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Sair da conta?</div>
            <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.5, marginBottom: 20 }}>
              Você vai precisar entrar de novo com seu e-mail e senha pra acessar seus dados.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={() => setConfirmarSair(false)}
                style={{ flex: 1, background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700 }}>
                Continuar na conta
              </button>
              <button className="btn" onClick={() => { setConfirmarSair(false); supabase.auth.signOut(); }}
                style={{ flex: 1, background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700 }}>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Marca() {
  return (
    <div>
      <div className="serif" style={{ fontSize: 24, lineHeight: 1 }}>Prezo</div>
      <div className="lbl" style={{ marginTop: 4, fontSize: 12.5 }}>Custo · Markup · Preço</div>
    </div>
  );
}

function Sec({ children, acao }) {
  return (
    <div className="sec" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <span>{children}</span>
      {acao}
    </div>
  );
}

function Aviso({ children, forte }) {
  return (
    <div style={{ background: forte ? C.redSoft : "#EFEFEC", borderRadius: 8, padding: "11px 13px", marginTop: 11 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: forte ? C.red : C.ink70, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

// ————————————————————————— painel —————————————————————————

function Painel({ produtos, calc, cfg, onOpen }) {
  const [busca, setBusca] = useState("");
  const fixas = totalFixas(cfg);
  const todasLinhas = produtos.map((p) => ({ p, r: calc(p) })).filter((x) => x.r?.prim?.definido > 0)
    .sort((a, b) => b.r.prim.mcCanalPct - a.r.prim.mcCanalPct);
  const linhas = busca ? todasLinhas.filter((x) => x.p.nome.toLowerCase().includes(busca.toLowerCase())) : todasLinhas;
  const mcMedia = todasLinhas.length ? todasLinhas.reduce((s, x) => s + x.r.prim.mcCanalPct, 0) / todasLinhas.length : 0;
  const cmvMedia = todasLinhas.length ? todasLinhas.reduce((s, x) => s + x.r.cmvPct, 0) / todasLinhas.length : 0;
  const pe = mcMedia > 0 ? fixas / (mcMedia / 100) : 0;
  const folga = cfg.faturamentoMedio > 0 && pe > 0 ? ((cfg.faturamentoMedio - pe) / cfg.faturamentoMedio) * 100 : 0;
  const usaFixas = cfg.modoFixas === "auto" && fixas > 0;

  return (
    <div>
      <Sec>Ponto de equilíbrio mensal</Sec>
      {usaFixas && mcMedia > 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <div className="serif" style={{ fontSize: 40, lineHeight: 1.05 }}>{brl(pe)}</div>
          <div className="mono" style={{ fontSize: 12, color: C.ink45, marginTop: 9 }}>
            {brl(fixas)} de despesa fixa ÷ margem média de {pct(mcMedia)}
          </div>
          {cfg.faturamentoMedio > 0 && (
            <div style={{ marginTop: 22, borderTop: `1px solid ${C.ruleSoft}`, paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="lbl">Faturamento médio</span>
                <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{brl(cfg.faturamentoMedio)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 7 }}>
                <span className="lbl">{folga > 0 ? "Folga sobre o equilíbrio" : "Abaixo do equilíbrio"}</span>
                <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: folga > 0 ? C.ink : C.red }}>
                  {folga > 0 ? "+" : "−"}{pct(Math.abs(folga))}
                </span>
              </div>
              <div style={{ marginTop: 13, height: 3, background: C.paperAlt, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, (pe / cfg.faturamentoMedio) * 100)}%`, background: folga > 0 ? C.ink : C.red }} />
              </div>
              <div style={{ fontSize: 12.5, color: C.ink70, marginTop: 10, lineHeight: 1.5 }}>
                {folga > 0
                  ? "Acima desse faturamento, cada real que entra vira lucro."
                  : "O faturamento não cobre as despesas fixas no ritmo atual."}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.55, paddingTop: 14 }}>
          {!usaFixas ? "Lance as despesas fixas em reais na aba Ajustes para calcular o ponto de equilíbrio."
            : "Defina o preço de venda de ao menos um produto no canal principal."}
        </div>
      )}

      {todasLinhas.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 30 }}>
          <span className="lbl">CMV teórico do restaurante</span>
          <span className="mono tag" style={{ fontSize: 15, color: corCMV(cmvMedia), background: bgCMV(cmvMedia) }}>{pct(cmvMedia)}</span>
        </div>
      )}

      <Sec acao={
        todasLinhas.length > 0 && (
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar"
            style={{ border: "none", borderBottom: `1px solid ${C.rule}`, background: "transparent", outline: "none", fontSize: 12, padding: "0 0 2px", width: 90, textAlign: "right" }} />
        )
      }>
        Quanto cada produto deixa
      </Sec>
      {todasLinhas.length === 0 ? (
        <div style={{ fontSize: 13.5, color: C.ink70, paddingTop: 14, lineHeight: 1.55 }}>Defina o preço dos produtos no canal principal para ver o ranking.</div>
      ) : linhas.length === 0 ? (
        <div style={{ fontSize: 13.5, color: C.ink70, paddingTop: 14, lineHeight: 1.55 }}>Nenhum produto encontrado pra "{busca}".</div>
      ) : (
        <div className="card" style={{ padding: "4px 16px 8px" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="lbl" style={{ textAlign: "left", padding: "8px 0", fontSize: 12 }}>Produto</th>
              <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 12 }}>CMV</th>
              <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 12 }}>Custo</th>
              <th className="lbl" style={{ textAlign: "right", padding: "8px 0", fontSize: 12 }}>Preço</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ p, r }) => (
              <tr key={p.id} className="row tap" onClick={() => onOpen(p.id)}>
                <td style={{ padding: "14px 0" }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600 }}>{p.nome}</div>
                </td>
                <td style={{ textAlign: "right", padding: "14px 10px" }}>
                  <span className="mono tag" style={{ fontSize: 13, color: corCMV(r.cmvPct), background: bgCMV(r.cmvPct) }}>{pct(r.cmvPct)}</span>
                </td>
                <td className="mono" style={{ textAlign: "right", padding: "14px 10px", fontSize: 15, color: C.ink70 }}>{brlSec(r.custoUnid)}</td>
                <td className="mono" style={{ textAlign: "right", padding: "14px 0", fontSize: 15 }}>{brl(r.prim.definido)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <div style={{ fontSize: 12, color: C.ink45, marginTop: 12, lineHeight: 1.5 }}>
        Margem no canal principal. O fim da lista é o que menos contribui para pagar a despesa fixa.
      </div>
    </div>
  );
}

// ————————————————————————— produtos —————————————————————————

function Produtos({ produtos, insumos, canais, calc, onOpen, onNew, onSaveInsumos, onSaveProdutos, onSaveCanais }) {
  const [importOpen, setImportOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const lista = busca ? produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())) : produtos;

  return (
    <div>
      <button className="btn" onClick={() => setImportOpen(true)}
        style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "16px 18px", fontSize: 15.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 26 }}>
        ⬆ Importar do Excel
      </button>

      {importOpen && (
        <ImportUnificado produtos={produtos} insumos={insumos} canais={canais}
          onSaveInsumos={onSaveInsumos} onSaveProdutos={onSaveProdutos} onSaveCanais={onSaveCanais} onClose={() => setImportOpen(false)} />
      )}

      <Sec acao={
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {produtos.length > 0 && (
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar"
              style={{ border: "none", borderBottom: `1px solid ${C.rule}`, background: "transparent", outline: "none", fontSize: 12, padding: "0 0 2px", width: 90, textAlign: "right" }} />
          )}
          <button className="btn lbl" onClick={onNew} style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700 }}>Novo produto</button>
        </div>
      }>
        {produtos.length} produto{produtos.length !== 1 ? "s" : ""}
      </Sec>

      {produtos.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Como funciona</div>
          {[["1", "Toque em Novo produto e dê um nome"], ["2", "Adicione os ingredientes e quanto usa de cada um"], ["3", "Pronto — o preço de venda aparece calculado"]].map(([n, t]) => (
            <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
              <span className="mono" style={{ background: C.ink, color: "#fff", borderRadius: 6, width: 24, height: 24, display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>{n}</span>
              <span style={{ fontSize: 14.5, color: C.ink70, fontWeight: 500, lineHeight: 1.5, paddingTop: 2 }}>{t}</span>
            </div>
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div style={{ fontSize: 13.5, color: C.ink70, paddingTop: 14, lineHeight: 1.55 }}>Nenhum produto encontrado pra "{busca}".</div>
      ) : (
        <div className="card" style={{ padding: "4px 16px 8px" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="lbl" style={{ textAlign: "left", padding: "8px 0", fontSize: 12 }}>Produto</th>
              <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 12 }}>Custo</th>
              <th className="lbl" style={{ textAlign: "right", padding: "8px 10px", fontSize: 12 }}>Multiplicador</th>
              <th className="lbl" style={{ textAlign: "right", padding: "8px 0", fontSize: 12 }}>CMV (custo da mercadoria vendida)</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const r = calc(p);
              const prim = r.prim;
              return (
                <tr key={p.id} className="row tap" onClick={() => onOpen(p.id)}>
                  <td style={{ padding: "14px 0" }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>{p.nome}</div>
                    <div className="mono" style={{ fontSize: 13, color: r.orfaos ? C.red : C.ink45, marginTop: 3 }}>
                      {r.orfaos > 0
                        ? `${r.orfaos} insumo${r.orfaos > 1 ? "s" : ""} excluído — custo incompleto`
                        : prim ? (prim.confiavel ? `sugerido ${brl(prim.preco)} · ${prim.nome}` : "parâmetros impedem sugerir preço") : "sem canal"}
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: "right", padding: "14px 10px", fontSize: 15 }}>{brlSec(r.custoUnid)}</td>
                  <td className="mono" style={{ textAlign: "right", padding: "14px 10px", fontSize: 15, color: prim?.confiavel ? C.ink70 : C.red }}>
                    {prim ? (prim.confiavel ? `${prim.markup.toFixed(2)}×` : "—") : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "14px 0" }}>
                    {r.cmvPct > 0
                      ? <span className="mono tag" style={{ fontSize: 14, color: corCMV(r.cmvPct), background: bgCMV(r.cmvPct) }}>{pct(r.cmvPct)}</span>
                      : <span className="mono" style={{ fontSize: 15, color: C.ink45 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

// ————————————————————————— detalhe —————————————————————————

function Detalhe({ p, insumos, cfg, calc, onBack, onSave, onDelete, onNovoInsumo, onDuplicar }) {
  const [local, setLocal] = useState(p);
  const [addOpen, setAddOpen] = useState(false);
  const [buscaIns, setBuscaIns] = useState("");
  const [rapido, setRapido] = useState({ preco: "", qtd: "", un: "kg" });
  useEffect(() => { setLocal(p); }, [p.id]); // eslint-disable-line

  const r = calc(local);
  const set = (patch) => { const np = { ...local, ...patch }; setLocal(np); onSave(np); };
  const setPrecoCanal = (canalId, valor) => set({ precosCanal: { ...(local.precosCanal || {}), [canalId]: valor } });
  const addItem = (insumoId) => {
    const ins = insumos.find((i) => i.id === insumoId);
    const sug = perdaSugerida(ins?.nome);
    set({ itens: [...local.itens, { insumoId, qtd: 0, perda: sug ? sug.perda : 0 }] });
    setAddOpen(false);
  };
  const setItem = (idx, patch) => set({ itens: local.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const rmItem = (idx) => set({ itens: local.itens.filter((_, i) => i !== idx) });
  const disponiveis = insumos.filter((i) => !local.itens.some((it) => it.insumoId === i.id));
  const achados = buscaIns.trim()
    ? disponiveis.filter((i) => i.nome.toLowerCase().includes(buscaIns.trim().toLowerCase())).slice(0, 6)
    : disponiveis.slice(0, 6);
  const criarRapido = () => {
    const preco = parseFloat(rapido.preco), qtd = parseFloat(rapido.qtd);
    if (!preco || !qtd) return;
    const novo = { id: uid(), nome: buscaIns.trim(), unidade: rapido.un, precoPacote: preco, qtdPacote: qtd, historico: [{ d: hoje(), p: preco }] };
    onNovoInsumo(novo);
    const sug = perdaSugerida(novo.nome);
    set({ itens: [...local.itens, { insumoId: novo.id, qtd: 0, perda: sug ? sug.perda : 0 }] });
    setRapido({ preco: "", qtd: "", un: "kg" }); setBuscaIns(""); setAddOpen(false);
  };

  return (
    <div>
      <button onClick={onBack} className="btn lbl" style={{ background: "none", border: "none", padding: "0 0 20px", color: C.ink45 }}>← Produtos</button>

      <div className="lbl" style={{ marginBottom: 6 }}>Nome do produto</div>
      <div className="fld" style={{ marginBottom: 14 }}>
      <input value={local.nome === "Novo produto" ? "" : local.nome} placeholder="Nome do produto"
        onChange={(e) => set({ nome: e.target.value })} onBlur={() => { if (!local.nome.trim()) set({ nome: "Novo produto" }); }} className="serif nome-prod"
        style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.01em", padding: "13px 3px", minWidth: 0 }} />
      </div>

      <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="lbl">Custa para produzir</span>
        <span className="mono" style={{ fontSize: 24, marginLeft: "auto" }}>{brl(r.custoUnid)}</span>
        {r.cmvPct > 0 && (
          <span className="mono tag" style={{ fontSize: 13.5, color: corCMV(r.cmvPct), background: bgCMV(r.cmvPct), marginLeft: 10 }}>
            {pct(r.cmvPct)} do preço
          </span>
        )}
      </div>
      <div className="mono" style={{ fontSize: 13, color: C.ink45, paddingTop: 9 }}>
        insumos {brlSec(r.custoInsumos / (local.rendimento || 1))}
        {local.maoDeObra > 0 && ` + mão de obra ${brlSec(local.maoDeObra)}`}
        {local.outrosCustos > 0 && ` + outros custos ${brlSec(local.outrosCustos)}`}
      </div>

      <Sec>Detalhes (opcional)</Sec>
      <div style={{ display: "flex", gap: 14, paddingTop: 14 }}>
        <Campo rot="Rende quantas unidades">
          <input type="number" inputMode="decimal" className="inp numi" value={local.rendimento}
            onChange={(e) => set({ rendimento: parseFloat(e.target.value) || 1 })} />
        </Campo>
        <Campo rot="Mão de obra por unidade">
          <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
          <input type="number" inputMode="decimal" className="inp numi" value={local.maoDeObra || ""} placeholder="0"
            onChange={(e) => set({ maoDeObra: parseFloat(e.target.value) || 0 })} />
        </Campo>
        <Campo rot="Outros custos por unidade">
          <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
          <input type="number" inputMode="decimal" className="inp numi" value={local.outrosCustos || ""} placeholder="0"
            onChange={(e) => set({ outrosCustos: parseFloat(e.target.value) || 0 })} />
        </Campo>
      </div>

      <Sec>Preço por canal</Sec>
      {r.precos.length === 0 && <div style={{ fontSize: 13.5, color: C.ink70, paddingTop: 14 }}>Cadastre canais na aba Ajustes.</div>}
      {r.precos.map((canal) => (
        <div key={canal.id} className="row" style={{ padding: "15px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500 }}>{canal.nome}</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span className="mono tag" style={{ fontSize: 13, background: canal.confiavel ? "#EFEFEC" : C.redSoft, color: canal.confiavel ? C.ink : C.red }}>
                  {canal.confiavel ? `markup ${canal.markup.toFixed(2)}×` : "sem preço possível"}
                </span>
                <span className="mono" style={{ fontSize: 13, color: C.ink70 }}>
                  {canal.confiavel ? `sugerido ${brl(canal.preco)}` : ""}
                </span>
              </div>
              <div className="mono" style={{ fontSize: 12, color: C.ink45, marginTop: 4 }}>taxa {pct(canal.comissao)} · soma {pct(canal.soma)}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="lbl" style={{ marginBottom: 4 }}>Você cobra</div>
              <div className="fld" style={{ borderColor: canal.definido > 0 ? C.ink : C.rule, display: "inline-flex" }}>
                <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
                <input type="number" inputMode="decimal" className="inp numi" value={canal.definido || ""}
                  placeholder={canal.confiavel ? canal.preco.toFixed(2) : "0"}
                  onChange={(e) => setPrecoCanal(canal.id, parseFloat(e.target.value) || 0)}
                  style={{ width: 74, fontSize: 16, fontWeight: 600 }} />
              </div>
            </div>
          </div>

          {canal.definido > 0 && (
            <div style={{ display: "flex", marginTop: 12, borderTop: `1px solid ${C.ruleSoft}`, paddingTop: 9 }}>
              <Dado rot="Sobra por venda" v={brl(canal.mcCanal)} cor={corMC(canal.mcCanalPct)} />
              <Dado rot="Isso é da venda" v={pct(canal.mcCanalPct)} cor={corMC(canal.mcCanalPct)} />
              <Dado rot="CMV (custo da mercadoria vendida)" v={pct(canal.cmvCanal)} cor={corCMV(canal.cmvCanal)} ultimo />
            </div>
          )}

          {canal.definido > 0 && canal.mcCanal > 0 && (
            <div style={{ fontSize: 13.5, color: C.ink70, marginTop: 9, lineHeight: 1.5, fontWeight: 500 }}>
              Vendendo a {brl(canal.definido)} neste canal, sobram <b style={{ color: C.ink }}>{brl(canal.mcCanal)}</b> por unidade para pagar as contas fixas e virar lucro.
            </div>
          )}
          {canal.definido > 0 && canal.mcCanal <= 0 && (
            <div style={{ fontSize: 13.5, color: C.red, marginTop: 9, lineHeight: 1.5, fontWeight: 600 }}>
              A {brl(canal.definido)} este canal dá prejuízo de {brl(Math.abs(canal.mcCanal))} por unidade vendida.
            </div>
          )}
          {!canal.confiavel && (
            <Aviso forte>
              Impostos, despesas fixas, lucro e taxa somam {pct(canal.soma)} do preço de venda. Não é possível sugerir um preço confiável.
              {r.fixasPct > 45 && <> A causa provável é a despesa fixa em {pct(r.fixasPct)} do faturamento — confira o faturamento médio em Ajustes.</>}
            </Aviso>
          )}
          {canal.confiavel && canal.atencao && <Aviso>Soma de {pct(canal.soma)} — o preço sugerido fica alto. Vale conferir os percentuais em Ajustes.</Aviso>}
          {canal.confiavel && canal.temDesvio && canal.desvio < -2 && (
            <Aviso forte>Abaixo do sugerido. Neste canal você não cobre os {pct(canal.soma)} de impostos, fixas, lucro e taxa.</Aviso>
          )}
        </div>
      ))}

      <Sec>De onde vem o preço</Sec>
      <div style={{ paddingTop: 10 }}>
        <Lin rot="Impostos" v={pct(cfg.impostos)} />
        <Lin rot={cfg.modoFixas === "auto" ? `Despesas fixas · ${brl(totalFixas(cfg))} ÷ ${brl(cfg.faturamentoMedio)}` : "Despesas fixas · % informado"} v={pct(r.fixasPct)} />
        <Lin rot="Lucro desejado" v={pct(cfg.lucro)} />
        <Lin rot="Base, sem canal" v={pct(r.base)} forte />
        <div style={{ height: 14 }} />
        {r.precos.map((c) => (
          <Lin key={c.id} rot={`${c.nome} — ${c.confiavel ? `${c.markup.toFixed(2)}×` : "sem preço"}`} v={c.confiavel ? brl(c.preco) : "—"} alerta={!c.confiavel} />
        ))}
      </div>

      <Sec acao={<button className="btn lbl" onClick={() => setAddOpen(!addOpen)} style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700 }}>{addOpen ? "Fechar" : "+ Ingrediente"}</button>}>
        Do que é feito
      </Sec>

      {addOpen && (
        <div className="card" style={{ padding: 16, marginTop: 10 }}>
          <div className="fld" style={{ marginBottom: 10 }}>
            <input autoFocus value={buscaIns} onChange={(e) => setBuscaIns(e.target.value)}
              placeholder="Digite o ingrediente — ex: carne, pão, queijo" className="inp" />
          </div>

          {achados.map((i) => (
            <div key={i.id} className="btn row" onClick={() => { addItem(i.id); setBuscaIns(""); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{i.nome}</span>
              <span className="mono" style={{ fontSize: 13, color: C.ink45 }}>{brl(custoInsumo(i))}/{baseUnit(i.unidade)}</span>
            </div>
          ))}

          {buscaIns.trim() && achados.length === 0 && (
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cadastrar "{buscaIns}"</div>
              <div style={{ fontSize: 13, color: C.ink70, marginBottom: 12, lineHeight: 1.5 }}>
                Quanto você pagou e quanto vinha na embalagem? Ex: paguei R$ 42 no pacote de 1 kg.
              </div>
              <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
                <div className="fld" style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, color: C.ink45 }}>R$</span>
                  <input type="number" inputMode="decimal" className="inp numi" placeholder="paguei" value={rapido.preco}
                    onChange={(e) => setRapido({ ...rapido, preco: e.target.value })} />
                </div>
                <div className="fld" style={{ width: 86 }}>
                  <input type="number" inputMode="decimal" className="inp numi" placeholder="qtd" value={rapido.qtd}
                    onChange={(e) => setRapido({ ...rapido, qtd: e.target.value })} />
                </div>
                <select value={rapido.un} onChange={(e) => setRapido({ ...rapido, un: e.target.value })}
                  style={{ border: `1.5px solid ${C.rule}`, borderRadius: 8, background: "#fff", padding: "0 8px", fontSize: 15, fontWeight: 600 }}>
                  {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <button className="btn" onClick={criarRapido} disabled={!rapido.preco || !rapido.qtd}
                style={{ width: "100%", background: rapido.preco && rapido.qtd ? C.ink : C.rule, color: "#fff", border: "none", borderRadius: 8, padding: 13, fontSize: 14.5, fontWeight: 700 }}>
                Cadastrar e usar neste produto
              </button>
            </div>
          )}

          {!buscaIns.trim() && disponiveis.length === 0 && (
            <div style={{ fontSize: 13.5, color: C.ink70, padding: "6px 0" }}>Todos os ingredientes já estão neste produto. Digite acima para cadastrar um novo.</div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: "4px 16px 8px" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="lbl" style={{ textAlign: "left", padding: "8px 0", fontSize: 12 }}>Ingrediente</th>
            <th className="lbl" style={{ textAlign: "right", padding: "8px 6px", fontSize: 12, width: 74 }}>Usa</th>
            <th className="lbl" style={{ textAlign: "right", padding: "8px 6px", fontSize: 12, width: 70 }}>Perde</th>
            <th style={{ width: 16 }} />
          </tr>
        </thead>
        <tbody>
          {local.itens.length === 0 && (
            <tr><td colSpan={4} style={{ fontSize: 14, color: C.ink70, padding: "16px 0", fontWeight: 500 }}>Toque em <b>+ Ingrediente</b> acima para montar o produto.</td></tr>
          )}
          {local.itens.map((it, idx) => {
            const ins = insumos.find((i) => i.id === it.insumoId);
            if (!ins) {
              return (
                <tr key={idx} className="row">
                  <td colSpan={3} style={{ padding: "11px 0", fontSize: 13, color: C.red }}>Insumo excluído — custo incompleto</td>
                  <td style={{ textAlign: "right" }}><button className="btn" onClick={() => rmItem(idx)} style={{ background: "none", border: "none", color: C.red, fontSize: 15 }}>×</button></td>
                </tr>
              );
            }
            const rendPreparo = ins.rendimentoPreparo || 1;
            const bruto = quantidadeBruta(it, ins);
            const sug = perdaSugerida(ins.nome);
            return (
              <tr key={idx} className="row">
                <td style={{ padding: "9px 0" }}>
                  <div style={{ fontSize: 13.5 }}>{ins.nome}</div>
                  <div className="mono" style={{ fontSize: 11, color: C.ink45, marginTop: 1 }}>
                    {brlSec(custoInsumo(ins) * bruto)}
                    {(it.perda > 0 || rendPreparo !== 1) && ` · compra ${num(bruto, 1)}${baseUnit(ins.unidade)}`}
                  </div>
                </td>
                <td style={{ padding: "9px 6px" }}>
                  <div className="fld" style={{ padding: "0 5px" }}>
                    <input type="number" inputMode="decimal" className="inp numi" value={it.qtd || ""} placeholder="0"
                      onChange={(e) => setItem(idx, { qtd: parseFloat(e.target.value) || 0 })} style={{ fontSize: 13, padding: "6px 1px" }} />
                  </div>
                </td>
                <td style={{ padding: "9px 6px" }}>
                  <div className="fld" style={{ padding: "0 5px", borderColor: it.perda > 0 ? C.ink : C.rule }}>
                    <input type="number" inputMode="decimal" className="inp numi" value={it.perda || ""} placeholder="0"
                      onChange={(e) => setItem(idx, { perda: Math.min(99, parseFloat(e.target.value) || 0) })} style={{ fontSize: 13, padding: "6px 1px" }} />
                    <span style={{ fontSize: 11, color: C.ink45 }}>%</span>
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => rmItem(idx)} style={{ background: "none", border: "none", color: C.ink45, fontSize: 15 }}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>

      <div style={{ fontSize: 12, color: C.ink45, marginTop: 12, lineHeight: 1.55 }}>
        <b>Usa</b> é a quantidade que vai no produto pronto. <b>Perde</b> é o que se joga fora no preparo — aparo, osso, casca, encolhimento. Já preenchemos com valores típicos; ajuste se o seu for diferente.
      </div>

      <button onClick={() => onDuplicar(local)} className="btn"
        style={{ marginTop: 34, background: "#fff", border: `1.5px solid ${C.rule}`, color: C.ink, borderRadius: 8, padding: "12px 18px", fontSize: 14, fontWeight: 700, marginRight: 10 }}>
        Duplicar produto
      </button>
      <button onClick={() => onDelete(local.id)} className="btn lbl"
        style={{ background: "none", border: "none", color: C.red, fontSize: 14, fontWeight: 600 }}>
        Excluir produto
      </button>
    </div>
  );
}

function Dado({ rot, v, cor, alerta, ultimo }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: ultimo ? "none" : `1px solid ${C.ruleSoft}`, paddingRight: 10, marginRight: 10 }}>
      <div className="lbl" style={{ fontSize: 12 }}>{rot}</div>
      <div className="mono" style={{ fontSize: 17, marginTop: 3, color: cor || (alerta ? C.red : C.ink) }}>{v}</div>
    </div>
  );
}

function Lin({ rot, v, forte, alerta }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "5px 0", borderBottom: forte ? `1px solid ${C.ink}` : "none" }}>
      <span style={{ fontSize: 13, color: forte ? C.ink : C.ink70, fontWeight: forte ? 600 : 400, minWidth: 0 }}>{rot}</span>
      <span className="mono" style={{ fontSize: 13.5, fontWeight: forte ? 700 : 500, whiteSpace: "nowrap", color: alerta ? C.red : C.ink }}>{v}</span>
    </div>
  );
}

function Campo({ rot, children }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="lbl" style={{ marginBottom: 5 }}>{rot}</div>
      <div className="fld">{children}</div>
    </div>
  );
}

// ————————————————————————— insumos —————————————————————————

function Insumos({ insumos, onSave, custoInsumo, usoDoInsumo, produtos, canais, onSaveProdutos, onSaveCanais }) {
  const [novo, setNovo] = useState({ nome: "", unidade: "kg", precoPacote: "", qtdPacote: "" });
  const [editando, setEditando] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [busca, setBusca] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const add = () => {
    if (!novo.nome || !novo.precoPacote || !novo.qtdPacote) return;
    const preco = parseFloat(novo.precoPacote);
    onSave([{ id: uid(), nome: novo.nome, unidade: novo.unidade, precoPacote: preco, qtdPacote: parseFloat(novo.qtdPacote), historico: [{ d: hoje(), p: preco }] }, ...insumos]);
    setNovo({ nome: "", unidade: "kg", precoPacote: "", qtdPacote: "" });
  };

  const atualizar = (id, patch, registrarPreco) => {
    onSave(insumos.map((i) => {
      if (i.id !== id) return i;
      const n = { ...i, ...patch };
      if (registrarPreco && patch.precoPacote !== undefined && patch.precoPacote !== i.precoPacote) {
        const h = [...(i.historico || [])];
        if (h[h.length - 1]?.p !== patch.precoPacote) h.push({ d: hoje(), p: patch.precoPacote });
        n.historico = h.slice(-12);
      }
      return n;
    }));
  };

  const excluir = (ins) => {
    const uso = usoDoInsumo(ins.id);
    if (uso.length > 0) { setConfirmar({ ins, uso }); return; }
    onSave(insumos.filter((x) => x.id !== ins.id));
  };

  const lista = busca ? insumos.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase())) : insumos;

  return (
    <div>
      <button className="btn" onClick={() => setImportOpen(true)}
        style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "16px 18px", fontSize: 15.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 26 }}>
        ⬆ Importar do Excel
      </button>

      <Sec>Novo insumo</Sec>
      <div style={{ paddingTop: 14 }}>
        <div className="fld" style={{ marginBottom: 9 }}>
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome — couro, tecido, farinha" className="inp" />
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <div className="fld" style={{ flex: 1 }}>
            <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
            <input type="number" inputMode="decimal" value={novo.precoPacote} onChange={(e) => setNovo({ ...novo, precoPacote: e.target.value })} placeholder="preço pago" className="inp numi" />
          </div>
          <div className="fld" style={{ width: 72 }}>
            <input type="number" inputMode="decimal" value={novo.qtdPacote} onChange={(e) => setNovo({ ...novo, qtdPacote: e.target.value })} placeholder="qtd" className="inp numi" />
          </div>
          <select value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })}
            style={{ border: `1px solid ${C.rule}`, borderRadius: 2, background: "#FFFDF8", padding: "0 6px", fontSize: 13.5 }}>
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
          <button className="btn" onClick={add} style={{ background: C.ink, color: C.paper, border: "none", borderRadius: 2, padding: "0 16px", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600 }}>
            Add
          </button>
        </div>
      </div>

      <Sec acao={
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar"
          style={{ border: "none", borderBottom: `1px solid ${C.rule}`, background: "transparent", outline: "none", fontSize: 12, padding: "0 0 2px", width: 90, textAlign: "right" }} />
      }>
        {lista.length} insumo{lista.length !== 1 ? "s" : ""}
      </Sec>

      {importOpen && (
        <ImportUnificado insumos={insumos} produtos={produtos} canais={canais}
          onSaveInsumos={onSave} onSaveProdutos={onSaveProdutos} onSaveCanais={onSaveCanais} onClose={() => setImportOpen(false)} />
      )}

      <div className="card" style={{ padding: "4px 16px 8px" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="lbl" style={{ textAlign: "left", padding: "8px 0", fontSize: 12 }}>Ingrediente</th>
            <th className="lbl" style={{ textAlign: "right", padding: "8px 0", fontSize: 12 }}>Custo unitário</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((i) => {
            const h = i.historico || [];
            const anterior = h.length >= 2 ? h[h.length - 2] : null;
            const varia = anterior && anterior.p > 0 ? ((i.precoPacote - anterior.p) / anterior.p) * 100 : 0;
            const emEdicao = editando === i.id;
            const uso = usoDoInsumo(i.id);
            return (
              <React.Fragment key={i.id}>
                <tr className="row tap" onClick={() => setEditando(emEdicao ? null : i.id)}>
                  <td style={{ padding: "14px 0" }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>{i.nome}</div>
                    <div className="mono" style={{ fontSize: 13, color: C.ink45, marginTop: 3 }}>
                      {brl(i.precoPacote)} / {i.qtdPacote}{i.unidade}{uso.length > 0 && ` · ${uso.length} produto${uso.length > 1 ? "s" : ""}`}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", padding: "11px 0" }}>
                    <div className="mono" style={{ fontSize: 14.5, fontWeight: 600 }}>{brl(custoInsumo(i))}</div>
                    <div className="mono" style={{ fontSize: 11, color: anterior && Math.abs(varia) >= 0.5 && varia > 0 ? C.red : C.ink45, marginTop: 1 }}>
                      {anterior && Math.abs(varia) >= 0.5
                        ? `${varia > 0 ? "↑" : "↓"} ${pct(Math.abs(varia))} desde ${dataBR(anterior.d)}`
                        : `por ${baseUnit(i.unidade)}`}
                    </div>
                  </td>
                </tr>
                {emEdicao && (
                  <tr>
                    <td colSpan={2} style={{ background: C.paperAlt, padding: "16px 14px" }}>
                      <div className="lbl" style={{ marginBottom: 10 }}>Editar</div>
                      <div className="fld" style={{ marginBottom: 9 }}>
                        <input value={i.nome} onChange={(e) => atualizar(i.id, { nome: e.target.value })} className="inp" />
                      </div>
                      <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                        <div className="fld" style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
                          <input type="number" inputMode="decimal" value={i.precoPacote || ""} placeholder="0" className="inp numi"
                            onChange={(e) => atualizar(i.id, { precoPacote: parseFloat(e.target.value) || 0 })}
                            onBlur={(e) => atualizar(i.id, { precoPacote: parseFloat(e.target.value) || 0 }, true)} />
                        </div>
                        <div className="fld" style={{ width: 72 }}>
                          <input type="number" inputMode="decimal" value={i.qtdPacote || ""} placeholder="0" className="inp numi"
                            onChange={(e) => atualizar(i.id, { qtdPacote: parseFloat(e.target.value) || 1 })} />
                        </div>
                        <select value={i.unidade} onChange={(e) => atualizar(i.id, { unidade: e.target.value })}
                          style={{ border: `1px solid ${C.rule}`, borderRadius: 2, background: "#FFFDF8", padding: "0 6px", fontSize: 13.5 }}>
                          {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </div>

                      <div style={{ marginBottom: 14 }}>
                        <div className="lbl" style={{ marginBottom: 3 }}>Rendimento no preparo</div>
                        <div style={{ fontSize: 12, color: C.ink45, marginBottom: 8, lineHeight: 1.4 }}>
                          Pra insumo que muda de peso ao cozinhar — ex: 1kg de arroz cru rende 3kg pronto, então é 3. Deixe 1 se não muda.
                        </div>
                        <div className="fld" style={{ width: 90 }}>
                          <input type="number" inputMode="decimal" value={i.rendimentoPreparo || ""} placeholder="1" className="inp numi"
                            onChange={(e) => atualizar(i.id, { rendimentoPreparo: parseFloat(e.target.value) || 1 })} />
                          <span style={{ fontSize: 13, color: C.ink45 }}>×</span>
                        </div>
                      </div>

                      {h.length > 1 && (
                        <div style={{ marginBottom: 14 }}>
                          <div className="lbl" style={{ marginBottom: 6 }}>Histórico de preço</div>
                          {h.slice(-4).reverse().map((x, k) => (
                            <div key={k} className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.ink70, padding: "3px 0", borderBottom: `1px solid ${C.ruleSoft}` }}>
                              <span>{dataBR(x.d)}</span><span style={{ color: C.ink, fontWeight: 600 }}>{brl(x.p)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button className="btn lbl" onClick={() => excluir(i)} style={{ background: "none", border: "none", color: C.red, borderBottom: `1px solid ${C.red}`, paddingBottom: 1 }}>
                        Excluir insumo
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table></div>

      {confirmar && (
        <div onClick={() => setConfirmar(null)} style={{ position: "fixed", inset: 0, background: "rgba(22,19,14,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, border: `1px solid ${C.ink}`, padding: 24, maxWidth: 400, width: "100%" }}>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1.2, marginBottom: 10 }}>Insumo em uso</div>
            <div style={{ fontSize: 13.5, color: C.ink70, lineHeight: 1.55, marginBottom: 14 }}>
              <b style={{ color: C.ink }}>{confirmar.ins.nome}</b> compõe {confirmar.uso.length} ficha{confirmar.uso.length > 1 ? "s" : ""}. Excluir deixa o custo destes produtos incompleto:
            </div>
            <div style={{ borderTop: `1px solid ${C.rule}`, marginBottom: 20 }}>
              {confirmar.uso.map((p) => <div key={p.id} style={{ fontSize: 13, padding: "7px 0", borderBottom: `1px solid ${C.ruleSoft}` }}>{p.nome}</div>)}
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <button className="btn" onClick={() => setConfirmar(null)} style={{ background: C.ink, color: C.paper, border: "none", borderRadius: 2, padding: "11px 22px", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600 }}>Manter</button>
              <button className="btn lbl" onClick={() => { onSave(insumos.filter((x) => x.id !== confirmar.ins.id)); setConfirmar(null); }}
                style={{ background: "none", border: "none", color: C.red, borderBottom: `1px solid ${C.red}`, paddingBottom: 1 }}>Excluir mesmo assim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ————————————————————————— ajustes —————————————————————————

function Ajustes({ cfg, onSaveCfg, canais, onSaveCanais, onRemoverCanal, produtos, onResetTudo }) {
  const [resetStep, setResetStep] = useState(0);
  const set = (k, v) => onSaveCfg({ ...cfg, [k]: v });
  const setCanal = (id, patch) => onSaveCanais(canais.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addCanal = () => onSaveCanais([...canais, { id: uid(), nome: "Novo canal", comissao: 0, embalagem: 0 }]);
  const setDesp = (id, patch) => set("despesas", (cfg.despesas || []).map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const addDesp = () => set("despesas", [...(cfg.despesas || []), { id: uid(), nome: "", valor: 0 }]);
  const rmDesp = (id) => set("despesas", (cfg.despesas || []).filter((d) => d.id !== id));
  const CATEGORIAS_FIXAS = [
    { id: "ocupacional", titulo: "Despesa ocupacional", hint: "aluguel, condomínio, luz…" },
    { id: "equipe", titulo: "Despesa com equipe", hint: "salário, férias, extra, INSS e FGTS" },
    { id: "administrativa", titulo: "Despesa administrativa", hint: "prestadores de serviço (ex: contabilidade, TOTVS), materiais de apoio (ex: louça, limpeza)" },
  ];
  const setValorCategoria = (catId, valor) => {
    const existente = (cfg.despesas || []).find((d) => d.categoria === catId);
    if (existente) setDesp(existente.id, { valor });
    else set("despesas", [...(cfg.despesas || []), { id: uid(), nome: catId, valor, categoria: catId }]);
  };
  const despesasExtras = (cfg.despesas || []).filter((d) => !CATEGORIAS_FIXAS.some((c) => c.id === d.categoria));

  const total = totalFixas(cfg);
  const fixasPct = calcFixasPct(cfg);
  const base = cfg.impostos + fixasPct + cfg.lucro;
  const markup = base < 100 ? 1 / (1 - base / 100) : null;
  const custoPct = 100 - base;
  const usoCanal = (id) => produtos.filter((p) => p.precosCanal?.[id] > 0).length;

  const pctCalculado = cfg.faturamentoMedio > 0 ? (total / cfg.faturamentoMedio) * 100 : 0;
  const trocarModo = (m) => {
    if (m === "manual" && cfg.modoFixas !== "manual" && pctCalculado > 0) {
      onSaveCfg({ ...cfg, modoFixas: "manual", despesasFixasManual: Number(pctCalculado.toFixed(2)) });
    } else set("modoFixas", m);
  };
  const difere = pctCalculado > 0 && Math.abs(pctCalculado - (cfg.despesasFixasManual || 0)) >= 0.1;

  return (
    <div>
      <Sec></Sec>
      <div className="card" style={{ padding: 20 }}>
        <div className="serif" style={{ fontSize: 38, lineHeight: 1.05, color: C.ink }}>{pct(base)}</div>
        <div className="mono" style={{ fontSize: 12, color: C.ink45, marginTop: 8 }}>
          impostos {pct(cfg.impostos)} + fixas {pct(fixasPct)} + lucro {pct(cfg.lucro)}
        </div>
        {markup && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.ruleSoft}` }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Markup</span>
            <span className="serif" style={{ fontSize: 26, lineHeight: 1 }}>{markup.toFixed(2)}×</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
          <span style={{ fontSize: 13, color: C.ink70 }}>Custo representa do preço de venda</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{pct(custoPct)}</span>
        </div>
      </div>

      <Sec></Sec>
      <div style={{ paddingTop: 14 }}>
        <LinhaCampo rot="Quanto a empresa fatura por mês" hint="valor do MÊS inteiro, não do dia">
          <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
          <input type="number" inputMode="decimal" className="inp numi" value={cfg.faturamentoMedio || ""} placeholder="0" onChange={(e) => set("faturamentoMedio", parseFloat(e.target.value) || 0)} style={{ width: 92 }} />
        </LinhaCampo>
      </div>
      <div style={{ display: "flex", gap: 22, padding: "14px 0 4px" }}>
        {[{ id: "auto", l: "Calcular pelo R$" }, { id: "manual", l: "Informar %" }].map((m) => (
          <button key={m.id} className="btn" onClick={() => trocarModo(m.id)}
            style={{ background: "none", border: "none", padding: "0 0 3px", fontSize: 13, fontWeight: cfg.modoFixas === m.id ? 600 : 400,
              color: cfg.modoFixas === m.id ? C.ink : C.ink45, borderBottom: `2px solid ${cfg.modoFixas === m.id ? C.ink : "transparent"}` }}>
            {m.l}
          </button>
        ))}
      </div>

      {cfg.modoFixas === "manual" ? (
        <div style={{ paddingTop: 14 }}>
          <LinhaCampo rot="Despesas fixas" hint="percentual sobre o faturamento">
            <input type="number" inputMode="decimal" className="inp numi" value={cfg.despesasFixasManual || ""} placeholder="0" onChange={(e) => set("despesasFixasManual", parseFloat(e.target.value) || 0)} style={{ width: 54 }} />
            <span style={{ fontSize: 13, color: C.ink45 }}>%</span>
          </LinhaCampo>
          {pctCalculado > 0 && (
            <Aviso>
              Pelo custo fixo lançado ({brl(total)} ÷ {brl(cfg.faturamentoMedio)}) daria <b>{pct(pctCalculado)}</b>.
              {difere && (
                <>{" "}<button className="btn" onClick={() => set("despesasFixasManual", Number(pctCalculado.toFixed(2)))}
                  style={{ background: "none", border: "none", color: C.ink, fontWeight: 600, fontSize: 12.5, borderBottom: `1px solid ${C.ink}`, padding: 0 }}>
                  usar este valor
                </button></>
              )}
            </Aviso>
          )}
        </div>
      ) : (
        <div style={{ paddingTop: 14 }}>
          {CATEGORIAS_FIXAS.map((c) => {
            const item = (cfg.despesas || []).find((d) => d.categoria === c.id);
            return (
              <LinhaCampo key={c.id} rot={c.titulo} hint={c.hint}>
                <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
                <input type="number" inputMode="decimal" className="inp numi" value={item?.valor || ""} placeholder="0"
                  onChange={(e) => setValorCategoria(c.id, parseFloat(e.target.value) || 0)} style={{ width: 92 }} />
              </LinhaCampo>
            );
          })}

          {despesasExtras.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 0", borderBottom: `1px solid ${C.ruleSoft}` }}>
              <div className="fld" style={{ flex: 1 }}>
                <input value={d.nome} onChange={(e) => setDesp(d.id, { nome: e.target.value })} placeholder="Ex: Outra despesa" className="inp" />
              </div>
              <div className="fld" style={{ width: 116 }}>
                <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
                <input type="number" inputMode="decimal" value={d.valor || ""} placeholder="0" className="inp numi" onChange={(e) => setDesp(d.id, { valor: parseFloat(e.target.value) || 0 })} />
              </div>
              <button className="btn" onClick={() => rmDesp(d.id)} style={{ background: "none", border: "none", color: C.ink45, fontSize: 15 }}>×</button>
            </div>
          ))}

          <button className="btn lbl" onClick={addDesp} style={{ background: "none", border: "none", color: C.ink, borderBottom: `1px solid ${C.ink}`, paddingBottom: 1, marginTop: 12 }}>Adicionar despesa</button>
        </div>
      )}

      <Sec>Imposto e lucro</Sec>
      <div style={{ paddingTop: 6 }}>
        <LinhaCampo rot="Imposto sobre cada venda" hint="Simples Nacional costuma ficar em 6%">
          <input type="number" inputMode="decimal" className="inp numi" value={cfg.impostos || ""} placeholder="0" onChange={(e) => set("impostos", parseFloat(e.target.value) || 0)} style={{ width: 54 }} />
          <span style={{ fontSize: 13, color: C.ink45 }}>%</span>
        </LinhaCampo>
        <LinhaCampo rot="Lucro desejado" hint="de cada R$ 100 vendidos, quanto quer que sobre">
          <input type="number" inputMode="decimal" className="inp numi" value={cfg.lucro || ""} placeholder="0" onChange={(e) => set("lucro", parseFloat(e.target.value) || 0)} style={{ width: 54 }} />
          <span style={{ fontSize: 13, color: C.ink45 }}>%</span>
        </LinhaCampo>
      </div>

      <Sec acao={<button className="btn lbl" onClick={addCanal} style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700 }}>Novo canal</button>}>
        Canais de venda
      </Sec>

      {canais.map((c, idx) => {
        const soma = base + (c.comissao || 0);
        const ok = soma < 100;
        const usados = usoCanal(c.id);
        return (
          <div key={c.id} className="row" style={{ padding: "14px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 9, marginBottom: 12 }}>
              <Campo rot="Canal de venda">
                <input value={c.nome === "Novo canal" ? "" : c.nome} placeholder="Ex: Maquininha Salão, iFood, WhatsApp" className="inp"
                  onChange={(e) => setCanal(c.id, { nome: e.target.value })}
                  onBlur={() => { if (!c.nome.trim()) setCanal(c.id, { nome: "Novo canal" }); }} />
              </Campo>
              <div style={{ display: "flex", alignItems: "center", gap: 9, paddingBottom: 13 }}>
                {idx === 0 && <span className="lbl" style={{ fontSize: 11.5 }}>Principal</span>}
                <span className="mono" style={{ fontSize: 12, color: ok ? C.ink45 : C.red }}>{ok ? `${(1 / (1 - soma / 100)).toFixed(2)}×` : "sem preço"}</span>
                <button className="btn" onClick={() => { if (usados === 0 || window.confirm(`${usados} produto(s) têm preço definido neste canal. Excluir apaga esses preços. Continuar?`)) onRemoverCanal(c.id); }}
                  style={{ background: "none", border: "none", color: C.ink45, fontSize: 15 }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <Campo rot="Taxa do canal">
                <input type="number" inputMode="decimal" className="inp numi" value={c.comissao || ""} placeholder="0" onChange={(e) => setCanal(c.id, { comissao: parseFloat(e.target.value) || 0 })} />
                <span style={{ fontSize: 13, color: C.ink45 }}>%</span>
              </Campo>
              <Campo rot="Embalagem / frete">
                <span style={{ fontSize: 13, color: C.ink45 }}>R$</span>
                <input type="number" inputMode="decimal" className="inp numi" value={c.embalagem || ""} placeholder="0" onChange={(e) => setCanal(c.id, { embalagem: parseFloat(e.target.value) || 0 })} />
              </Campo>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 12, color: C.ink45, marginTop: 12, lineHeight: 1.55 }}>
        O primeiro canal da lista é o principal — alimenta o CMV, o ranking e o ponto de equilíbrio.
      </div>

      <Sec>Zona de risco</Sec>
      <div style={{ paddingTop: 6, paddingBottom: 10 }}>
        <button className="btn lbl" onClick={() => setResetStep(1)}
          style={{ background: "none", border: "none", padding: 0, color: C.red, textDecoration: "underline", fontSize: 13.5, fontWeight: 600 }}>
          Apagar todos os dados
        </button>
      </div>

      {resetStep > 0 && (
        <div onClick={() => setResetStep(0)} style={{ position: "fixed", inset: 0, background: "rgba(24,24,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 24, maxWidth: 360, width: "100%" }}>
            {resetStep === 1 && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: C.red }}>Apagar todos os dados?</div>
                <div style={{ fontSize: 13.5, color: C.red, lineHeight: 1.5, marginBottom: 20, fontWeight: 600 }}>
                  Isso vai apagar PERMANENTEMENTE todos os insumos, produtos, canais e configurações desta conta. Essa ação não pode ser desfeita.
                </div>
              </>
            )}
            {resetStep === 2 && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: C.red }}>Tem certeza mesmo?</div>
                <div style={{ fontSize: 13.5, color: C.red, lineHeight: 1.5, marginBottom: 20, fontWeight: 600 }}>
                  Todos os seus dados serão perdidos para sempre, sem nenhuma chance de recuperação. Confirme só se tiver certeza absoluta.
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={() => setResetStep(0)}
                style={{ flex: 1, background: "#fff", color: C.ink, border: `1.5px solid ${C.rule}`, borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700 }}>
                Cancelar
              </button>
              {resetStep === 1 && (
                <button className="btn" onClick={() => setResetStep(2)}
                  style={{ flex: 1, background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700 }}>
                  Continuar
                </button>
              )}
              {resetStep === 2 && (
                <button className="btn" onClick={() => { onResetTudo(); setResetStep(0); }}
                  style={{ flex: 1, background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700 }}>
                  Apagar tudo agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaCampo({ rot, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "11px 0", borderBottom: `1px solid ${C.ruleSoft}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{rot}</div>
        {hint && <div style={{ fontSize: 13, color: C.ink45, marginTop: 3 }}>{hint}</div>}
      </div>
      <div className="fld" style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
