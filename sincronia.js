/* Livro-Caixa — sincronização com a planilha. O app funciona offline; isto só troca as diferenças. */
(function (raiz) {
  'use strict';

  /* Aplica registros vindos da planilha: a edição mais recente vence, registro por registro. */
  function aplicarRemotos(estado, registros) {
    let mudou = false;
    (registros || []).forEach((r) => {
      if (!estado[r.colecao]) return;
      const local = estado[r.colecao][r.id];
      if (!local || r.atualizadoEm > local.atualizadoEm) {
        estado[r.colecao][r.id] = r.dados;
        mudou = true;
      }
    });
    return mudou;
  }

  function montarMudancas(estado, pendentes, limite = 500) {
    const mudancas = [];
    Object.keys(pendentes).slice(0, limite).forEach((chave) => {
      const [colecao, id] = separa(chave);
      const dados = estado[colecao] && estado[colecao][id];
      if (dados) mudancas.push({ colecao, id, atualizadoEm: dados.atualizadoEm, excluido: !!dados.excluido, dados });
    });
    return mudancas;
  }

  function separa(chave) {
    const i = chave.indexOf('|');
    return [chave.slice(0, i), chave.slice(i + 1)];
  }

  /* Só tira da fila o que não foi editado de novo enquanto o envio acontecia. */
  function limparEnviados(pendentes, enviados, estado) {
    enviados.forEach((m) => {
      const atual = estado[m.colecao] && estado[m.colecao][m.id];
      if (!atual || atual.atualizadoEm === m.atualizadoEm) delete pendentes[m.colecao + '|' + m.id];
    });
  }

  async function trocarComPlanilha({ url, chave, desde, mudancas, buscar }) {
    const resposta = await buscar(url, {
      method: 'POST',
      // text/plain evita a verificação prévia de CORS, que o Apps Script não atende.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ chave, desde, mudancas }),
      redirect: 'follow',
    });
    if (!resposta.ok) throw new Error('http');
    let corpo;
    try {
      corpo = await resposta.json();
    } catch (e) {
      throw new Error('resposta');
    }
    if (!corpo.ok) throw new Error(corpo.erro || 'falha');
    return corpo;
  }

  const api = { aplicarRemotos, montarMudancas, limparEnviados, trocarComPlanilha };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sincronia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
