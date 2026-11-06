const test = require('node:test');
const assert = require('node:assert/strict');
const Fin = require('../logica.js');

const HOJE = '2026-11-06';
let seq = 0;
const novoId = () => 'id' + ++seq;

function base() {
  const e = Fin.estadoPadrao();
  e.contas['ct-banco'].saldoInicial = 100000; // R$ 1.000,00
  e.contas.visa = { id: 'visa', nome: 'Visa', tipo: 'cartao', grupo: 'Pessoal', fechamento: 25, vencimento: 5, atualizadoEm: 1 };
  e.contas.esc = { id: 'esc', nome: 'Escritório', tipo: 'banco', grupo: 'Escritório', saldoInicial: 50000, atualizadoEm: 1 };
  return e;
}
const lanc = (e, dados) => {
  const id = novoId();
  e.lancamentos[id] = { id, atualizadoEm: 2, tipo: 'despesa', categoriaId: 'x', contaId: 'ct-banco', certeza: 'certa', pago: true, ...dados };
  return e.lancamentos[id];
};

test('lerReais entende os formatos brasileiros', () => {
  assert.equal(Fin.lerReais('1.234,56'), 123456);
  assert.equal(Fin.lerReais('R$ 12,5'), 1250);
  assert.equal(Fin.lerReais('1234.56'), 123456);
  assert.equal(Fin.lerReais('1.234'), 123400);
  assert.equal(Fin.lerReais('1.234.567'), 123456700);
  assert.equal(Fin.lerReais('10.5'), 1050);
  assert.equal(Fin.lerReais(''), 0);
  assert.equal(Fin.lerReais('abc'), 0);
});

test('reais formata negativo e compacto', () => {
  const norm = (s) => s.replace(/ /g, ' ');
  assert.equal(norm(Fin.reais(123456)), 'R$ 1.234,56');
  assert.equal(norm(Fin.reais(-500)), '−R$ 5,00');
  assert.equal(norm(Fin.reais(1250000, { compacto: true })), 'R$ 12,5 mil');
});

test('somaMeses ajusta o fim do mês e a virada de ano', () => {
  assert.equal(Fin.somaMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(Fin.somaMeses('2026-12-15', 1), '2027-01-15');
  assert.equal(Fin.somaMeses('2026-03', -3), '2025-12');
  assert.equal(Fin.somaMeses('2028-01-31', 1), '2028-02-29');
});

test('fatura: compra antes e depois do fechamento', () => {
  const c = { tipo: 'cartao', fechamento: 25, vencimento: 5 };
  assert.equal(Fin.vencimentoFatura(c, '2026-11-10'), '2026-12-05');
  assert.equal(Fin.vencimentoFatura(c, '2026-11-25'), '2027-01-05');
  assert.equal(Fin.vencimentoFatura(c, '2026-12-30'), '2027-02-05');
  const mesmoMes = { tipo: 'cartao', fechamento: 3, vencimento: 20 };
  assert.equal(Fin.vencimentoFatura(mesmoMes, '2026-11-02'), '2026-11-20');
  assert.equal(Fin.vencimentoFatura(mesmoMes, '2026-11-03'), '2026-12-20');
});

test('saldo de hoje: pago conta, futuro não, cartão só depois do vencimento', () => {
  const e = base();
  lanc(e, { valor: 10000, data: '2026-11-01' });
  lanc(e, { valor: 99900, data: '2026-11-20', pago: false });
  lanc(e, { valor: 20000, data: '2026-11-02', tipo: 'receita' });
  lanc(e, { valor: 3000, data: '2026-11-05', contaId: 'visa' }); // vence 05/12: ainda não saiu
  lanc(e, { valor: 4000, data: '2026-10-10', contaId: 'visa' }); // venceu 05/11: já saiu
  assert.equal(Fin.saldoHoje(e, HOJE), 100000 + 50000 - 10000 + 20000 - 4000);
});

test('filtro de grupo separa pessoal e escritório', () => {
  const e = base();
  lanc(e, { valor: 10000, data: '2026-11-01', contaId: 'esc' });
  assert.equal(Fin.saldoHoje(e, HOJE, 'Pessoal'), 100000);
  assert.equal(Fin.saldoHoje(e, HOJE, 'Escritório'), 40000);
  assert.equal(Fin.saldoHoje(e, HOJE, 'Tudo'), 140000);
});

test('parcelas somam exatamente o total e caem nos meses certos', () => {
  const lista = Fin.criarParcelas({ tipo: 'despesa', valor: 100000, data: '2026-01-31', descricao: 'TV', contaId: 'ct-banco', pago: true }, 3, novoId, 5);
  assert.equal(lista.reduce((s, l) => s + l.valor, 0), 100000);
  assert.deepEqual(lista.map((l) => l.data), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(lista.map((l) => l.pago), [true, false, false]);
  assert.equal(lista[2].parcela, 3);
  assert.equal(lista[0].parcelas, 3);
  assert.ok(lista[0].parcelaGrupo);
});

test('fixo vira ocorrência e some quando confirmado ou pulado', () => {
  const e = base();
  e.recorrentes.r1 = { id: 'r1', tipo: 'despesa', descricao: 'Aluguel', valor: 150000, inicio: '2026-09-31'.replace('09-31', '09-30'), contaId: 'ct-banco', categoriaId: 'x', atualizadoEm: 2, pulados: ['2026-10'] };
  const ate = Fin.ocorrencias(e, '2027-02');
  assert.deepEqual(ate.map((o) => o.data), ['2026-09-30', '2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28']);
  lanc(e, { valor: 150000, data: '2026-09-30', recorrenteId: 'r1', competencia: '2026-09' });
  assert.equal(Fin.ocorrencias(e, '2026-09').length, 0);
});

test('fixo respeita a data final', () => {
  const e = base();
  e.recorrentes.r1 = { id: 'r1', tipo: 'despesa', descricao: 'Curso', valor: 100, inicio: '2026-11-10', fim: '2026-12', contaId: 'ct-banco', categoriaId: 'x', atualizadoEm: 2 };
  assert.equal(Fin.ocorrencias(e, '2027-06').length, 2);
});

test('projeção: entradas prováveis ficam fora do cenário conservador', () => {
  const e = base();
  e.config.geral.variavelManual = 0;
  lanc(e, { tipo: 'receita', valor: 500000, data: '2026-12-10', pago: false, certeza: 'provavel' });
  lanc(e, { tipo: 'receita', valor: 100000, data: '2026-12-11', pago: false, certeza: 'certa' });
  const cons = Fin.projetar(e, HOJE, 2);
  const otim = Fin.projetar(e, HOJE, 2, { provaveis: true });
  assert.equal(cons.saldoFinal, 150000 + 100000);
  assert.equal(otim.saldoFinal, 150000 + 600000);
});

test('projeção: conta vencida sem confirmar pesa a partir de hoje e cartão pesa na fatura', () => {
  const e = base();
  e.config.geral.variavelManual = 0;
  lanc(e, { valor: 30000, data: '2026-10-01', pago: false });
  lanc(e, { valor: 50000, data: '2026-11-10', contaId: 'visa' }); // vence 05/12
  const p = Fin.projetar(e, HOJE, 2);
  const porMes = Object.fromEntries(p.finaisDeMes.map((f) => [f.mes, f.saldo]));
  assert.equal(porMes['2026-11'], 150000 - 30000);
  assert.equal(porMes['2026-12'], 150000 - 30000 - 50000);
});

test('projeção: gasto variável estimado desconta o que já foi gasto no mês', () => {
  const e = base();
  e.config.geral.variavelManual = 30000;
  lanc(e, { valor: 10000, data: '2026-11-02' });
  const p = Fin.projetar(e, HOJE, 1);
  const porMes = Object.fromEntries(p.finaisDeMes.map((f) => [f.mes, f.saldo]));
  assert.equal(porMes['2026-11'], 150000 - 10000 - 20000);
  assert.equal(porMes['2026-12'], 150000 - 10000 - 20000 - 30000);
});

test('projeção encontra o menor saldo mesmo quando o mês fecha positivo', () => {
  const e = base();
  e.config.geral.variavelManual = 0;
  lanc(e, { valor: 200000, data: '2026-11-10', pago: false });
  lanc(e, { tipo: 'receita', valor: 300000, data: '2026-11-20', pago: false });
  const p = Fin.projetar(e, HOJE, 1);
  assert.equal(p.menor.saldo, 150000 - 200000);
  assert.equal(p.menor.data, '2026-11-10');
  assert.equal(p.finaisDeMes[0].saldo, 250000);
});

test('média de variáveis usa até 3 meses completos e ignora fixos e parcelas', () => {
  const e = base();
  lanc(e, { valor: 30000, data: '2026-08-05' });
  lanc(e, { valor: 60000, data: '2026-10-05' });
  lanc(e, { valor: 90000, data: '2026-10-05', recorrenteId: 'r', competencia: '2026-10' });
  lanc(e, { valor: 90000, data: '2026-10-05', parcelaGrupo: 'g', parcela: 1, parcelas: 2 });
  const m = Fin.mediaVariavel(e, HOJE);
  assert.equal(m.origem, 'media');
  assert.equal(m.meses, 3);
  assert.equal(m.valor, 30000);
});

test('média sem mês completo usa o ritmo só a partir do dia 10', () => {
  const e = base();
  lanc(e, { valor: 10000, data: '2026-11-02' });
  assert.equal(Fin.mediaVariavel(e, '2026-11-06').origem, 'sem-dados');
  const m = Fin.mediaVariavel(e, '2026-11-15');
  assert.equal(m.origem, 'ritmo');
  assert.equal(m.valor, 20000);
});

test('simulação: compra parcelada e corte mudam o saldo final', () => {
  const e = base();
  e.config.geral.variavelManual = 0;
  const compra = Fin.projetar(e, HOJE, 12, { sim: { tipo: 'compra', valor: 120000, parcelas: 10, inicio: '2026-12-01' } });
  assert.equal(compra.saldoFinal, 150000 - 120000);
  const corte = Fin.projetar(e, HOJE, 2, { sim: { tipo: 'corte', valor: 10000, inicio: '2026-11-15' } });
  assert.equal(corte.saldoFinal, 150000 + 30000);
});

test('histórico reconstrói o saldo no fim dos meses passados', () => {
  const e = base();
  lanc(e, { valor: 10000, data: '2026-10-15' });
  lanc(e, { valor: 5000, data: '2026-11-02' });
  const h = Fin.historicoSaldo(e, HOJE, 2);
  assert.deepEqual(h.map((x) => x.mes), ['2026-09', '2026-10']);
  assert.equal(h[1].saldo, 150000 - 10000);
  assert.equal(h[0].saldo, 150000);
});

test('resumo do mês soma fixos previstos e separa prováveis', () => {
  const e = base();
  e.recorrentes.r1 = { id: 'r1', tipo: 'despesa', descricao: 'Aluguel', valor: 150000, inicio: '2026-11-30', contaId: 'ct-banco', categoriaId: 'mor', atualizadoEm: 2 };
  lanc(e, { tipo: 'receita', valor: 500000, data: '2026-11-05' });
  lanc(e, { tipo: 'receita', valor: 200000, data: '2026-11-25', pago: false, certeza: 'provavel' });
  const r = Fin.resumoMes(e, '2026-11');
  assert.equal(r.saidas, 150000);
  assert.equal(r.entradasCertas, 500000);
  assert.equal(r.entradasProvaveis, 200000);
  assert.equal(r.sobra, 350000);
  assert.equal(r.porCategoria.mor, 150000);
});

test('próximos agrupa o cartão em uma fatura e marca o que venceu', () => {
  const e = base();
  lanc(e, { valor: 1000, data: '2026-11-01', contaId: 'visa' });
  lanc(e, { valor: 2000, data: '2026-11-03', contaId: 'visa' });
  lanc(e, { valor: 500, data: '2026-11-01', pago: false, descricao: 'Luz' });
  const p = Fin.proximos(e, HOJE, 35);
  assert.equal(p.length, 2);
  assert.equal(p[0].atrasado, true);
  assert.equal(p[1].fatura, true);
  assert.equal(p[1].valor, 3000);
  assert.equal(p[1].quando, '2026-12-05');
});

test('previsão de meta', () => {
  assert.deepEqual(Fin.previsaoMeta({ alvo: 300000, guardado: 100000, aporte: 50000 }, HOJE), { falta: 200000, meses: 4, data: '2027-03', pronta: false });
  assert.equal(Fin.previsaoMeta({ alvo: 100, guardado: 100 }, HOJE).pronta, true);
  assert.equal(Fin.previsaoMeta({ alvo: 100, guardado: 0 }, HOJE).meses, null);
});

test('áreas: dados antigos ficam com a primeira pessoa e nada se mistura', () => {
  const e = base();
  Object.values(Fin.padroesDaArea('p2').contas).forEach((c) => { e.contas[c.id] = { ...c, saldoInicial: c.id === 'p2-ct-banco' ? 70000 : 0 }; });
  Object.values(Fin.padroesDaArea('conjunta').contas).forEach((c) => { e.contas[c.id] = { ...c, saldoInicial: 20000 }; });
  const antigo = lanc(e, { valor: 1000, data: '2026-11-01' });
  const dela = lanc(e, { valor: 2000, data: '2026-11-01', area: 'p2', contaId: 'p2-ct-banco' });
  const junto = lanc(e, { valor: 3000, data: '2026-11-01', area: 'conjunta', contaId: 'conjunta-ct-banco' });

  const v1 = Fin.visaoDaArea(e, 'p1');
  const v2 = Fin.visaoDaArea(e, 'p2');
  const vc = Fin.visaoDaArea(e, 'conjunta');
  assert.deepEqual(Object.keys(v1.lancamentos), [antigo.id]);
  assert.deepEqual(Object.keys(v2.lancamentos), [dela.id]);
  assert.deepEqual(Object.keys(vc.lancamentos), [junto.id]);
  assert.equal(Fin.saldoHoje(v1, HOJE), 150000 - 1000);
  assert.equal(Fin.saldoHoje(v2, HOJE), 70000 - 2000);
  assert.equal(Fin.saldoHoje(vc, HOJE), 20000 - 3000);
  assert.equal(Fin.projetar(v2, HOJE, 2, { variavel: 0 }).saldoFinal, 70000 - 2000);
});

test('áreas: padrões não colidem com os da primeira pessoa e a estimativa é separada', () => {
  const p1 = Fin.padroesDaArea('p1');
  const p2 = Fin.padroesDaArea('p2');
  const conj = Fin.padroesDaArea('conjunta');
  Object.keys(p2.contas).concat(Object.keys(p2.categorias), Object.keys(conj.categorias)).forEach((id) => {
    assert.equal(p1.contas[id] || p1.categorias[id], undefined);
  });
  assert.equal(Object.keys(conj.contas).length, 1);
  assert.equal(Object.values(conj.contas)[0].nome, 'Conta conjunta');
  assert.ok(Object.values(p2.categorias).every((c) => c.area === 'p2'));

  const e = Fin.estadoPadrao();
  e.config.geral.variavelManual = 111;
  Object.assign(e.config, p2.config);
  e.config['geral-p2'].variavelManual = 222;
  assert.equal(Fin.visaoDaArea(e, 'p1').config.geral.variavelManual, 111);
  assert.equal(Fin.visaoDaArea(e, 'p2').config.geral.variavelManual, 222);
  assert.equal(Fin.visaoDaArea(e, 'conjunta').config.geral.variavelManual, null);
});

test('áreas: fixo guarda a área e a ocorrência a herda', () => {
  const e = base();
  e.recorrentes.r1 = { id: 'r1', area: 'conjunta', tipo: 'despesa', descricao: 'Luz', valor: 100, inicio: '2026-11-10', contaId: 'x', categoriaId: 'x', atualizadoEm: 2 };
  assert.equal(Fin.ocorrencias(Fin.visaoDaArea(e, 'p1'), '2026-11').length, 0);
  const oc = Fin.ocorrencias(Fin.visaoDaArea(e, 'conjunta'), '2026-11');
  assert.equal(oc.length, 1);
  assert.equal(oc[0].area, 'conjunta');
});

test('alertas avisam saldo negativo e limite estourado', () => {
  const e = base();
  e.config.geral.variavelManual = 0;
  e.categorias['cat-lazer'].limite = 10000;
  lanc(e, { valor: 12000, data: '2026-11-02', categoriaId: 'cat-lazer' });
  lanc(e, { valor: 500000, data: '2026-12-02', pago: false });
  const a = Fin.alertas(e, HOJE);
  assert.ok(a.some((x) => x.titulo.includes('negativo')));
  assert.ok(a.some((x) => x.titulo.includes('Lazer')));
});
