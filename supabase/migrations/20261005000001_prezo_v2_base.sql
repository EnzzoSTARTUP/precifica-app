-- Prezo v2 · Fase 1 — modelo de dados, papel admin master, versionamento do app_state
-- Idempotente onde possível (pode ser reaplicado sem quebrar).

create extension if not exists pgcrypto;

-- ———————————————————————— tipos ————————————————————————
do $$ begin
  if not exists (select 1 from pg_type where typname = 'papel_usuario') then
    create type papel_usuario as enum ('dono', 'admin_master');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_empresa') then
    create type status_empresa as enum ('ativo', 'inativo', 'cadastro_incompleto');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_revisao') then
    create type status_revisao as enum ('pendente', 'aprovado', 'rejeitado');
  end if;
end $$;

-- ———————————————————————— empresas / perfis ————————————————————————
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  cnpj text,                       -- só dígitos
  dados_cnpj jsonb,                -- resposta normalizada da consulta, SEM quadro de sócios
  endereco jsonb,
  bairro text,
  cidade text,
  uf text,
  logo_url text,
  categorias text[] not null default '{}',
  status status_empresa not null default 'cadastro_incompleto',
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
create unique index if not exists empresas_cnpj_unico on public.empresas (cnpj) where cnpj is not null;

create table if not exists public.empresa_socios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  qualificacao text,
  dados jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists empresa_socios_empresa on public.empresa_socios (empresa_id);

create table if not exists public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  papel papel_usuario not null default 'dono',
  nome text,
  email text,
  aceite_termos_em timestamptz,
  termos_versao text,
  aceite_ip text,
  criado_em timestamptz not null default now()
);
create index if not exists perfis_empresa on public.perfis (empresa_id);

-- e-mails que viram admin master automaticamente ao criar conta no app
create table if not exists public.admin_emails (
  email text primary key,
  criado_em timestamptz not null default now()
);
insert into public.admin_emails (email) values ('bennesbye@gmail.com')
  on conflict do nothing;

-- ———————————————————————— is_admin() ————————————————————————
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and papel = 'admin_master');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ———————————————————————— catálogo base ————————————————————————
create table if not exists public.catalogo_base (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sinonimos text[] not null default '{}',
  categoria text not null,
  unidade_compra text not null check (unidade_compra in ('kg', 'g', 'L', 'ml', 'un', 'm2')),
  qtd_padrao numeric not null default 1,          -- quantidade típica do pacote (ex.: 1 kg, 30 un, 900 ml)
  preco_medio numeric not null check (preco_medio >= 0),  -- R$ por qtd_padrao
  regiao text not null default 'Rio de Janeiro',
  zona text,
  fator_aproveitamento numeric not null default 100 check (fator_aproveitamento > 0 and fator_aproveitamento <= 100),
  rendimento_preparo numeric not null default 1 check (rendimento_preparo > 0),
  origem_preco text,
  atualizado_em timestamptz not null default now(),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists catalogo_base_nome_regiao on public.catalogo_base (lower(nome), regiao);
create index if not exists catalogo_base_categoria on public.catalogo_base (categoria);
create index if not exists catalogo_base_sinonimos on public.catalogo_base using gin (sinonimos);

create table if not exists public.catalogo_precos_historico (
  id uuid primary key default gen_random_uuid(),
  catalogo_id uuid not null references public.catalogo_base(id) on delete cascade,
  preco numeric not null,
  origem text,
  fonte text,
  criado_em timestamptz not null default now()
);
create index if not exists catalogo_precos_historico_item on public.catalogo_precos_historico (catalogo_id, criado_em desc);

create table if not exists public.catalogo_analises (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid references auth.users(id) on delete set null,
  limite_pct numeric not null default 10,
  status text not null default 'pendente',
  resumo jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists public.catalogo_sugestoes_preco (
  id uuid primary key default gen_random_uuid(),
  analise_id uuid not null references public.catalogo_analises(id) on delete cascade,
  catalogo_id uuid not null references public.catalogo_base(id) on delete cascade,
  preco_atual numeric not null,
  preco_sugerido numeric not null,
  variacao_pct numeric not null,
  fonte text,
  justificativa text,
  status status_revisao not null default 'pendente',
  decidido_em timestamptz,
  decidido_por uuid references auth.users(id) on delete set null
);
create index if not exists catalogo_sugestoes_analise on public.catalogo_sugestoes_preco (analise_id, status);

-- ———————————————————————— canais e categorias padrão ————————————————————————
create table if not exists public.canais_padrao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  comissao_pct numeric not null default 0,
  taxa_pagamento_pct numeric not null default 0,
  outras_taxas_pct numeric not null default 0,
  embalagem_padrao numeric not null default 0,
  ordem int not null default 100,
  ativo boolean not null default true
);

create table if not exists public.categorias_restaurante (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ordem int not null default 100,
  ativo boolean not null default true,
  insumos_sugeridos uuid[] not null default '{}',
  exemplos_pratos text[] not null default '{}'
);

-- ———————————————————————— filas / rascunhos / limites ————————————————————————
create table if not exists public.fila_revisao_insumos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  cadastro_id uuid,
  insumo_id text,                  -- id do objeto dentro de app_state.insumos
  nome text not null,
  unidade text not null,
  qtd_pacote numeric not null default 1,
  preco_estimado numeric not null default 0,
  justificativa_ia text,
  texto_origem text,
  status status_revisao not null default 'pendente',
  catalogo_id uuid references public.catalogo_base(id) on delete set null,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references auth.users(id) on delete set null
);
create index if not exists fila_revisao_status on public.fila_revisao_insumos (status, criado_em desc);

create table if not exists public.cadastros_em_andamento (
  id uuid primary key default gen_random_uuid(),
  etapa text not null default 'nome',
  dados jsonb not null default '{}',
  transcricao text,
  ficha jsonb,
  email text,
  status text not null default 'em_andamento',   -- em_andamento | concluido | expirado
  ip text,
  termos_versao text,
  aceite_termos_em timestamptz,
  transcricoes int not null default 0,
  extracoes int not null default 0,
  user_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '48 hours'
);
create index if not exists cadastros_email on public.cadastros_em_andamento (lower(email));

create table if not exists public.rate_limits (
  chave text not null,
  janela_inicio timestamptz not null,
  contagem int not null default 0,
  primary key (chave, janela_inicio)
);

create table if not exists public.cnpj_cache (
  cnpj text primary key,
  dados jsonb not null,
  consultado_em timestamptz not null default now()
);

-- contador atômico: devolve TRUE se ainda está dentro do limite
create or replace function public.rate_limit_hit(p_chave text, p_janela_seg int, p_max int)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := to_timestamp(floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg);
  v_contagem int;
begin
  insert into public.rate_limits (chave, janela_inicio, contagem) values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio) do update set contagem = rate_limits.contagem + 1
  returning contagem into v_contagem;
  delete from public.rate_limits where janela_inicio < now() - interval '2 days';
  return v_contagem <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ———————————————————————— app_state: defaults, versão, índice ————————————————————————
alter table public.app_state alter column insumos set default '[]'::jsonb;
alter table public.app_state alter column produtos set default '[]'::jsonb;
alter table public.app_state alter column canais set default '[]'::jsonb;
alter table public.app_state alter column cfg set default '{}'::jsonb;
alter table public.app_state add column if not exists versao int not null default 1;
create index if not exists app_state_insumos_gin on public.app_state using gin (insumos jsonb_path_ops);

create or replace function public.app_state_bump_versao()
returns trigger language plpgsql as $$
begin
  new.versao := coalesce(old.versao, 0) + 1;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists app_state_versao on public.app_state;
create trigger app_state_versao before update on public.app_state
  for each row execute function public.app_state_bump_versao();

-- gravação com controle de versão (substitui o upsert cego do cliente)
create or replace function public.save_state(patch jsonb, versao_esperada int default null)
returns table (insumos jsonb, produtos jsonb, canais jsonb, cfg jsonb, versao int)
language plpgsql security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_atual int;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  insert into public.app_state (user_id) values (v_uid) on conflict (user_id) do nothing;
  select s.versao into v_atual from public.app_state s where s.user_id = v_uid for update;
  if versao_esperada is not null and v_atual <> versao_esperada then
    raise exception 'VERSAO_CONFLITO' using errcode = 'P0001', detail = v_atual::text;
  end if;
  update public.app_state s set
    insumos  = coalesce(patch->'insumos',  s.insumos),
    produtos = coalesce(patch->'produtos', s.produtos),
    canais   = coalesce(patch->'canais',   s.canais),
    cfg      = coalesce(patch->'cfg',      s.cfg)
  where s.user_id = v_uid;
  return query select s.insumos, s.produtos, s.canais, s.cfg, s.versao from public.app_state s where s.user_id = v_uid;
end $$;
grant execute on function public.save_state(jsonb, int) to authenticated;

-- ———————————————————————— novo usuário → empresa + perfil ————————————————————————
create or replace function public.handle_novo_usuario()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_papel papel_usuario := 'dono';
begin
  if exists (select 1 from public.perfis where user_id = new.id) then return new; end if;
  if exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then v_papel := 'admin_master'; end if;
  insert into public.empresas (nome_fantasia, status)
    values (coalesce(new.raw_user_meta_data->>'nome_restaurante', 'Restaurante de ' || split_part(new.email, '@', 1)), 'cadastro_incompleto')
    returning id into v_empresa;
  insert into public.perfis (user_id, empresa_id, papel, nome, email)
    values (new.id, v_empresa, v_papel, new.raw_user_meta_data->>'nome', new.email);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_novo_usuario();

-- backfill dos usuários que já existem (não mexe no app_state deles)
do $$
declare r record; v_empresa uuid;
begin
  for r in select u.id, u.email from auth.users u where not exists (select 1 from public.perfis p where p.user_id = u.id) loop
    insert into public.empresas (nome_fantasia, status)
      values ('Restaurante de ' || split_part(r.email, '@', 1), 'ativo')
      returning id into v_empresa;
    insert into public.perfis (user_id, empresa_id, papel, email)
      values (r.id, v_empresa,
        case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(r.email)) then 'admin_master'::papel_usuario else 'dono'::papel_usuario end,
        r.email);
  end loop;
end $$;
update public.perfis p set papel = 'admin_master'
  where papel <> 'admin_master' and exists (select 1 from public.admin_emails a where lower(a.email) = lower(p.email));

-- ———————————————————————— RPCs administrativas ————————————————————————
create or replace function public.admin_set_status(p_empresa uuid, p_status status_empresa)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  update public.empresas set status = p_status where id = p_empresa;
end $$;
grant execute on function public.admin_set_status(uuid, status_empresa) to authenticated;

create or replace function public.admin_set_papel(p_user uuid, p_papel papel_usuario)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  if p_user = auth.uid() and p_papel <> 'admin_master' then raise exception 'Não é possível remover o próprio papel de admin'; end if;
  update public.perfis set papel = p_papel where user_id = p_user;
end $$;
grant execute on function public.admin_set_papel(uuid, papel_usuario) to authenticated;

-- propaga preço do catálogo só para itens que o restaurante nunca editou
create or replace function public.propagar_catalogo(p_catalogo uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c record; v_linhas int;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  select * into c from public.catalogo_base where id = p_catalogo;
  if not found then raise exception 'Item não encontrado'; end if;
  update public.app_state s set insumos = coalesce((
    select jsonb_agg(
      case when e->>'catalogoId' = p_catalogo::text and coalesce((e->>'editado')::boolean, false) = false
        then e || jsonb_build_object(
          'precoPacote', c.preco_medio, 'qtdPacote', c.qtd_padrao, 'unidade', c.unidade_compra,
          'rendimentoPreparo', c.rendimento_preparo,
          'historico', (select coalesce(jsonb_agg(z.h order by z.o), '[]'::jsonb) from (
              select h, o from jsonb_array_elements(coalesce(e->'historico', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('d', to_char(now(), 'YYYY-MM-DD'), 'p', c.preco_medio))) with ordinality t(h, o)
              order by o desc limit 12) z) )
        else e end order by ord)
    from jsonb_array_elements(s.insumos) with ordinality t(e, ord)), '[]'::jsonb)
  where s.insumos @> jsonb_build_array(jsonb_build_object('catalogoId', p_catalogo::text));
  get diagnostics v_linhas = row_count;
  return v_linhas;
end $$;
grant execute on function public.propagar_catalogo(uuid) to authenticated;

-- visão para o painel admin (RLS do app_state/perfis continua valendo: security_invoker)
create or replace view public.admin_empresas with (security_invoker = true) as
  select e.*,
         p.user_id as dono_user_id, p.email as dono_email, p.nome as dono_nome,
         coalesce(jsonb_array_length(coalesce(s.produtos, '[]'::jsonb)), 0) as qtd_pratos,
         coalesce(jsonb_array_length(coalesce(s.insumos, '[]'::jsonb)), 0) as qtd_insumos,
         s.updated_at as ultimo_uso
  from public.empresas e
  left join public.perfis p on p.empresa_id = e.id and p.papel = 'dono'
  left join public.app_state s on s.user_id = p.user_id;

-- ———————————————————————— RLS ————————————————————————
alter table public.empresas enable row level security;
alter table public.empresa_socios enable row level security;
alter table public.perfis enable row level security;
alter table public.admin_emails enable row level security;
alter table public.catalogo_base enable row level security;
alter table public.catalogo_precos_historico enable row level security;
alter table public.catalogo_analises enable row level security;
alter table public.catalogo_sugestoes_preco enable row level security;
alter table public.canais_padrao enable row level security;
alter table public.categorias_restaurante enable row level security;
alter table public.fila_revisao_insumos enable row level security;
alter table public.cadastros_em_andamento enable row level security;
alter table public.rate_limits enable row level security;
alter table public.cnpj_cache enable row level security;
alter table public.app_state enable row level security;

-- helper: cria a policy só se ainda não existir
create or replace function public._policy(p_nome text, p_tabela text, p_sql text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = p_tabela and policyname = p_nome) then
    execute p_sql;
  end if;
end $$;

select public._policy('empresas_select', 'empresas',
  $p$ create policy empresas_select on public.empresas for select to authenticated
      using ((select public.is_admin()) or id = (select empresa_id from public.perfis where user_id = auth.uid())) $p$);
select public._policy('empresas_update', 'empresas',
  $p$ create policy empresas_update on public.empresas for update to authenticated
      using ((select public.is_admin()) or id = (select empresa_id from public.perfis where user_id = auth.uid()))
      with check ((select public.is_admin()) or id = (select empresa_id from public.perfis where user_id = auth.uid())) $p$);
revoke update on public.empresas from authenticated;
grant update (nome_fantasia, logo_url, categorias, bairro, cidade, uf, endereco, ultimo_acesso) on public.empresas to authenticated;

select public._policy('empresa_socios_admin', 'empresa_socios',
  $p$ create policy empresa_socios_admin on public.empresa_socios for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);

select public._policy('perfis_select', 'perfis',
  $p$ create policy perfis_select on public.perfis for select to authenticated
      using (user_id = auth.uid() or (select public.is_admin())) $p$);
select public._policy('perfis_update', 'perfis',
  $p$ create policy perfis_update on public.perfis for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid()) $p$);
revoke update on public.perfis from authenticated;
grant update (nome, aceite_termos_em, termos_versao, aceite_ip) on public.perfis to authenticated;

select public._policy('admin_emails_admin', 'admin_emails',
  $p$ create policy admin_emails_admin on public.admin_emails for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);

select public._policy('catalogo_select', 'catalogo_base',
  $p$ create policy catalogo_select on public.catalogo_base for select to authenticated using (true) $p$);
select public._policy('catalogo_admin', 'catalogo_base',
  $p$ create policy catalogo_admin on public.catalogo_base for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);

select public._policy('catalogo_hist_admin', 'catalogo_precos_historico',
  $p$ create policy catalogo_hist_admin on public.catalogo_precos_historico for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);
select public._policy('catalogo_analises_admin', 'catalogo_analises',
  $p$ create policy catalogo_analises_admin on public.catalogo_analises for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);
select public._policy('catalogo_sugestoes_admin', 'catalogo_sugestoes_preco',
  $p$ create policy catalogo_sugestoes_admin on public.catalogo_sugestoes_preco for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);

-- canais e categorias: leitura pública (o cadastro é anônimo), escrita só admin
select public._policy('canais_padrao_select', 'canais_padrao',
  $p$ create policy canais_padrao_select on public.canais_padrao for select to anon, authenticated using (ativo) $p$);
select public._policy('canais_padrao_admin', 'canais_padrao',
  $p$ create policy canais_padrao_admin on public.canais_padrao for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);
select public._policy('categorias_select', 'categorias_restaurante',
  $p$ create policy categorias_select on public.categorias_restaurante for select to anon, authenticated using (ativo) $p$);
select public._policy('categorias_admin', 'categorias_restaurante',
  $p$ create policy categorias_admin on public.categorias_restaurante for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);

select public._policy('fila_revisao_admin', 'fila_revisao_insumos',
  $p$ create policy fila_revisao_admin on public.fila_revisao_insumos for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin())) $p$);

-- cadastros_em_andamento, rate_limits, cnpj_cache: sem policy → só service_role (functions)

-- app_state: garante as policies do próprio usuário (se já existirem com outro nome, só somam) + leitura admin
select public._policy('app_state_own_select', 'app_state',
  $p$ create policy app_state_own_select on public.app_state for select to authenticated using (user_id = auth.uid()) $p$);
select public._policy('app_state_own_insert', 'app_state',
  $p$ create policy app_state_own_insert on public.app_state for insert to authenticated with check (user_id = auth.uid()) $p$);
select public._policy('app_state_own_update', 'app_state',
  $p$ create policy app_state_own_update on public.app_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid()) $p$);
select public._policy('app_state_admin_select', 'app_state',
  $p$ create policy app_state_admin_select on public.app_state for select to authenticated using ((select public.is_admin())) $p$);

drop function public._policy(text, text, text);

-- ———————————————————————— seeds: canais e categorias ————————————————————————
insert into public.canais_padrao (nome, comissao_pct, taxa_pagamento_pct, outras_taxas_pct, embalagem_padrao, ordem) values
  ('Salão',     0,  3.5, 0, 0,    10),
  ('Balcão',    0,  3.5, 0, 0,    20),
  ('WhatsApp',  0,  3.5, 0, 2.5,  30),
  ('iFood',    23,  3.2, 0, 2.5,  40),
  ('99Food',   15,  3.0, 0, 2.5,  50),
  ('Rappi',    22,  3.0, 0, 2.5,  60)
on conflict (nome) do nothing;

insert into public.categorias_restaurante (nome, slug, ordem, exemplos_pratos) values
  ('Sushi e japonesa',          'japonesa',      10, '{"Combinado 20 peças","Temaki de salmão","Hot roll"}'),
  ('Carnes e churrascaria',     'churrascaria',  20, '{"Picanha na brasa","Fraldinha","Espeto misto"}'),
  ('Quentinhas e marmitas',     'marmitas',      30, '{"Marmita de frango grelhado","Marmita de carne de panela"}'),
  ('Hamburgueria',              'hamburgueria',  40, '{"Cheeseburger 150g","Smash duplo","Batata frita"}'),
  ('Pizzaria',                  'pizzaria',      50, '{"Pizza de calabresa","Pizza marguerita","Pizza portuguesa"}'),
  ('Comida brasileira',         'brasileira',    60, '{"Feijoada","Prato feito","Moqueca"}'),
  ('Massas e italiana',         'italiana',      70, '{"Lasanha à bolonhesa","Espaguete carbonara","Nhoque"}'),
  ('Frutos do mar',             'frutos-do-mar', 80, '{"Camarão ao alho e óleo","Moqueca de peixe","Risoto de camarão"}'),
  ('Lanches e salgados',        'lanches',       90, '{"Coxinha","Misto quente","Pastel"}'),
  ('Açaí e sorvetes',           'acai',         100, '{"Açaí 500ml","Milkshake","Casquinha"}'),
  ('Doces e confeitaria',       'confeitaria',  110, '{"Bolo de pote","Brigadeiro gourmet","Brownie"}'),
  ('Padaria e café',            'padaria',      120, '{"Pão na chapa","Café com leite","Croissant"}'),
  ('Comida saudável e fit',     'fit',          130, '{"Bowl de frango com quinoa","Salada caesar","Wrap integral"}'),
  ('Árabe',                     'arabe',        140, '{"Esfiha de carne","Kibe","Shawarma"}'),
  ('Mexicana',                  'mexicana',     150, '{"Burrito","Tacos","Nachos"}'),
  ('Chinesa',                   'chinesa',      160, '{"Yakisoba","Frango xadrez","Rolinho primavera"}'),
  ('Vegetariana e vegana',      'vegetariana',  170, '{"Hambúrguer de grão-de-bico","Bowl de legumes","Lasanha de berinjela"}'),
  ('Petiscos e bar',            'bar',          180, '{"Porção de batata","Bolinho de bacalhau","Isca de frango"}'),
  ('Pastelaria',                'pastelaria',   190, '{"Pastel de carne","Pastel de queijo","Caldo de cana"}'),
  ('Self service',              'self-service', 200, '{"Buffet por quilo","Prato executivo"}')
on conflict (slug) do nothing;
