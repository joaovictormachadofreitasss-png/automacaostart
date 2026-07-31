// Webhook do Formulário "Diagnóstico de Aceleração" — recebe cada resposta em tempo real
// (via Apps Script preso ao Google Forms) e grava no Supabase pra alimentar a dashboard.
//
// Configurar no Apps Script do formulário: gatilho "Ao enviar formulário" chamando uma função
// que faz POST pra este endpoint (https://SEU-DOMINIO.vercel.app/api/webhook-diagnostico)
// com o token de validação.
//
// Variáveis de ambiente necessárias na Vercel (Settings > Environment Variables):
//   SUPABASE_URL         = https://drdodqhxecflgjrdxovs.supabase.co
//   SUPABASE_SECRET       = chave service_role do Supabase (NUNCA a publishable)
//   DIAGNOSTICO_TOKEN     = token de validação (fixo, você escolhe, cola igual no Apps Script)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const DIAGNOSTICO_TOKEN = process.env.DIAGNOSTICO_TOKEN;

const PRODUTO_FIXO = 'Sua Primeira Automação (R$17)';

// Classe proxy: combina plano de saúde + última viagem internacional como sinal de renda,
// já que o formulário não pergunta renda diretamente (pergunta direta gera resistência/mentira).
function classeProxy(planoSaude, ultimaViagem) {
  const viajouRecente = ultimaViagem === 'Nos últimos 12 meses' || ultimaViagem === 'Entre 1 e 3 anos';
  const temPlano = planoSaude === 'Sim';
  if (temPlano && viajouRecente) return 'Classe A/B';
  if (temPlano || viajouRecente || ultimaViagem === 'Mais de 3 anos') return 'Classe B/C';
  return 'Classe C/D';
}

const AREA_CURTA = {
  'Eletricista': 'Eletricista',
  'Técnico em eletrônica ou TI': 'Técnico/TI',
  'Engenheiro': 'Engenheiro',
  'Estudante': 'Estudante',
  'Só entusiasta, sem área técnica': 'Entusiasta',
};

function montarSegmento(r) {
  const area = AREA_CURTA[r.area_atuacao] || r.area_atuacao || 'Outro';
  const classe = classeProxy(r.plano_saude, r.ultima_viagem);
  return `${area} · ${classe} · ${r.idade || '?'}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = req.body || {};

  if (DIAGNOSTICO_TOKEN && body.token !== DIAGNOSTICO_TOKEN) {
    res.status(401).json({ error: 'token invalido' });
    return;
  }

  if (!body.responseId) {
    res.status(400).json({ error: 'sem responseId no payload' });
    return;
  }

  const row = {
    response_id: String(body.responseId),
    nome: body.nome || null,
    produto: PRODUTO_FIXO,
    idade: body.idade || null,
    area_atuacao: body.area_atuacao || null,
    presta_servico: body.presta_servico || null,
    plano_saude: body.plano_saude || null,
    ultima_viagem: body.ultima_viagem || null,
    objetivo: body.objetivo || null,
    disposicao_investir: body.disposicao_investir || null,
    regiao: body.regiao || null,
    canal: body.canal || null,
    demanda_percebida: body.demanda_percebida || null,
    respondido_em: body.respondidoEm || new Date().toISOString(),
  };
  row.segmento = montarSegmento(row);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/diagnostico_respostas?on_conflict=response_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SECRET,
        Authorization: `Bearer ${SUPABASE_SECRET}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([row]),
    });
    if (!r.ok) {
      const errText = await r.text();
      res.status(502).json({ error: 'falha ao gravar no supabase', detalhe: errText });
      return;
    }
    res.status(200).json({ ok: true, response_id: row.response_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
