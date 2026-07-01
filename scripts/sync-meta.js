// Sincroniza métricas do Meta Ads (gasto, cliques, conversões) para o Supabase.
// Roda no GitHub Actions a cada 15 min (.github/workflows/sync-meta.yml) — não depende do seu PC.
// Réplica em Node do sync-meta.ps1 original, com o mesmo GOTCHA corrigido:
//   - last_90d (ou qualquer range multi-dia) NUNCA traz o dia corrente -> precisa de uma
//     chamada extra isolada com date_preset=today.
//   - date_preset=maximum CORTA as conversões (purchase/initiate_checkout zerados) -> nunca usar.

const META_TOKEN = process.env.META_TOKEN;
const ACT_ID = process.env.META_ACT_ID || 'act_409350247728910';
const API_VER = 'v25.0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

const FIELDS = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions';
const ATTR = encodeURIComponent('["7d_click","1d_view"]');

function actionsToRow(d) {
  const act = {};
  for (const a of d.actions || []) {
    if (a.action_type) act[a.action_type] = Math.trunc(parseFloat(a.value));
  }
  return {
    date: d.date_start,
    spend: parseFloat(d.spend) || 0,
    impressions: parseInt(d.impressions, 10) || 0,
    reach: parseInt(d.reach, 10) || 0,
    frequency: parseFloat(d.frequency) || 0,
    clicks: parseInt(d.clicks, 10) || 0,
    link_clicks: parseInt(d.inline_link_clicks, 10) || 0,
    ctr: parseFloat(d.ctr) || 0,
    cpc: parseFloat(d.cpc) || 0,
    cpm: parseFloat(d.cpm) || 0,
    landing_page_views: act.landing_page_view || 0,
    initiate_checkout: act.initiate_checkout || 0,
    purchases: act.purchase || 0,
    synced_at: new Date().toISOString(),
  };
}

async function fetchAll(url) {
  const rows = [];
  let next = url;
  while (next) {
    const resp = await fetch(next).then(r => r.json());
    if (resp.error) throw new Error(JSON.stringify(resp.error));
    for (const d of resp.data || []) rows.push(actionsToRow(d));
    next = resp.paging?.next || null;
  }
  return rows;
}

async function main() {
  if (!META_TOKEN || !SUPABASE_URL || !SUPABASE_SECRET) {
    console.error('Faltam variaveis de ambiente (META_TOKEN / SUPABASE_URL / SUPABASE_SECRET).');
    process.exit(1);
  }

  console.log('1/3 Puxando metricas do Meta (last_90d, dia a dia)...');
  const urlHistorico = `https://graph.facebook.com/${API_VER}/${ACT_ID}/insights?fields=${FIELDS}&time_increment=1&date_preset=last_90d&action_attribution_windows=${ATTR}&limit=500&access_token=${META_TOKEN}`;
  const rowsHistorico = await fetchAll(urlHistorico);

  console.log('2/3 Puxando gasto parcial de HOJE (date_preset=today, separado)...');
  const urlHoje = `https://graph.facebook.com/${API_VER}/${ACT_ID}/insights?fields=${FIELDS}&time_increment=1&date_preset=today&action_attribution_windows=${ATTR}&access_token=${META_TOKEN}`;
  const rowsHoje = await fetchAll(urlHoje);

  const rows = [...rowsHistorico, ...rowsHoje];
  console.log(`   ${rows.length} dias de metricas encontrados.`);
  if (rows.length === 0) {
    console.error('Nenhum dado retornado. Verifique o token (pode ter expirado).');
    process.exit(1);
  }

  console.log('3/3 Gravando no Supabase (upsert)...');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/meta_insights?on_conflict=date`, {
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
  console.log(`PRONTO! ${rows.length} dias de metricas sincronizados com o Supabase.`);
}

main().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
