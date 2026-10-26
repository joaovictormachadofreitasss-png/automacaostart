const el = id => document.getElementById(id);
const fragment = new URLSearchParams(location.hash.slice(1));
let token = fragment.get('access') || '';
try { if (token) { sessionStorage.setItem('lmAccess', token); history.replaceState(null, '', location.pathname); } else token = sessionStorage.getItem('lmAccess') || ''; } catch { /* Continuar com o token em memória. */ }
if (!token) { el('open').hidden = true; el('status').textContent = 'Recupere seu acesso para abrir o convite. Não é necessário pagar novamente.'; }
el('open').onclick = async () => {
  if (!token || el('open').disabled) return;
  el('open').disabled = true; el('status').textContent = 'Conferindo seu acesso…';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('/api/curadoria/invite', { method: 'POST', signal: controller.signal, headers: { Authorization: 'Bearer ' + token } });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 403) { el('recover').href = 'diagnostico.html#access=' + encodeURIComponent(token); el('recover').textContent = 'Continuar meu diagnóstico ↗'; }
      if (response.status === 401) el('open').hidden = true;
      throw new Error(data.error || 'Não foi possível abrir o convite agora.');
    }
    const destination = new URL(data.url);
    if (destination.protocol !== 'https:' || destination.hostname !== 'chat.whatsapp.com') throw new Error('Convite indisponível. Fale com a equipe.');
    location.assign(destination.href);
  } catch (error) { el('status').textContent = error.name === 'AbortError' ? 'A conexão demorou. Tente novamente em instantes.' : error.message; }
  finally { clearTimeout(timer); el('open').disabled = false; }
};
