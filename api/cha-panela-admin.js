// API do painel admin do Chá de Panela — roda com a chave service_role (nunca exposta ao navegador).
// Usa as MESMAS variáveis de ambiente já configuradas na Vercel pro resto do projeto:
//   SUPABASE_URL, SUPABASE_SECRET

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const SENHA = 'letsmaker2026';

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SECRET,
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

module.exports = async (req, res) => {
  try {
    const body = req.method === 'POST' ? req.body : req.query;
    if (!body || body.senha !== SENHA) {
      res.status(401).json({ error: 'senha invalida' });
      return;
    }

    const action = body.action;

    if (action === 'listar') {
      const itens = await sb('cha_panela_itens?order=ordem.asc');
      const interesses = await sb(
        'cha_panela_interesses?select=id,item_id,nome_convidado,criado_em&order=criado_em.desc'
      );
      let rsvps = [];
      try {
        rsvps = await sb('cha_panela_rsvp?select=id,nome,vai,criado_em&order=criado_em.desc');
      } catch (e) {
        rsvps = []; // tabela pode ainda nao existir se o SQL de rsvp nao foi rodado
      }
      res.status(200).json({ itens, interesses, rsvps });
      return;
    }

    if (action === 'confirmar') {
      const { item_id, confirmado_por } = body;
      await sb(`cha_panela_itens?id=eq.${item_id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'confirmado', confirmado_por: confirmado_por || null }),
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'desfazer') {
      const { item_id } = body;
      await sb(`cha_panela_itens?id=eq.${item_id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'disponivel', confirmado_por: null }),
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'descartar_interesse') {
      const { interesse_id } = body;
      await sb(`cha_panela_interesses?id=eq.${interesse_id}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'resetar_catalogo') {
      const { itens } = body; // [{nome, ordem}, ...]
      if (!Array.isArray(itens) || !itens.length) {
        res.status(400).json({ error: 'itens vazio' });
        return;
      }
      await sb('cha_panela_interesses?id=gt.0', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await sb('cha_panela_itens?id=gt.0', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await sb('cha_panela_itens', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(itens.map((it) => ({ nome: it.nome, ordem: it.ordem, faixa_preco: it.faixa_preco || '', prioridade: it.prioridade || 'alta' }))),
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'action desconhecida' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
