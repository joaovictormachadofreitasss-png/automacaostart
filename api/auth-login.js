// Recebe a senha do formulário de login (login.html) e, se correta, grava um
// cookie de sessão assinado (HMAC). A senha em si NUNCA chega ao navegador
// além desse POST — nada de senha hardcoded no JS do frontend.
//
// Variáveis de ambiente necessárias na Vercel (Settings > Environment Variables):
//   DASHBOARD_PASSWORD = senha compartilhada com a equipe
//   AUTH_SECRET        = mesma string usada no middleware.js pra assinar/validar o cookie

const crypto = require('crypto');

const COOKIE_NAME = 'lm_session';
const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 dias

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const PASSWORD = process.env.DASHBOARD_PASSWORD;
  const SECRET = process.env.AUTH_SECRET;
  if (!PASSWORD || !SECRET) {
    res.status(500).json({ error: 'Autenticação não configurada no servidor (DASHBOARD_PASSWORD / AUTH_SECRET ausentes).' });
    return;
  }

  const body = req.body || {};
  if (body.password !== PASSWORD) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return;
  }

  const ts = String(Date.now());
  const sig = crypto.createHmac('sha256', SECRET).update(ts).digest('hex');
  const token = `${ts}.${sig}`;

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_S}; HttpOnly; Secure; SameSite=Lax`
  );
  res.status(200).json({ ok: true });
};
