/* Finanças G&L — cálculos puros, sem tela nem rede. Valores sempre em centavos (inteiros). */
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
  /* Pontua o valor enquanto se digita: "10000" vira "10.000". O ponto entra sozinho, então um
     ponto digitado vale como vírgula; se vierem 3 dígitos depois dele, era separador de milhar. */
  const CURSOR = '\u0000';
  function formatarDigitando(texto, cursor, { digitouPonto = false, virgulaDoPonto = false, negativo = false } = {}) {
    let v = texto.slice(0, cursor) + CURSOR + texto.slice(cursor);
    const menos = negativo && /^[^\d]*[-−]/.test(v);
    if (digitouPonto && v.charAt(cursor - 1) === '.') {
      const semEle = v.slice(0, cursor - 1) + v.slice(cursor);
      if (semEle.includes(',')) v = semEle;
      else {
        v = v.slice(0, cursor - 1) + ',' + v.slice(cursor);
        virgulaDoPonto = true;
      }
    }
    const limpo = v.replace(/[^\d,\u0000]/g, '');
    const i = limpo.indexOf(',');
    let inteiro = i < 0 ? limpo : limpo.slice(0, i);
    let decimais = i < 0 ? null : limpo.slice(i + 1).replace(/,/g, '');
    if (decimais !== null && virgulaDoPonto && decimais.replace(CURSOR, '').length >= 3) {
      inteiro += decimais;
      decimais = null;
    }
    if (decimais === null) virgulaDoPonto = false;
    if (decimais !== null) {
      let n = 0;
      decimais = [...decimais].filter((ch) => ch === CURSOR || (n < 2 && ++n)).join('');
    }
    inteiro = inteiro.replace(/^(\u0000?)0+(?=\u0000?\d)/, '$1');
    let agrupado = '';
    let digitos = 0;
    for (let k = inteiro.length - 1; k >= 0; k--) {
      const ch = inteiro[k];
      if (ch !== CURSOR) {
        if (digitos && digitos % 3 === 0) agrupado = '.' + agrupado;
        digitos += 1;
      }
      agrupado = ch + agrupado;
    }
    if (!digitos && decimais !== null) agrupado = '0' + agrupado;
    const saida = (menos ? '-' : '') + agrupado + (decimais !== null ? ',' + decimais : '');
    const pos = saida.indexOf(CURSOR);
    return { texto: saida.replace(CURSOR, ''), cursor: pos < 0 ? saida.length : pos, virgulaDoPonto };
  }

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
  const COLECOES = ['contas', 'categorias', 'lancamentos', 'recorrentes', 'metas', 'config', 'perfis'];

  /* Áreas: cada pessoa tem a sua, e há uma conjunta. Registro sem área é da primeira pessoa,
     que é quem já usava o app antes de existirem perfis. */
  const AREA_PRIMEIRA = 'p1';
  const AREA_SEGUNDA = 'p2';
  const AREA_CONJUNTA = 'conjunta';
  const areaDe = (r) => r.area || AREA_PRIMEIRA;

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

  /* Só os registros de uma área: todos os cálculos e telas trabalham em cima disto. */
  function visaoDaArea(estado, area) {
    const v = estadoVazio();
    COLECOES.forEach((c) => {
      if (c === 'perfis' || c === 'config') return;
      Object.entries(estado[c] || {}).forEach(([id, r]) => {
        if (areaDe(r) === area) v[c][id] = r;
      });
    });
    v.perfis = estado.perfis || {};
    const idGeral = area === AREA_PRIMEIRA ? 'geral' : `geral-${area}`;
    const config = estado.config || {};
    v.config = { geral: config[idGeral] || { id: idGeral, area, atualizadoEm: 1, variavelManual: null } };
    return v;
  }

  /* Contas e categorias iniciais de cada área, com IDs fixos para não duplicar entre aparelhos. */
  function padroesDaArea(area) {
    const base = estadoPadrao();
    if (area === AREA_PRIMEIRA) return base;
    const saida = estadoVazio();
    const contas = area === AREA_CONJUNTA
      ? [{ ...base.contas['ct-banco'], nome: 'Conta conjunta', grupo: 'Conjunta' }]
      : Object.values(base.contas);
    contas.forEach((r) => {
      const id = `${area}-${r.id}`;
      saida.contas[id] = { ...r, id, area };
    });
    Object.values(base.categorias).forEach((r) => {
      const id = `${area}-${r.id}`;
      saida.categorias[id] = { ...r, id, area };
    });
    const idGeral = `geral-${area}`;
    saida.config[idGeral] = { ...base.config.geral, id: idGeral, area };
    return saida;
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

  /* Gasto da conjunta pago por um dos dois: é gasto da conjunta, mas o dinheiro saiu da conta
     pessoal de quem pagou (num lançamento espelho), então não mexe no caixa da conjunta. */
  const movimentaCaixa = (l) => !l.semCaixa;

  /* Transferência entre contas da mesma área não é gasto nem entrada: o dinheiro continua seu.
     Entre áreas (sua → conjunta, sua → da outra pessoa) conta como saída de um lado e entrada do outro. */
  const soMudouDeConta = (l) => !!l.transferencia && !l.entreAreas;

  /* De onde sai a fatura: a conta escolhida no cartão; sem escolha, a principal do mesmo grupo. */
  function contaPagadora(estado, cartao) {
    const escolhida = cartao.contaPagamento && contaDe(estado, cartao.contaPagamento);
    if (escolhida && !escolhida.excluido && escolhida.tipo !== 'cartao') return escolhida;
    const candidatas = vivos(estado, 'contas').filter((c) => c.tipo !== 'cartao');
    const doGrupo = candidatas.filter((c) => c.grupo === cartao.grupo);
    const principal = (lista) => lista.find((c) => c.tipo === 'banco') || lista[0];
    return principal(doGrupo) || principal(candidatas) || null;
  }

  /* A conta que o lançamento movimenta de verdade: no cartão, a que paga a fatura. */
  function contaDoCaixa(estado, item) {
    const conta = contaDe(estado, item.contaId);
    return conta && conta.tipo === 'cartao' ? contaPagadora(estado, conta) : conta;
  }

  /* O saldo informado vale a partir de uma data: o que veio antes dela já está dentro dele. */
  function dataDoSaldo(estado, item) {
    const conta = contaDoCaixa(estado, item);
    return (conta && conta.saldoData) || null;
  }

  function jaNoSaldo(estado, item) {
    const corte = dataDoSaldo(estado, item);
    return !!corte && dataCaixa(estado, item) < corte;
  }

  /* Conta em aberto paga agora saiu depois do saldo informado, mesmo com vencimento anterior. */
  function dataDoPagamento(estado, item) {
    const corte = dataDoSaldo(estado, item);
    return !ehCartao(estado, item) && corte && item.data < corte ? corte : item.data;
  }

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
            id: `v:${rec.id}:${ym}`, virtual: true, recorrenteId: rec.id, competencia: ym, area: rec.area,
            transferencia: rec.transferencia, entreAreas: rec.entreAreas, acerto: rec.acerto, parRecorrente: rec.parId,
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

  function realDaOcorrencia(o, extras = {}) {
    return {
      id: `rc-${o.recorrenteId}-${o.competencia}`, tipo: o.tipo, descricao: o.descricao, valor: o.valor,
      categoriaId: o.categoriaId, contaId: o.contaId, data: o.data, certeza: 'certa', pago: true,
      recorrenteId: o.recorrenteId, competencia: o.competencia, area: o.area,
      ...(o.transferencia ? { transferencia: true } : {}),
      ...(o.entreAreas ? { entreAreas: true } : {}),
      ...(o.acerto ? { acerto: true } : {}),
      ...(o.parRecorrente ? { parId: `rc-${o.parRecorrente}-${o.competencia}` } : {}),
      ...extras,
    };
  }

  /* Criados pelo app, não por alguém: a data de edição mínima faz qualquer edição ou exclusão
     feita em outro aparelho vencer, mesmo que este ainda não tenha sincronizado. */
  const EDICAO_AUTOMATICA = 2;

  function fixosDoCartaoVencidos(visao, hoje, area) {
    return ocorrencias(visao, mesDe(hoje))
      .filter((o) => o.data <= hoje && ehCartao(visao, o) && !o.transferencia)
      .map((o) => realDaOcorrencia(o, { area, atualizadoEm: EDICAO_AUTOMATICA }));
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
      if (movimentaCaixa(l) && liquidado(estado, l, hoje) && !jaNoSaldo(estado, l)) total += sinal(l);
    });
    return total;
  }

  /* De onde vem o saldo de hoje: o que foi informado, mais o que entrou, menos o que saiu depois. */
  function composicaoSaldo(estado, hoje, grupo) {
    const contas = vivos(estado, 'contas').filter((c) => c.tipo !== 'cartao' && (!grupo || grupo === 'Tudo' || c.grupo === grupo));
    const informado = contas.reduce((s, c) => s + (c.saldoInicial || 0), 0);
    const datas = [...new Set(contas.filter((c) => c.saldoInicial || c.saldoData).map((c) => c.saldoData || null))];
    const r = { informado, desde: datas.length === 1 ? datas[0] : null, entrou: 0, saiu: 0, guardado: 0, antes: [] };
    lancamentosReais(estado, grupo).forEach((l) => {
      if (!movimentaCaixa(l) || !liquidado(estado, l, hoje)) return;
      if (jaNoSaldo(estado, l)) {
        r.antes.push(l);
        return;
      }
      if (l.metaId) r.guardado += l.valor;
      else if (l.tipo === 'receita') r.entrou += l.valor;
      else r.saiu += l.valor;
    });
    r.saldo = r.informado + r.entrou - r.saiu - r.guardado;
    r.antes.sort((a, b) => (dataCaixa(estado, a) < dataCaixa(estado, b) ? 1 : -1));
    return r;
  }

  function saldoConta(estado, conta, hoje) {
    let total = conta.saldoInicial || 0;
    vivos(estado, 'lancamentos').forEach((l) => {
      const caixa = contaDoCaixa(estado, l);
      if (movimentaCaixa(l) && caixa && caixa.id === conta.id && liquidado(estado, l, hoje) && !jaNoSaldo(estado, l)) total += sinal(l);
    });
    return total;
  }

  /* Ajustar ao banco: muda só o ponto de partida da conta, para o saldo de hoje bater com o banco. */
  function ajusteAoBanco(estado, conta, hoje, valorBanco) {
    const diferenca = valorBanco - saldoConta(estado, conta, hoje);
    return { saldoInicial: (conta.saldoInicial || 0) + diferenca, diferenca };
  }

  /* Marcados como pagos com data que ainda não chegou: já descontados no app, talvez não no banco. */
  function pagosAdiantados(estado, conta, hoje) {
    return vivos(estado, 'lancamentos')
      .filter((l) => {
        const caixa = contaDoCaixa(estado, l);
        return movimentaCaixa(l) && caixa && caixa.id === conta.id && !ehCartao(estado, l) && l.pago && l.data > hoje;
      })
      .sort((a, b) => (a.data < b.data ? -1 : 1));
  }

  /* Contas de antes da data do saldo: o saldo vale antes do primeiro movimento e da última edição. */
  function dataDoSaldoAntigo(estado, conta, hoje) {
    let menor = hojeLocal(new Date(conta.atualizadoEm));
    vivos(estado, 'lancamentos').forEach((l) => {
      const caixa = contaDoCaixa(estado, l);
      if (movimentaCaixa(l) && caixa && caixa.id === conta.id && liquidado(estado, l, hoje)) {
        const quando = dataCaixa(estado, l);
        if (quando < menor) menor = quando;
      }
    });
    return menor;
  }

  /* ---------- gastos variáveis: o que não é fixo nem parcela ---------- */
  const ehVariavel = (l) => l.tipo === 'despesa' && !l.recorrenteId && !l.parcelaGrupo && !l.planejado && !l.excepcional && !l.metaId && !l.transferencia;

  function gastoVariavel(estado, ym, grupo) {
    return lancamentosReais(estado, grupo)
      .filter((l) => ehVariavel(l) && mesDe(l.data) === ym)
      .reduce((s, l) => s + l.valor, 0);
  }

  /* O primeiro mês só conta inteiro se os lançamentos começaram nos primeiros dias. Com pelo menos
     15 dias, é proporcionalizado; com menos, é pouco para estimar. */
  const DIA_MES_INTEIRO = 5;
  const MINIMO_DIAS = 15;

  function gastoDoPrimeiroMes(gasto, primeiraData) {
    const [a, m, dia] = partes(primeiraData);
    if (dia <= DIA_MES_INTEIRO) return gasto;
    const total = diasNoMes(a, m);
    const cobertos = total - dia + 1;
    return cobertos >= MINIMO_DIAS ? Math.round((gasto * total) / cobertos) : null;
  }

  /* Média dos últimos 3 meses completos com dados; sem isso, ritmo do mês atual a partir de 10 dias. */
  function mediaVariavel(estado, hoje, grupo) {
    const manual = estado.config && estado.config.geral && estado.config.geral.variavelManual;
    if (manual != null && (!grupo || grupo === 'Tudo')) return { valor: manual, origem: 'manual', meses: 0 };
    const reais = lancamentosReais(estado, grupo).filter(ehVariavel);
    if (!reais.length) return { valor: 0, origem: 'sem-dados', meses: 0 };
    const primeiraData = reais.map((l) => l.data).sort()[0];
    const primeiroMes = mesDe(primeiraData);
    const mesAtual = mesDe(hoje);
    const valores = [];
    for (let i = 1; i <= 3; i++) {
      const ym = somaMeses(mesAtual, -i);
      if (ym < primeiroMes) break;
      const gasto = gastoVariavel(estado, ym, grupo);
      const valor = ym === primeiroMes ? gastoDoPrimeiroMes(gasto, primeiraData) : gasto;
      if (valor != null) valores.push(valor);
    }
    if (valores.length) {
      return { valor: Math.round(valores.reduce((a, b) => a + b, 0) / valores.length), origem: 'media', meses: valores.length };
    }
    const dia = partes(hoje)[2];
    const diaInicial = partes(primeiraData)[2];
    const comecouNoMes = primeiroMes === mesAtual && diaInicial > DIA_MES_INTEIRO;
    const dias = comecouNoMes ? dia - diaInicial + 1 : dia;
    if (dias >= 10) {
      const [a, m] = partes(hoje);
      const noMes = gastoVariavel(estado, mesAtual, grupo);
      return { valor: Math.round((noMes / dias) * diasNoMes(a, m)), origem: 'ritmo', meses: 0 };
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
      if (!movimentaCaixa(item) || liquidado(estado, item, hoje)) return;
      if (item.tipo === 'receita' && item.certeza === 'provavel' && !provaveis) return;
      soma(dataCaixa(estado, item), sinal(item));
    });
    fluxosSimulacao(sim, hoje, fim).forEach((f) => soma(f.data, f.valor));

    // Metas cujo dinheiro sai da conta: o valor mensal pesa até a meta ser alcançada.
    let metasMensal = 0;
    vivos(estado, 'metas').forEach((meta) => {
      if (!meta.contaId || !meta.aporte || !noGrupo(estado, meta, grupo)) return;
      let falta = meta.alvo - guardadoMeta(estado, meta);
      if (falta <= 0) return;
      metasMensal += meta.aporte;
      let ym = aporteDoMes(estado, meta, mesAtual) ? somaMeses(mesAtual, 1) : mesAtual;
      while (falta > 0 && ym <= ultimoMes) {
        const valor = Math.min(meta.aporte, falta);
        soma(ym === mesAtual ? hoje : `${ym}-01`, -valor);
        falta -= valor;
        ym = somaMeses(ym, 1);
      }
    });

    const mediaV = variavel != null ? variavel : mediaVariavel(estado, hoje, grupo).valor;
    const [ah, mh, dh] = partes(hoje);
    const jaGasto = gastoVariavel(estado, mesAtual, grupo);
    const restanteMes = Math.max(0, mediaV - jaGasto);
    const diasRestantes = diasNoMes(ah, mh) - dh + 1;

    let saldo = saldoHoje(estado, hoje, grupo);
    const finaisDeMes = [];
    let menor = { saldo: Infinity, data: hoje };
    let primeiroNegativo = null;
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
      if (saldo < 0 && !primeiroNegativo) primeiroNegativo = d;
      if (d === montaData(a, m, 31)) finaisDeMes.push({ mes: mesDe(d), saldo });
    }
    return { finaisDeMes, menor, primeiroNegativo, variavelMensal: mediaV, metasMensal, saldoFinal: saldo };
  }

  /* Reconstrói o saldo no fim dos meses passados a partir do que já foi liquidado. */
  function historicoSaldo(estado, hoje, meses, grupo = 'Tudo') {
    const atual = saldoHoje(estado, hoje, grupo);
    const itens = lancamentosReais(estado, grupo).filter((l) => movimentaCaixa(l) && liquidado(estado, l, hoje));
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
  /* Com "hoje", separa também o que já aconteceu do que ainda está previsto. */
  function resumoMes(estado, ym, grupo, hoje) {
    const itens = itensDoMes(estado, ym, grupo);
    const r = { entradasCertas: 0, entradasProvaveis: 0, saidas: 0, guardado: 0, transferido: 0, entrou: 0, saiu: 0, porCategoria: {}, qtd: itens.length };
    itens.forEach((i) => {
      if (hoje && !i.metaId && !soMudouDeConta(i) && liquidado(estado, i, hoje)) {
        if (i.tipo === 'receita') r.entrou += i.valor;
        else r.saiu += i.valor;
      }
      if (soMudouDeConta(i)) {
        // Dinheiro que só mudou de conta: mexe no saldo, mas não é gasto nem entrada.
        r.transferido += i.tipo === 'despesa' ? i.valor : 0;
      } else if (i.metaId) {
        // Dinheiro guardado sai do saldo, mas não é gasto.
        r.guardado += i.valor;
      } else if (i.tipo === 'receita') {
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
  function proximos(estado, hoje, dias, grupo, { entradas = false } = {}) {
    const limite = somaDias(hoje, dias);
    const itens = [...lancamentosReais(estado, grupo), ...ocorrencias(estado, mesDe(somaMeses(limite, 2)), grupo)]
      .filter((i) => movimentaCaixa(i) && !liquidado(estado, i, hoje) && (i.tipo === 'despesa' || (entradas && i.certeza !== 'provavel' && !ehCartao(estado, i))));
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
  /* O que já foi guardado: o valor informado mais o que saiu da conta por esta meta. */
  function guardadoMeta(estado, meta) {
    return vivos(estado, 'lancamentos')
      .filter((l) => l.metaId === meta.id)
      .reduce((s, l) => s + l.valor, meta.guardado || 0);
  }

  function aporteDoMes(estado, meta, ym) {
    return meta.ultimoAporte === ym || vivos(estado, 'lancamentos').some((l) => l.metaId === meta.id && mesDe(l.data) === ym);
  }

  /* Conta um valor por mês, a partir deste se ainda não foi guardado: registrar o valor
     em dia mantém a data; deixar um mês passar sem guardar a adia. */
  function previsaoMeta(meta, hoje, estado = {}) {
    const mes = mesDe(hoje);
    const falta = Math.max(0, meta.alvo - guardadoMeta(estado, meta));
    const feitoEsteMes = aporteDoMes(estado, meta, mes);
    if (falta === 0) return { falta, meses: 0, data: hoje, pronta: true, feitoEsteMes };
    if (!meta.aporte) return { falta, meses: null, data: null, pronta: false, feitoEsteMes };
    const meses = Math.ceil(falta / meta.aporte);
    return { falta, meses, data: somaMeses(mes, feitoEsteMes ? meses : meses - 1), pronta: false, feitoEsteMes };
  }

  /* ---------- acerto do casal ---------- */
  /* Positivo: a segunda pessoa deve à primeira; negativo: o contrário. Conta os gastos da conjunta
     pagos do bolso de um (pela divisão combinada) e desconta os acertos já feitos. */
  function acertoConjunta(estado, hoje, parteP1 = 50) {
    const p1 = Math.min(100, Math.max(0, parteP1)) / 100;
    let saldo = 0;
    vivos(estado, 'lancamentos').forEach((l) => {
      if (l.data > hoje) return;
      if (areaDe(l) === AREA_CONJUNTA && l.tipo === 'despesa' && l.pagoPor) {
        saldo += l.pagoPor === AREA_PRIMEIRA ? l.valor * (1 - p1) : -l.valor * p1;
      } else if (l.acerto && l.transferencia && l.tipo === 'despesa') {
        saldo += areaDe(l) === AREA_PRIMEIRA ? l.valor : -l.valor;
      }
    });
    return Math.round(saldo);
  }

  /* ---------- alertas ---------- */
  function alertas(estado, hoje, grupo) {
    const lista = [];
    const conservador = projetar(estado, hoje, 12, { grupo });
    if (conservador.menor.saldo < 0) {
      const dataBR = (d) => d.split('-').reverse().join('/');
      const primeiro = conservador.primeiroNegativo;
      lista.push({
        nivel: 'critico',
        titulo: primeiro === hoje ? 'O saldo está negativo' : `O saldo fica negativo em ${nomeMes(mesDe(primeiro))}`,
        texto: `Contando só as entradas certas, fica abaixo de zero em ${dataBR(primeiro)} e chega a ${reais(conservador.menor.saldo)} em ${dataBR(conservador.menor.data)}.`,
      });
    }
    const atrasados = proximos(estado, hoje, 0, grupo).filter((i) => i.atrasado);
    if (atrasados.length) {
      const soma = atrasados.reduce((s, i) => s + i.valor, 0);
      lista.push({ nivel: 'atencao', titulo: `${atrasados.length} ${atrasados.length > 1 ? 'contas vencidas sem confirmação' : 'conta vencida sem confirmação'}`, texto: `Somam ${reais(soma)}. Confirme o pagamento para o saldo ficar certo.` });
    }
    const naoRecebidas = proximos(estado, hoje, 0, grupo, { entradas: true }).filter((i) => i.atrasado && i.tipo === 'receita');
    if (naoRecebidas.length) {
      const soma = naoRecebidas.reduce((s, i) => s + i.valor, 0);
      lista.push({ nivel: 'atencao', titulo: `${naoRecebidas.length} ${naoRecebidas.length > 1 ? 'entradas previstas sem confirmação' : 'entrada prevista sem confirmação'}`, texto: `Somam ${reais(soma)}. Confirme o recebimento para o saldo ficar certo.` });
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
    COLECOES, AREA_PRIMEIRA, AREA_SEGUNDA, AREA_CONJUNTA, areaDe, visaoDaArea, padroesDaArea,
    somaMeses, somaDias, hojeLocal, nomeMes, mesDe, diasNoMes, lerReais, reais,
    vivos, estadoVazio, estadoPadrao, vencimentoFatura, dataCaixa, liquidado, ocorrencias,
    itensDoMes, saldoHoje, saldoConta, gastoVariavel, mediaVariavel, fluxosSimulacao, projetar,
    historicoSaldo, resumoMes, proximos, criarParcelas, parcelamentos, previsaoMeta, alertas,
    ehCartao, sinal, contaPagadora, dataDoSaldo, jaNoSaldo, dataDoPagamento, dataDoSaldoAntigo,
    realDaOcorrencia, fixosDoCartaoVencidos, guardadoMeta, aporteDoMes, composicaoSaldo, formatarDigitando,
    ajusteAoBanco, pagosAdiantados, acertoConjunta, movimentaCaixa, soMudouDeConta,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Fin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
