-- ══════════════════════════════════════════════════════════════
-- RASCUNHO — schema v2 com IDs formais (visitor/session/event/product/
-- offer/page/page_version/campaign/adset/ad/creative/checkout/order)
-- ══════════════════════════════════════════════════════════════
--
-- ⚠️ NÃO EXECUTAR SEM REVISAR. Isto é um rascunho pra rodar manualmente no
-- SQL Editor do Supabase depois de ler com calma — nada no projeto executa
-- isso automaticamente.
--
-- DESENHO: ADITIVO. Não mexe nas tabelas atuais (vendas, events,
-- meta_insights, meta_insights_ad). As tabelas novas convivem com elas —
-- dá pra migrar aos poucos, sem quebrar vendas.html/dashboard.html, que
-- hoje leem as tabelas antigas direto via REST.
--
-- Por que aditivo, e não substituição de uma vez: o schema antigo está em
-- produção, lido ao vivo pelo dashboard. Trocar tudo de uma vez significa
-- reescrever vendas.html inteiro (2900+ linhas) antes de poder validar que
-- os números continuam batendo — risco alto sem necessidade.

create extension if not exists pgcrypto; -- Supabase já vem com isso habilitado, mas garante

-- ══════════════════════════════════════════════════════════════
-- DIMENSÕES
-- ══════════════════════════════════════════════════════════════

-- Pessoa anônima entre sessões. Hoje NÃO existe esse conceito — cada sck
-- (session) é isolada, sem religar "essa pessoa voltou 3 dias depois" via
-- cookie de longa duração. Essa tabela só passa a ter dado real se o
-- tracker (script em renda-extra.html/index.html/controle-ar-tv.html) for
-- alterado pra gravar um cookie de visitante — não existe hoje.
create table if not exists visitors (
  visitor_id   uuid primary key default gen_random_uuid(),
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create table if not exists pages (
  page_id      text primary key,        -- slug estável, mesmo valor da chave em PAGINAS (vendas.html)
  url_path     text not null,
  nome         text not null,
  ativa        boolean not null default true
);
insert into pages (page_id, url_path, nome) values
  ('renda-extra',    'renda-extra.html',    'Renda Extra'),
  ('index',          'index.html',          'Sua Primeira Automação'),
  ('controle-ar-tv', 'controle-ar-tv.html', 'Controle AR/TV (teste)')
on conflict (page_id) do nothing;

-- Cada mudança relevante de copy/headline numa página, pra comparar
-- conversão ANTES/DEPOIS sem depender de git log. Preenchimento é manual —
-- não existe hook automático de deploy gravando isso.
create table if not exists page_versions (
  page_version_id uuid primary key default gen_random_uuid(),
  page_id         text not null references pages(page_id),
  descricao       text not null,          -- ex: 'headline GARANTA SUA RENDA EXTRA (16-29/07)'
  vigente_desde   timestamptz not null,
  vigente_ate     timestamptz              -- null = versão atual
);

create table if not exists products (
  product_id   bigint primary key,        -- mesmo ID da Hotmart, já usado em vendas.product_id
  nome         text not null,
  categoria    text not null,             -- 'low' | 'bump' | 'cip' | 'outro'
  emoji        text
);
insert into products (product_id, nome, categoria, emoji) values
  (7267410, 'Automação Start',      'low',  '🚀'),
  (7839946, '7 Boas Práticas',      'bump', '📘'),
  (7915838, 'Universo de Soluções', 'bump', '🌐'),
  (7862000, 'Instalando seu primeiro interruptor inteligente do zero', 'bump', '💡'),
  (4401736, 'Renovações CIP',       'cip',  '🔄'),
  (2298674, 'CIP Completo',         'cip',  '👑')
on conflict (product_id) do nothing;

create table if not exists offers (
  offer_id     text primary key,          -- offer_code da Hotmart (purchase.offer.code)
  product_id   bigint not null references products(product_id),
  descricao    text,
  preco        numeric(10,2)
);

-- Estrutura de anúncio do Meta. Hoje só ad_id/ad_name são reais (sincronizados
-- por scripts/sync-meta.js → meta_insights_ad). campaign_id/adset_id formais
-- NÃO são gravados ainda — essas tabelas ficam prontas pra quando isso for
-- adicionado ao sync; até lá, o dashboard atual não depende delas.
create table if not exists campaigns (
  campaign_id  text primary key,
  nome         text
);
create table if not exists adsets (
  adset_id     text primary key,
  campaign_id  text references campaigns(campaign_id),
  nome         text
);
create table if not exists ads (
  ad_id        text primary key,          -- já existe de verdade em meta_insights_ad.ad_id
  adset_id     text references adsets(adset_id),
  nome         text
);
create table if not exists creatives (
  creative_id  uuid primary key default gen_random_uuid(),
  ad_id        text references ads(ad_id),
  utm_content  text not null,             -- valor bruto (formato "AD_NOME|id_do_anuncio")
  nome         text not null              -- nome legível — o que nomeCriativo() extrai hoje em vendas.html
);

-- ══════════════════════════════════════════════════════════════
-- SESSÃO / COMPORTAMENTO
-- ══════════════════════════════════════════════════════════════

-- ID formal por cima da tabela `events` existente — não duplica dado, só
-- dá nome/tipo estável pro que já existe (session_id = sck/events.session).
create table if not exists sessions (
  session_id   text primary key,
  visitor_id   uuid references visitors(visitor_id),   -- fica null até existir cookie de visitante
  page_id      text references pages(page_id),
  utm_source   text,
  utm_medium   text,
  utm_content  text,
  device       text,
  created_at   timestamptz not null
);

create table if not exists session_events (
  event_id     uuid primary key default gen_random_uuid(),
  session_id   text not null references sessions(session_id),
  event_type   text not null,             -- 'pageview' | 'scroll' | 'cta_click' | 'tempo_pagina'
  value        text,
  created_at   timestamptz not null
);

-- ══════════════════════════════════════════════════════════════
-- FUNIL DE COMPRA / TRANSACIONAL
-- ══════════════════════════════════════════════════════════════

-- Checkout iniciado COM sessão conhecida. Hoje o dashboard só enxerga
-- "iniciou checkout" de forma agregada via pixel do Meta (sem ligação
-- individual por sessão — ver aviso em vendas.html área Tráfego). Essa
-- tabela é o que fecharia esse gap, mas exige instrumentação nova (um
-- evento disparado antes do redirect pro checkout da Hotmart) que não
-- existe no tracker atual — fica pronta pra quando isso for construído.
create table if not exists checkouts (
  checkout_id  uuid primary key default gen_random_uuid(),
  session_id   text references sessions(session_id),
  product_id   bigint references products(product_id),
  offer_id     text references offers(offer_id),
  initiated_at timestamptz not null
);

-- View com IDs formais por cima de `vendas` — evita duplicar os ~20 campos
-- que api/webhook-hotmart.js já grava corretamente; só acrescenta os IDs.
create or replace view orders_v2 as
select
  v.transaction        as order_id,
  v.base_transaction,
  v.is_order_bump,
  v.product_id,
  v.offer_code         as offer_id,
  s.session_id,
  s.visitor_id,
  v.value, v.net_value, v.currency, v.status,
  v.order_date, v.approved_date,
  v.sck
from vendas v
left join sessions s on s.session_id = v.sck;

-- ══════════════════════════════════════════════════════════════
-- COMO MIGRAR AOS POUCOS (sem quebrar o que já roda em produção)
-- ══════════════════════════════════════════════════════════════
-- 1. Rodar este arquivo inteiro (só cria tabelas/view novas).
--
-- 2. Popular `sessions` a partir do `events` existente:
--
--      insert into sessions (session_id, utm_source, utm_medium, utm_content, device, created_at)
--      select distinct on (session)
--        session, utm_source, utm_medium, utm_content, device, created_at
--      from events where event = 'pageview'
--      order by session, created_at asc
--      on conflict (session_id) do nothing;
--
--    Propositalmente deixei `page_id` de fora desse insert: preenchê-lo
--    direito exige reimplementar a lógica de paginaDeUrl() (vendas.html) —
--    "qual página essa URL de pageview representa" — em SQL, e prefiro não
--    reescrever essa lógica duas vezes (JS + SQL) sem revisar com você
--    onde as duas podem divergir. Dá pra fazer um UPDATE separado depois
--    usando CASE/LIKE espelhando exatamente paginaDeUrl().
--
-- 3. Só depois de 2 confirmado (contagem de sessions bate com a contagem
--    de sessões únicas que vendas.html já mostra), considerar migrar
--    vendas.html pra ler de `orders_v2`/`sessions` em vez de
--    `vendas`/`events` direto. Isso é reescrita grande — fazer só depois
--    de validar que os números novos batem exatamente com os atuais.
--
-- 4. campaigns/adsets/ads/creatives ficam vazias até scripts/sync-meta.js
--    passar a gravar campaign_id/adset_id de verdade (mudança nesse
--    script, fora do escopo deste arquivo SQL).
