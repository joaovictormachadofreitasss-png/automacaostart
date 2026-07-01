// Reconciliação de segurança: roda no GitHub Actions de hora em hora e garante que
// nenhuma venda seja perdida caso o webhook (api/webhook-hotmart.js) falhe por algum motivo
// (Hotmart fora do ar, erro de rede, etc). O webhook cobre o tempo real; este script é o backup.
// Réplica em Node do sync-vendas.ps1 original, com os 2 bugs já corrigidos:
//   - Chamada SEM start_date/end_date usa indice desatualizado da Hotmart (perde vendas recentes)
//     -> sempre usar janela explicita (ultimos 120 dias ate agora).
//   - Campo de rastreio (SCK) e purchase.tracking.source, NAO tracking.source_sck.

const HOTMART_BASIC = process.env.HOTMART_BASIC;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

// Nota: ao contrário do PowerShell (Invoke-RestMethod decodifica errado como ISO-8859-1),
// o fetch nativo do Node já entrega strings UTF-8 corretas — não precisa de correção aqui.
function fixUtf8(s) {
  return s;
}

async function main() {
  if (!HOTMART_BASIC || !SUPABASE_URL || !SUPABASE_SECRET) {
    console.error('Faltam variaveis de ambiente (HOTMART_BASIC / SUPABASE_URL / SUPABASE_SECRET).');
    process.exit(1);
  }

  console.log('1/4 Autenticando na Hotmart...');
  const tokenResp = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials', {
    method: 'POST',
    headers: { Authorization: HOTMART_BASIC },
  }).then(r => r.json());
  const token = tokenResp.access_token;
  if (!token) throw new Error('Falha ao autenticar na Hotmart: ' + JSON.stringify(tokenResp));

  console.log('2/4 Puxando vendas (paginado, ultimos 120 dias)...');
  const startDate = Date.now() - 120 * 24 * 60 * 60 * 1000;
  const endDate = Date.now() + 5 * 60 * 1000;
  let items = [];
  let pageToken = null;
  do {
    let url = `https://developers.hotmart.com/payments/api/v1/sales/history?max_results=100&start_date=${startDate}&end_date=${endDate}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (resp.items) items = items.concat(resp.items);
    pageToken = resp.page_info?.next_page_token || null;
  } while (pageToken);
  console.log(`   ${items.length} transacoes encontradas.`);

  console.log('3/4 Preparando dados...');
  const rows = items.map(it => {
    const tx = it.purchase.transaction;
    const base = tx.replace(/C\d+$/, '');
    const matchBump = tx.match(/C(\d+)$/);
    const isBump = matchBump ? parseInt(matchBump[1], 10) >= 2 : false;
    const orderDate = it.purchase.order_date ? new Date(it.purchase.order_date).toISOString() : null;
    const apprDate = it.purchase.approved_date ? new Date(it.purchase.approved_date).toISOString() : null;
    const sck = it.purchase.tracking?.source || it.tracking?.source || null;
    const netValue = it.purchase.hotmart_fee?.total != null
      ? Math.round((it.purchase.price.value - it.purchase.hotmart_fee.total) * 100) / 100
      : null;
    return {
      transaction: tx,
      base_transaction: base,
      is_order_bump: isBump,
      product_name: fixUtf8(it.product.name),
      product_id: it.product.id,
      offer_code: it.purchase.offer?.code ?? null,
      value: it.purchase.price.value,
      net_value: netValue,
      currency: it.purchase.price.currency_code,
      status: it.purchase.status,
      order_date: orderDate,
      approved_date: apprDate,
      payment_method: it.purchase.payment?.method ?? null,
      installments: it.purchase.payment?.installments_number ?? null,
      recurrency_number: it.purchase.recurrency_number ?? null,
      sck: sck,
      buyer_name: fixUtf8(it.buyer?.name) ?? null,
      buyer_email: it.buyer?.email ?? null,
      buyer_ucode: it.buyer?.ucode ?? null,
      synced_at: new Date().toISOString(),
    };
  });

  console.log('4/4 Gravando no Supabase (upsert)...');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/vendas?on_conflict=transaction`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET,
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!r.ok) {
    console.error('FALHOU ao gravar no Supabase:', await r.text());
    process.exit(1);
  }
  console.log(`PRONTO! ${rows.length} vendas sincronizadas com o Supabase.`);
}

main().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
