// Endpoint PUBLICO (sem senha) chamado pelo convidado ao confirmar presenca.
// Passa pelo servidor (em vez de ir direto no Supabase) so pra poder disparar
// a notificacao no Telegram usando a chave service_role com seguranca.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function notificarTelegram(texto) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: texto, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.log('Falha ao notificar Telegram:', e.message);
  }
}

module.exports = async (req, res) => {
  try {
    const { nome, vai } = req.body || {};
    if (!nome) {
      res.status(400).json({ error: 'nome e obrigatorio' });
      return;
    }
    const nomeLimpo = String(nome).slice(0, 120);

    const r = await fetch(`${SUPABASE_URL}/rest/v1/cha_panela_rsvp`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SECRET,
        Authorization: `Bearer ${SUPABASE_SECRET}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ nome: nomeLimpo, vai: vai !== false }),
    });
    if (!r.ok) throw new Error(await r.text());

    const emoji = vai !== false ? '🎉' : '😢';
    const texto = vai !== false ? 'Vai!' : 'Não vai';
    await notificarTelegram(`${emoji} *Presença confirmada!*\n\n👤 ${nomeLimpo}\n📋 ${texto}`);

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
