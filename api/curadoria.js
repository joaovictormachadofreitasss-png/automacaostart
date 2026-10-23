const {createHmac,randomBytes,timingSafeEqual,createHash}=require('node:crypto');
const fields=require('../lib/curadoria-fields.json');
const E=process.env;
const same=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0&&x.length===y.length&&timingSafeEqual(x,y);};
const paid=o=>o&&['APPROVED','COMPLETE'].includes(o.status)&&(o.billing_model!=='monthly'||Date.parse(o.paid_until)>Date.now());
const bearer=req=>String(req.headers.authorization||'').replace(/^Bearer /,'');
function admin(req){
 if(same(bearer(req),E.CURADORIA_ADMIN_KEY))return true;
 try{const raw=String(req.headers.cookie||'').match(/(?:^|;\s*)lm_session=([^;]+)/)?.[1];if(!raw||!E.AUTH_SECRET)return false;const [ts,sig,...extra]=decodeURIComponent(raw).split('.');if(extra.length||!/^\d+$/.test(ts)||Date.now()-Number(ts)<0||Date.now()-Number(ts)>=30*86400000)return false;return same(sig,createHmac('sha256',E.AUTH_SECRET).update(ts).digest('hex'));}catch{return false;}
}
async function store(path,method='GET',data,prefer='return=representation'){
 if(!E.SUPABASE_URL||!E.SUPABASE_SECRET)throw Error('storage');
 const r=await fetch(E.SUPABASE_URL+'/rest/v1/'+path,{method,signal:AbortSignal.timeout(12000),headers:{apikey:E.SUPABASE_SECRET,Authorization:'Bearer '+E.SUPABASE_SECRET,'Content-Type':'application/json',Prefer:prefer},...(data!==undefined?{body:JSON.stringify(data)}:{})});
 if(!r.ok)throw Error('storage');const s=await r.text();return s?JSON.parse(s):null;
}
const eq=v=>encodeURIComponent(v);
function issue(o){if(E.CURADORIA_ACCESS_SECRET?.length<32||!E.CURADORIA_ACCESS_SECRET)throw Error('secret');const data=Buffer.from(JSON.stringify({tx:o.tx,n:o.nonce,exp:Date.now()+7*86400000})).toString('base64url');return data+'.'+createHmac('sha256',E.CURADORIA_ACCESS_SECRET).update(data).digest('base64url');}
async function access(token){try{const [p,s,...extra]=String(token||'').split('.');if(extra.length||!p||!s||!E.CURADORIA_ACCESS_SECRET)return null;const sig=createHmac('sha256',E.CURADORIA_ACCESS_SECRET).update(p).digest('base64url');if(!same(sig,s))return null;const d=JSON.parse(Buffer.from(p,'base64url').toString());if(d.exp<Date.now()||!d.exp||!d.tx)return null;const [o]=await store('lm_curadoria_orders?tx=eq.'+eq(d.tx)+'&limit=1');return paid(o)&&same(o.nonce,d.n)?o:null;}catch{return null;}}
async function event(tx,kind){await store('lm_curadoria_access_events?on_conflict=tx,kind','POST',{tx,kind},'resolution=ignore-duplicates,return=minimal');}
async function rate(req,action,max=60){const minute=Math.floor(Date.now()/60000),ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];const bucket=createHash('sha256').update(ip+':'+action+':'+minute).digest('hex');return store('rpc/lm_curadoria_rate','POST',{p_bucket:bucket,p_expiry:new Date((minute+2)*60000).toISOString(),p_max:max});}
module.exports=async(req,res)=>{
 const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
 try{
 const origin=E.CURADORIA_ORIGIN,base=E.CURADORIA_BASE_PATH||'/curadoria';const url=new URL(req.url,origin||'https://localhost');const action=String(req.query?.action||url.searchParams.get('action')||'').replace(/^\/+|\/+$/g,'');
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origem não permitida.'});
 const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});if(Buffer.byteLength(JSON.stringify(b))>32768)return send(413,{error:'Solicitação muito grande.'});
 const model=E.CURADORIA_PAYMENT_MODEL==='monthly'?'monthly':'one_time',oneProduct=E.CURADORIA_ONE_TIME_PRODUCT||'8776657',oneOffer=E.CURADORIA_ONE_TIME_OFFER||'202l1t52';const enabled=E.CURADORIA_OFFER_READY==='true'&&(model==='one_time'||!!E.CURADORIA_PLAN_ID);
 if(action==='config'&&req.method==='GET')return send(200,{provider:'hotmart',price_brl:3.9,billing_model:model,checkout_url:enabled?(model==='one_time'?(E.CURADORIA_ONE_TIME_CHECKOUT_URL||'https://pay.hotmart.com/C108126600R?off='+oneOffer):E.CURADORIA_CHECKOUT_URL):null});
 if(!origin||!E.SUPABASE_SECRET||!E.CURADORIA_ACCESS_SECRET)return send(503,{error:'Integração ainda não disponível.'});
 if(!await rate(req,action,action==='events'?180:60))return send(429,{error:'Aguarde um instante antes de tentar novamente.'});
 if(action==='admin/session'&&req.method==='GET'){const ok=admin(req);return send(ok?200:401,{ok});}
 if(action==='hotmart'&&req.method==='POST'){
 if(!same(b.hottok||req.headers['x-hotmart-hottok'],E.HOTMART_HOTTOK))return send(401,{error:'Não autorizado.'});
 const oneTime=String(b.data?.product?.id)===oneProduct&&b.data?.purchase?.offer?.code===oneOffer;if(!oneTime&&String(b.data?.product?.id)==='8778447'){
  if(!E.CURADORIA_PLAN_ID)return send(503,{error:'Plano mensal ainda não configurado.'});
  const d=b.data,p=d.purchase||{},cancel=b.event==='SUBSCRIPTION_CANCELLATION';
  const plan=String(d.subscription?.plan?.id||''),code=String(cancel?d.subscriber?.code||'':d.subscription?.subscriber?.code||'');
  if(plan!==E.CURADORIA_PLAN_ID)return send(202,{ignored:true});
  const statuses={PURCHASE_APPROVED:'APPROVED',PURCHASE_COMPLETE:'COMPLETE',PURCHASE_REFUNDED:'REFUNDED',PURCHASE_CHARGEBACK:'CHARGEBACK',PURCHASE_CANCELED:'CANCELLED',PURCHASE_EXPIRED:'EXPIRED',PURCHASE_BILLET_PRINTED:'WAITING_PAYMENT',PURCHASE_DELAYED:'OVERDUE',PURCHASE_PROTEST:'PROTESTED',PURCHASE_DISPUTE:'DISPUTE',PURCHASE_PARTIALLY_REFUNDED:'PARTIALLY_REFUNDED'};
  const status=statuses[b.event];if(!cancel&&!status)return send(202,{ignored:true});
  const iso=v=>Number.isFinite(v)&&v>0&&Number.isFinite(new Date(v).getTime())?new Date(v).toISOString():null;
  const from=iso(p.approved_date),until=iso(p.date_next_charge),cancelled=iso(d.cancellation_date);
  const email=String(cancel?d.subscriber?.email||'':d.buyer?.email||'').trim().toLowerCase();if(/@example\.(com|net|org)$/.test(email))return send(202,{ignored:true,test:true});
  if(b.version!=='2.0.0'||typeof b.id!=='string'||!b.id||b.id.length>150||!Number.isFinite(b.creation_date)||!code||code.length>150||(!cancel&&(typeof p.transaction!=='string'||p.transaction.length>150))||(cancel&&!cancelled)||(until&&from&&Date.parse(until)<=Date.parse(from))||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return send(400,{error:'Evento de assinatura inválido.'});
  const amount=Number.isFinite(p.price?.value)?Math.round(p.price.value*100):null;
  const currency=typeof p.price?.currency_value==='string'?p.price.currency_value:null;
  await store('rpc/lm_curadoria_apply_subscription','POST',{p_event_id:b.id,p_event_time:b.creation_date,p_kind:cancel?'CANCELLATION':'INVOICE',p_code:code,p_plan:plan,p_email:email,p_tx:cancel?'':p.transaction,p_status:status||'',p_from:from,p_until:until,p_cancelled:cancelled,p_amount:amount,p_currency:currency,p_nonce:randomBytes(24).toString('hex')});
  return send(200,{ok:true});
 }
 const p=b.data?.purchase;if(!oneTime)return send(202,{ignored:true});if(/@example\.(com|net|org)$/.test(String(b.data?.buyer?.email||'').trim().toLowerCase()))return send(202,{ignored:true,test:true});
 const statuses={PURCHASE_APPROVED:'APPROVED',PURCHASE_COMPLETE:'COMPLETE',PURCHASE_REFUNDED:'REFUNDED',PURCHASE_CHARGEBACK:'CHARGEBACK',PURCHASE_CANCELED:'CANCELLED',PURCHASE_EXPIRED:'EXPIRED',PURCHASE_BILLET_PRINTED:'WAITING_PAYMENT',PURCHASE_DELAYED:'OVERDUE',PURCHASE_PROTEST:'PROTESTED'};
 const status=statuses[b.event];if(!status)return send(202,{ignored:true});if(typeof b.id!=='string'||typeof p.transaction!=='string'||!Number.isFinite(b.creation_date))return send(400,{error:'Evento inválido.'});
 await store('rpc/lm_curadoria_apply_hook','POST',{p_id:b.id,p_tx:p.transaction,p_email:String(b.data?.buyer?.email||'').trim().toLowerCase(),p_status:status,p_time:b.creation_date,p_nonce:randomBytes(24).toString('hex')});return send(200,{ok:true});
 }
 if(action==='events'&&req.method==='POST'){
 if(!['page_view','section_view','scroll_depth','vsl_progress','checkout_click'].includes(b.type)||!(/^[a-f0-9-]{36}$/i.test(b.session||'')))return send(400,{error:'Evento inválido.'});
 const details={};for(const k of ['path','source','campaign','creative','section'])if(typeof b[k]==='string')details[k]=b[k].slice(0,100);if([25,50,75,90].includes(b.depth))details.depth=b.depth;
 await store('lm_curadoria_events','POST',{type:b.type,session:b.session,details},'return=minimal');return send(202,{ok:true});
 }
 if(action==='self-access'&&req.method==='POST'){const tx=String(b.transaction||'').trim().toUpperCase(),email=String(b.email||'').trim().toLowerCase();if(!/^HP[0-9A-Z]{6,}$/.test(tx)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(400,{error:'Confira o código da transação (começa com HP) e o e-mail usado na compra.'});const [o]=await store('lm_curadoria_orders?tx=eq.'+eq(tx)+'&limit=1');if(!o||!same(String(o.email||'').toLowerCase(),email))return send(404,{error:'Não encontramos uma compra com esse código e esse e-mail. Se pagou por Pix ou boleto, a confirmação pode levar alguns minutos.'});if(!paid(o))return send(409,{error:'Sua compra ainda não foi confirmada pela Hotmart. Se pagou agora, aguarde alguns minutos e tente de novo.'});await event(o.tx,'self_access').catch(()=>{});return send(200,{diagnostic_url:origin+base+'/diagnostico.html#access='+issue(o)});}
 if(action==='request-access'&&req.method==='POST')return send(410,{error:'A recuperação por e-mail foi desativada. Acesse sua compra na Hotmart e procure o suporte indicado para validar sua titularidade e receber seu link pessoal.'});
 if(action==='admin/fulfillment'&&req.method==='POST'){
 if(!admin(req))return send(401,{error:'Não autorizado.'});let tx=String(b.transaction||'');let [o]=await store('lm_curadoria_orders?tx=eq.'+eq(tx)+'&limit=1');if(!o){const [invoice]=await store('lm_curadoria_invoices?tx=eq.'+eq(tx)+'&select=subscriber_code&limit=1');if(invoice)[o]=await store('lm_curadoria_orders?tx=eq.'+eq('sub:'+invoice.subscriber_code)+'&limit=1');}if(!paid(o))return send(404,{error:'Compra com acesso vigente não localizada.'});return send(200,{email:o.email,diagnostic_url:origin+base+'/diagnostico.html#access='+issue(o),note:'Entregar somente ao titular por canal verificado.'});
 }
 if(action==='manychat/status'&&req.method==='POST'){
 if(!same(bearer(req),E.CURADORIA_BRIDGE_KEY))return send(401,{error:'Não autorizado.'});const o=await access(b.access_token);if(!o)return send(401,{error:'Acesso inválido.'});const complete=(await store('lm_curadoria_completions?tx=eq.'+eq(o.tx)+'&limit=1')).length>0;return send(200,{payment_status:o.status,diagnostic_complete:complete,diagnostic_url:origin+base+'/diagnostico.html#access='+issue(o),next_action:complete?'OPEN_ACCESS':'COMPLETE_DIAGNOSTIC'});
 }
 if(['admin/metrics','admin/funnel','admin/subscriptions'].includes(action)&&req.method==='GET'){
 if(!admin(req))return send(401,{error:'Não autorizado.'});
 async function all(table){const rows=[];for(let offset=0;offset<50000;offset+=1000){const batch=await store(table+'?select=*&limit=1000&offset='+offset+'&order='+ (table.endsWith('answers')?'tx,field':'created_at'));rows.push(...batch);if(batch.length<1000)return rows;}throw Error('volume');}
 if(action==='admin/subscriptions'){
  const [accounts,invoices,subs]=await Promise.all(['lm_curadoria_orders','lm_curadoria_invoices','lm_curadoria_subscriptions'].map(all));
  const monthly=accounts.filter(x=>x.billing_model==='monthly'),active=monthly.filter(paid),byCode=new Map(subs.map(x=>[x.code,x]));
  const good=invoices.filter(x=>['APPROVED','COMPLETE'].includes(x.status)),counts=new Map();for(const x of good)counts.set(x.subscriber_code,(counts.get(x.subscriber_code)||0)+1);
  return send(200,{generated_at:new Date().toISOString(),kpis:{'Assinaturas com acesso vigente':active.length,'Acessos vencidos ou sem pagamento':monthly.length-active.length,'Canceladas com período ainda pago':active.filter(x=>byCode.get(x.subscriber_code)?.cancelled_at).length,'Cobranças aprovadas':good.length,'Renovações aprovadas':Array.from(counts.values()).reduce((n,c)=>n+Math.max(c-1,0),0),'Cobranças em atraso':invoices.filter(x=>x.status==='OVERDUE').length},received_brl_cents:good.filter(x=>x.currency==='BRL').reduce((n,x)=>n+(x.amount_cents||0),0),mrr_brl_cents:active.filter(x=>!byCode.get(x.subscriber_code)?.cancelled_at).length*390,review:monthly.filter(x=>!paid(x)).map(x=>({subscriber_code:x.subscriber_code,email:x.email,paid_until:x.paid_until})),note:'Valores brutos antes de taxas e ajustes. MRR é projeção, não dinheiro recebido. A lista exige conferência humana: não comprova presença no WhatsApp e não remove participantes.'});
 }
 const [orders,events,steps,completions,accesses]=await Promise.all(['lm_curadoria_orders','lm_curadoria_events','lm_curadoria_answers','lm_curadoria_completions','lm_curadoria_access_events'].map(all));
 const sessions=(kind,rows=events)=>new Set(rows.filter(e=>e.type===kind).map(e=>e.session)).size;
 const kpis={'Sessões na página':sessions('page_view'),'Cliques no checkout':sessions('checkout_click'),'Compras aprovadas':orders.filter(paid).length,'Diagnósticos iniciados':accesses.filter(x=>x.kind==='diagnostic_started').length,'Diagnósticos concluídos':completions.length,'Convites liberados':accesses.filter(x=>x.kind==='invite_released').length};
 if(action==='admin/funnel'){const days=Number(url.searchParams.get('days')||7);if(![1,7,30,90].includes(days))return send(400,{error:'Período inválido.'});const from=Date.now()-days*86400000,inRange=x=>Date.parse(x.created_at)>=from;const e=events.filter(inRange),o=orders.filter(inRange),a=accesses.filter(inRange);return send(200,{days,generated_at:new Date().toISOString(),funnel:[['Visitas',sessions('page_view',e)],['Cliques para entrar',sessions('checkout_click',e)],['Pagamentos aprovados',o.filter(paid).length],['Diagnósticos iniciados',a.filter(x=>x.kind==='diagnostic_started').length],['Diagnósticos concluídos',completions.filter(inRange).length],['Convites liberados',a.filter(x=>x.kind==='invite_released').length]].map(([label,value])=>({label,value})),refunds:o.filter(x=>['REFUNDED','CHARGEBACK'].includes(x.status)).length,ratio_note:'Contagens por evento no período; não representam uma coorte. Entradas no WhatsApp ainda não conectadas.',external:['Visualizações do Instagram','Investimento em anúncios','Comissões aprovadas','Vendas do CIP','Entradas confirmadas no grupo'].map(label=>({label,status:'Não conectado'}))});}
 const grouped=new Map(),profiles=new Map(),sources=new Map();for(const x of steps){grouped.set(x.field,(grouped.get(x.field)||0)+1);const k=JSON.stringify([x.field,x.value]);profiles.set(k,(profiles.get(k)||0)+1);}for(const e of events.filter(x=>x.type==='page_view')){const d=e.details||{},k=JSON.stringify([d.source||'direct',d.campaign||'',d.creative||'']);if(!sources.has(k))sources.set(k,new Set());sources.get(k).add(e.session);}
 return send(200,{kpis,steps:[...grouped].map(([field,count])=>({field,count})),profiles:[...profiles].map(([k,count])=>{const [field,value]=JSON.parse(k);return{field,value,count};}),sources:[...sources].map(([k,s])=>{const [source,campaign,creative]=JSON.parse(k);return{source,campaign,creative,visits:s.size};}),scroll:[25,50,75,90].map(depth=>({depth,count:new Set(events.filter(x=>x.type==='scroll_depth'&&x.details.depth===depth).map(x=>x.session)).size})),membership_note:'Entradas e saídas do grupo ainda não conectadas. Clique no convite não é contado como membro.'});
 }
 const o=await access(bearer(req));if(!o)return send(401,{error:'Acesso inválido ou expirado. Procure a equipe.'});
 if(action==='access'&&req.method==='GET'){await event(o.tx,'diagnostic_started');const a=await store('lm_curadoria_answers?tx=eq.'+eq(o.tx)+'&select=field,value');return send(200,{answers:Object.fromEntries(a.map(x=>[x.field,x.value]))});}
 if(action==='diagnostic/step'&&req.method==='POST'){if(!fields[b.id]?.includes(b.value))return send(400,{error:'Resposta inválida.'});await store('lm_curadoria_answers?on_conflict=tx,field','POST',{tx:o.tx,field:b.id,value:b.value,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal');return send(200,{ok:true});}
 if(action==='diagnostic/complete'&&req.method==='POST'){const rows=await store('lm_curadoria_answers?tx=eq.'+eq(o.tx)+'&select=field,value'),a=Object.fromEntries(rows.map(x=>[x.field,x.value]));if(!Object.entries(fields).every(([k,v])=>v.includes(a[k])))return send(400,{error:'Conclua todas as etapas.'});if(!E.CURADORIA_GROUP_URL)return send(503,{error:'Convite ainda indisponível. Suas respostas estão salvas.'});await store('lm_curadoria_completions?on_conflict=tx','POST',{tx:o.tx},'resolution=ignore-duplicates,return=minimal');await event(o.tx,'invite_released');return send(200,{invite_path:base+'/convite.html'});}
 if(action==='invite'&&req.method==='POST'){if(!(await store('lm_curadoria_completions?tx=eq.'+eq(o.tx)+'&limit=1')).length)return send(403,{error:'Conclua o diagnóstico.'});const invite=new URL(E.CURADORIA_GROUP_URL||'');if(invite.protocol!=='https:'||invite.hostname!=='chat.whatsapp.com')return send(503,{error:'Convite indisponível.'});await event(o.tx,'invite_clicked');return send(200,{url:invite.href});}
 return send(404,{error:'Rota indisponível.'});
 }catch{return send(503,{error:'Não foi possível concluir agora. Tente novamente ou procure a equipe.'});}
};
