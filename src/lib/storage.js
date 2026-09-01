import { supabase } from "./supabaseClient";

export async function loadState() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("app_state")
    .select("insumos, produtos, canais, cfg")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data || {};
}

export async function saveState(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("app_state")
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() })
    .select("insumos, produtos, canais, cfg")
    .single();

  if (error) throw error;
  return data;
}
