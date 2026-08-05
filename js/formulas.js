// ── FÓRMULAS COMPARTILHADAS (dashboard + testes) ──
// Funções puras, sem efeito colateral, sem DOM. Carregado como <script> normal
// (não module) pra funcionar direto no vendas.html/dashboard.html sem build step,
// e também via require() nos testes em Node (guard no final do arquivo).
//
// Definições (mesmas do prompt de evolução do dashboard):
//   Taxa de clique no CTA = sessões únicas com CTA ÷ sessões únicas
//   Conversão da página    = pedidos aprovados atribuídos ÷ sessões únicas
//   Conversão do checkout  = pedidos aprovados atribuídos ÷ sessões que iniciaram checkout
//   CPA         = investimento ÷ vendas aprovadas atribuídas
//   ROAS bruto  = receita bruta atribuída ÷ investimento
//   ROAS líquido= receita líquida atribuída ÷ investimento
//   Lucro       = receita líquida − investimento − outros custos configurados
//   Margem      = lucro ÷ receita líquida
//   Ticket médio= receita ÷ vendas aprovadas
// Quando o denominador é zero ou desconhecido, retorna null (chamador decide como
// mostrar — o padrão do dashboard é "—", nunca 0% ou Infinity).

(function (root) {
  const p2 = x => String(x).padStart(2, '0');

  // Converte um ISO (UTC) pra "YYYY-MM-DD" no fuso America/Sao_Paulo (UTC-3, sem
  // horário de verão desde 2019). Usado pra "Hoje/Ontem" baterem com o painel da Hotmart.
  function dataStrBR(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const br = new Date(d.getTime() - 3 * 3600 * 1000);
    return br.getUTCFullYear() + '-' + p2(br.getUTCMonth() + 1) + '-' + p2(br.getUTCDate());
  }

  function hojeBR() {
    const br = new Date(Date.now() - 3 * 3600 * 1000);
    return br.getUTCFullYear() + '-' + p2(br.getUTCMonth() + 1) + '-' + p2(br.getUTCDate());
  }

  function somaDias(str, delta) {
    const dt = new Date(str + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.getUTCFullYear() + '-' + p2(dt.getUTCMonth() + 1) + '-' + p2(dt.getUTCDate());
  }

  // Taxa de clique no CTA = sessões únicas com clique ÷ sessões únicas totais.
  function taxaCliqueCta(sessoesComCta, sessoesUnicas) {
    if (!sessoesUnicas) return null;
    return (sessoesComCta / sessoesUnicas) * 100;
  }

  // Conversão da página = pedidos aprovados atribuídos ÷ sessões únicas.
  function conversaoPagina(pedidosAprovados, sessoesUnicas) {
    if (!sessoesUnicas) return null;
    return (pedidosAprovados / sessoesUnicas) * 100;
  }

  // Conversão do checkout = pedidos aprovados ÷ sessões que iniciaram checkout.
  function conversaoCheckout(pedidosAprovados, sessoesCheckout) {
    if (!sessoesCheckout) return null;
    return (pedidosAprovados / sessoesCheckout) * 100;
  }

  function cpa(investimento, vendasAprovadas) {
    if (!vendasAprovadas) return null;
    return investimento / vendasAprovadas;
  }

  function roas(receitaAtribuida, investimento) {
    if (!investimento) return null;
    return receitaAtribuida / investimento;
  }

  function lucro(receitaLiquida, investimento, outrosCustos) {
    return receitaLiquida - investimento - (outrosCustos || 0);
  }

  function margem(lucroValor, receitaLiquida) {
    if (!receitaLiquida) return null;
    return (lucroValor / receitaLiquida) * 100;
  }

  function ticketMedio(receita, vendasAprovadas) {
    if (!vendasAprovadas) return null;
    return receita / vendasAprovadas;
  }

  // ── NORMALIZAÇÃO DE UTM ── (mesma lógica usada no vendas.html)
  function normalizarOrigem(utmSourceBruto, utmMediumBruto) {
    const s = (utmSourceBruto || '').trim();
    const sLow = s.toLowerCase();
    let source = 'direct', placement = null;

    if (!s || sLow === 'direto' || sLow === 'direct') {
      source = 'direct';
    } else if (sLow === 'ig' || sLow.indexOf('instagram') >= 0) {
      source = 'instagram';
      if (sLow.indexOf('reel') >= 0) placement = 'instagram_reels';
      else if (sLow.indexOf('stor') >= 0) placement = 'instagram_stories';
      else if (sLow.indexOf('feed') >= 0) placement = 'instagram_feed';
    } else if (sLow.indexOf('facebook') >= 0 || sLow === 'fb') {
      source = 'facebook';
      if (sLow.indexOf('right_column') >= 0 || sLow.indexOf('right column') >= 0) placement = 'facebook_right_column';
      else if (sLow.indexOf('feed') >= 0) placement = 'facebook_feed';
    } else if (sLow === 'meta') {
      source = 'meta';
    } else {
      source = sLow.replace(/\s+/g, '_');
    }

    const mLow = (utmMediumBruto || '').toLowerCase();
    let medium = 'direct';
    if (source === 'direct') medium = 'direct';
    else if (mLow.indexOf('cpc') >= 0 || mLow.indexOf('paid') >= 0) medium = 'paid_social';
    else if (mLow.indexOf('organic') >= 0) medium = 'organic_social';
    else if (source === 'instagram' || source === 'facebook' || source === 'meta') medium = 'paid_social';
    else medium = 'referral';

    return {
      source, medium, placement,
      bruto_source: utmSourceBruto || '',
      bruto_medium: utmMediumBruto || '',
      label: source === 'direct' ? 'Direto/Orgânico' : (source.charAt(0).toUpperCase() + source.slice(1)),
    };
  }

  // Maior profundidade de scroll alcançada por sessão (não conta cada marco como evento
  // separado — pega só o máximo, pra não inflar contagem de sessões engajadas).
  function maiorScrollPorSessao(eventosScroll) {
    const max = {};
    eventosScroll.forEach(e => {
      const pct = parseInt(String(e.value || '0').replace('%', ''), 10) || 0;
      if (!max[e.session] || pct > max[e.session]) max[e.session] = pct;
    });
    return max;
  }

  const FORMULAS = {
    dataStrBR, hojeBR, somaDias,
    taxaCliqueCta, conversaoPagina, conversaoCheckout,
    cpa, roas, lucro, margem, ticketMedio,
    normalizarOrigem, maiorScrollPorSessao,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FORMULAS; // Node (testes)
  } else {
    root.FORMULAS = FORMULAS; // navegador (global)
  }
})(typeof window !== 'undefined' ? window : globalThis);
