/**
 * Livro-Caixa — guarda os dados na sua própria planilha Google.
 *
 * Instalação (o passo a passo completo está no LEIA-ME.md):
 *  1. Crie uma planilha e abra Extensões > Apps Script.
 *  2. Cole este arquivo, salve e rode a função configurar. Ela mostra a chave de acesso.
 *  3. Implantar > Nova implantação > App da Web. Executar como: Eu. Quem pode acessar: Qualquer pessoa.
 *  4. Cole a URL e a chave no app, em Ajustes > Sincronização.
 *
 * "Qualquer pessoa" só libera o endereço: sem a chave, nenhum dado é lido nem gravado.
 */

var ABA = 'dados';
var CABECALHO = ['colecao', 'id', 'atualizadoEm', 'seq', 'excluido', 'json'];
var COL = { colecao: 0, id: 1, atualizadoEm: 2, seq: 3, excluido: 4, json: 5 };
var MAX_REGISTROS_POR_ENVIO = 1000;

function configurar() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) throw new Error('Abra este script pela planilha: Extensões > Apps Script.');
  obterAba_(planilha);
  var props = PropertiesService.getScriptProperties();
  var chave = props.getProperty('CHAVE');
  if (!chave) {
    chave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('CHAVE', chave);
  }
  props.setProperty('PLANILHA_ID', planilha.getId());
  Logger.log('Chave de acesso do Livro-Caixa: ' + chave);
  return chave;
}

/** Rode só se a chave vazar: os aparelhos conectados precisarão da chave nova. */
function trocarChave() {
  PropertiesService.getScriptProperties().deleteProperty('CHAVE');
  return configurar();
}

function doGet() {
  return json_({ ok: true, app: 'livro-caixa' });
}

function doPost(e) {
  try {
    var pedido = JSON.parse(e.postData.contents);
    var chave = PropertiesService.getScriptProperties().getProperty('CHAVE');
    if (!chave || pedido.chave !== chave) return json_({ ok: false, erro: 'chave' });
    return json_(sincronizar_(pedido));
  } catch (err) {
    return json_({ ok: false, erro: 'falha', detalhe: String(err && err.message || err) });
  }
}

function sincronizar_(pedido) {
  var trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    var id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
    var aba = obterAba_(SpreadsheetApp.openById(id));
    var total = aba.getLastRow() - 1;
    var linhas = total > 0 ? aba.getRange(2, 1, total, CABECALHO.length).getValues() : [];

    var indice = {};
    var maiorSeq = 0;
    linhas.forEach(function (l, i) {
      indice[l[COL.colecao] + '|' + l[COL.id]] = i;
      maiorSeq = Math.max(maiorSeq, Number(l[COL.seq]) || 0);
    });

    var mudancas = (pedido.mudancas || []).slice(0, MAX_REGISTROS_POR_ENVIO);
    var novoSeq = maiorSeq + 1;
    var alterouExistente = false;
    var novas = [];

    mudancas.forEach(function (m) {
      var chaveLinha = m.colecao + '|' + m.id;
      var pos = indice[chaveLinha];
      var existente = pos === undefined ? null : linhas[pos];
      // A edição mais recente vence, registro por registro.
      if (existente && Number(existente[COL.atualizadoEm]) >= Number(m.atualizadoEm)) return;
      var linha = [m.colecao, m.id, Number(m.atualizadoEm), novoSeq, m.excluido ? 1 : 0, JSON.stringify(m.dados)];
      if (existente) {
        linhas[pos] = linha;
        alterouExistente = true;
      } else {
        indice[chaveLinha] = linhas.length + novas.length;
        novas.push(linha);
      }
    });

    if (alterouExistente) aba.getRange(2, 1, linhas.length, CABECALHO.length).setValues(linhas);
    if (novas.length) {
      aba.getRange(linhas.length + 2, 1, novas.length, CABECALHO.length).setValues(novas);
      linhas = linhas.concat(novas);
    }

    var desde = Number(pedido.desde) || 0;
    var registros = [];
    var seqFinal = maiorSeq;
    linhas.forEach(function (l) {
      var s = Number(l[COL.seq]) || 0;
      seqFinal = Math.max(seqFinal, s);
      if (s > desde) registros.push({ colecao: l[COL.colecao], id: String(l[COL.id]), atualizadoEm: Number(l[COL.atualizadoEm]), dados: JSON.parse(l[COL.json]) });
    });

    return { ok: true, seq: seqFinal, registros: registros };
  } finally {
    trava.releaseLock();
  }
}

function obterAba_(planilha) {
  var aba = planilha.getSheetByName(ABA);
  if (!aba) {
    aba = planilha.insertSheet(ABA);
    aba.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]);
    aba.setFrozenRows(1);
    // Texto puro: impede o Sheets de reinterpretar ids e JSON como data ou número.
    aba.getRange('A:B').setNumberFormat('@');
    aba.getRange('F:F').setNumberFormat('@');
  }
  return aba;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
