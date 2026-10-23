// First-party events only. No third-party tracker or contact data in analytics.
const sid=sessionStorage.lmSid||(sessionStorage.lmSid=crypto.randomUUID());
function track(type,data={}){fetch('/api/curadoria/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,session:sid,...data})}).catch(()=>{});}
track('page_view',{path:location.pathname,source:new URLSearchParams(location.search).get('utm_source')||'direct',campaign:new URLSearchParams(location.search).get('utm_campaign')||'',creative:new URLSearchParams(location.search).get('utm_content')||''});
const seen=new Set();new IntersectionObserver(items=>items.forEach(i=>{if(i.isIntersecting&&!seen.has(i.target.dataset.section)){seen.add(i.target.dataset.section);track('section_view',{section:i.target.dataset.section});}}),{threshold:.4}).observe(document.querySelector('[data-section]'));
const observer=new IntersectionObserver(items=>items.forEach(i=>{if(i.isIntersecting&&!seen.has(i.target.dataset.section)){seen.add(i.target.dataset.section);track('section_view',{section:i.target.dataset.section});}}),{threshold:.35});document.querySelectorAll('[data-section]').forEach(s=>observer.observe(s));
const depths=new Set();addEventListener('scroll',()=>{const d=document.documentElement.scrollHeight-innerHeight;if(d<=0)return;const p=scrollY/d*100;[25,50,75,90].forEach(n=>{if(p>=n&&!depths.has(n)){depths.add(n);track('scroll_depth',{depth:n});}});},{passive:true});
// Checkout direto na Hotmart (sem página intermediária). Repassa a origem da visita para o relatório da Hotmart.
let checkoutUrl='https://pay.hotmart.com/C108126600R?off=202l1t52';
fetch('/api/curadoria/config').then(r=>r.json()).then(c=>{if(c.checkout_url&&new URL(c.checkout_url).hostname.endsWith('hotmart.com'))checkoutUrl=c.checkout_url;}).catch(()=>{});
function checkoutHref(){const u=new URL(checkoutUrl);const q=new URLSearchParams(location.search);const src=q.get('utm_source');if(src)u.searchParams.set('src',[src,q.get('utm_campaign'),q.get('utm_content')].filter(Boolean).join('_').slice(0,90));return u.href;}
document.querySelector('#checkout').addEventListener('click',()=>{track('checkout_click');location.assign(checkoutHref());});
