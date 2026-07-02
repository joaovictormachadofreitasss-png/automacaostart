// Webhook da Hotmart — recebe aviso INSTANTÂNEO de venda (PURCHASE_APPROVED, PURCHASE_COMPLETE, etc.)
// e grava direto no Supabase. Elimina a necessidade de rodar sync-vendas.ps1 na sua máquina.
//
// Configurar no painel da Hotmart: Ferramentas > Webhook > colar a URL deste endpoint
// (https://SEU-DOMINIO.vercel.app/api/webhook-hotmart) e o token (HOTTOK) gerado lá.
//
// Variáveis de ambiente necessárias na Vercel (Settings > Environment Variables):
//   SUPABASE_URL       = https://drdodqhxecflgjrdxovs.supabase.co
//   SUPABASE_SECRET    = chave service_role do Supabase (NUNCA a publishable)
//   HOTMART_HOTTOK     = token de validação do webhook, copiado do painel da Hotmart
//   TELEGRAM_BOT_TOKEN = token do bot gerado pelo @BotFather
//   TELEGRAM_CHAT_ID   = seu chat id pessoal (achar via getUpdates)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function notificarTelegram(row) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const emoji = row.is_order_bump ? '🎁' : '💰';
  const tipo = row.is_order_bump ? 'Order bump' : 'Venda';
  const linhas = [
    `${emoji} *${tipo} aprovada!*`,
    ``,
    `📦 ${row.product_name}`,
    `👤 ${row.buyer_name || 'sem nome'}`,
    `💵 R$ ${row.value} (bruto)${row.net_value != null ? ` · líquido ~R$ ${row.net_value}` : ''}`,
    `💳 ${row.payment_method || '—'}${row.installments && row.installments > 1 ? ` ${row.installments}x` : ''}`,
  ];
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: linhas.join('\n'),
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    // Notificação é best-effort — nunca deve derrubar o webhook principal.
    console.log('Falha ao notificar Telegram:', e.message);
  }
}

// Nota: o body do webhook já chega como JSON UTF-8 corretamente decodificado pelo Node/Vercel
// (diferente do PowerShell, que tinha um bug de decodificação ISO-8859-1) — sem correção necessária.
function fixUtf8(s) {
  return s;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // Validação do token do webhook. IMPORTANTE: a Hotmart NAO manda isso como header —
  // manda como campo "hottok" na raiz do corpo JSON. O valor e fixo, gerado pela Hotmart
  // por conta (nao e algo que a gente escolhe) — copiar exatamente o que veio no teste
  // e colocar na env var HOTMART_HOTTOK da Vercel.
  const hottok = req.body?.hottok || req.headers['x-hotmart-hottok'];
  if (HOTMART_HOTTOK && hottok !== HOTMART_HOTTOK) {
    res.status(401).json({ error: 'hottok invalido' });
    return;
  }

  const body = req.body || {};
  const evento = body.event || '';
  const d = body.data || {};
  const purchase = d.purchase || {};
  const product = d.product || {};
  const buyer = d.buyer || {};

  // Só processa eventos de compra (ignora outros tipos: assinatura cancelada, reembolso avulso, etc.
  // — esses continuam cobertos pelo sync periódico de reconciliação).
  const eventosVenda = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_BILLET_PRINTED', 'PURCHASE_OUT_OF_SHOPPING_CART'];
  if (!eventosVenda.includes(evento)) {
    res.status(200).json({ ok: true, ignorado: evento });
    return;
  }

  const tx = purchase.transaction;
  if (!tx) {
    res.status(400).json({ error: 'sem transaction no payload' });
    return;
  }

  const base = tx.replace(/C\d+$/, '');
  const matchBump = tx.match(/C(\d+)$/);
  const isBump = matchBump ? parseInt(matchBump[1], 10) >= 2 : false;

  const orderDate = purchase.order_date ? new Date(purchase.order_date).toISOString() : null;
  const apprDate = purchase.approved_date ? new Date(purchase.approved_date).toISOString() : null;

  const sck = purchase.tracking?.source || d.tracking?.source || null;

  const netValue = purchase.hotmart_fee?.total != null
    ? Math.round((purchase.price?.value - purchase.hotmart_fee.total) * 100) / 100
    : null;

  // Normaliza o status: o webhook manda "COMPLETED", mas a sales/history (e o dashboard)
  // usam "COMPLETE". Sem isso a venda some da contagem do dashboard quando a garantia vence.
  let status = purchase.status ?? null;
  if (status === 'COMPLETED') status = 'COMPLETE';

  const row = {
    transaction: tx,
    base_transaction: base,
    is_order_bump: isBump,
    product_name: fixUtf8(product.name),
    product_id: product.id,
    offer_code: purchase.offer?.code ?? null,
    value: purchase.price?.value ?? null,
    net_value: netValue,
    currency: purchase.price?.currency_code ?? null,
    status: status,
    order_date: orderDate,
    approved_date: apprDate,
    payment_method: purchase.payment?.method ?? null,
    installments: purchase.payment?.installments_number ?? null,
    recurrency_number: purchase.recurrency_number ?? null,
    sck: sck,
    buyer_name: fixUtf8(buyer.name) ?? null,
    buyer_email: buyer.email ?? null,
    buyer_ucode: buyer.ucode ?? null,
    synced_at: new Date().toISOString(),
  };

  try {
    // ⚠️ PURCHASE_COMPLETE (garantia vencendo, venda antiga) manda price.value SEM os juros
    // de parcelamento — upsert completo sobrescreveria o valor real da sales/history
    // (ex: CIP R$1.194 virou R$997 em 02/Jul). Nesses eventos, atualiza SÓ o status.
    let r;
    if (evento === 'PURCHASE_COMPLETE') {
      r = await fetch(`${SUPABASE_URL}/rest/v1/vendas?transaction=eq.${encodeURIComponent(tx)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SECRET,
          Authorization: `Bearer ${SUPABASE_SECRET}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: status, synced_at: row.synced_at }),
      });
    } else {
      r = await fetch(`${SUPABASE_URL}/rest/v1/vendas?on_conflict=transaction`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SECRET,
          Authorization: `Bearer ${SUPABASE_SECRET}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([row]),
      });
    }
    if (!r.ok) {
      const errText = await r.text();
      res.status(502).json({ error: 'falha ao gravar no supabase', detalhe: errText });
      return;
    }

    // Notifica SÓ em venda nova (PURCHASE_APPROVED). PURCHASE_COMPLETE dispara quando a
    // garantia de 7 dias de uma venda ANTIGA vence — notificar nele gera alarme falso de
    // "venda nova" no Telegram (aconteceu em 02/Jul com vendas de 24/Jun).
    if (evento === 'PURCHASE_APPROVED') {
      await notificarTelegram(row);
    }

    res.status(200).json({ ok: true, transaction: tx });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
