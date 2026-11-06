/* Livro-Caixa — cálculos puros, sem tela nem rede. Valores sempre em centavos (inteiros). */
(function (raiz) {
  'use strict';

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* ---------- datas (texto AAAA-MM-DD, sem fuso) ---------- */
  const doisDig = (n) => String(n).padStart(2, '0');
  const partes = (d) => d.split('-').map(Number);
  const diasNoMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
  const montaData = (a, m, d) => `${a}-${doisDig(m)}-${doisDig(Math.min(d, diasNoMes(a, m)))}`;
  const mesDe = (d) => d.slice(0, 7);

  function somaMeses(data, n) {
    const [a, m, d] = partes(data.length === 7 ? data + '-01' : data);
    const total = a * 12 + (m - 1) + n;
    const novoA = Math.floor(total / 12);
    const novoM = total % 12 + 1;
    const r = montaData(novoA, novoM, d);
    return data.length === 7 ? r.slice(0, 7) : r;
  }

  function somaDias(data, n) {
    const [a, m, d] = partes(data);
    const t = new Date(Date.UTC(a, m - 1, d + n));
    return `${t.getUTCFullYear()}-${doisDig(t.getUTCMonth() + 1)}-${doisDig(t.getUTCDate())}`;
  }

  function hojeLocal(agora = new Date()) {
    return `${agora.getFullYear()}-${doisDig(agora.getMonth() + 1)}-${doisDig(agora.getDate())}`;
  }

  function nomeMes(ym, longo = false) {
    const [a, m] = partes(ym);
    return longo ? `${MESES_LONGOS[m - 1]} de ${a}` : `${MESES[m - 1]}/${String(a).slice(2)}`;
  }

  /* ---------- dinheiro ---------- */
  function lerReais(texto) {
    if (typeof texto === 'number') return Math.round(texto * 100);
    let t = String(texto || '').replace(/[^\d.,-]/g, '');
    if (!t) return 0;
    const virgula = t.lastIndexOf(',');
    const ponto = t.lastIndexOf('.');
    if (virgula > ponto) t = t.replace(/\./g, '').replace(',', '.');
    else if (ponto > -1 && t.length - ponto - 1 === 3 && t.indexOf('.') !== ponto) t = t.replace(/\./g, '');
    else if (ponto > -1 && t.length - ponto - 1 === 3) t = t.replace('.', '');
    else t = t.replace(/,/g, '');
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  function reais(c, { compacto = false, sinal = false } = {}) {
    const v = Math.abs(c) / 100;
    let s;
    if (compacto && v >= 1000) {
      const mil = v / 1000;
      s = 'R$ ' + mil.toLocaleString('pt-BR', { maximumFractionDigits: mil >= 100 ? 0 : 1 }) + ' mil';
    } else {
      s = 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (c < 0) return '−' + s;
    return sinal && c > 0 ? '+' + s : s;
  }

  /* ---------- estado ---------- */
  const COLECOES = ['contas', 'categorias', 'lancamentos', 'recorrentes', 'metas', 'config'];

  function vivos(estado, colecao) {
    return Object.values(estado[colecao] || {}).filter((r) => !r.excluido);
  }

  function estadoVazio() {
    const e = {};
    COLECOES.forEach((c) => { e[c] = {}; });
    return e;
  }

  /* IDs fixos: ao ligar um segundo aparelho, os padrões não duplicam. */
  function estadoPadrao() {
    const e = estadoVazio();
    const r = (id, dados) => ({ id, atualizadoEm: 1, ...dados });
    [
      ['ct-banco', { nome: 'Conta corrente', tipo: 'banco', grupo: 'Pessoal', saldoInicial: 0 }],
      ['ct-dinheiro', { nome: 'Dinheiro', tipo: 'carteira', grupo: 'Pessoal', saldoInicial: 0 }],
    ].forEach(([id, d]) => { e.contas[id] = r(id, d); });
    [
      ['Moradia', 'despesa'], ['Mercado', 'despesa'], ['Transporte e carro', 'despesa'],
      ['Saúde', 'despesa'], ['Alimentação fora', 'despesa'], ['Lazer', 'despesa'],
      ['Contas e assinaturas', 'despesa'], ['Educação', 'despesa'], ['Impostos e taxas', 'despesa'],
      ['Outras despesas', 'despesa'],
      ['Salário', 'receita'], ['Honorários', 'receita'], ['Outras entradas', 'receita'],
    ].forEach(([nome, tipo]) => {
      const id = 'cat-' + nome.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase();
      e.categorias[id] = r(id, { nome, tipo, limite: 0 });
    });
    e.config.geral = r('geral', { variavelManual: null });
    return e;
  }

  const contaDe = (estado, id) => (estado.contas || {})[id];

  function noGrupo(estado, item, grupo) {
    if (!grupo || grupo === 'Tudo') return true;
    const conta = contaDe(estado, item.contaId);
    return !!conta && conta.grupo === grupo;
  }

  /* ---------- cartão: quando a compra sai do caixa ---------- */
  function vencimentoFatura(conta, dataCompra) {
    const [a, m, d] = partes(dataCompra);
    const fecha = conta.fechamento || 1;
    const vence = conta.vencimento || 10;
    // Compra no dia do fechamento ou depois cai na fatura seguinte.
    const mesFechamento = somaMeses(`${a}-${doisDig(m)}`, d >= fecha ? 1 : 0);
    const mesVencimento = vence > fecha ? mesFechamento : somaMeses(mesFechamento, 1);
    const [av, mv] = partes(mesVencimento);
    return montaData(av, mv, vence);
  }

  function dataCaixa(estado, item) {
    const conta = contaDe(estado, item.contaId);
    return conta && conta.tipo === 'cartao' ? vencimentoFatura(conta, item.data) : item.data;
  }

  const ehCartao = (estado, item) => {
    const conta = contaDe(estado, item.contaId);
    return !!conta && conta.tipo === 'cartao';
  };

  const sinal = (item) => (item.tipo === 'receita' ? item.valor : -item.valor);

  /* Já saiu (ou entrou) do caixa? No cartão isso acontece no vencimento da fatura. */
  function liquidado(estado, item, hoje) {
    if (item.virtual) return false;
    return ehCartao(estado, item) ? dataCaixa(estado, item) <= hoje : !!item.pago;
  }

  /* ---------- fixos: viram itens "virtuais" até serem confirmados ---------- */
  function ocorrencias(estado, ateMes, grupo) {
    const reais = new Set();
    vivos(estado, 'lancamentos').forEach((l) => {
      if (l.recorrenteId) reais.add(l.recorrenteId + '|' + l.competencia);
    });
    const saida = [];
    vivos(estado, 'recorrentes').forEach((rec) => {
      if (!noGrupo(estado, rec, grupo)) return;
      const pulados = new Set(rec.pulados || []);
      let ym = mesDe(rec.inicio);
      const dia = partes(rec.inicio)[2];
      while (ym <= ateMes && (!rec.fim || ym <= rec.fim)) {
        if (!reais.has(rec.id + '|' + ym) && !pulados.has(ym)) {
          const [a, m] = partes(ym);
          saida.push({
            id: `v:${rec.id}:${ym}`, virtual: true, recorrenteId: rec.id, competencia: ym,
            tipo: rec.tipo, descricao: rec.descricao, valor: rec.valor,
            categoriaId: rec.categoriaId, contaId: rec.contaId,
            data: montaData(a, m, dia), certeza: rec.certeza || 'certa', pago: false,
          });
        }
        ym = somaMeses(ym, 1);
      }
    });
    return saida;
  }

  function lancamentosReais(estado, grupo) {
    return vivos(estado, 'lancamentos').filter((l) => noGrupo(estado, l, grupo));
  }

  function itensDoMes(estado, ym, grupo) {
    return [
      ...lancamentosReais(estado, grupo).filter((l) => mesDe(l.data) === ym),
      ...ocorrencias(estado, ym, grupo).filter((o) => mesDe(o.data) === ym),
    ].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  /* ---------- saldo de hoje ---------- */
  function saldoHoje(estado, hoje, grupo) {
    let total = 0;
    vivos(estado, 'contas').forEach((c) => {
      if (c.tipo !== 'cartao' && (!grupo || grupo === 'Tudo' || c.grupo === grupo)) total += c.saldoInicial || 0;
    });
    lancamentosReais(estado, grupo).forEach((l) => {
      if (liquidado(estado, l, hoje)) total += sinal(l);
    });
    return total;
  }

  function saldoConta(estado, conta, hoje) {
    let total = conta.saldoInicial || 0;
    vivos(estado, 'lancamentos').forEach((l) => {
      if (l.contaId === conta.id && liquidado(estado, l, hoje)) total += sinal(l);
    });
    return total;
  }

  /* ---------- gastos variáveis: o que não é fixo nem parcela ---------- */
  const ehVariavel = (l) => l.tipo === 'despesa' && !l.recorrenteId && !l.parcelaGrupo && !l.planejado;

  function gastoVariavel(estado, ym, grupo) {
    return lancamentosReais(estado, grupo)
      .filter((l) => ehVariavel(l) && mesDe(l.data) === ym)
      .reduce((s, l) => s + l.valor, 0);
  }

  /* Média dos últimos 3 meses completos com dados; sem isso, ritmo do mês atual a partir do dia 10. */
  function mediaVariavel(estado, hoje, grupo) {
    const manual = estado.config && estado.config.geral && estado.config.geral.variavelManual;
    if (manual != null && (!grupo || grupo === 'Tudo')) return { valor: manual, origem: 'manual', meses: 0 };
    const reais = lancamentosReais(estado, grupo).filter(ehVariavel);
    if (!reais.length) return { valor: 0, origem: 'sem-dados', meses: 0 };
    const primeiroMes = reais.map((l) => mesDe(l.data)).sort()[0];
    const mesAtual = mesDe(hoje);
    const valores = [];
    for (let i = 1; i <= 3; i++) {
      const ym = somaMeses(mesAtual, -i);
      if (ym < primeiroMes) break;
      valores.push(gastoVariavel(estado, ym, grupo));
    }
    if (valores.length) {
      return { valor: Math.round(valores.reduce((a, b) => a + b, 0) / valores.length), origem: 'media', meses: valores.length };
    }
    const dia = partes(hoje)[2];
    if (dia >= 10) {
      const [a, m] = partes(hoje);
      const noMes = gastoVariavel(estado, mesAtual, grupo);
      return { valor: Math.round((noMes / dia) * diasNoMes(a, m)), origem: 'ritmo', meses: 0 };
    }
    return { valor: 0, origem: 'sem-dados', meses: 0 };
  }

  /* ---------- simulação "e se" ---------- */
  function fluxosSimulacao(sim, hoje, ateData) {
    if (!sim || !sim.valor) return [];
    const inicio = sim.inicio || hoje;
    const fluxos = [];
    if (sim.tipo === 'compra') {
      const n = Math.max(1, sim.parcelas || 1);
      const base = Math.floor(sim.valor / n);
      for (let i = 0; i < n; i++) {
        const v = i === 0 ? sim.valor - base * (n - 1) : base;
        fluxos.push({ data: somaMeses(inicio, i), valor: -v });
      }
    } else {
      const v = sim.tipo === 'renda' || sim.tipo === 'corte' ? sim.valor : -sim.valor;
      for (let d = inicio; d <= ateData; d = somaMeses(d, 1)) fluxos.push({ data: d, valor: v });
    }
    return fluxos.filter((f) => f.data <= ateData);
  }

  /* ---------- projeção do saldo, dia a dia ---------- */
  function projetar(estado, hoje, meses, { provaveis = false, grupo = 'Tudo', sim = null, variavel } = {}) {
    const mesAtual = mesDe(hoje);
    const ultimoMes = somaMeses(mesAtual, meses);
    const [au, mu] = partes(ultimoMes);
    const fim = montaData(au, mu, 31);

    const fluxo = new Map();
    const soma = (data, v) => {
      const d = data < hoje ? hoje : data;
      if (d <= fim) fluxo.set(d, (fluxo.get(d) || 0) + v);
    };

    [...lancamentosReais(estado, grupo), ...ocorrencias(estado, ultimoMes, grupo)].forEach((item) => {
      if (liquidado(estado, item, hoje)) return;
      if (item.tipo === 'receita' && item.certeza === 'provavel' && !provaveis) return;
      soma(dataCaixa(estado, item), sinal(item));
    });
    fluxosSimulacao(sim, hoje, fim).forEach((f) => soma(f.data, f.valor));

    const mediaV = variavel != null ? variavel : mediaVariavel(estado, hoje, grupo).valor;
    const [ah, mh, dh] = partes(hoje);
    const jaGasto = gastoVariavel(estado, mesAtual, grupo);
    const restanteMes = Math.max(0, mediaV - jaGasto);
    const diasRestantes = diasNoMes(ah, mh) - dh + 1;

    let saldo = saldoHoje(estado, hoje, grupo);
    const finaisDeMes = [];
    let menor = { saldo: Infinity, data: hoje };
    let acumulado = 0;

    for (let d = hoje; d <= fim; d = somaDias(d, 1)) {
      const [a, m] = partes(d);
      const noMes = mesDe(d) === mesAtual;
      const diaria = noMes ? restanteMes / diasRestantes : mediaV / diasNoMes(a, m);
      acumulado += diaria;
      const inteiro = Math.round(acumulado);
      acumulado -= inteiro;
      saldo += (fluxo.get(d) || 0) - inteiro;
      if (saldo < menor.saldo) menor = { saldo, data: d };
      if (d === montaData(a, m, 31)) finaisDeMes.push({ mes: mesDe(d), saldo });
    }
    return { finaisDeMes, menor, variavelMensal: mediaV, saldoFinal: saldo };
  }

  /* Reconstrói o saldo no fim dos meses passados a partir do que já foi liquidado. */
  function historicoSaldo(estado, hoje, meses, grupo = 'Tudo') {
    const atual = saldoHoje(estado, hoje, grupo);
    const itens = lancamentosReais(estado, grupo).filter((l) => liquidado(estado, l, hoje));
    const saida = [];
    for (let i = meses; i >= 1; i--) {
      const ym = somaMeses(mesDe(hoje), -i);
      const [a, m] = partes(ym);
      const fimDoMes = montaData(a, m, 31);
      const depois = itens.reduce((s, l) => s + (dataCaixa(estado, l) > fimDoMes ? sinal(l) : 0), 0);
      saida.push({ mes: ym, saldo: atual - depois });
    }
    return saida;
  }

  /* ---------- resumo do mês, por data do lançamento ---------- */
  function resumoMes(estado, ym, grupo) {
    const itens = itensDoMes(estado, ym, grupo);
    const r = { entradasCertas: 0, entradasProvaveis: 0, saidas: 0, porCategoria: {}, qtd: itens.length };
    itens.forEach((i) => {
      if (i.tipo === 'receita') {
        if (i.certeza === 'provavel') r.entradasProvaveis += i.valor;
        else r.entradasCertas += i.valor;
      } else {
        r.saidas += i.valor;
        r.porCategoria[i.categoriaId] = (r.porCategoria[i.categoriaId] || 0) + i.valor;
      }
    });
    r.entradas = r.entradasCertas;
    r.sobra = r.entradasCertas - r.saidas;
    return r;
  }

  /* ---------- próximos vencimentos ---------- */
  function proximos(estado, hoje, dias, grupo) {
    const limite = somaDias(hoje, dias);
    const itens = [...lancamentosReais(estado, grupo), ...ocorrencias(estado, mesDe(somaMeses(limite, 2)), grupo)]
      .filter((i) => i.tipo === 'despesa' && !liquidado(estado, i, hoje));
    const faturas = new Map();
    const avulsos = [];
    itens.forEach((i) => {
      const quando = dataCaixa(estado, i);
      if (quando > limite) return;
      if (ehCartao(estado, i)) {
        const chave = i.contaId + '|' + quando;
        const f = faturas.get(chave) || { id: 'f:' + chave, fatura: true, contaId: i.contaId, descricao: 'Fatura ' + contaDe(estado, i.contaId).nome, valor: 0, quando };
        f.valor += i.valor;
        faturas.set(chave, f);
      } else {
        avulsos.push({ ...i, quando });
      }
    });
    return [...avulsos, ...faturas.values()]
      .map((i) => ({ ...i, atrasado: i.quando < hoje }))
      .sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));
  }

  /* ---------- parcelas ---------- */
  function criarParcelas(base, parcelas, novoId, agora) {
    const n = Math.max(1, parcelas);
    const unidade = Math.floor(base.valor / n);
    const grupo = n > 1 ? novoId() : null;
    const lista = [];
    for (let i = 0; i < n; i++) {
      lista.push({
        ...base,
        id: novoId(),
        atualizadoEm: agora,
        data: somaMeses(base.data, i),
        // A primeira parcela absorve os centavos que sobram da divisão.
        valor: i === 0 ? base.valor - unidade * (n - 1) : unidade,
        pago: i === 0 ? !!base.pago : false,
        ...(grupo ? { parcelaGrupo: grupo, parcela: i + 1, parcelas: n } : {}),
      });
    }
    return lista;
  }

  function parcelamentos(estado, hoje, grupoFiltro) {
    const mapa = new Map();
    lancamentosReais(estado, grupoFiltro).filter((l) => l.parcelaGrupo).forEach((l) => {
      const g = mapa.get(l.parcelaGrupo) || { id: l.parcelaGrupo, descricao: l.descricao, contaId: l.contaId, total: 0, restante: 0, pagas: 0, parcelas: l.parcelas, ultima: l.data, valorParcela: l.valor };
      g.total += l.valor;
      const quitada = liquidado(estado, l, hoje);
      if (quitada) g.pagas += 1; else g.restante += l.valor;
      if (l.data > g.ultima) g.ultima = l.data;
      mapa.set(l.parcelaGrupo, g);
    });
    return [...mapa.values()].sort((a, b) => b.restante - a.restante);
  }

  /* ---------- metas ---------- */
  function previsaoMeta(meta, hoje) {
    const falta = Math.max(0, meta.alvo - (meta.guardado || 0));
    if (falta === 0) return { falta, meses: 0, data: hoje, pronta: true };
    if (!meta.aporte) return { falta, meses: null, data: null, pronta: false };
    const meses = Math.ceil(falta / meta.aporte);
    return { falta, meses, data: somaMeses(mesDe(hoje), meses), pronta: false };
  }

  /* ---------- alertas ---------- */
  function alertas(estado, hoje, grupo) {
    const lista = [];
    const conservador = projetar(estado, hoje, 12, { grupo });
    if (conservador.menor.saldo < 0) {
      lista.push({
        nivel: 'critico', titulo: `O saldo fica negativo em ${nomeMes(mesDe(conservador.menor.data))}`,
        texto: `Contando só as entradas certas, chega a ${reais(conservador.menor.saldo)} em ${conservador.menor.data.split('-').reverse().join('/')}.`,
      });
    }
    const atrasados = proximos(estado, hoje, 0, grupo).filter((i) => i.atrasado);
    if (atrasados.length) {
      const soma = atrasados.reduce((s, i) => s + i.valor, 0);
      lista.push({ nivel: 'atencao', titulo: `${atrasados.length} ${atrasados.length > 1 ? 'contas vencidas sem confirmação' : 'conta vencida sem confirmação'}`, texto: `Somam ${reais(soma)}. Confirme o pagamento para o saldo ficar certo.` });
    }
    const resumo = resumoMes(estado, mesDe(hoje), grupo);
    vivos(estado, 'categorias').filter((c) => c.tipo === 'despesa' && c.limite > 0).forEach((c) => {
      const gasto = resumo.porCategoria[c.id] || 0;
      if (gasto > c.limite) lista.push({ nivel: 'critico', titulo: `${c.nome} passou do limite`, texto: `${reais(gasto)} de ${reais(c.limite)} neste mês.` });
      else if (gasto >= c.limite * 0.8) lista.push({ nivel: 'atencao', titulo: `${c.nome} está perto do limite`, texto: `${reais(gasto)} de ${reais(c.limite)} neste mês.` });
    });
    return lista;
  }

  const api = {
    COLECOES, somaMeses, somaDias, hojeLocal, nomeMes, mesDe, diasNoMes, lerReais, reais,
    vivos, estadoVazio, estadoPadrao, vencimentoFatura, dataCaixa, liquidado, ocorrencias,
    itensDoMes, saldoHoje, saldoConta, gastoVariavel, mediaVariavel, fluxosSimulacao, projetar,
    historicoSaldo, resumoMes, proximos, criarParcelas, parcelamentos, previsaoMeta, alertas,
    ehCartao, sinal,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Fin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
