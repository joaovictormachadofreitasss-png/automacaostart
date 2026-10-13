const start = new Date('2026-10-12T07:00:00-03:00').getTime();
const end = new Date('2026-10-18T23:59:59-03:00').getTime();
function updateEvent(now = Date.now()) {
  const label = document.querySelector('.countdown-label');
  const grid = document.querySelector('.countdown-grid');
  if (now >= start) {
    grid.hidden = true;
    grid.style.display = 'none';
    label.classList.toggle('active', now <= end);
    label.textContent = now <= end ? 'Evento em andamento · 12 a 18 de outubro' : 'Esta edição do evento foi encerrada';
    return;
  }
  label.textContent = 'Seu primeiro encontro começa em';
  const remaining = start - now;
  [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60].forEach((v, i) => {
    document.getElementById(['cd-dias', 'cd-horas', 'cd-min', 'cd-seg'][i]).textContent = String(v).padStart(2, '0');
  });
}
updateEvent();
setInterval(updateEvent, 1000);
// Carry campaign parameters to the original checkout without creating tracking visits for this review copy.
const params = new URLSearchParams(location.search);
document.querySelectorAll('.cta-link').forEach(link => {
  const url = new URL(link.href);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src']) {
    if (params.has(key)) url.searchParams.set(key, params.get(key));
  }
  link.href = url.href;
});
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const video = document.querySelector('.hero-video');
const motionButton = document.querySelector('.motion-toggle');
let pausedByUser = false;
function syncMotionButton() {
  const paused = video.paused;
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', paused ? 'Reproduzir animação de fundo' : 'Pausar animação de fundo');
  motionButton.innerHTML = paused ? 'REPRODUZIR ANIMAÇÃO <span aria-hidden="true">▷</span>' : 'PAUSAR ANIMAÇÃO <span aria-hidden="true">Ⅱ</span>';
}
async function resumeVideo() {
  try { await video.play(); } catch (_) { /* Poster remains visible when autoplay is blocked. */ }
  syncMotionButton();
}
if (motionPreference.matches) video.pause(); else resumeVideo();
video.addEventListener('play', syncMotionButton);
video.addEventListener('pause', syncMotionButton);
motionButton.addEventListener('click', () => {
  pausedByUser = !video.paused;
  if (video.paused) resumeVideo(); else video.pause();
});
motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) video.pause();
  else if (!pausedByUser && !document.hidden) resumeVideo();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else if (!pausedByUser && !motionPreference.matches) resumeVideo();
});
const dimensionCaptions = ['A tecnologia responde a uma necessidade real.', 'O planejamento conecta ambientes, infraestrutura e soluções.', 'A proposta traduz o projeto em valor para o cliente.', 'A instalação, os testes e a entrega completam o projeto.'];
document.querySelectorAll('.dimension-tab').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.dimension-tab').forEach(item => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('.system-workspace').dataset.dimension = button.dataset.dimension;
    document.getElementById('dimension-caption').textContent = dimensionCaptions[Number(button.dataset.dimension)];
  });
});
document.getElementById('dimension-caption').setAttribute('aria-live', 'polite');
document.querySelectorAll('section:not(.hero)').forEach((section, i) => {
  const label = document.createElement('span');
  label.className = 'section-index';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = `[${String(i + 1).padStart(2, '0')}] / MERGULHANDO NA AUTOMAÇÃO`;
  section.prepend(label);
});
if ('IntersectionObserver' in window) {
  if (!motionPreference.matches) {
    document.body.classList.add('motion-ready');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {threshold: 0.08});
    document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
  }
  const sticky = document.querySelector('.sticky-cta');
  const visibility = { hero: true, oferta: false };
  new IntersectionObserver(entries => {
    entries.forEach(entry => visibility[entry.target.id] = entry.isIntersecting);
    sticky.classList.toggle('is-hidden', visibility.hero || visibility.oferta);
  }, {threshold: 0}).observe(document.getElementById('hero'));
  new IntersectionObserver(entries => {
    entries.forEach(entry => visibility[entry.target.id] = entry.isIntersecting);
    sticky.classList.toggle('is-hidden', visibility.hero || visibility.oferta);
  }, {threshold: 0}).observe(document.getElementById('oferta'));
}
