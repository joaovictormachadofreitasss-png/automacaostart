-- ══════════════════════════════════════════════════════════════
-- Tabelas pra dashboard "Conteúdo C1" (rotina semanal de Reels do
-- método Distribuição Turbo — ver project-rotina-c1c2c3 na memória).
-- ══════════════════════════════════════════════════════════════
--
-- Rodar UMA VEZ no SQL Editor do Supabase.

create table if not exists conteudo_c1 (
  id              bigint generated always as identity primary key,
  semana_ref       date not null,        -- segunda-feira da semana a que pertence
  dia_publicacao   date,                 -- dia planejado/real de publicação
  headline         text not null,
  framework        text,                 -- 'atracao_funil' | 'formacao_direta' | 'isca_digital' | 'autoridade' | 'chamada_evento'
  gancho           text,                 -- 3-5s
  abertura         text,                 -- 10s "abrir a boca do funil"
  aprofundamento   text,                 -- 30s-1min
  cta              text,                 -- 10-20s
  tipo_c2          boolean not null default false,  -- também usado como C2 (remarketing)?
  status           text not null default 'ideia',   -- ideia | roteiro_pronto | gravado | editado | publicado
  link_instagram   text,
  publico          text,
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists provas_sociais_c3 (
  id          bigint generated always as identity primary key,
  descricao   text not null,
  data        date not null default current_date,
  usado       boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table conteudo_c1 enable row level security;
alter table provas_sociais_c3 enable row level security;

-- Interno, já protegido pela senha compartilhada do login.html — libera
-- leitura/escrita direta pra chave publishable, igual à tabela `events`.
drop policy if exists "conteudo_c1_anon_all" on conteudo_c1;
create policy "conteudo_c1_anon_all" on conteudo_c1
  for all using (true) with check (true);

drop policy if exists "provas_sociais_c3_anon_all" on provas_sociais_c3;
create policy "provas_sociais_c3_anon_all" on provas_sociais_c3
  for all using (true) with check (true);
