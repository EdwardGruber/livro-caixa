/* Finanças G&L — sincronização com a planilha. O app funciona offline; isto só troca as diferenças. */
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

  /* Este aparelho tem dados próprios, a planilha também, e não há registro em comum: não são
     a mesma história. Juntar misturaria as finanças de quem começou em separado. */
  function conflitoAoConectar(estado, registros) {
    const lista = registros || [];
    const proprios = [];
    Object.keys(estado).forEach((colecao) => {
      Object.values(estado[colecao]).forEach((r) => { if (r.atualizadoEm > 1) proprios.push([colecao, r]); });
    });
    if (!proprios.length || !lista.some((r) => !r.dados.excluido)) return false;
    const naPlanilha = new Map(lista.map((r) => [r.colecao + '|' + r.id, r.atualizadoEm]));
    return !proprios.some(([colecao, r]) => naPlanilha.get(colecao + '|' + r.id) === r.atualizadoEm);
  }

  /* O backup vence: excluído ou alterado depois volta a ser como era, em todos os aparelhos.
     O que foi criado depois do backup não é tocado. */
  function restaurarBackup(estado, backup, pendentes, agora) {
    let total = 0;
    const semData = ({ atualizadoEm, ...resto }) => JSON.stringify(resto);
    Object.keys(estado).forEach((colecao) => {
      Object.values((backup && backup[colecao]) || {}).forEach((r) => {
        if (!r || !r.id) return;
        const atual = estado[colecao][r.id];
        if (atual && semData(atual) === semData(r)) return;
        estado[colecao][r.id] = { ...r, atualizadoEm: Math.max(agora, ((atual && atual.atualizadoEm) || 0) + 1) };
        if (pendentes) pendentes[colecao + '|' + r.id] = 1;
        total += 1;
      });
    });
    return total;
  }

  const api = { aplicarRemotos, montarMudancas, limparEnviados, trocarComPlanilha, conflitoAoConectar, restaurarBackup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sincronia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
