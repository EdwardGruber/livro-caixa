/* Exercita a sincronização inteira com uma planilha simulada: dois aparelhos e o Codigo.gs real. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Sincronia = require('../sincronia.js');
const Fin = require('../logica.js');

function criarServidor() {
  const linhas = [];
  const aba = {
    getLastRow: () => linhas.length,
    getRange(a, b, c, d) {
      if (typeof a === 'string') return { setNumberFormat() {} };
      return {
        getValues: () => linhas.slice(a - 1, a - 1 + c).map((l) => l.slice()),
        setValues: (v) => v.forEach((l, i) => { linhas[a - 1 + i] = l.slice(); }),
      };
    },
    setFrozenRows() {},
  };
  const planilha = { getId: () => 'p', getSheetByName: () => (linhas.length ? aba : null), insertSheet: () => aba };
  const props = {};
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha, openById: () => planilha },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => 'aaaabbbb-cccc' },
    Logger: { log() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => t }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Codigo.gs'), 'utf8'), ctx);
  const chave = ctx.configurar();
  const buscar = async (_url, opcoes) => {
    const texto = ctx.doPost({ postData: { contents: opcoes.body } });
    return { ok: true, json: async () => JSON.parse(texto) };
  };
  return { chave, buscar, linhas };
}

function aparelho(servidor) {
  const a = { estado: { lancamentos: {}, contas: {} }, pendentes: {}, desde: 0 };
  a.grava = (colecao, id, dados, quando) => {
    a.estado[colecao][id] = { id, ...dados, atualizadoEm: quando };
    a.pendentes[colecao + '|' + id] = 1;
  };
  a.sincroniza = async () => {
    const mudancas = Sincronia.montarMudancas(a.estado, a.pendentes);
    const r = await Sincronia.trocarComPlanilha({ url: 'x', chave: servidor.chave, desde: a.desde, mudancas, buscar: servidor.buscar });
    Sincronia.limparEnviados(a.pendentes, mudancas, a.estado);
    Sincronia.aplicarRemotos(a.estado, r.registros);
    a.desde = r.seq;
  };
  return a;
}

test('dados lançados no PC aparecem no celular', async () => {
  const s = criarServidor();
  const pc = aparelho(s);
  const cel = aparelho(s);
  pc.grava('lancamentos', 'a', { valor: 100 }, 10);
  await pc.sincroniza();
  await cel.sincroniza();
  assert.equal(cel.estado.lancamentos.a.valor, 100);
  assert.deepEqual(pc.pendentes, {});
});

test('a edição mais recente vence, nos dois sentidos', async () => {
  const s = criarServidor();
  const pc = aparelho(s);
  const cel = aparelho(s);
  pc.grava('lancamentos', 'a', { valor: 100 }, 10);
  await pc.sincroniza();
  await cel.sincroniza();
  pc.grava('lancamentos', 'a', { valor: 200 }, 20);
  cel.grava('lancamentos', 'a', { valor: 300 }, 30);
  await pc.sincroniza();
  await cel.sincroniza();
  await pc.sincroniza();
  assert.equal(pc.estado.lancamentos.a.valor, 300);
  assert.equal(cel.estado.lancamentos.a.valor, 300);
});

test('edição antiga não sobrescreve a planilha', async () => {
  const s = criarServidor();
  const pc = aparelho(s);
  const cel = aparelho(s);
  pc.grava('lancamentos', 'a', { valor: 500 }, 50);
  await pc.sincroniza();
  cel.grava('lancamentos', 'a', { valor: 100 }, 10);
  await cel.sincroniza();
  assert.equal(cel.estado.lancamentos.a.valor, 500);
  assert.equal(s.linhas.length, 2);
});

test('exclusão chega ao outro aparelho', async () => {
  const s = criarServidor();
  const pc = aparelho(s);
  const cel = aparelho(s);
  pc.grava('lancamentos', 'a', { valor: 100 }, 10);
  await pc.sincroniza();
  await cel.sincroniza();
  pc.grava('lancamentos', 'a', { valor: 100, excluido: true }, 20);
  await pc.sincroniza();
  await cel.sincroniza();
  assert.equal(cel.estado.lancamentos.a.excluido, true);
});

test('chave errada não lê nem grava nada', async () => {
  const s = criarServidor();
  const pc = aparelho(s);
  pc.grava('lancamentos', 'a', { valor: 100 }, 10);
  await pc.sincroniza();
  await assert.rejects(
    Sincronia.trocarComPlanilha({ url: 'x', chave: 'errada', desde: 0, mudancas: [{ colecao: 'lancamentos', id: 'z', atualizadoEm: 1, dados: {} }], buscar: s.buscar }),
    /chave/
  );
  assert.equal(s.linhas.length, 2);
});

test('registro editado durante o envio continua na fila', () => {
  const estado = { lancamentos: { a: { id: 'a', atualizadoEm: 20 } } };
  const pendentes = { 'lancamentos|a': 1 };
  Sincronia.limparEnviados(pendentes, [{ colecao: 'lancamentos', id: 'a', atualizadoEm: 10 }], estado);
  assert.ok(pendentes['lancamentos|a']);
});

function aparelhoComFixoNoCartao(servidor) {
  const a = aparelho(servidor);
  a.estado = Fin.estadoPadrao();
  a.estado.contas.c1 = { id: 'c1', nome: 'Cartão', tipo: 'cartao', grupo: 'Pessoal', fechamento: 25, vencimento: 5, area: 'p1', atualizadoEm: 5 };
  a.estado.recorrentes.r1 = { id: 'r1', tipo: 'despesa', descricao: 'Streaming', valor: 5590, inicio: '2026-11-18', categoriaId: 'x', contaId: 'c1', certeza: 'certa', pulados: [], area: 'p1', atualizadoEm: 5 };
  a.confirmaFixos = () => {
    Fin.fixosDoCartaoVencidos(Fin.visaoDaArea(a.estado, 'p1'), '2026-11-20', 'p1').forEach((reg) => {
      if (a.estado.lancamentos[reg.id]) return;
      a.estado.lancamentos[reg.id] = reg;
      a.pendentes['lancamentos|' + reg.id] = 1;
    });
  };
  return a;
}

test('fixo no cartão recriado por outro aparelho não desfaz edição nem exclusão', async () => {
  const s = criarServidor();
  const cel = aparelhoComFixoNoCartao(s);
  const pc = aparelhoComFixoNoCartao(s);
  const id = 'rc-r1-2026-11';

  cel.confirmaFixos();
  cel.grava('lancamentos', id, { ...cel.estado.lancamentos[id], valor: 5990 }, 1000);
  await cel.sincroniza();

  pc.confirmaFixos(); // abre antes de sincronizar e cria a própria cópia
  await pc.sincroniza();
  await cel.sincroniza();
  assert.equal(pc.estado.lancamentos[id].valor, 5990);
  assert.equal(cel.estado.lancamentos[id].valor, 5990);

  cel.grava('lancamentos', id, { ...cel.estado.lancamentos[id], excluido: true }, 2000);
  await cel.sincroniza();
  const outro = aparelhoComFixoNoCartao(s);
  outro.confirmaFixos();
  await outro.sincroniza();
  await cel.sincroniza();
  assert.equal(outro.estado.lancamentos[id].excluido, true);
  assert.equal(cel.estado.lancamentos[id].excluido, true);
});

test('fixo no cartão criado pelo app ainda chega aos outros aparelhos', async () => {
  const s = criarServidor();
  const pc = aparelhoComFixoNoCartao(s);
  const cel = aparelho(s);
  cel.estado = Fin.estadoPadrao();
  pc.confirmaFixos();
  await pc.sincroniza();
  await cel.sincroniza();
  assert.equal(cel.estado.lancamentos['rc-r1-2026-11'].valor, 5590);
});

test('conectar: aparelho que começou em separado é barrado, sem enviar nada', async () => {
  const s = criarServidor();
  const ele = aparelho(s);
  ele.estado = Fin.estadoPadrao();
  ele.grava('perfis', 'p1', { nome: 'Ele' }, 100);
  ele.grava('contas', 'ct-banco', { ...ele.estado.contas['ct-banco'], saldoInicial: 500000 }, 100);
  await ele.sincroniza();
  const linhasAntes = s.linhas.length;
  const le = () => Sincronia.trocarComPlanilha({ url: 'x', chave: s.chave, desde: 0, mudancas: [], buscar: s.buscar });
  const naPlanilha = (await le()).registros;
  assert.equal(s.linhas.length, linhasAntes);

  const ela = Fin.estadoPadrao();
  ela.perfis.p1 = { id: 'p1', nome: 'Ela', atualizadoEm: 200 };
  assert.equal(Sincronia.conflitoAoConectar(ela, naPlanilha), true);
  // Aparelho novo, sem nada próprio.
  assert.equal(Sincronia.conflitoAoConectar(Fin.estadoPadrao(), naPlanilha), false);
  // Primeiro aparelho, planilha vazia.
  assert.equal(Sincronia.conflitoAoConectar(ela, []), false);
  // Mesmo aparelho reconectando, inclusive com algo novo ainda não enviado.
  ele.estado.lancamentos.novo = { id: 'novo', atualizadoEm: 300 };
  assert.equal(Sincronia.conflitoAoConectar(ele.estado, naPlanilha), false);
  // Planilha só com exclusões não tem o que proteger.
  assert.equal(Sincronia.conflitoAoConectar(ela, [{ colecao: 'lancamentos', id: 'z', atualizadoEm: 5, dados: { excluido: true } }]), false);
});

test('restaurar backup desfaz exclusão e edição, nos outros aparelhos também', async () => {
  const s = criarServidor();
  const pc = aparelho(s);
  const cel = aparelho(s);
  pc.grava('lancamentos', 'a', { valor: 100 }, 10);
  pc.grava('lancamentos', 'b', { valor: 200 }, 10);
  await pc.sincroniza();
  await cel.sincroniza();
  const backup = JSON.parse(JSON.stringify(pc.estado));

  pc.grava('lancamentos', 'a', { valor: 100, excluido: true }, 20);
  pc.grava('lancamentos', 'b', { valor: 999 }, 20);
  pc.grava('lancamentos', 'c', { valor: 300 }, 20);
  await pc.sincroniza();
  await cel.sincroniza();

  const total = Sincronia.restaurarBackup(pc.estado, backup, pc.pendentes, 1000);
  assert.equal(total, 2);
  assert.equal(pc.estado.lancamentos.a.excluido, undefined);
  assert.equal(pc.estado.lancamentos.b.valor, 200);
  assert.equal(pc.estado.lancamentos.c.valor, 300);
  await pc.sincroniza();
  await cel.sincroniza();
  assert.equal(cel.estado.lancamentos.a.excluido, undefined);
  assert.equal(cel.estado.lancamentos.b.valor, 200);
  assert.equal(cel.estado.lancamentos.c.valor, 300);
  assert.equal(Sincronia.restaurarBackup(pc.estado, backup, pc.pendentes, 2000), 0);
});
