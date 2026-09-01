// Middleware de autenticação (Vercel Edge) — protege as dashboards internas.
// Roda ANTES da página ser servida, então a senha nunca fica exposta no JS do
// frontend (diferente do esquema antigo, que comparava a senha dentro do <script>).
//
// Variáveis de ambiente necessárias na Vercel (Settings > Environment Variables):
//   DASHBOARD_PASSWORD = senha compartilhada com a equipe (usada só no /api/auth-login.js)
//   AUTH_SECRET        = string aleatória longa, só pra assinar o cookie de sessão
//                         (gerar uma vez com, por ex., `openssl rand -hex 32`)

export const config = {
  matcher: ['/vendas.html', '/dashboard.html', '/diagnostico.html', '/campanhas-comparacao.html', '/conteudo-c1.html'],
};

const COOKIE_NAME = 'lm_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function isValidToken(token, secret) {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const ts = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(ts)) return false;
  const expected = await hmacHex(secret, ts);
  if (expected !== sig) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < MAX_AGE_MS;
}

export default async function middleware(request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return new Response(
      'Configuração de autenticação ausente no servidor (AUTH_SECRET). Configure as variáveis de ambiente na Vercel antes de acessar esta página.',
      { status: 500 }
    );
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  const token = match ? decodeURIComponent(match[1]) : null;

  if (await isValidToken(token, secret)) {
    return; // cookie válido: deixa passar, serve a página normalmente
  }

  const url = new URL(request.url);
  const loginUrl = new URL('/login.html', url.origin);
  loginUrl.searchParams.set('redirect', url.pathname);
  return Response.redirect(loginUrl, 302);
}
