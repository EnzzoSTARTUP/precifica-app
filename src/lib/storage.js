import { supabase } from "./supabaseClient";

export class ConflitoVersao extends Error {
  constructor(versaoServidor) { super("VERSAO_CONFLITO"); this.versaoServidor = versaoServidor; }
}

export async function loadState() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("app_state")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data || {};
}

// loadState usa select("*") de propósito: a coluna "versao" só existe depois da migração v2.
// Gravação com controle de versão: o servidor rejeita se alguém (ex.: propagação do catálogo)
// alterou os dados depois da última leitura. Enquanto a RPC não existir no banco, cai no upsert antigo.
export async function saveState(patch, versaoEsperada = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const rpc = await supabase.rpc("save_state", { patch, versao_esperada: versaoEsperada });
  if (!rpc.error) return Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;

  if (rpc.error.message?.includes("VERSAO_CONFLITO")) throw new ConflitoVersao(Number(rpc.error.details) || null);
  const semRpc = rpc.error.code === "PGRST202" || /function .*save_state.* does not exist|Could not find the function/i.test(rpc.error.message || "");
  if (!semRpc) throw rpc.error;

  const { data, error } = await supabase
    .from("app_state")
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() })
    .select("insumos, produtos, canais, cfg")
    .single();
  if (error) throw error;
  return data;
}
