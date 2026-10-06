// Cliente Supabase com service role (só dentro das functions) + limites de uso.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

let _admin: SupabaseClient | null = null;

export function dbAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// true = dentro do limite; false = estourou
export async function dentroDoLimite(chave: string, janelaSeg: number, max: number): Promise<boolean> {
  const { data, error } = await dbAdmin().rpc("rate_limit_hit", { p_chave: chave, p_janela_seg: janelaSeg, p_max: max });
  if (error) { console.error("rate_limit_hit", error); return true; } // nunca trava o cliente por falha do contador
  return data === true;
}

// chave global diária: botão de pânico de custo (padrão 2000 chamadas de IA/dia)
export async function dentroDoLimiteGlobal(tipo: string): Promise<boolean> {
  const max = Number(Deno.env.get("LIMITE_GLOBAL_DIARIO") || 2000);
  const dia = new Date().toISOString().slice(0, 10);
  return dentroDoLimite(`global:${tipo}:${dia}`, 86400, max);
}

export type Rascunho = {
  id: string; etapa: string; dados: Record<string, unknown>; transcricao: string | null; ficha: unknown;
  email: string | null; status: string; transcricoes: number; extracoes: number; expira_em: string;
};

export async function carregarRascunho(id: string | null | undefined): Promise<Rascunho | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await dbAdmin().from("cadastros_em_andamento").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  if (data.status !== "em_andamento" || new Date(data.expira_em) < new Date()) return null;
  return data as Rascunho;
}

export async function atualizarRascunho(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await dbAdmin().from("cadastros_em_andamento").update({ ...patch, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) console.error("atualizarRascunho", error);
}
