// Alcance REAL (deduplicado) de um período do Meta Ads — sob demanda.
//
// Por que existe: "reach" não é somável entre dias. Se a mesma pessoa viu o anúncio na
// segunda e na quinta, ela conta 1x no alcance real da semana, mas contava 2x se a gente
// só somasse o alcance diário que já está sincronizado no Supabase (bug encontrado e
// reportado pelo João em 10/08/2026 — o "alcance 01-07" do vendas.html não batia com o
// Ads Manager). Só a própria Meta sabe deduplicar "pessoa única" dentro de um intervalo —
// por isso esse endpoint chama a API ao vivo com o intervalo exato pedido, sem
// time_increment, em vez de usar o dado diário já sincronizado.
//
// Uso (chamado pelo vendas.html): GET /api/meta-reach?since=2026-07-01&until=2026-07-07
// Resposta: { reach: 3594 }
//
// Variáveis de ambiente necessárias na Vercel (Settings > Environment Variables) — ADICIONAR,
// não existem ainda no projeto (só existiam como GitHub Actions secret pro sync-meta.js):
//   META_TOKEN   = mesmo token de longa duração usado no sync-meta.js/sync-meta.yml
//   META_ACT_ID  = act_409350247728910 (opcional — já tem esse valor como default abaixo)

const META_TOKEN = process.env.META_TOKEN;
// ID da conta de anúncio não é segredo (não é senha/token) — fixo direto aqui em vez de env var.
// Motivo: a env var META_ACT_ID na Vercel ficou presa com um valor duplicado
// ("act_409350247728910act_409350247728910") mesmo depois de reeditada 3x — provavelmente
// autofill do navegador ou cache do campo "Sensitive" reinserindo o valor velho antes do Save.
// Removendo a dependência da env var elimina esse ponto de falha de vez.
const ACT_ID = 'act_409350247728910';
const API_VER = 'v25.0';
const ATTR = encodeURIComponent('["7d_click","1d_view"]');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  if (!META_TOKEN) {
    res.status(500).json({ error: 'META_TOKEN não configurado nas env vars da Vercel' });
    return;
  }

  const { since, until } = req.query;
  if (!since || !until || !/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    res.status(400).json({ error: 'parâmetros since/until obrigatórios, formato YYYY-MM-DD' });
    return;
  }

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const url = `https://graph.facebook.com/${API_VER}/${ACT_ID}/insights?fields=reach&time_range=${timeRange}&action_attribution_windows=${ATTR}&access_token=${META_TOKEN}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) {
      res.status(502).json({ error: 'Meta API retornou erro', detalhe: j.error });
      return;
    }
    // Sem gasto/entrega no período, a Meta devolve data:[] em vez de um objeto com reach=0.
    const reach = j.data && j.data[0] ? parseInt(j.data[0].reach, 10) || 0 : 0;
    // Cacheia 10 min no edge da Vercel — o painel atualiza sozinho a cada 2min, sem cache isso
    // vira uma chamada nova à API do Meta por refresh; alcance de período fechado não muda
    // minuto a minuto, só o dia corrente (que de qualquer forma o front pula essa chamada, ver
    // vendas.html: período de 1 dia só usa o dado diário já sincronizado, exato por natureza).
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60');
    res.status(200).json({ reach });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
