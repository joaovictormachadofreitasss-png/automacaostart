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

// ⚠️ 05/08: o formulário real não pergunta mais plano de saúde / última viagem / demanda
// percebida (removidas em algum momento depois que este webhook foi escrito) — por isso
// classeProxy() foi removida junto: não dá pra estimar classe social sem esses dois sinais,
// e manter a função só pra sempre cair em "Classe C/D" seria mostrar um dado inventado.
// Ver docs/conectores-hotmart-meta.md e o histórico de 05/08 se isso voltar a mudar.

// Rótulo curto pras opções REAIS de "Qual a sua profissão?" (confirmadas 05/08 direto no
// formulário). Resposta que não bater aqui cai no valor bruto mesmo (fallback em montarSegmento),
// nunca é descartada.
const AREA_CURTA = {
  'Eletricista Autônomo': 'Eletricista',
  'Engenheiro Eletricista': 'Eng. Eletricista',
  'Engenheiro de automação': 'Eng. Automação',
  'Engenheiro civil': 'Eng. Civil',
  'Engenheiro Mecânico': 'Eng. Mecânico',
  'Outras engenharias': 'Engenheiro (outra)',
  'Arquiteto': 'Arquiteto',
};

function montarSegmento(r) {
  const area = AREA_CURTA[r.area_atuacao] || r.area_atuacao || 'Outro';
  return `${area} · ${r.idade || '?'}`;
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
    objetivo: body.objetivo || null,
    disposicao_investir: body.disposicao_investir || null,
    regiao: body.regiao || null,
    canal: body.canal || null, // "Como você conheceu o Adriano Leite?" (texto mudou 05/08, campo continua o mesmo)
    busca_automacao: body.busca_automacao || null, // "O que você busca na automação residencial?" — campo novo, adicionado 05/08
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
