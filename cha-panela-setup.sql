-- Setup do Chá de Panela / Aniversário — rode isso uma vez no SQL Editor do Supabase
-- Projeto: drdodqhxecflgjrdxovs (mesmo projeto do automacaostart)

create table if not exists cha_panela_itens (
  id bigint generated always as identity primary key,
  nome text not null,
  faixa_preco text not null,
  prioridade text not null default 'alta', -- 'alta' | 'media' | 'baixa'
  status text not null default 'disponivel', -- 'disponivel' | 'confirmado'
  confirmado_por text,
  ordem int not null default 0
);

create table if not exists cha_panela_interesses (
  id bigint generated always as identity primary key,
  item_id bigint references cha_panela_itens(id),
  nome_convidado text not null default 'Não informado',
  criado_em timestamptz not null default now()
);

alter table cha_panela_itens enable row level security;
alter table cha_panela_interesses enable row level security;

-- Convidados podem LER a lista de itens (pra ver o que já foi dado)
drop policy if exists "leitura publica itens" on cha_panela_itens;
create policy "leitura publica itens" on cha_panela_itens
  for select using (true);

-- Convidados podem REGISTRAR interesse (mas não ler quem mais registrou, nem alterar status)
drop policy if exists "insercao publica interesses" on cha_panela_interesses;
create policy "insercao publica interesses" on cha_panela_interesses
  for insert with check (true);

-- Ninguém (nem via anon key) pode alterar/apagar itens ou ler interesses direto —
-- isso só acontece via API server-side com a chave service_role (api/cha-panela-admin.js)

-- Popula o catálogo (Prioridade 1 = alta, Intermediário = media, Baixa/depois = baixa)
insert into cha_panela_itens (nome, faixa_preco, prioridade, ordem) values
('Fogão (usado)', 'R$ 250 – 500', 'alta', 1),
('Geladeira (usada)', 'R$ 600 – 1.200', 'alta', 2),
('Jogo de panelas antiaderente', 'R$ 150 – 400', 'alta', 3),
('Jogo de copos', 'R$ 30 – 90', 'alta', 4),
('Talheres (faqueiro inox)', 'R$ 60 – 200', 'alta', 5),
('Tábua de corte', 'R$ 30 – 90', 'alta', 6),
('Kit utensílios de preparo', 'R$ 40 – 120', 'alta', 7),
('Escorredor de louça', 'R$ 25 – 130', 'alta', 8),
('Lixeira com pedal', 'R$ 60 – 180', 'alta', 9),
('Gelágua (purificador elétrico)', 'R$ 300 – 900', 'alta', 10),
('Micro-ondas', 'R$ 350 – 750', 'media', 11),
('Kit utilitários (abridor, saca-rolhas, descascador, ralador)', 'R$ 40 – 100', 'baixa', 12),
('Cafeteira elétrica', 'R$ 80 – 200', 'baixa', 13)
on conflict do nothing;
