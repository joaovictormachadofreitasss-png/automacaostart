const questions=[{id:'profession',title:'Qual é a sua área hoje?',options:['Eletricista','Engenharia','Eletrotécnica','Tecnologia da informação','Instalações e manutenção','Entusiasta / uso próprio','Outra área']},{id:'experience',title:'Como está sua experiência com automação?',options:['Ainda não comecei','Já configurei na minha casa','Faço instalações pontuais','Já entrego projetos integrados']},{id:'goal',title:'O que você quer desenvolver primeiro?',options:['Escolher produtos para minha casa','Começar a prestar serviços','Melhorar as soluções que já entrego','Comparar dispositivos e acompanhar novidades']},{id:'zigbee',title:'Qual é seu contato com Zigbee?',options:['Ainda não conheço','Conheço a ideia, mas não uso','Já uso alguns dispositivos','Já configuro redes e cenas']},{id:'interest',title:'Qual solução mais interessa agora?',options:['Iluminação e cenas','Sensores e segurança','Controle de ar-condicionado e equipamentos','Hubs e compatibilidade','Rede e estabilidade','Quero entender o conjunto']},{id:'challenge',title:'Qual é sua maior dificuldade?',options:['Escolher modelos compatíveis','Instalar e configurar','Criar cenas úteis','Entender o que oferecer ao cliente','Precificar e apresentar soluções','Encontrar fornecedores']},{id:'purchase_intent',title:'Como está sua intenção de comprar dispositivos?',options:['Estou pesquisando, sem prazo','Pretendo comprar nos próximos 30 dias','Tenho uma instalação ou projeto em andamento','Quero aprender antes de comprar']}];
const el = id => document.getElementById(id);
const fragment = new URLSearchParams(location.hash.slice(1));
let token = fragment.get('access') || '';
try {
  if (token) { sessionStorage.setItem('lmAccess', token); sessionStorage.removeItem('lmDiagnostic'); history.replaceState(null, '', location.pathname); }
  else token = sessionStorage.getItem('lmAccess') || '';
} catch { /* O fragmento e a memória da página permitem continuar sem sessionStorage. */ }
let answers = {}, i = 0, valid = false, busy = false;
async function call(path, body) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'Não foi possível continuar.'); error.status = response.status; throw error; }
    return data;
  } finally { clearTimeout(timer); }
}
function link(text, href) { const a = document.createElement('a'); a.className = 'button'; a.textContent = text; a.href = href; return a; }
function inviteLink(invitePath) {
  // O fragmento mantém o acesso ao abrir em outra aba ou quando o armazenamento está bloqueado.
  return (invitePath || '/curadoria/convite.html') + '#access=' + encodeURIComponent(token);
}
function completed(invitePath) {
  valid = false;
  el('mode').textContent = 'Compra validada. Seu diagnóstico está concluído.';
  el('step').textContent = 'CADASTRO CONCLUÍDO'; el('bar').style.width = '100%';
  el('question').textContent = 'Seu convite está aqui.';
  el('choices').replaceChildren(link('Abrir convite do grupo ↗', inviteLink(invitePath)));
  el('next').hidden = true; el('back').hidden = true;
  el('status').textContent = 'Você pode abrir novamente o convite sem repetir o diagnóstico. A entrada segue as regras de aprovação do grupo.';
}
function gate(message, retry = false) {
  valid = false;
  el('mode').textContent = message;
  el('step').textContent = ''; el('bar').style.width = '0%';
  el('question').textContent = retry ? 'Vamos tentar novamente?' : 'Retome seu acesso.';
  el('choices').replaceChildren(link('Recuperar meu acesso ↗', '/curadoria/acesso.html'));
  if (retry) { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary'; b.textContent = 'Tentar novamente'; b.onclick = load; el('choices').append(b); }
  el('next').hidden = true; el('back').hidden = true;
  el('status').textContent = 'Se você já pagou, não precisa comprar novamente. Use o código da Hotmart e o e-mail da compra.';
}
function render() {
  const q = questions[i];
  el('step').textContent = `ETAPA ${i + 1} DE ${questions.length}`; el('bar').style.width = ((i + 1) / questions.length * 100) + '%';
  el('question').textContent = q.title; el('choices').replaceChildren();
  q.options.forEach(value => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice' + (answers[q.id] === value ? ' selected' : ''); b.textContent = value; b.setAttribute('aria-pressed', answers[q.id] === value ? 'true' : 'false'); b.disabled = busy;
    b.onclick = () => { if (busy) return; answers[q.id] = value; render(); }; el('choices').append(b);
  });
  el('back').hidden = false; el('next').hidden = false;
  el('back').disabled = i === 0 || busy; el('next').disabled = busy;
  el('next').textContent = i === questions.length - 1 ? 'Concluir diagnóstico ↗' : 'Continuar ↗';
  el('status').textContent = '';
}
el('back').onclick = () => { if (valid && !busy && i > 0) { i--; render(); } };
el('next').onclick = async () => {
  if (!valid || busy) return;
  const q = questions[i];
  if (!q.options.includes(answers[q.id])) { el('status').textContent = 'Escolha uma opção para continuar.'; return; }
  busy = true; render();
  try {
    await call('/api/curadoria/diagnostic/step', { id: q.id, value: answers[q.id] });
    if (i < questions.length - 1) { i++; busy = false; render(); }
    else { const data = await call('/api/curadoria/diagnostic/complete', { answers }); completed(data.invite_path); }
  } catch (error) {
    if (error.status === 401) gate('Seu link não está válido. Recupere o acesso para continuar com as respostas salvas.');
    else el('status').textContent = error.name === 'AbortError' ? 'A conexão demorou. Tente novamente; as etapas já confirmadas continuam salvas.' : error.message;
  } finally { busy = false; el('next').disabled = false; el('back').disabled = i === 0; }
};
async function load() {
  if (!token) { gate('Confirme sua compra para acessar o diagnóstico.'); return; }
  el('mode').textContent = 'Conferindo sua compra e suas respostas…';
  try {
    const data = await call('/api/curadoria/access');
    // O servidor é a fonte das respostas; não reutilizamos um rascunho de outro comprador.
    answers = Object.fromEntries(questions.filter(q => q.options.includes(data.answers?.[q.id])).map(q => [q.id, data.answers[q.id]]));
    if (data.diagnostic_complete === true) { completed(data.invite_path); return; }
    valid = true; const firstPending = questions.findIndex(q => !q.options.includes(answers[q.id])); i = firstPending < 0 ? questions.length - 1 : firstPending;
    el('mode').textContent = Object.keys(answers).length ? 'Respostas anteriores recuperadas. Continue de onde parou.' : 'Compra validada. Responda às etapas para liberar o convite.';
    render();
  } catch (error) { gate(error.status === 401 ? 'Seu link não está válido. Recupere o acesso para continuar.' : 'Não conseguimos conferir seu acesso agora. Suas respostas confirmadas continuam salvas.', error.status !== 401); }
}
load();
