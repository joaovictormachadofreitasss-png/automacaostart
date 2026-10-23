const $=id=>document.getElementById(id);const q=new URLSearchParams(location.search);
const t0=q.get('transaction')||q.get('tx')||q.get('transaction_code')||'';const e0=q.get('email')||q.get('buyer_email')||'';if(t0)$('tx').value=t0;if(e0)$('em').value=e0;
$('f').onsubmit=async ev=>{ev.preventDefault();const st=$('st');const tx=$('tx').value.trim().toUpperCase(),email=$('em').value.trim();
if(!/^HP[0-9A-Z]{6,}$/.test(tx)){st.textContent='O código da transação começa com HP. Confira no e-mail da Hotmart.';$('tx').focus();return;}
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){st.textContent='Digite o e-mail usado na compra.';$('em').focus();return;}
$('go').disabled=true;st.textContent='Conferindo sua compra…';
try{const r=await fetch('/api/curadoria/self-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transaction:tx,email})});const d=await r.json().catch(()=>({}));
if(r.ok&&d.diagnostic_url){st.textContent='Compra confirmada! Abrindo o diagnóstico…';location.href=d.diagnostic_url;return;}
st.textContent=d.error||'Não foi possível conferir agora. Tente de novo em instantes.';}catch{st.textContent='Erro de conexão. Tente de novo.';}finally{$('go').disabled=false;}};
