(() => {
  const dialog = document.querySelector('.opportunity-dialog');
  const storageKey = 'lm_event_offer_v3';
  let activated = false;
  let previousFocus = null;
  let confirmTimer;
  const readState = () => { try { return sessionStorage.getItem(storageKey); } catch (_) { return null; } };
  const saveState = value => { try { sessionStorage.setItem(storageKey, value); } catch (_) {} };
  function closeOffer() {
    if (dialog.open) dialog.close();
  }
  function openOffer() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    document.body.classList.add('page-offer-open');
    dialog.showModal();
    dialog.querySelector('.opportunity-activate').focus();
  }
  function applyOffer(notify = false) {
    activated = true;
    document.body.classList.add('offer-active');
    document.querySelectorAll('.offer-btn-price[data-promotional]').forEach(price => {
      const format = amount => Number(amount).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
      price.innerHTML = `<s class="old-price">${format(price.dataset.price)}</s>${format(price.dataset.promotional)}`;
    });
    document.getElementById('sticky-price').textContent = 'A partir de R$19,90';
    document.querySelectorAll('.offer-badge').forEach(badge => badge.textContent = 'OFERTA ATIVADA');
    document.querySelector('.offer-reopen').textContent = 'Oferta ativada ✓';
    saveState('activated');
    if (notify) {
      const notice = document.querySelector('.offer-confirmation');
      notice.classList.add('show');
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => notice.classList.remove('show'), 5000);
    }
  }
  dialog.querySelector('.opportunity-activate').addEventListener('click', () => {
    applyOffer(true);
    closeOffer();
  });
  dialog.querySelector('.opportunity-close').addEventListener('click', closeOffer);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeOffer();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('page-offer-open');
    if (!activated) saveState('dismissed');
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  });
  document.querySelector('.offer-reopen').addEventListener('click', openOffer);
  const state = readState();
  if (state === 'activated') applyOffer();
  else if (state !== 'dismissed') setTimeout(openOffer, 650);
  // Ticket links navigate directly to their respective Hotmart offers.
  // Visual offer activation does not intercept checkout navigation.
})();
