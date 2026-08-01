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

-- Popula o catálogo com a lista completa (não só o essencial — inclui tudo que
-- entrou na pesquisa original, do mais barato ao mais caro). Preço/prioridade
-- ficam salvos no banco pra referência interna, mas não aparecem pro convidado.
insert into cha_panela_itens (nome, faixa_preco, prioridade, ordem) values
('Fogão', 'R$ 250 – 500', 'alta', 1),
('Geladeira', 'R$ 600 – 1.200', 'alta', 2),
('Jogo de panelas antiaderente', 'R$ 150 – 400', 'alta', 3),
('Panela de pressão', 'R$ 90 – 220', 'alta', 4),
('Aparelho de jantar (pratos)', 'R$ 100 – 300', 'alta', 5),
('Jogo de copos', 'R$ 30 – 90', 'alta', 6),
('Talheres', 'R$ 60 – 200', 'alta', 7),
('Canecas', 'R$ 30 – 80', 'alta', 8),
('Faca de cozinha (chef + pão)', 'R$ 60 – 250', 'alta', 9),
('Tábua de corte', 'R$ 30 – 90', 'alta', 10),
('Kit utensílios de preparo', 'R$ 40 – 120', 'alta', 11),
('Escorredor de louça', 'R$ 25 – 130', 'alta', 12),
('Lixeira com pedal', 'R$ 60 – 180', 'alta', 13),
('Kit têxtil de cozinha (panos, luva térmica, pegador)', 'R$ 30 – 80', 'alta', 14),
('Bacia de lavar louça + esponjeira', 'R$ 20 – 50', 'alta', 15),
('Jarra filtrante de água', 'R$ 90 – 180', 'alta', 16),
('Gelágua (purificador elétrico)', 'R$ 300 – 900', 'alta', 17),
('Micro-ondas', 'R$ 350 – 750', 'media', 18),
('Potes herméticos organizadores', 'R$ 40 – 150', 'media', 19),
('Forma de bolo + assadeira', 'R$ 30 – 90', 'media', 20),
('Garrafa térmica', 'R$ 50 – 150', 'media', 21),
('Liquidificador', 'R$ 100 – 250', 'media', 22),
('Kit utilitários (abridor, saca-rolhas, descascador, ralador)', 'R$ 40 – 100', 'media', 23),
('Frigideira antiaderente', 'R$ 40 – 120', 'baixa', 24),
('Jarra de água comum', 'R$ 20 – 60', 'baixa', 25),
('Porta-temperos', 'R$ 20 – 60', 'baixa', 26),
('Cafeteira elétrica', 'R$ 80 – 200', 'baixa', 27),
('Air fryer', 'R$ 250 – 500', 'baixa', 28)
on conflict do nothing;
