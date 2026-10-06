import { supabase } from "./supabaseClient";

// Perfil do usuário logado (papel + empresa). Antes da migração v2 as tabelas não existem: devolve null sem quebrar.
export async function carregarPerfil() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil, error } = await supabase
    .from("perfis")
    .select("user_id, empresa_id, papel, nome, email, aceite_termos_em")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !perfil) return null;

  let empresa = null;
  if (perfil.empresa_id) {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome_fantasia, razao_social, cnpj, bairro, cidade, uf, logo_url, categorias, status, criado_em")
      .eq("id", perfil.empresa_id)
      .maybeSingle();
    empresa = data || null;
  }
  return { ...perfil, empresa, admin: perfil.papel === "admin_master" };
}

export async function registrarAcesso() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: perfil } = await supabase.from("perfis").select("empresa_id").eq("user_id", user.id).maybeSingle();
  if (perfil?.empresa_id) await supabase.from("empresas").update({ ultimo_acesso: new Date().toISOString() }).eq("id", perfil.empresa_id);
}
