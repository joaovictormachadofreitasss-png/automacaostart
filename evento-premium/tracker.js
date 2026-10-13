// Production attribution is enabled only on the original LetsMaker site.
(() => {
if (location.hostname !== 'automacaostart.vercel.app' || location.pathname.startsWith('/evento-premium')) return;
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KX2X674Z');
  const SB_URL = 'https://drdodqhxecflgjrdxovs.supabase.co';
  const SB_KEY = 'sb_publishable_XEMLwGVpJSd5BmbmyHnmUg_uFdFsgFd';
  let lmSid = null;
  try { lmSid = sessionStorage.getItem('lm_sid'); } catch (e) {}
  if (!lmSid) {
    lmSid = 'lm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    try { sessionStorage.setItem('lm_sid', lmSid); } catch (e) {}
  }
  const lmParams = new URLSearchParams(location.search);
  const lmDevice = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  function lmSend(event, value) {
    try {
      fetch(SB_URL + '/rest/v1/events', {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ session: lmSid, event: event, value: String(value || ''), device: lmDevice, referrer: document.referrer || 'direto',
          utm_source: lmParams.get('utm_source') || '', utm_medium: lmParams.get('utm_medium') || '', utm_content: lmParams.get('utm_content') || '' }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }


  document.querySelectorAll('.cta-link').forEach(link=>{const url=new URL(link.href);url.searchParams.set('src',lmSid);link.href=url.href;link.addEventListener('click',()=>{window.dataLayer.push({event:'CTA_Click',offer_type:link.dataset.offer});lmSend('cta_click',link.dataset.offer);});});
  window.dataLayer.push({event:'ViewContent'});
  lmSend('pageview', location.href);
  const lmMarcos = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function () {
    const pct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
    [25, 50, 75, 100].forEach(function (m) { if (!lmMarcos[m] && pct >= m) { lmMarcos[m] = true; lmSend('scroll', m + '%'); } });
  }, { passive: true });
  const lmInicio = Date.now();
  window.addEventListener('beforeunload', function () { lmSend('tempo_pagina', Math.round((Date.now() - lmInicio) / 1000) + 's'); });

})();