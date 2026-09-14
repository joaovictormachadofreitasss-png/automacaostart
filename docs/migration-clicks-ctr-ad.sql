-- ══════════════════════════════════════════════════════════════
-- Adiciona cliques totais, CTR e CPC nativos do Meta em
-- meta_insights_ad — pra que o "Ranking de Criativos" bata com o
-- Ads Manager (hoje só grava "cliques no link", não dá pra calcular
-- CTR/CPC do jeito que o Meta calcula por padrão).
-- ══════════════════════════════════════════════════════════════
--
-- Rodar UMA VEZ no SQL Editor do Supabase. Aditivo — não apaga nem
-- altera nenhuma coluna existente, só adiciona 3 novas (todas
-- opcionais, com default null, então não quebra nenhum insert antigo).
--
-- Depois de rodar isso, é preciso ATUALIZAR scripts/sync-meta.js pra
-- incluir "clicks,ctr,cpc" em FIELDS_AD e gravar essas colunas em
-- actionsToAdRow() — só peça pro Claude fazer essa parte depois de
-- rodar esse SQL (fazer antes quebra o sync por criativo inteiro,
-- igual aconteceu com adset_id/campaign_name antes dessa coluna
-- existir — ver comentário em sync-meta.js linhas 53-58).

alter table meta_insights_ad
  add column if not exists clicks integer,
  add column if not exists ctr    numeric,
  add column if not exists cpc    numeric;
