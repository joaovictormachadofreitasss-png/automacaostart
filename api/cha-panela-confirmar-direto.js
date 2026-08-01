// Endpoint PUBLICO (sem senha) chamado direto pelo convidado ao confirmar um presente.
// Usa service_role so aqui dentro (nunca exposta ao navegador) pra fazer um update
// condicional atomico: so confirma se o item ainda estiver "disponivel", evitando
// duas pessoas darem o mesmo presente ao mesmo tempo (race condition).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

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
    const { item_id, nome_convidado } = req.body || {};
    if (!item_id || !nome_convidado) {
      res.status(400).json({ error: 'item_id e nome_convidado sao obrigatorios' });
      return;
    }
    const nome = String(nome_convidado).slice(0, 120);

    // Update condicional: so afeta a linha se ainda estiver disponivel.
    // Prefer: return=representation faz o Supabase devolver a linha alterada (ou [] se nao alterou nada).
    const atualizado = await sb(`cha_panela_itens?id=eq.${item_id}&status=eq.disponivel`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'confirmado', confirmado_por: nome }),
    });

    if (!Array.isArray(atualizado) || atualizado.length === 0) {
      res.status(409).json({ ok: false, error: 'ja_confirmado', message: 'Esse item já foi escolhido por outra pessoa, que pena! Escolha outro na lista.' });
      return;
    }

    // Guarda no historico de interesses tambem, so pra registro/auditoria.
    await sb('cha_panela_interesses', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{ item_id, nome_convidado: nome }]),
    });

    res.status(200).json({ ok: true, item: atualizado[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
