const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const txFromURL = query.get('transaction') || query.get('tx') || query.get('transaction_code') || '';
const emailFromURL = query.get('email') || query.get('buyer_email') || '';
if (txFromURL) $('tx').value = txFromURL;
if (emailFromURL) $('em').value = emailFromURL;
// Os campos do retorno da compra não precisam permanecer na barra de endereços.
if (['transaction', 'tx', 'transaction_code', 'email', 'buyer_email'].some(k => query.has(k))) {
  ['transaction', 'tx', 'transaction_code', 'email', 'buyer_email'].forEach(k => query.delete(k));
  history.replaceState(null, '', location.pathname + (query.toString() ? '?' + query : '') + location.hash);
}
$('f').onsubmit = async ev => {
  ev.preventDefault();
  if ($('go').disabled) return;
  const status = $('st'), transaction = $('tx').value.trim().toUpperCase(), email = $('em').value.trim();
  if (!/^HP[0-9A-Z]{6,}$/.test(transaction)) { status.textContent = 'Confira o código da transação: ele começa com HP.'; $('tx').focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = 'Digite o e-mail usado na compra.'; $('em').focus(); return; }
  $('go').disabled = true; status.textContent = 'Conferindo sua compra…';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('/api/curadoria/self-access', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction, email }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.diagnostic_url) {
      const destination = new URL(data.diagnostic_url, location.href);
      if (destination.origin !== location.origin) throw new Error('Destino de acesso inválido.');
      status.textContent = 'Compra confirmada. Abrindo seu acesso…'; location.assign(destination.href); return;
    }
    status.textContent = data.error || 'Não foi possível conferir agora. Tente novamente ou fale com a equipe.';
  } catch { status.textContent = 'Não conseguimos conectar agora. Tente novamente; não é necessário pagar outra vez.'; }
  finally { clearTimeout(timer); $('go').disabled = false; }
};
