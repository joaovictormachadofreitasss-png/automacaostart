-- Adiciona a tabela de confirmação de presença — rode uma vez no SQL Editor do Supabase
-- (mesmo projeto já usado pelo resto do chá de panela)

create table if not exists cha_panela_rsvp (
  id bigint generated always as identity primary key,
  nome text not null,
  vai boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table cha_panela_rsvp enable row level security;

-- Convidados podem confirmar presença (inserir), mas não ver quem mais confirmou
drop policy if exists "insercao publica rsvp" on cha_panela_rsvp;
create policy "insercao publica rsvp" on cha_panela_rsvp
  for insert with check (true);

-- Leitura só via API server-side com a chave service_role (api/cha-panela-admin.js)
