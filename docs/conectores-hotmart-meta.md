# Conectores Hotmart e Meta Ads — como funcionam e como mexer

Documento de referência pra quando precisar reconfigurar um token expirado, mudar de conta,
ou entender por que um número no dashboard está diferente do esperado. Reflete o estado real
do código em `automacaostart-repo` — não é um plano, é o que está rodando.

## Visão geral

```
Hotmart  ──webhook (tempo real)──▶  api/webhook-hotmart.js  ──▶  Supabase.vendas
         ──sync de hora em hora──▶  scripts/sync-vendas.js  ──▶  Supabase.vendas   (backup do webhook)

Meta Ads ──sync a cada 15 min────▶  scripts/sync-meta.js    ──▶  Supabase.meta_insights
                                                             ──▶  Supabase.meta_insights_ad

vendas.html / dashboard.html ──lê tudo direto do Supabase via REST (fetch no browser)
```

Os dois syncs (`sync-vendas.js`, `sync-meta.js`) rodam como **GitHub Actions**, não mais em
tarefa agendada do Windows — não dependem do seu PC estar ligado. Ver
`.github/workflows/sync-vendas.yml` e `.github/workflows/sync-meta.yml`.

## 1. Hotmart

### Webhook (tempo real) — `api/webhook-hotmart.js`

- Configurado no painel da Hotmart em **Ferramentas → Webhook**, apontando pra
  `https://automacaostart.vercel.app/api/webhook-hotmart`.
- A Hotmart manda um token (`hottok`) **dentro do corpo JSON**, não como header — isso é
  fixo, gerado por conta, não é algo que a gente escolhe.
- Eventos processados: `PURCHASE_APPROVED`, `PURCHASE_COMPLETE`, `PURCHASE_BILLET_PRINTED`,
  `PURCHASE_OUT_OF_SHOPPING_CART`. Qualquer outro evento é ignorado (200 OK, sem gravar).
- `PURCHASE_COMPLETE` (venda antiga cuja garantia de 7 dias venceu) só faz **PATCH do status** —
  nunca sobrescreve `value`, porque esse evento manda o preço sem os juros de parcelamento
  (já causou bug real: uma venda de R$1.194 virou R$997 num sync antigo).
- Notificação no Telegram só dispara em `PURCHASE_APPROVED` — `PURCHASE_COMPLETE` geraria
  alarme falso de "venda nova" pra uma venda de dias atrás.
- Identifica order bump pelo sufixo da transação (`C2`, `C3`... ao final do código = bump;
  sem sufixo ou `C1` = produto principal).

**Variáveis de ambiente (Vercel → Settings → Environment Variables, não GitHub):**
`SUPABASE_URL`, `SUPABASE_SECRET`, `HOTMART_HOTTOK`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

### Sync de backup (hora em hora) — `scripts/sync-vendas.js`

- Roda via GitHub Actions (`.github/workflows/sync-vendas.yml`, cron `0 * * * *`) — é uma
  **rede de segurança**, não a via principal. Só importa se o webhook falhar (Hotmart fora
  do ar, erro de rede, deploy no meio de uma venda).
- Puxa os últimos 120 dias via `sales/history` da API da Hotmart — **sempre com
  `start_date`/`end_date` explícitos**, porque sem isso a Hotmart usa um índice desatualizado
  e perde vendas recentes (bug já corrigido).
- O campo de rastreio (SCK, usado pra ligar a venda à sessão do site) é
  `purchase.tracking.source` — **não** `tracking.source_sck`, que é um nome antigo/errado que
  já causou perda de atribuição.
- Autentica via `client_credentials` (Basic Auth) — token de curta duração, renovado a cada
  execução.

**Variáveis (GitHub → repo → Settings → Secrets and variables → Actions, não Vercel):**
`HOTMART_BASIC`, `SUPABASE_URL`, `SUPABASE_SECRET`.

### Reconfigurar (token expirado ou troca de conta)

1. Painel da Hotmart → gerar novas credenciais (Client ID/Secret) → montar o Basic Auth
   (`base64(client_id:client_secret)`) → atualizar o secret `HOTMART_BASIC` no GitHub.
2. Se o `hottok` do webhook mudar (só muda se você recriar o webhook), atualizar
   `HOTMART_HOTTOK` na Vercel e reconfigurar a URL no painel da Hotmart.
3. Testar: `gh workflow run sync-vendas.yml` (ou aba Actions no GitHub) e conferir o log.

## 2. Meta Ads

### Sync — `scripts/sync-meta.js`

- Roda via GitHub Actions a cada 15 min (`.github/workflows/sync-meta.yml`).
- Puxa métricas em dois níveis: conta inteira (`meta_insights`) e por criativo/anúncio
  (`meta_insights_ad`, filtrado pela campanha em `META_CAMPAIGN_ID` — hoje só cobre a
  campanha de baixo ticket ativa; **se lançar uma campanha nova, atualizar esse ID**).
- Duas chamadas separadas por sync: `date_preset=last_90d` (histórico) +
  `date_preset=today` (hoje isolado). Isso existe por causa de dois gotchas reais:
  - `date_preset=maximum` **zera** `purchase`/`initiate_checkout` — nunca usar.
  - Qualquer preset multi-dia (`last_90d` incluso) **não traz o dia corrente** — precisa da
    chamada extra com `date_preset=today`.
- Janela de atribuição usada nas chamadas ao Meta: `7d_click, 1d_view` (constante `ATTR` no
  script) — é a mesma janela que decide o que o **Meta** credita como conversão da campanha.
  Isso é diferente da "janela de atribuição" configurável em vendas.html → Configurações, que
  é sobre **nossa própria** atribuição sessão→venda via `sck`, não sobre o pixel do Meta.
- Upsert por `date` (agregado) e por `date + ad_id` (por criativo) — seguro rodar de novo,
  não duplica.

**Variáveis (GitHub Secrets, não Vercel):**
`META_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET`. Opcionais com default no código:
`META_ACT_ID` (default `act_409350247728910`), `META_CAMPAIGN_ID` (default
`120247157618930157`).

### Reconfigurar (token expirado ou troca de conta/campanha)

1. Gerar novo token de longa duração no [Meta for Developers](https://developers.facebook.com/)
   pro app conectado à conta de anúncios → atualizar o secret `META_TOKEN` no GitHub.
   ⚠️ Conforme registrado no projeto: o último token conectado (30/Jun) expira em
   **29/08/2026** — vale colocar um lembrete antes disso.
2. Trocou de conta de anúncios? Atualizar `META_ACT_ID`.
3. Lançou campanha nova de baixo ticket? Atualizar `META_CAMPAIGN_ID` (senão o Ranking de
   Criativos em vendas.html continua olhando só pra campanha antiga).
4. Testar: `gh workflow run sync-meta.yml` e conferir se `meta_insights`/`meta_insights_ad`
   receberam linhas novas no Supabase.

## 3. Erros comuns

| Sintoma | Causa provável |
|---|---|
| Venda não aparece no dashboard | Webhook falhou e o sync de backup ainda não rodou (até 1h de atraso) — checar Actions → sync-vendas |
| ROAS/gasto zerado num período recente | Sync do Meta atrasado (até 15 min) ou token expirado — checar Actions → sync-meta e a validade do token |
| Vendas com valor errado (ex: R$997 em vez de R$1.194) | Evento `PURCHASE_COMPLETE` sobrescrevendo `value` — não deveria mais acontecer (webhook já faz PATCH-only nesse caso), mas se aparecer, é sinal de regressão nessa lógica |
| Ranking de Criativos sem dados por criativo | `META_CAMPAIGN_ID` desatualizado (campanha nova) ou tabela `meta_insights_ad` sem sync ainda |
| "Faltam variáveis de ambiente" no log do Actions | Secret não configurado em GitHub → Settings → Secrets and variables → **Actions** (não confundir com env vars da Vercel, que são um sistema separado) |

## 4. O que esse setup NÃO cobre ainda

- Não existem `campaign_id`/`adset_id`/`creative_id` numéricos rastreados como colunas
  próprias — `meta_insights_ad` guarda `ad_id`/`ad_name`, e o "criativo" no dashboard é
  identificado pelo **nome do UTM** (`utm_content`), não por um ID formal do Meta. Ver
  `docs/schema-v2-ids-draft.sql` pra um desenho de como formalizar isso.
- Não há reconciliação automática entre "venda no Hotmart" e "purchase no pixel do Meta" —
  são contados por fontes diferentes e já divergiram (Meta contou compra que não existiu no
  Hotmart, ver análise da Campanha 3).
