// Testes das fórmulas puras (js/formulas.js). Sem dependências — roda com:
//   node scripts/test-formulas.js
// Sai com código 1 se algum teste falhar (pra usar em CI depois, se quiser).

const F = require('../js/formulas.js');

let passou = 0, falhou = 0;
function assertEq(nome, got, esperado) {
  const ok = JSON.stringify(got) === JSON.stringify(esperado);
  if (ok) { passou++; }
  else { falhou++; console.error(`✗ ${nome}\n  esperado: ${JSON.stringify(esperado)}\n  obtido:   ${JSON.stringify(got)}`); }
}
function assertNull(nome, got) {
  const ok = got === null;
  if (ok) { passou++; }
  else { falhou++; console.error(`✗ ${nome}\n  esperado: null\n  obtido:   ${JSON.stringify(got)}`); }
}
function assertClose(nome, got, esperado, eps=0.001) {
  const ok = typeof got === 'number' && Math.abs(got - esperado) < eps;
  if (ok) { passou++; }
  else { falhou++; console.error(`✗ ${nome}\n  esperado: ~${esperado}\n  obtido:   ${JSON.stringify(got)}`); }
}

// ── dataStrBR / timezone America/Sao_Paulo (UTC-3, sem horário de verão) ──
// 2026-08-04T02:30:00Z (madrugada UTC) deve virar 2026-08-03 no Brasil (ainda é dia anterior às 23h30 BR).
assertEq('dataStrBR: madrugada UTC vira dia anterior no BR', F.dataStrBR('2026-08-04T02:30:00Z'), '2026-08-03');
// 2026-08-04T15:00:00Z = 12h BR, mesmo dia.
assertEq('dataStrBR: meio-dia UTC = mesmo dia BR', F.dataStrBR('2026-08-04T15:00:00Z'), '2026-08-04');
assertEq('dataStrBR: null pra entrada vazia', F.dataStrBR(null), null);
assertEq('dataStrBR: null pra ISO invalido', F.dataStrBR('lixo'), null);

// ── somaDias ──
assertEq('somaDias: +1 dia', F.somaDias('2026-08-04', 1), '2026-08-05');
assertEq('somaDias: -1 dia', F.somaDias('2026-08-01', -1), '2026-07-31');
assertEq('somaDias: vira mes', F.somaDias('2026-07-31', 1), '2026-08-01');
assertEq('somaDias: vira ano', F.somaDias('2026-12-31', 1), '2027-01-01');

// ── taxaCliqueCta ──
assertClose('taxaCliqueCta: 25/100 = 25%', F.taxaCliqueCta(25, 100), 25);
assertNull('taxaCliqueCta: sem sessoes = null (nao 0 ou Infinity)', F.taxaCliqueCta(0, 0));
assertClose('taxaCliqueCta: zero cliques mas com sessoes = 0%', F.taxaCliqueCta(0, 50), 0);

// ── conversaoPagina / conversaoCheckout ──
assertClose('conversaoPagina: 3/919 = 0.3264...%', F.conversaoPagina(3, 919), 3/919*100);
assertNull('conversaoPagina: sem sessoes = null', F.conversaoPagina(3, 0));
assertClose('conversaoCheckout: pode passar de 100% se checkout do pixel < vendas reais', F.conversaoCheckout(10, 5), 200);
assertNull('conversaoCheckout: sem checkout iniciado = null', F.conversaoCheckout(3, 0));

// ── cpa / roas / lucro / margem / ticketMedio ──
assertClose('cpa: 1000/25 vendas', F.cpa(1000, 25), 40);
assertNull('cpa: sem vendas = null (nao Infinity)', F.cpa(1000, 0));
assertClose('roas: 3064/1457.34', F.roas(3064, 1457.34), 3064/1457.34);
assertNull('roas: sem investimento = null (nao 0)', F.roas(3064, 0));
assertClose('lucro: receita - invest - custos extras', F.lucro(1000, 400, 50), 550);
assertClose('lucro: sem custos extras', F.lucro(1000, 400), 600);
assertClose('margem: lucro 600 sobre receita 1000 = 60%', F.margem(600, 1000), 60);
assertNull('margem: sem receita = null', F.margem(600, 0));
assertClose('margem: pode ser negativa', F.margem(-282.67, 1097.13), -282.67/1097.13*100);
assertClose('ticketMedio: 1097.13/45', F.ticketMedio(1097.13, 45), 1097.13/45);
assertNull('ticketMedio: sem vendas = null', F.ticketMedio(1097.13, 0));

// ── normalizarOrigem — cobre a inconsistência real reportada no prompt ──
assertEq('normalizarOrigem: Instagram_Reels -> instagram/reels', F.normalizarOrigem('Instagram_Reels','cpc').source, 'instagram');
assertEq('normalizarOrigem: Instagram_Reels placement', F.normalizarOrigem('Instagram_Reels','cpc').placement, 'instagram_reels');
assertEq('normalizarOrigem: ig curto -> instagram', F.normalizarOrigem('ig','social').source, 'instagram');
assertEq('normalizarOrigem: Facebook_Right_Column -> facebook/placement', F.normalizarOrigem('Facebook_Right_Column','').placement, 'facebook_right_column');
assertEq('normalizarOrigem: vazio -> direct', F.normalizarOrigem('','').source, 'direct');
assertEq('normalizarOrigem: "direto" -> direct', F.normalizarOrigem('direto','').source, 'direct');
assertEq('normalizarOrigem: instagram sempre paid_social (anuncios)', F.normalizarOrigem('Instagram_Feed','').medium, 'paid_social');
assertEq('normalizarOrigem: preserva valor bruto original pra auditoria', F.normalizarOrigem('Instagram_Reels','cpc').bruto_source, 'Instagram_Reels');

// ── maiorScrollPorSessao — dedup: maior profundidade, não soma de eventos ──
const eventosScroll = [
  { session: 'a', value: '25%' }, { session: 'a', value: '50%' }, { session: 'a', value: '75%' },
  { session: 'b', value: '25%' },
  { session: 'c', value: '100%' }, { session: 'c', value: '50%' }, // fora de ordem: 100% depois 50%, tem que ficar 100
];
const maxScroll = F.maiorScrollPorSessao(eventosScroll);
assertEq('maiorScrollPorSessao: sessao a chegou a 75%, nao soma 3 eventos', maxScroll.a, 75);
assertEq('maiorScrollPorSessao: sessao b só 25%', maxScroll.b, 25);
assertEq('maiorScrollPorSessao: sessao c mantém o maior (100%) mesmo fora de ordem', maxScroll.c, 100);
assertEq('maiorScrollPorSessao: 3 sessoes distintas, nao 6 eventos', Object.keys(maxScroll).length, 3);

// ── resultado ──
console.log(`\n${passou} passaram, ${falhou} falharam.`);
if (falhou > 0) process.exit(1);
