-- ══════════════════════════════════════════════════════════════
-- Adiciona conjunto de anúncios (adset) e campanha por linha de
-- meta_insights_ad — pedido do João pra mostrar "qual campanha,
-- conjunto e período" em cada card do Ranking de Criativos.
-- ══════════════════════════════════════════════════════════════
--
-- Rodar UMA VEZ no SQL Editor do Supabase. Aditivo — não apaga nem
-- altera nenhuma coluna existente, só adiciona 3 novas (todas
-- opcionais, com default null, então não quebra nenhum insert antigo).
--
-- Depois de rodar isso, o próximo sync do scripts/sync-meta.js (a cada
-- 15 min via GitHub Actions) já passa a preencher essas colunas
-- sozinho — não precisa fazer mais nada.

alter table meta_insights_ad
  add column if not exists adset_id      text,
  add column if not exists adset_name    text,
  add column if not exists campaign_name text;
