/* Exercita a sincronização inteira com uma planilha simulada: dois aparelhos e o Codigo.gs real. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Sincronia = require('../sincronia.js');

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
    a.estado[colecao][id] = { id, atualizadoEm: quando, ...dados };
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
