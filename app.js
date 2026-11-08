/* Finanças G&L — telas e interações. */
(function () {
  'use strict';
  const { reais, lerReais, nomeMes, mesDe, somaMeses, somaDias, hojeLocal, vivos, AREA_CONJUNTA } = Fin;

  const NOME_HTML = 'Finanças G&amp;L';
  // Mantidos do nome antigo do app: trocar estas chaves faria os aparelhos perderem o que já está salvo.
  const CHAVE = 'livrocaixa:v1';
  const CHAVE_TEMA = 'livrocaixa:tema';
  const ID_BACKUP = 'livro-caixa';
  const hoje = () => hojeLocal();

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const novoId = () => {
    const b = crypto.getRandomValues(new Uint8Array(10));
    return [...b].map((x) => x.toString(36).padStart(2, '0')).join('');
  };
  const dataBR = (d) => d.split('-').reverse().join('/');
  const dataCurta = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  const valorParaCampo = (c) => (c ? (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

  function nomeDia(d) {
    const h = hoje();
    if (d === h) return 'Hoje';
    if (d === somaDias(h, -1)) return 'Ontem';
    if (d === somaDias(h, 1)) return 'Amanhã';
    const [a, m, dia] = d.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, dia)).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).replace(/\./g, '');
  }

  const ICONES = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    lancamentos: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    fixos: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    graficos: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 17v-5M13 17V8M18 17v-8"/>',
    planejar: '<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>',
    ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    baixar: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    esquerda: '<path d="M15 5l-7 7 7 7"/>',
    direita: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
  };
  const icone = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n]}</svg>`;

  /* ---------- armazenamento ---------- */
  function bancoNovo() {
    return { estado: Fin.estadoPadrao(), pendentes: {}, sinc: null, iniciado: false, exemplo: false, perfil: null };
  }

  let textoSalvo = null;

  function carregar() {
    try {
      const t = localStorage.getItem(CHAVE);
      if (t) {
        const b = JSON.parse(t);
        Fin.COLECOES.forEach((c) => { if (!b.estado[c]) b.estado[c] = {}; });
        textoSalvo = t;
        return b;
      }
    } catch (e) { /* armazenamento indisponível ou corrompido: começa limpo */ }
    return bancoNovo();
  }

  let banco = carregar();
  // "estado" é sempre só a área aberta na tela; "banco.estado" guarda todas e é o que sincroniza.
  let estado = banco.estado;

  /* Área aberta: "meu" é a da pessoa deste aparelho. */
  const areaAtiva = () => (ui.area === 'conjunta' ? AREA_CONJUNTA : banco.perfil || Fin.AREA_PRIMEIRA);
  const visao = (area) => Fin.visaoDaArea(banco.estado, area);
  const refazerVisao = () => { estado = visao(areaAtiva()); };

  function garantirPadroes(area) {
    const padroes = Fin.padroesDaArea(area);
    Fin.COLECOES.forEach((c) => {
      Object.values(padroes[c]).forEach((r) => {
        if (!banco.estado[c][r.id]) banco.estado[c][r.id] = r;
      });
    });
  }

  function salvar() {
    try {
      const t = JSON.stringify(banco);
      localStorage.setItem(CHAVE, t);
      textoSalvo = t;
    } catch (e) {
      avisar('Não consegui salvar neste aparelho. Baixe um backup em Ajustes.');
    }
  }

  /* Outra aba salvou: pega o que ela gravou antes de esta salvar por cima. */
  function recarregarSeMudou() {
    try {
      const t = localStorage.getItem(CHAVE);
      if (!t || t === textoSalvo) return false;
      JSON.parse(t);
      banco = carregar();
      refazerVisao();
      return true;
    } catch (e) {
      return false;
    }
  }

  function gravar(colecao, reg) {
    const anterior = banco.estado[colecao][reg.id];
    reg.atualizadoEm = Math.max(Date.now(), ((anterior && anterior.atualizadoEm) || 0) + 1);
    if (colecao !== 'perfis' && !reg.area) reg.area = areaAtiva();
    banco.estado[colecao][reg.id] = reg;
    if (!banco.exemplo) banco.pendentes[colecao + '|' + reg.id] = 1;
    refazerVisao();
  }

  function concluir() {
    salvar();
    desenhar();
    agendarSinc();
  }

  /* Cobranças fixas no cartão acontecem sozinhas: viram lançamento quando a data chega. */
  function confirmarFixosNoCartao() {
    if (!banco.perfil) return false;
    let criou = false;
    [banco.perfil, AREA_CONJUNTA].forEach((area) => {
      Fin.fixosDoCartaoVencidos(visao(area), hoje(), area).forEach((reg) => {
        if (banco.estado.lancamentos[reg.id]) return;
        banco.estado.lancamentos[reg.id] = reg;
        if (!banco.exemplo) banco.pendentes['lancamentos|' + reg.id] = 1;
        criou = true;
      });
    });
    if (criou) {
      refazerVisao();
      salvar();
    }
    return criou;
  }

  const realDaOcorrencia = Fin.realDaOcorrencia;

  /* Contas de antes da "data do saldo" ganham a data que preserva o saldo que já mostravam. */
  function migrarSaldos() {
    if (banco.exemplo) return;
    let mudou = false;
    Object.values(banco.estado.contas).forEach((c) => {
      if (c.excluido || c.tipo === 'cartao' || c.saldoData || !c.saldoInicial || c.atualizadoEm <= 1) return;
      banco.estado.contas[c.id] = { ...c, saldoData: Fin.dataDoSaldoAntigo(visao(Fin.areaDe(c)), c, hoje()), atualizadoEm: c.atualizadoEm + 1 };
      banco.pendentes['contas|' + c.id] = 1;
      mudou = true;
    });
    if (mudou) {
      refazerVisao();
      salvar();
    }
  }

  /* ---------- sincronização ---------- */
  const sinc = { situacao: 'desligado', emCurso: false, repetir: false, temporizador: null };

  function textoSelo() {
    if (banco.exemplo) return 'Dados de exemplo';
    if (!banco.sinc) return 'Só neste aparelho';
    switch (sinc.situacao) {
      case 'enviando': return 'Sincronizando…';
      case 'offline': return 'Sem internet';
      case 'erro': return 'Erro ao sincronizar';
      case 'ok': return 'Sincronizado';
      default: return 'Conectado à planilha';
    }
  }

  function pintarSelo() {
    $$('.selo-sinc').forEach((s) => {
      s.dataset.estado = banco.exemplo || !banco.sinc ? 'desligado' : sinc.situacao;
      s.lastElementChild.textContent = textoSelo();
      s.title = textoSelo();
    });
    const detalhe = $('#sinc-detalhe');
    if (detalhe) detalhe.textContent = detalheSinc();
  }

  function detalheSinc() {
    if (sinc.situacao === 'erro') return sinc.mensagem;
    const q = Object.keys(banco.pendentes).length;
    const ultima = banco.sinc && banco.sinc.ultima ? new Date(banco.sinc.ultima).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
    return `${ultima ? `Última sincronização: ${ultima}.` : 'Ainda não sincronizou.'}${q ? ` ${q} ${q > 1 ? 'alterações aguardando' : 'alteração aguardando'}.` : ''}`;
  }

  function agendarSinc(ms = 1500) {
    if (!banco.sinc || banco.exemplo) return;
    clearTimeout(sinc.temporizador);
    sinc.temporizador = setTimeout(sincronizar, ms);
  }

  const mensagemErroSinc = (e) => (e.message === 'chave'
    ? 'A planilha recusou a chave. Confira a chave de acesso.'
    : 'Não consegui falar com a planilha. Confira a URL e se a implantação está como "Qualquer pessoa". Seus dados continuam salvos neste aparelho.');

  async function sincronizar() {
    if (!banco.sinc || banco.exemplo) return false;
    if (sinc.emCurso) { sinc.repetir = true; return false; }
    if (navigator.onLine === false) { sinc.situacao = 'offline'; pintarSelo(); return false; }
    sinc.emCurso = true;
    sinc.situacao = 'enviando';
    pintarSelo();
    let sucesso = false;
    try {
      let mudouAlgo = false;
      let mudancas;
      do {
        mudancas = Sincronia.montarMudancas(banco.estado, banco.pendentes);
        const r = await Sincronia.trocarComPlanilha({ url: banco.sinc.url, chave: banco.sinc.chave, desde: banco.sinc.desde || 0, mudancas, buscar: (u, o) => fetch(u, o) });
        Sincronia.limparEnviados(banco.pendentes, mudancas, banco.estado);
        if (Sincronia.aplicarRemotos(banco.estado, r.registros)) mudouAlgo = true;
        banco.sinc.desde = r.seq;
      } while (mudancas.length && Object.keys(banco.pendentes).length);
      banco.sinc.ultima = Date.now();
      sinc.situacao = 'ok';
      sucesso = true;
      refazerVisao();
      if (mudouAlgo) {
        migrarSaldos();
        if (confirmarFixosNoCartao()) sinc.repetir = true;
      }
      salvar();
      if (mudouAlgo) desenharSePossivel();
    } catch (e) {
      sinc.situacao = 'erro';
      sinc.mensagem = mensagemErroSinc(e);
    } finally {
      sinc.emCurso = false;
      sinc.tentou = true;
      pintarSelo();
      if (sinc.repetir) { sinc.repetir = false; agendarSinc(300); }
      // A tela de escolher a pessoa espera a primeira resposta da planilha.
      if (banco.iniciado && !banco.perfil) desenharSePossivel();
    }
    return sucesso;
  }

  function desenharSePossivel() {
    const ativo = document.activeElement;
    const digitando = ativo && /^(INPUT|SELECT)$/.test(ativo.tagName);
    if ($('#folha').open || digitando) { ui.redesenhar = true; return; }
    desenhar();
  }

  /* ---------- estado da tela ---------- */
  const VISTAS = [
    ['inicio', 'Início'], ['lancamentos', 'Lançamentos'], ['fixos', 'Fixos'], ['graficos', 'Gráficos'], ['planejar', 'Planejar'],
  ];
  const ui = {
    vista: 'inicio', area: 'meu', mes: mesDe(hoje()), grupo: 'Tudo', faixa: 12, periodo: 12,
    texto: '', tipo: 'todos', entrada: 'menu', pedirSaldo: false, redesenhar: false,
    sim: { tipo: 'compra', valorTxt: '', parcelas: 10, inicio: hoje() },
  };

  function lerRota() {
    const h = location.hash.replace('#', '');
    if (VISTAS.some(([v]) => v === h) || h === 'ajustes') ui.vista = h;
    else ui.vista = 'inicio';
  }

  const grupos = () => [...new Set(vivos(estado, 'contas').map((c) => c.grupo || 'Pessoal'))];
  const CATEGORIA_META = 'meta';
  const CATEGORIA_TRANSF = 'transferencia';
  const CATEGORIA_CONJ = 'conjunta';
  const CATEGORIAS_FIXAS = { [CATEGORIA_META]: 'Meta', [CATEGORIA_TRANSF]: 'Transferência', [CATEGORIA_CONJ]: 'Conjunta' };
  const nomeCategoria = (id) => CATEGORIAS_FIXAS[id] || (estado.categorias[id] ? estado.categorias[id].nome : 'Sem categoria');
  const nomeConta = (id) => (estado.contas[id] ? estado.contas[id].nome : 'Conta removida');

  function segmento(acao, atual, opcoes, classe = '') {
    return `<div class="seg ${classe}" role="group">${opcoes.map(([v, r]) => `<button type="button" data-acao="${acao}" data-valor="${esc(v)}" aria-pressed="${String(v) === String(atual)}">${esc(r)}</button>`).join('')}</div>`;
  }

  /* ---------- moldura ---------- */
  function desenhar(animar = false) {
    const raiz = $('#app');
    ui.redesenhar = false;
    document.body.dataset.area = ui.area;
    if (!banco.iniciado) { raiz.innerHTML = telaBoasVindas(); return; }
    if (!banco.perfil) { raiz.innerHTML = telaPerfil(); return; }
    garantirPadroes(banco.perfil);
    garantirPadroes(AREA_CONJUNTA);
    refazerVisao();
    if (ui.pedirSaldo) { raiz.innerHTML = telaSaldo(); return; }
    if (!grupos().includes(ui.grupo)) ui.grupo = 'Tudo';
    const titulo = ui.vista === 'ajustes' ? 'Ajustes' : VISTAS.find(([v]) => v === ui.vista)[1];
    const gs = grupos();
    const nome = nomePerfil(banco.perfil);
    const acaoPdf = { lancamentos: 'pdf-lancamentos', graficos: 'pdf-graficos' }[ui.vista];
    const aba = (v, r) => `<a class="aba" href="#${v}" ${ui.vista === v ? 'aria-current="page"' : ''} style="text-decoration:none">${icone(v)}<span>${r}</span></a>`;
    raiz.innerHTML = `<div class="moldura">
      <nav class="navegacao" aria-label="Seções">
        <div class="marca-lateral">${NOME_HTML}</div>
        ${VISTAS.map(([v, r]) => aba(v, r)).join('')}
        <div class="rodape-lateral">
          ${aba('ajustes', 'Ajustes')}
          <div class="perfil-lateral"><span class="avatar" aria-hidden="true">${esc(nome.trim().charAt(0).toUpperCase() || '?')}</span>
            <span><b>${esc(nome)}</b><small>${ui.area === 'conjunta' ? 'Área conjunta' : 'Minhas finanças'}</small></span></div>
        </div>
      </nav>
      <main class="principal">
        <header class="topo">
          <div class="titulo-topo">
            <h1>${ui.vista === 'inicio' ? esc(saudacao(nome)) : titulo}</h1>
            ${ui.vista === 'inicio' ? `<span class="data-hoje">${esc(dataPorExtenso())}</span>` : ''}
          </div>
          <div class="topo-filtros">
            ${segmento('area', ui.area, [['meu', 'Minhas'], ['conjunta', 'Conjunta']], 'seletor-area')}
            ${gs.length > 1 ? segmento('grupo', ui.grupo, [['Tudo', 'Tudo'], ...gs.map((g) => [g, g])]) : ''}
          </div>
          <a class="selo-sinc" href="#ajustes" style="text-decoration:none" data-estado="desligado" title="${esc(textoSelo())}"><i></i><span>${esc(textoSelo())}</span></a>
          ${acaoPdf ? `<button type="button" class="btn leve" data-acao="${acaoPdf}" title="Exportar em PDF">${icone('baixar')}<span>PDF</span></button>` : ''}
          <a class="icone-btn so-celular" href="#ajustes" aria-label="Ajustes">${icone('ajustes')}</a>
        </header>
        <div id="vista" class="vista${animar ? ' anima' : ''}">${banco.exemplo ? faixaExemplo() : ''}${vistas[ui.vista]()}</div>
      </main>
      <button type="button" class="fab" data-acao="novo">${icone('mais')}<span>Lançar</span></button>
    </div>`;
    pintarSelo();
    if (animar) {
      $$('#vista .exemplo-faixa, #vista .heroi, #vista .alerta, #vista .cartao').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 10)));
      $$('#vista .linha-item').slice(0, 14).forEach((el, i) => el.style.setProperty('--j', i));
    }
    montar[ui.vista] && montar[ui.vista](animar);
  }

  function saudacao(nome) {
    const hora = new Date().getHours();
    const parte = hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const primeiro = String(nome || '').trim().split(/\s+/)[0];
    return primeiro && primeiro !== 'Sem' ? `${parte}, ${primeiro}` : parte;
  }

  const dataPorExtenso = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const faixaExemplo = () => `<div class="exemplo-faixa"><span>Estes são <b>dados de exemplo</b>, não os seus.</span><button type="button" class="btn" data-acao="apagar-exemplo">Apagar e começar</button></div>`;

  /* ---------- boas-vindas ---------- */
  const nomePerfil = (id) => (banco.estado.perfis[id] || {}).nome || 'Sem nome';

  /* ---------- casal: áreas, contas de qualquer área e pares de lançamentos ---------- */
  const outraPessoa = () => (banco.perfil === Fin.AREA_SEGUNDA ? Fin.AREA_PRIMEIRA : Fin.AREA_SEGUNDA);
  const temSegundaPessoa = () => !!banco.estado.perfis[Fin.AREA_SEGUNDA];
  const rotuloArea = (area) => (area === AREA_CONJUNTA ? 'Conjunta' : nomePerfil(area));
  const contaGlobal = (id) => banco.estado.contas[id];
  const contasDaArea = (area, { cartao = true } = {}) => vivos(visao(area), 'contas').filter((c) => cartao || c.tipo !== 'cartao');
  /* Nome da conta com o dono, para ficar claro dos dois lados de uma transferência. */
  function rotuloConta(c) {
    if (!c) return 'Conta removida';
    const area = Fin.areaDe(c);
    return area === AREA_CONJUNTA ? c.nome : `${c.nome} de ${nomePerfil(area)}`;
  }
  const parDe = (reg, colecao = 'lancamentos') => (reg && reg.parId ? banco.estado[colecao][reg.parId] : null);
  const divisaoP1 = () => {
    const c = banco.estado.config['geral-conjunta'];
    return c && c.divisaoP1 != null ? c.divisaoP1 : 50;
  };

  /* Confirma uma ocorrência de fixo; se ela for metade de uma transferência, confirma a outra metade. */
  function confirmarOcorrencia(o, extras = {}) {
    gravar('lancamentos', realDaOcorrencia(o, extras));
    if (!o.parRecorrente) return;
    const recPar = banco.estado.recorrentes[o.parRecorrente];
    if (!recPar || recPar.excluido) return;
    const vPar = visao(Fin.areaDe(recPar));
    const oPar = Fin.ocorrencias(vPar, o.competencia).find((x) => x.recorrenteId === recPar.id && x.competencia === o.competencia);
    if (oPar) {
      gravar('lancamentos', realDaOcorrencia(oPar, {
        ...(extras.valor ? { valor: extras.valor } : {}),
        ...(extras.data ? { data: Fin.dataDoPagamento(vPar, { ...oPar, data: extras.data }) } : {}),
      }));
    }
  }

  function telaSaldo() {
    return `<div class="boas-vindas"><div>
      <h1>Quanto você tem hoje?</h1>
      <p class="mudo">Some o saldo da sua conta principal. Dá para ajustar depois e criar outras contas e cartões em Ajustes.</p>
      <label class="campo"><span>Saldo atual da conta</span><div class="com-sinal"><div class="valor-grande"><span>R$</span><input id="saldo-inicial" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off"></div><button type="button" class="btn sinal" data-acao="inverter-sinal" data-alvo="saldo-inicial" aria-label="Trocar entre saldo positivo e negativo">±</button></div></label>
      <button type="button" class="btn primario" data-acao="comecar">Abrir minhas finanças</button>
    </div></div>`;
  }

  /* Primeiro os nomes, uma vez só para os dois. Depois, em cada aparelho, quem usa. */
  function telaPerfil() {
    const perfis = vivos(banco.estado, 'perfis');
    if (perfis.length) {
      return `<div class="boas-vindas"><div>
        <h1>Quem usa este aparelho?</h1>
        <p class="mudo">O app vai abrir sempre nas finanças desta pessoa. Dá para trocar depois em Ajustes.</p>
        ${[Fin.AREA_PRIMEIRA, Fin.AREA_SEGUNDA].filter((id) => banco.estado.perfis[id]).map((id) => `<button type="button" class="btn primario" data-acao="escolher-perfil" data-valor="${id}">${esc(nomePerfil(id))}</button>`).join('')}
      </div></div>`;
    }
    if (banco.sinc && !sinc.tentou && navigator.onLine !== false) {
      return `<div class="boas-vindas"><div><h1>${NOME_HTML}</h1><p class="mudo">Buscando seus dados na planilha…</p></div></div>`;
    }
    const temDados = vivos(banco.estado, 'lancamentos').length > 0 || vivos(banco.estado, 'recorrentes').length > 0;
    return `<div class="boas-vindas"><div>
      <h1>Quem vai usar?</h1>
      <p class="mudo">Cada pessoa tem as próprias finanças, sem misturar, e vocês dois têm uma área conjunta.</p>
      <label class="campo"><span>${temDados ? 'Nome de quem já usa o app' : 'Primeira pessoa'}</span><input id="p-nome1" type="text" maxlength="30" autocomplete="off"></label>
      ${temDados ? '<p class="dica-campo">Os lançamentos que já existem ficam com esta pessoa.</p>' : ''}
      <label class="campo"><span>Segunda pessoa</span><input id="p-nome2" type="text" maxlength="30" autocomplete="off"></label>
      <p class="erro-campo" id="p-erro" hidden></p>
      <button type="button" class="btn primario" data-acao="salvar-nomes">Continuar</button>
    </div></div>`;
  }

  function telaBoasVindas() {
    if (ui.entrada === 'conectar') {
      return `<div class="boas-vindas"><div>
        <h1>Conectar à planilha</h1>
        <p class="mudo">Use a mesma URL e a mesma chave do outro aparelho. Os seus dados chegam em seguida.</p>
        ${camposConexao()}
        <button type="button" class="btn primario" data-acao="conectar">Conectar</button>
        <p class="erro-campo" id="conexao-erro" hidden></p>
        <button type="button" class="btn sem-borda" data-acao="entrada" data-valor="menu">Voltar</button>
      </div></div>`;
    }
    return `<div class="boas-vindas"><div>
      <h1>${NOME_HTML}</h1>
      <p class="mudo">Lance entradas, gastos fixos e parcelas, e veja como o seu saldo fica nos próximos meses.</p>
      <button type="button" class="btn primario" data-acao="comecar-zero">Começar do zero</button>
      <button type="button" class="btn" data-acao="ver-exemplo">Ver com dados de exemplo</button>
      <button type="button" class="btn" data-acao="entrada" data-valor="conectar">Já uso em outro aparelho</button>
    </div></div>`;
  }

  const camposConexao = () => `
    <label class="campo"><span>URL do app da Web</span><input id="sinc-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" value="${esc(banco.sinc ? banco.sinc.url : '')}"></label>
    <label class="campo"><span>Chave de acesso</span><input id="sinc-chave" type="password" autocomplete="off" value="${esc(banco.sinc ? banco.sinc.chave : '')}"></label>`;

  /* ---------- dados de exemplo ---------- */
  function preencherExemplo() {
    const e = Fin.estadoPadrao();
    const h = hoje();
    const mesAtual = mesDe(h);
    const marca = (r) => ({ atualizadoEm: 2, exemplo: true, ...r });
    e.contas['ct-banco'].saldoInicial = 320000;
    e.contas.cartao = marca({ id: 'cartao', nome: 'Cartão de crédito', tipo: 'cartao', grupo: 'Pessoal', fechamento: 25, vencimento: 5 });
    e.contas.escritorio = marca({ id: 'escritorio', nome: 'Conta do escritório', tipo: 'banco', grupo: 'Escritório', saldoInicial: 180000 });
    e.categorias['cat-mercado'].limite = 110000;
    e.categorias['cat-lazer'].limite = 40000;

    const inicio = somaMeses(mesAtual, -5);
    const fixos = [
      ['r1', 'receita', 'Salário', 720000, 5, 'cat-salario', 'ct-banco', 'certa'],
      ['r2', 'receita', 'Honorários previstos', 280000, 20, 'cat-honorarios', 'escritorio', 'provavel'],
      ['r3', 'despesa', 'Aluguel', 210000, 10, 'cat-moradia', 'ct-banco'],
      ['r4', 'despesa', 'Internet e celular', 18900, 15, 'cat-contaseassinaturas', 'ct-banco'],
      ['r5', 'despesa', 'Plano de saúde', 62000, 12, 'cat-saude', 'ct-banco'],
      ['r6', 'despesa', 'Anuidade e sistema do escritório', 32000, 8, 'cat-contaseassinaturas', 'escritorio'],
      ['r7', 'despesa', 'Streaming', 5590, 18, 'cat-contaseassinaturas', 'cartao'],
    ];
    fixos.forEach(([id, tipo, descricao, valor, dia, categoriaId, contaId, certeza]) => {
      e.recorrentes[id] = marca({ id, tipo, descricao, valor, inicio: `${inicio}-${String(dia).padStart(2, '0')}`, categoriaId, contaId, certeza: certeza || 'certa', pulados: [] });
    });

    // Meses passados já confirmados; o valor varia de forma previsível para o exemplo não mudar a cada abertura.
    let s = 7;
    const sorteio = (min, max) => { s = (s * 31 + 11) % 1009; return min + Math.round((s / 1008) * (max - min)); };
    Fin.ocorrencias(e, mesAtual).filter((o) => o.data <= h).forEach((o) => {
      const provavelBaixo = o.certeza === 'provavel' ? sorteio(-120000, 90000) : 0;
      const id = `rc-${o.recorrenteId}-${o.competencia}`;
      e.lancamentos[id] = marca({ ...realDaOcorrencia(o), id, valor: o.valor + provavelBaixo });
    });

    const compras = [['Mercado', 'cat-mercado', 'ct-banco', 18000, 34000], ['Mercado do mês', 'cat-mercado', 'cartao', 42000, 68000], ['Combustível', 'cat-transporteecarro', 'cartao', 18000, 26000], ['Restaurante', 'cat-alimentacaofora', 'cartao', 7000, 16000], ['Farmácia', 'cat-saude', 'ct-banco', 3000, 12000], ['Cinema e passeio', 'cat-lazer', 'cartao', 8000, 18000]];
    for (let i = 5; i >= 0; i--) {
      const ym = somaMeses(mesAtual, -i);
      compras.forEach(([descricao, categoriaId, contaId, min, max], j) => {
        const data = `${ym}-${String(3 + ((j * 5 + i * 3) % 24)).padStart(2, '0')}`;
        if (data > h) return;
        const id = `ex-${ym}-${j}`;
        e.lancamentos[id] = marca({ id, tipo: 'despesa', descricao, valor: sorteio(min, max), categoriaId, contaId, data, certeza: 'certa', pago: true });
      });
    }

    Fin.criarParcelas({ tipo: 'despesa', descricao: 'Notebook', valor: 389000, data: `${somaMeses(mesAtual, -2)}-14`, categoriaId: 'cat-outrasdespesas', contaId: 'cartao', certeza: 'certa', pago: true, exemplo: true }, 10, novoId, 2).forEach((l) => { e.lancamentos[l.id] = l; });
    const ipva = somaDias(h, 62);
    e.lancamentos.ipva = marca({ id: 'ipva', tipo: 'despesa', descricao: 'IPVA do carro', valor: 145000, categoriaId: 'cat-impostosetaxas', contaId: 'ct-banco', data: ipva, certeza: 'certa', pago: false, planejado: true });
    const extra = somaDias(h, 40);
    e.lancamentos.acordo = marca({ id: 'acordo', tipo: 'receita', descricao: 'Honorários de êxito (acordo)', valor: 450000, categoriaId: 'cat-honorarios', contaId: 'escritorio', data: extra, certeza: 'provavel', pago: false });
    e.metas.reserva = marca({ id: 'reserva', nome: 'Reserva de emergência', alvo: 3000000, guardado: 850000, aporte: 70000 });
    e.metas.viagem = marca({ id: 'viagem', nome: 'Viagem de férias', alvo: 800000, guardado: 120000, aporte: 0 });
    e.perfis.p1 = marca({ id: 'p1', nome: 'Pessoa 1' });
    e.perfis.p2 = marca({ id: 'p2', nome: 'Pessoa 2' });

    // Área conjunta do exemplo.
    const padroesConjunta = Fin.padroesDaArea(AREA_CONJUNTA);
    Fin.COLECOES.forEach((c) => Object.assign(e[c], padroesConjunta[c]));
    const contaConjunta = 'conjunta-ct-banco';
    e.contas[contaConjunta].saldoInicial = 240000;
    [['rc1', 'receita', 'Depósito dos dois', 400000, 6, 'conjunta-cat-outrasentradas'], ['rc2', 'despesa', 'Contas da casa', 95000, 12, 'conjunta-cat-moradia'], ['rc3', 'despesa', 'Compras da casa', 130000, 15, 'conjunta-cat-mercado']].forEach(([id, tipo, descricao, valor, dia, categoriaId]) => {
      e.recorrentes[id] = marca({ id, area: AREA_CONJUNTA, tipo, descricao, valor, inicio: `${inicio}-${String(dia).padStart(2, '0')}`, categoriaId, contaId: contaConjunta, certeza: 'certa', pulados: [] });
    });
    Fin.ocorrencias(Fin.visaoDaArea(e, AREA_CONJUNTA), mesAtual).filter((o) => o.data <= h).forEach((o) => {
      const id = `rc-${o.recorrenteId}-${o.competencia}`;
      e.lancamentos[id] = marca({ ...realDaOcorrencia(o), id });
    });

    banco = { estado: e, pendentes: {}, sinc: null, iniciado: true, exemplo: true, perfil: 'p1' };
    ui.area = 'meu';
    ui.pedirSaldo = false;
    refazerVisao();
    confirmarFixosNoCartao();
    salvar();
  }

  /* ---------- gráfico de saldo ---------- */
  function dadosSaldo(faixa, extra = {}) {
    const h = hoje();
    const lanc = Fin.vivos(estado, 'lancamentos');
    const primeiro = lanc.length ? lanc.map((l) => mesDe(l.data)).sort()[0] : mesDe(h);
    let mesesHist = 0;
    while (mesesHist < 3 && somaMeses(mesDe(h), -(mesesHist + 1)) >= primeiro) mesesHist += 1;
    const hist = Fin.historicoSaldo(estado, h, mesesHist, ui.grupo);
    const agora = Fin.saldoHoje(estado, h, ui.grupo);
    const certas = Fin.projetar(estado, h, faixa, { grupo: ui.grupo, ...extra });
    const provaveis = Fin.projetar(estado, h, faixa, { grupo: ui.grupo, provaveis: true, ...extra });
    const rotulos = [...hist.map((x) => nomeMes(x.mes)), 'hoje', ...certas.finaisDeMes.map((x) => nomeMes(x.mes))];
    const longos = [...hist.map((x) => 'Fim de ' + nomeMes(x.mes, true)), 'Hoje', ...certas.finaisDeMes.map((x) => 'Fim de ' + nomeMes(x.mes, true))];
    const nul = (n) => Array(n).fill(null);
    return {
      rotulos, longos, indiceHoje: hist.length, agora, certas, provaveis,
      real: [...hist.map((x) => x.saldo), agora, ...nul(certas.finaisDeMes.length)],
      projCertas: [...nul(hist.length), agora, ...certas.finaisDeMes.map((x) => x.saldo)],
      projProvaveis: [...nul(hist.length), agora, ...provaveis.finaisDeMes.map((x) => x.saldo)],
    };
  }

  function configSaldo(d, animar) {
    const iguais = d.projCertas.every((v, i) => v === d.projProvaveis[i]);
    const series = [];
    if (d.indiceHoje > 0) series.push({ nome: 'Realizado', cor: 'var(--s1)', valores: d.real, area: true });
    series.push({ nome: iguais ? 'Projeção' : 'Projeção com entradas certas', cor: 'var(--s1)', valores: d.projCertas, tracejado: true });
    if (!iguais) series.push({ nome: 'Somando as prováveis', cor: 'var(--s3)', valores: d.projProvaveis, tracejado: true });
    return { titulo: 'Saldo real e projetado', rotulos: d.rotulos, rotulosLongos: d.longos, indiceHoje: d.indiceHoje, series, formatar: (v) => reais(v), animar };
  }

  function graficoSaldo(el, faixa, animar) {
    const d = dadosSaldo(faixa);
    Graficos.linhas(el, configSaldo(d, animar));
    return d;
  }

  function dadosColunas() {
    const atual = mesDe(hoje());
    const metade = ui.periodo / 2;
    const meses = [];
    for (let i = -metade + 1; i <= metade; i++) meses.push(somaMeses(atual, i));
    return { meses, atual, resumos: meses.map((m) => Fin.resumoMes(estado, m, ui.grupo)) };
  }

  function configColunas(d, animar) {
    return {
      titulo: 'Entradas e saídas por mês', rotulos: d.meses.map((m) => nomeMes(m)), indiceFuturo: d.meses.indexOf(d.atual) + 1,
      series: [
        { nome: 'Entradas', cor: 'var(--s1)', valores: d.resumos.map((r) => r.entradasCertas) },
        { nome: 'Saídas', cor: 'var(--s2)', valores: d.resumos.map((r) => r.saidas) },
      ],
      formatar: (v) => reais(v), animar,
    };
  }

  /* ---------- linha de lançamento ---------- */
  function linhaItem(item, opcoes = {}) {
    const h = hoje();
    // Gasto da conjunta pago do bolso: o estado de pago e a conta são os do lançamento espelho.
    const espelho = item.semCaixa ? parDe(item) : null;
    const vEspelho = espelho ? visao(Fin.areaDe(espelho)) : null;
    const cartao = espelho ? Fin.ehCartao(vEspelho, espelho) : Fin.ehCartao(estado, item);
    const feito = espelho ? Fin.liquidado(vEspelho, espelho, h) : Fin.liquidado(estado, item, h);
    const quando = espelho ? Fin.dataCaixa(vEspelho, espelho) : Fin.dataCaixa(estado, item);
    const atrasado = !feito && quando < h;
    const partes = [nomeCategoria(item.categoriaId), item.pagoPor ? `pago por ${nomePerfil(item.pagoPor)}` : nomeConta(item.contaId)];
    if (cartao) partes.push(`fatura ${dataCurta(quando)}`);
    if (opcoes.comData) partes.unshift(dataCurta(item.data));
    const etiquetas = [
      item.parcelaGrupo ? `<span class="etiqueta">${item.parcela}/${item.parcelas}</span>` : '',
      item.recorrenteId ? '<span class="etiqueta">Fixo</span>' : '',
      item.metaId ? '<span class="etiqueta">Meta</span>' : '',
      item.transferencia ? `<span class="etiqueta">${item.acerto ? 'Acerto' : 'Transferência'}</span>` : '',
      item.espelho ? '<span class="etiqueta">Conjunta</span>' : '',
      feito && Fin.jaNoSaldo(estado, item) ? '<span class="etiqueta">Já no saldo</span>' : '',
      item.tipo === 'receita' && item.certeza === 'provavel' ? '<span class="etiqueta provavel">Provável</span>' : '',
      atrasado ? '<span class="etiqueta atraso">Vencido</span>' : '',
    ].join('');
    const rotuloCheck = item.tipo === 'receita' ? 'recebido' : 'pago';
    const check = cartao || espelho
      ? `<span class="check so-marca" aria-hidden="true" ${feito ? 'aria-pressed="true"' : ''}>${icone('check')}</span>`
      : `<button type="button" class="check" data-acao="alternar" data-id="${esc(item.id)}" aria-pressed="${feito}" aria-label="Marcar ${esc(item.descricao)} como ${rotuloCheck}">${icone('check')}</button>`;
    return `<div class="linha-item">${check}
      <button type="button" class="linha-corpo" data-acao="abrir-item" data-id="${esc(item.id)}">
        <span class="linha-texto"><b>${esc(item.descricao)}${etiquetas}</b><small>${esc(partes.join(' · '))}</small></span>
        <span class="linha-valor num ${Fin.soMudouDeConta(item) ? 'transf' : item.tipo === 'receita' ? 'pos' : 'saida'}">${item.tipo === 'receita' ? '+' : '−'}${reais(item.valor)}</span>
      </button></div>`;
  }

  function acharItem(id) {
    if (id.startsWith('v:')) {
      const [, rec, ym] = id.split(':');
      return Fin.ocorrencias(estado, ym).find((o) => o.recorrenteId === rec && o.competencia === ym);
    }
    return estado.lancamentos[id];
  }

  /* ---------- vistas ---------- */
  const vistas = {};
  const montar = {};

  vistas.inicio = () => {
    const h = hoje();
    const r = Fin.resumoMes(estado, mesDe(h), ui.grupo, h);
    const proj = Fin.projetar(estado, h, 0, { grupo: ui.grupo });
    const fimMes = proj.finaisDeMes[0];
    const mesNome = nomeMes(mesDe(h), true).split(' ')[0];
    const compacto = (v) => reais(v, { compacto: true });
    // Saídas e sobra são medidas contra as entradas do mês; entradas, contra o que já foi recebido.
    const numero = (rotulo, valor, pctBarra, detalhe, titulo, estouro = false) => `<div class="numero${estouro ? ' estouro' : ''}">
        <small>${rotulo}</small><strong data-valor="${valor}">${compacto(valor)}</strong>
        <div class="mini" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, pctBarra))}%"></span></div>
        <small class="detalhe" title="${esc(titulo)}">${detalhe}</small></div>`;
    const base = r.entradasCertas;
    const dasEntradas = (v) => (base > 0 ? (v / base) * 100 : 0);
    const textoPct = (p) => (p > 0 && p < 1 ? 'menos de 1%' : `${Math.round(p)}%`);
    const recebido = base > 0 ? Math.min(100, (r.entrou / base) * 100) : 0;
    const alertas = Fin.alertas(estado, h, ui.grupo);
    const prox = Fin.proximos(estado, h, 30, ui.grupo, { entradas: true }).slice(0, 7);
    const categorias = vivos(estado, 'categorias').filter((c) => c.tipo === 'despesa' && c.limite > 0);
    return `
      ${ui.area === 'conjunta' ? '' : avisoAcertoPessoal()}
      <section class="heroi" aria-label="Resumo">
        <div class="heroi-faisca" id="heroi-faisca" aria-hidden="true"></div>
        <button type="button" class="heroi-saldo" data-acao="ver-saldo" title="Ver como o saldo é calculado">
          <span class="heroi-rotulo">${ui.area === 'conjunta' ? 'Saldo conjunto hoje' : 'Seu saldo hoje'}${ui.grupo !== 'Tudo' ? ' · ' + esc(ui.grupo) : ''}${icone('direita')}</span>
          <span class="heroi-valor" id="saldo-heroi">${reais(Fin.saldoHoje(estado, h, ui.grupo))}</span>
        </button>
        <div class="heroi-sub">Previsão para o fim de ${esc(mesNome)}: <b>${reais(fimMes.saldo)}</b></div>
        <div class="numeros">
          ${numero('Entradas<span class="so-largo"> do mês</span>', base, recebido, `${textoPct(recebido)} recebido`, `${compacto(r.entrou)} já recebido`)}
          ${numero('Saídas<span class="so-largo"> do mês</span>', r.saidas, dasEntradas(r.saidas), base > 0 ? `${textoPct(dasEntradas(r.saidas))} das entradas` : 'sem entradas no mês', `${compacto(r.saiu)} já saiu`, r.saidas > base)}
          ${numero('Sobra<span class="so-largo"> do mês</span>', r.sobra, dasEntradas(Math.max(0, r.sobra)), r.sobra < 0 ? 'saídas maiores' : base > 0 ? `${textoPct(dasEntradas(r.sobra))} das entradas` : '—', 'Entradas menos saídas do mês', r.sobra < 0)}
        </div>
      </section>
      ${alertas.length ? `<div class="pilha">${alertas.map((a) => `<div class="alerta ${a.nivel === 'critico' ? 'critico' : ''}">${icone('alerta')}<div><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></div></div>`).join('')}</div>` : ''}
      ${ui.area === 'conjunta' && temSegundaPessoa() ? cartaoAcerto() : ''}
      <div class="colunas">
        <section class="cartao">
          <div class="cartao-topo">
            <div><h2>Para onde o saldo vai</h2><p class="nota" id="frase-saldo"></p></div>
            ${segmento('faixa', ui.faixa, [[6, '6 meses'], [12, '1 ano'], [24, '2 anos']])}
          </div>
          <div id="grafico-saldo"></div>
        </section>
        <div class="pilha">
          <section class="cartao">
            <div class="cartao-topo"><h2>Próximos 30 dias</h2></div>
            ${prox.length ? prox.map(linhaProximo).join('') : '<div class="vazio"><span>Nada previsto.</span></div>'}
          </section>
          <section class="cartao">
            <div class="cartao-topo"><h2>Limites do mês</h2><a class="link" href="#ajustes">Definir</a></div>
            ${categorias.length ? categorias.map((c) => barraLimite(c, r.porCategoria[c.id] || 0)).join('') : '<p class="nota">Defina um limite para uma categoria em Ajustes e acompanhe aqui.</p>'}
          </section>
        </div>
      </div>`;
  };

  /* Quem deve a quem: positivo, a segunda pessoa deve à primeira. */
  function situacaoAcerto() {
    const saldo = Fin.acertoConjunta(banco.estado, hoje(), divisaoP1());
    if (!saldo) return null;
    const devedor = saldo > 0 ? Fin.AREA_SEGUNDA : Fin.AREA_PRIMEIRA;
    return { valor: Math.abs(saldo), devedor, credor: devedor === Fin.AREA_PRIMEIRA ? Fin.AREA_SEGUNDA : Fin.AREA_PRIMEIRA };
  }

  function cartaoAcerto() {
    const s = situacaoAcerto();
    const p1 = divisaoP1();
    return `<section class="cartao">
      <div class="cartao-topo"><div><h2>Acerto entre vocês</h2><p class="nota">Gastos da conjunta pagos do próprio bolso, divididos ${p1}% ${esc(nomePerfil(Fin.AREA_PRIMEIRA))} e ${100 - p1}% ${esc(nomePerfil(Fin.AREA_SEGUNDA))}. <a class="link" href="#ajustes">Mudar</a></p></div>
      </div>
      <p class="acerto-frase">${s ? `<b>${esc(nomePerfil(s.devedor))}</b> deve <b class="num">${reais(s.valor)}</b> para <b>${esc(nomePerfil(s.credor))}</b>.` : 'Vocês estão quites.'}</p>
      ${s ? '<button type="button" class="btn primario" data-acao="registrar-acerto" style="margin-top:12px">Registrar acerto</button>' : ''}
    </section>`;
  }

  function avisoAcertoPessoal() {
    if (!temSegundaPessoa()) return '';
    const s = situacaoAcerto();
    if (!s || (s.devedor !== banco.perfil && s.credor !== banco.perfil)) return '';
    const outro = nomePerfil(outraPessoa());
    const texto = s.credor === banco.perfil ? `${outro} te deve ${reais(s.valor)}` : `Você deve ${reais(s.valor)} para ${outro}`;
    return `<div class="alerta">${icone('alerta')}<div><b>${esc(texto)}</b><span>Pelos gastos da Conjunta pagos do próprio bolso. O acerto fica na área Conjunta.</span></div></div>`;
  }

  function linhaProximo(i) {
    const entrada = i.tipo === 'receita';
    const corpo = `<span class="linha-texto"><b>${esc(i.descricao)}${i.atrasado ? `<span class="etiqueta atraso">${entrada ? 'A confirmar' : 'Vencido'}</span>` : ''}</b><small>${esc(nomeDia(i.quando))}${i.fatura ? '' : ' · ' + esc(nomeConta(i.contaId))}</small></span><span class="linha-valor num ${entrada ? 'pos' : 'saida'}">${entrada ? '+' : '−'}${reais(i.valor)}</span>`;
    if (i.fatura) return `<div class="linha-item"><a class="linha-corpo" href="#lancamentos" style="color:inherit;text-decoration:none">${corpo}</a></div>`;
    return `<div class="linha-item"><button type="button" class="linha-corpo" data-acao="abrir-item" data-id="${esc(i.id)}">${corpo}</button></div>`;
  }

  function barraLimite(c, gasto) {
    const pct = Math.min(100, (gasto / c.limite) * 100);
    const nivel = gasto > c.limite ? 'critico' : gasto >= c.limite * 0.8 ? 'aviso' : '';
    return `<div class="barra-linha"><div class="barra-info"><span>${esc(c.nome)}</span><span class="num mudo">${reais(gasto)} de ${reais(c.limite)}</span></div>
      <div class="trilho"><span class="enche ${nivel}" style="width:${pct}%"></span></div>
      ${nivel === 'critico' ? '<span class="pequeno neg">Passou do limite</span>' : nivel === 'aviso' ? '<span class="pequeno mudo">Perto do limite</span>' : ''}</div>`;
  }

  montar.inicio = (animar) => {
    const saldo = Fin.saldoHoje(estado, hoje(), ui.grupo);
    if (animar) {
      Graficos.contar($('#saldo-heroi'), saldo, (v) => reais(v));
      $$('.numero strong[data-valor]').forEach((el) => Graficos.contar(el, Number(el.dataset.valor), (v) => reais(v, { compacto: true }), 900));
    }
    const linhaTopo = dadosSaldo(6);
    Graficos.faisca($('#heroi-faisca'), linhaTopo.real.map((v, i) => (v != null ? v : linhaTopo.projCertas[i])), linhaTopo.indiceHoje, animar);
    const d = graficoSaldo($('#grafico-saldo'), ui.faixa, animar);
    const m = d.certas.menor;
    const inclui = [];
    if (d.certas.variavelMensal) inclui.push(`${reais(d.certas.variavelMensal)} por mês de gastos variáveis`);
    if (d.certas.metasMensal) inclui.push(`${reais(d.certas.metasMensal)} por mês para metas`);
    $('#frase-saldo').textContent = `Menor saldo previsto: ${reais(m.saldo)} em ${dataBR(m.data)}.${inclui.length ? ` Inclui ${inclui.join(' e ')}.` : ''}`;
  };

  vistas.lancamentos = () => {
    const r = Fin.resumoMes(estado, ui.mes, ui.grupo);
    return `
      <section class="cartao">
        <div class="navega-mes">
          <button type="button" class="icone-btn" data-acao="mes" data-valor="-1" aria-label="Mês anterior">${icone('esquerda')}</button>
          <strong>${esc(nomeMes(ui.mes, true))}</strong>
          <button type="button" class="icone-btn" data-acao="mes" data-valor="1" aria-label="Próximo mês">${icone('direita')}</button>
        </div>
        <div class="resumo-3" style="margin-top:10px">
          <div><small>Entradas</small><strong class="num pos">${reais(r.entradasCertas, { compacto: true })}</strong></div>
          <div><small>Saídas</small><strong class="num saida">${r.saidas ? '−' : ''}${reais(r.saidas, { compacto: true })}</strong></div>
          <div><small>Sobra</small><strong class="num ${r.sobra < 0 ? 'neg' : ''}">${reais(r.sobra, { compacto: true })}</strong></div>
        </div>
        ${r.entradasProvaveis ? `<p class="nota" style="margin-top:8px">Mais ${reais(r.entradasProvaveis)} em entradas prováveis, fora da conta acima.</p>` : ''}
        ${r.guardado ? `<p class="nota" style="margin-top:8px">${reais(r.guardado)} guardados para metas, fora das saídas.</p>` : ''}
      </section>
      <section class="cartao">
        <div class="barra-filtros empilha" style="margin-bottom:12px">
          <label><span class="oculto-visual">Buscar lançamento</span><input id="busca" type="search" placeholder="Buscar" value="${esc(ui.texto)}" autocomplete="off"></label>
          ${segmento('tipo', ui.tipo, [['todos', 'Todos'], ['despesa', 'Saídas'], ['receita', 'Entradas']])}
        </div>
        <div id="lista-lancamentos">${listaLancamentos()}</div>
      </section>`;
  };

  function itensFiltrados() {
    const termo = ui.texto.trim().toLowerCase();
    return Fin.itensDoMes(estado, ui.mes, ui.grupo).filter((i) => {
      if (ui.tipo !== 'todos' && i.tipo !== ui.tipo) return false;
      if (!termo) return true;
      return `${i.descricao} ${nomeCategoria(i.categoriaId)} ${nomeConta(i.contaId)}`.toLowerCase().includes(termo);
    });
  }

  function listaLancamentos() {
    const termo = ui.texto.trim().toLowerCase();
    const itens = itensFiltrados();
    if (!itens.length) {
      return `<div class="vazio"><span>${termo || ui.tipo !== 'todos' ? 'Nada encontrado com esse filtro.' : 'Nenhum lançamento neste mês.'}</span>${termo || ui.tipo !== 'todos' ? '' : '<button type="button" class="btn primario" data-acao="novo">Fazer o primeiro lançamento</button>'}</div>`;
    }
    let dia = null;
    return itens.map((i) => {
      const cab = i.data !== dia ? `<div class="dia">${esc(nomeDia(i.data))}</div>` : '';
      dia = i.data;
      return cab + linhaItem(i);
    }).join('');
  }

  vistas.fixos = () => {
    const h = hoje();
    const recs = vivos(estado, 'recorrentes').filter((r) => (ui.grupo === 'Tudo' || (estado.contas[r.contaId] || {}).grupo === ui.grupo) && (!r.fim || r.fim >= mesDe(h)));
    const transfs = recs.filter((r) => r.transferencia);
    const saidas = recs.filter((r) => r.tipo === 'despesa' && !r.transferencia);
    const entradas = recs.filter((r) => r.tipo === 'receita' && !r.transferencia);
    const totalS = saidas.reduce((s, r) => s + r.valor, 0);
    const totalE = entradas.filter((r) => r.certeza !== 'provavel').reduce((s, r) => s + r.valor, 0);
    const parc = Fin.parcelamentos(estado, h, ui.grupo).filter((p) => p.restante > 0);
    const futuros = Fin.vivos(estado, 'lancamentos')
      .filter((l) => (ui.grupo === 'Tudo' || (estado.contas[l.contaId] || {}).grupo === ui.grupo) && !l.parcelaGrupo && !l.recorrenteId && l.data > h)
      .sort((a, b) => (a.data < b.data ? -1 : 1));
    const linhaFixo = (r) => `<div class="linha-item"><button type="button" class="linha-corpo" data-acao="editar-fixo" data-id="${esc(r.id)}">
        <span class="linha-texto"><b>${esc(r.descricao)}${r.certeza === 'provavel' ? '<span class="etiqueta provavel">Provável</span>' : ''}</b><small>Dia ${Number(r.inicio.slice(8, 10))} · ${esc(nomeCategoria(r.categoriaId))} · ${esc(nomeConta(r.contaId))}${r.fim ? ' · até ' + esc(nomeMes(r.fim)) : ''}</small></span>
        <span class="linha-valor num ${Fin.soMudouDeConta(r) ? 'transf' : r.tipo === 'receita' ? 'pos' : 'saida'}">${r.tipo === 'receita' ? '+' : '−'}${reais(r.valor)}</span></button></div>`;
    return `<div class="colunas">
      <div class="pilha">
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Saídas fixas</h2><p class="nota">${reais(totalS)} por mês</p></div></div>
          ${saidas.length ? saidas.sort((a, b) => b.valor - a.valor).map(linhaFixo).join('') : `<div class="vazio"><span>Aluguel, internet, assinaturas: cadastre uma vez e o app repete todo mês.</span><button type="button" class="btn" data-acao="novo-fixo" data-valor="despesa">Adicionar saída fixa</button></div>`}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Entradas fixas</h2><p class="nota">${reais(totalE)} por mês em entradas certas</p></div></div>
          ${entradas.length ? entradas.sort((a, b) => b.valor - a.valor).map(linhaFixo).join('') : `<div class="vazio"><span>Salário, pró-labore, honorários mensais.</span><button type="button" class="btn" data-acao="novo-fixo" data-valor="receita">Adicionar entrada fixa</button></div>`}
        </section>
        ${transfs.length ? `<section class="cartao">
          <div class="cartao-topo"><div><h2>Transferências fixas</h2><p class="nota">Repetem todo mês, como o depósito na conjunta.</p></div></div>
          ${transfs.sort((a, b) => b.valor - a.valor).map(linhaFixo).join('')}
        </section>` : ''}
      </div>
      <div class="pilha">
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Parcelas em andamento</h2><p class="nota">${reais(parc.reduce((s, p) => s + p.restante, 0))} ainda a pagar</p></div></div>
          ${parc.length ? parc.map((p) => `<div class="barra-linha"><div class="barra-info"><span>${esc(p.descricao)}</span><span class="num mudo">${p.pagas}/${p.parcelas}</span></div>
            <div class="trilho"><span class="enche meta" style="width:${(p.pagas / p.parcelas) * 100}%"></span></div>
            <span class="pequeno mudo">Faltam ${reais(p.restante)} · termina em ${esc(nomeMes(mesDe(p.ultima)))}</span></div>`).join('') : '<p class="nota">Nenhuma compra parcelada em aberto.</p>'}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Gastos e entradas futuras</h2><p class="nota">IPVA, seguro, um acordo a receber</p></div></div>
          ${futuros.length ? futuros.map((l) => linhaItem(l, { comData: true })).join('') : '<p class="nota">Nada agendado. Ao lançar, escolha uma data futura.</p>'}
        </section>
      </div>
    </div>`;
  };

  vistas.graficos = () => {
    const seg = segmento('periodo', ui.periodo, [[6, '6 meses'], [12, '1 ano']]);
    const r = Fin.resumoMes(estado, ui.mes, ui.grupo);
    const linhas = Object.entries(r.porCategoria).sort((a, b) => b[1] - a[1]);
    const maior = linhas.length ? linhas[0][1] : 1;
    return `<div class="colunas">
      <div class="pilha">
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Entradas × saídas</h2><p class="nota">Meses seguintes em tom claro, com o que já está previsto.</p></div>${seg}</div>
          <div id="grafico-colunas"></div>
        </section>
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Saldo mês a mês</h2></div>${segmento('faixa', ui.faixa, [[6, '6 meses'], [12, '1 ano'], [24, '2 anos']])}</div>
          <div id="grafico-saldo"></div>
        </section>
      </div>
      <section class="cartao">
        <div class="navega-mes" style="margin-bottom:6px">
          <button type="button" class="icone-btn" data-acao="mes" data-valor="-1" aria-label="Mês anterior">${icone('esquerda')}</button>
          <strong style="font-size:16px">${esc(nomeMes(ui.mes, true))}</strong>
          <button type="button" class="icone-btn" data-acao="mes" data-valor="1" aria-label="Próximo mês">${icone('direita')}</button>
        </div>
        <h2 style="margin-bottom:6px">Para onde foi o dinheiro</h2>
        ${linhas.length ? linhas.map(([id, v]) => `<div class="barra-linha"><div class="barra-info"><span>${esc(nomeCategoria(id))}</span><span class="num">${reais(v)} <span class="mudo">· ${Math.round((v / r.saidas) * 100)}%</span></span></div><div class="trilho"><span class="enche" style="width:${(v / maior) * 100}%"></span></div></div>`).join('') : '<div class="vazio"><span>Nenhuma saída neste mês.</span></div>'}
      </section>
    </div>`;
  };

  montar.graficos = (animar) => {
    Graficos.colunas($('#grafico-colunas'), configColunas(dadosColunas(), animar));
    graficoSaldo($('#grafico-saldo'), ui.faixa, animar);
  };

  /* ---------- planejar ---------- */
  vistas.planejar = () => {
    const h = hoje();
    const media = Fin.mediaVariavel(estado, h, ui.grupo);
    const origem = {
      manual: 'Valor definido por você.',
      media: `Média dos últimos ${media.meses} ${media.meses > 1 ? 'meses' : 'mês'}, sem contar fixos, parcelas, gastos planejados e gastos fora do comum.`,
      ritmo: 'Estimado pelo ritmo de gastos deste mês.',
      'sem-dados': 'Ainda sem histórico. Lance seus gastos ou defina um valor abaixo.',
    }[media.origem];
    const cfg = estado.config.geral || {};
    const metas = vivos(estado, 'metas');
    const s = ui.sim;
    return `<div class="colunas">
      <section class="cartao">
        <div class="cartao-topo"><div><h2>E se…?</h2><p class="nota">Teste uma decisão antes de tomar. Nada aqui é salvo.</p></div></div>
        <div style="display:grid;gap:12px">
          ${segmento('sim-tipo', s.tipo, [['compra', 'Compra'], ['gasto', 'Novo gasto'], ['corte', 'Corte'], ['renda', 'Renda extra']], 'largo')}
          <div class="grade-2">
            <label class="campo"><span id="sim-rotulo">${s.tipo === 'compra' ? 'Valor total' : 'Valor por mês'}</span><input id="sim-valor" type="text" inputmode="decimal" placeholder="0,00" value="${esc(s.valorTxt)}" autocomplete="off"></label>
            ${s.tipo === 'compra' ? `<label class="campo"><span>Parcelas</span><input id="sim-parcelas" type="number" inputmode="numeric" min="1" max="120" value="${s.parcelas}"></label>` : `<label class="campo"><span>A partir de</span><input id="sim-inicio" type="date" value="${esc(s.inicio)}"></label>`}
          </div>
          ${s.tipo === 'compra' ? `<label class="campo"><span>Primeira parcela</span><input id="sim-inicio" type="date" value="${esc(s.inicio)}"></label>` : ''}
        </div>
        <div id="sim-resultado"></div>
      </section>
      <div class="pilha">
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Gastos variáveis</h2><p class="nota">${esc(origem)}</p></div></div>
          <p style="font:700 26px var(--titulo)">${reais(media.valor)} <span class="pequeno mudo" style="font:400 13px var(--texto)">por mês</span></p>
          <div class="barra-filtros" style="margin-top:10px">
            <label><span class="oculto-visual">Valor manual por mês</span><input id="variavel-manual" type="text" inputmode="decimal" placeholder="Definir outro valor" value="${cfg.variavelManual != null ? valorParaCampo(cfg.variavelManual) : ''}" autocomplete="off"></label>
            <button type="button" class="btn" data-acao="salvar-variavel">Salvar</button>
          </div>
          ${cfg.variavelManual != null ? '<button type="button" class="link" data-acao="limpar-variavel" style="margin-top:6px">Voltar à estimativa automática</button>' : ''}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Metas</h2><button type="button" class="btn" data-acao="nova-meta">Nova meta</button></div>
          ${metas.length ? metas.map(linhaMeta).join('') : '<p class="nota">Reserva, viagem, troca do notebook: veja quando dá para chegar lá.</p>'}
        </section>
      </div>
    </div>`;
  };

  function linhaMeta(m) {
    const prev = Fin.previsaoMeta(m, hoje(), estado);
    const pct = Math.min(100, (Fin.guardadoMeta(estado, m) / m.alvo) * 100);
    const jaGuardou = prev.feitoEsteMes ? ' Este mês já está guardado.' : '';
    const texto = prev.pronta ? 'Meta alcançada' : prev.data ? `Faltam ${reais(prev.falta)}. Guardando ${reais(m.aporte)} por mês, chega em ${nomeMes(prev.data)}.${jaGuardou}` : `Faltam ${reais(prev.falta)}. Defina quanto guardar por mês para ver a data.`;
    const podeGuardar = m.aporte && !prev.pronta && !prev.feitoEsteMes;
    return `<div class="barra-linha">
      <button type="button" data-acao="editar-meta" data-id="${esc(m.id)}" style="display:grid;gap:5px;width:100%;text-align:left">
        <div class="barra-info"><span>${esc(m.nome)}</span><span class="num mudo">${Math.round(pct)}%</span></div>
        <div class="trilho"><span class="enche meta" style="width:${pct}%"></span></div>
        <span class="pequeno mudo">${esc(texto)}</span>
      </button>
      ${podeGuardar ? `<button type="button" class="btn" data-acao="guardar-meta" data-id="${esc(m.id)}">Guardei ${reais(Math.min(m.aporte, prev.falta))} este mês</button>` : ''}
    </div>`;
  }

  function pintarSimulacao(animar) {
    const alvo = $('#sim-resultado');
    if (!alvo) return;
    const s = ui.sim;
    const valor = lerReais(s.valorTxt);
    if (!valor) {
      alvo.innerHTML = '<p class="nota" style="margin-top:14px">Digite um valor para ver o efeito no seu saldo.</p>';
      return;
    }
    const h = hoje();
    const meses = 12;
    const sim = { tipo: s.tipo, valor, parcelas: Number(s.parcelas) || 1, inicio: s.inicio || h };
    const antes = dadosSaldo(meses);
    const depois = Fin.projetar(estado, h, meses, { grupo: ui.grupo, sim });
    const fica = depois.menor.saldo < 0;
    alvo.innerHTML = `
      <div class="comparativo">
        <div><small>Menor saldo em 12 meses</small><strong class="num ${fica ? 'neg' : ''}">${reais(depois.menor.saldo)}</strong><small>era ${reais(antes.certas.menor.saldo)}</small></div>
        <div><small>Saldo daqui a 12 meses</small><strong class="num">${reais(depois.saldoFinal)}</strong><small>era ${reais(antes.certas.saldoFinal)}</small></div>
      </div>
      <p class="nota" style="margin-bottom:10px">${fica ? `Assim o saldo fica negativo em ${dataBR(depois.primeiroNegativo)} e chega a ${reais(depois.menor.saldo)} em ${dataBR(depois.menor.data)}, contando só as entradas certas.` : 'O saldo continua positivo nos próximos 12 meses, contando só as entradas certas.'}</p>
      <div id="grafico-sim"></div>
      ${s.tipo === 'compra' ? '<button type="button" class="btn" data-acao="sim-lancar" style="margin-top:10px">Lançar esta compra</button>' : ''}`;
    const inicioProj = antes.indiceHoje;
    Graficos.linhas($('#grafico-sim'), {
      titulo: 'Saldo com e sem a simulação',
      rotulos: antes.rotulos.slice(inicioProj), rotulosLongos: antes.longos.slice(inicioProj),
      series: [
        { nome: 'Sem a simulação', cor: 'var(--s1)', valores: antes.projCertas.slice(inicioProj), tracejado: true },
        { nome: 'Com a simulação', cor: 'var(--s2)', valores: [antes.agora, ...depois.finaisDeMes.map((f) => f.saldo)] },
      ],
      formatar: (v) => reais(v), animar,
    });
  }

  montar.planejar = (animar) => pintarSimulacao(animar);

  /* ---------- ajustes ---------- */
  vistas.ajustes = () => {
    const contas = vivos(estado, 'contas');
    const h = hoje();
    const cats = vivos(estado, 'categorias').sort((a, b) => (a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : a.nome.localeCompare(b.nome, 'pt-BR')));
    let tema = 'auto';
    try { tema = localStorage.getItem(CHAVE_TEMA) || 'auto'; } catch (e) { /* segue o sistema */ }
    return `<section class="cartao">
        <div class="cartao-topo"><div><h2>Este aparelho é de ${esc(nomePerfil(banco.perfil))}</h2><p class="nota">Contas, categorias e limites abaixo são da área aberta: ${ui.area === 'conjunta' ? 'Conjunta' : 'Minhas'}.</p></div>
          <div class="acoes"><button type="button" class="btn" data-acao="trocar-perfil">Trocar de pessoa</button><button type="button" class="btn" data-acao="editar-nomes">Editar nomes</button></div></div>
      </section>
      ${ui.area === 'conjunta' && temSegundaPessoa() ? `<section class="cartao">
        <div class="cartao-topo"><div><h2>Divisão dos gastos da conjunta</h2><p class="nota">Vale para os gastos da conjunta que um de vocês paga do próprio bolso.</p></div></div>
        <form data-form="divisao" novalidate class="barra-filtros">
          <label class="campo"><span>Parte de ${esc(nomePerfil(Fin.AREA_PRIMEIRA))} (%)</span><input id="d-p1" type="number" inputmode="numeric" min="0" max="100" value="${divisaoP1()}"></label>
          <button type="submit" class="btn" style="align-self:end">Salvar</button>
        </form>
        <p class="nota" id="d-p2" style="margin-top:6px">${esc(nomePerfil(Fin.AREA_SEGUNDA))} fica com ${100 - divisaoP1()}%.</p>
      </section>` : ''}
      <div class="colunas">
      <div class="pilha">
        <section class="cartao">
          <div class="cartao-topo"><h2>Contas e cartões</h2><button type="button" class="btn" data-acao="nova-conta">Nova conta</button></div>
          ${contas.map((c) => `<div class="linha-item"><button type="button" class="linha-corpo" data-acao="editar-conta" data-id="${esc(c.id)}">
            <span class="linha-texto"><b>${esc(c.nome)}</b><small>${c.tipo === 'cartao' ? `Cartão · fecha dia ${c.fechamento}, vence dia ${c.vencimento}${Fin.contaPagadora(estado, c) ? ` · pago por ${esc(Fin.contaPagadora(estado, c).nome)}` : ''}` : c.tipo === 'carteira' ? 'Carteira' : 'Banco'} · ${esc(c.grupo || 'Pessoal')}</small></span>
            ${c.tipo === 'cartao' ? '' : `<span class="linha-valor num">${reais(Fin.saldoConta(estado, c, h))}</span>`}</button></div>`).join('')}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Categorias e limites</h2><p class="nota">Toque em uma saída para definir o limite mensal.</p></div><button type="button" class="btn" data-acao="nova-categoria">Nova</button></div>
          ${cats.map((c) => `<div class="linha-item"><button type="button" class="linha-corpo" data-acao="editar-categoria" data-id="${esc(c.id)}">
            <span class="linha-texto"><b>${esc(c.nome)}</b><small>${c.tipo === 'receita' ? 'Entrada' : 'Saída'}</small></span>
            <span class="linha-valor num mudo">${c.limite ? 'até ' + reais(c.limite) : ''}</span></button></div>`).join('')}
        </section>
      </div>
      <div class="pilha">
        <section class="cartao" id="sincronizacao">
          <div class="cartao-topo"><h2>Sincronização</h2></div>
          ${banco.exemplo ? '<p class="nota">Apague os dados de exemplo para conectar a sua planilha.</p>' : blocoSinc()}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Aparência</h2></div>
          ${segmento('tema', tema, [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']], 'largo')}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><div><h2>Backup</h2><p class="nota">Uma cópia completa em arquivo, além da planilha.</p></div></div>
          <div class="acoes">
            <button type="button" class="btn" data-acao="baixar-json">Baixar backup</button>
            <button type="button" class="btn" data-acao="restaurar">Restaurar backup</button>
            <button type="button" class="btn" data-acao="baixar-csv">Exportar para Excel</button>
          </div>
          <input id="arquivo-backup" type="file" accept="application/json,.json" hidden>
        </section>
      </div>
    </div>`;
  };

  function blocoSinc() {
    if (banco.sinc) {
      return `<p class="nota" id="sinc-detalhe" style="margin-bottom:12px">${esc(detalheSinc())}</p>
        <div class="acoes">
          <button type="button" class="btn primario" data-acao="sincronizar">Sincronizar agora</button>
          <button type="button" class="btn" data-acao="desconectar">Desconectar</button>
        </div>`;
    }
    return `<p class="nota" style="margin-bottom:12px">Hoje os dados estão só neste aparelho. Conecte uma planilha sua no Google para usar também em outro aparelho.</p>
      <ol class="nota" style="padding-left:20px;margin:0 0 12px;display:grid;gap:6px">
        <li>Crie uma planilha em branco e abra <b>Extensões &gt; Apps Script</b>.</li>
        <li>Apague o conteúdo do editor, <button type="button" class="link" data-acao="copiar-script">copie o script</button> e cole lá.</li>
        <li>Salve, escolha a função <b>configurar</b> e clique em <b>Executar</b>. Autorize. A chave aparece no <b>Registro de execução</b>.</li>
        <li><b>Implantar &gt; Nova implantação &gt; App da Web</b>. Executar como <b>Eu</b>, acesso <b>Qualquer pessoa</b>. Copie a URL.</li>
      </ol>
      <div style="display:grid;gap:12px">${camposConexao()}
        <button type="button" class="btn primario" data-acao="conectar">Conectar</button>
        <p class="erro-campo" id="conexao-erro" hidden></p>
      </div>`;
  }

  /* ---------- folha de formulários ---------- */
  const folha = () => $('#folha');
  function abrirFolha(html, focar) {
    const d = folha();
    d.innerHTML = `<div class="folha-corpo">${html}</div>`;
    if (!d.open) d.showModal();
    if (focar) { const alvo = $(focar, d); if (alvo) alvo.focus(); }
  }
  function fecharFolha() {
    const d = folha();
    if (d.open) d.close();
    d.innerHTML = '';
    if (ui.redesenhar) desenhar();
  }
  const topoFolha = (titulo) => `<div class="folha-topo"><h2 id="folha-titulo">${esc(titulo)}</h2><button type="button" class="icone-btn" data-acao="fechar" aria-label="Fechar">${icone('fechar')}</button></div>`;

  /* ---------- formulário de lançamento ---------- */
  let form = null;

  function formularioNovo(extras = {}) {
    const h = hoje();
    const contas = vivos(estado, 'contas');
    const preferida = (ui.grupo !== 'Tudo' && contas.find((c) => c.grupo === ui.grupo && c.tipo !== 'cartao')) || contas.find((c) => c.tipo !== 'cartao') || contas[0];
    form = { modo: 'novo', area: areaAtiva(), tipo: 'despesa', valorTxt: '', descricao: '', categoriaId: '', contaId: preferida ? preferida.id : '', data: h, repete: 'uma', parcelas: 2, fim: '', certeza: 'certa', pago: true, pagador: AREA_CONJUNTA, ...extras };
    pintarFormulario(true);
  }

  /* A mais usada; sem histórico, a categoria genérica "Outras". */
  function categoriaSugerida(tipo, cats, v) {
    const usos = {};
    vivos(v, 'lancamentos').forEach((l) => { if (l.tipo === tipo) usos[l.categoriaId] = (usos[l.categoriaId] || 0) + 1; });
    const ordenadas = cats.filter((c) => usos[c.id]).sort((a, b) => usos[b.id] - usos[a.id]);
    const generica = cats.find((c) => c.nome.startsWith('Outras'));
    return ((ordenadas[0] || generica || cats[0]) || {}).id || '';
  }

  function pintarFormulario(focar) {
    const f = form;
    const v = visao(f.area);
    const cats = vivos(v, 'categorias').filter((c) => c.tipo === f.tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!cats.some((c) => c.id === f.categoriaId)) f.categoriaId = categoriaSugerida(f.tipo, cats, v);
    const contas = vivos(v, 'contas');
    const titulos = { novo: 'Novo lançamento', editar: 'Editar lançamento', confirmar: 'Confirmar fixo', fixo: 'Editar fixo' };
    const descricoes = [...new Set(vivos(v, 'lancamentos').filter((l) => l.tipo === f.tipo && !l.metaId).map((l) => l.descricao))].slice(0, 200);
    const eParcela = f.modo === 'editar' && f.parcelaGrupo;
    const podeMudarArea = f.modo === 'novo' || (f.modo === 'editar' && !f.parcelaGrupo && !f.recorrenteId && !f.metaId);
    const podeSerExcepcional = f.tipo === 'despesa' && !f.metaId && ((f.modo === 'novo' && f.repete === 'uma') || (f.modo === 'editar' && !f.parcelaGrupo && !f.recorrenteId));
    // Gasto da conjunta pago do bolso: só lançamentos únicos (fixos e parcelas usam a conta conjunta).
    const podeEscolherPagador = f.area === AREA_CONJUNTA && f.tipo === 'despesa' && temSegundaPessoa() && !f.metaId
      && ((f.modo === 'novo' && f.repete === 'uma') || (f.modo === 'editar' && !f.parcelaGrupo && !f.recorrenteId));
    if (!podeEscolherPagador) f.pagador = AREA_CONJUNTA;
    const doBolso = f.pagador && f.pagador !== AREA_CONJUNTA;
    const contasPagador = doBolso ? contasDaArea(f.pagador) : [];
    if (doBolso && !contasPagador.some((c) => c.id === f.contaPessoal)) f.contaPessoal = (contasPagador.find((c) => c.tipo !== 'cartao') || contasPagador[0] || {}).id;

    abrirFolha(`<form data-form="lancamento" novalidate style="display:grid;gap:14px">
      ${topoFolha(titulos[f.modo])}
      ${f.modo === 'confirmar' ? `<p class="nota">Ajuste o valor se foi diferente. Previsto para ${dataBR(f.data)}.</p>` : ''}
      ${eParcela ? `<p class="nota">Parcela ${f.parcela} de ${f.parcelas}. A alteração vale só para esta parcela.</p>` : ''}
      ${podeMudarArea && !doBolso ? `<div class="campo"><span class="rotulo">Vai para</span>${segmento('f-area', f.area, [[banco.perfil, 'Minhas'], [AREA_CONJUNTA, 'Conjunta']], 'largo')}</div>` : ''}
      ${f.modo === 'novo' ? segmento('f-tipo', f.tipo, [['despesa', 'Saída'], ['receita', 'Entrada'], ['transferencia', 'Transferência']], `largo ${f.tipo === 'despesa' ? 'saida' : 'entrada'}`) : ''}
      <label class="campo"><span>${f.repete === 'parcelado' ? 'Valor total' : 'Valor'}</span>
        <div class="valor-grande"><span>R$</span><input id="f-valor" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(f.valorTxt)}"></div></label>
      <p class="erro-campo" id="f-erro" hidden></p>
      <label class="campo"><span>Descrição</span><input id="f-descricao" type="text" list="f-sugestoes" placeholder="Opcional" autocomplete="off" maxlength="120" value="${esc(f.descricao)}"><datalist id="f-sugestoes">${descricoes.map((d) => `<option value="${esc(d)}"></option>`).join('')}</datalist></label>
      ${podeEscolherPagador ? `<div class="campo"><span class="rotulo">Quem pagou</span>${segmento('f-pagador', f.pagador, [[AREA_CONJUNTA, 'Conta conjunta'], [Fin.AREA_PRIMEIRA, nomePerfil(Fin.AREA_PRIMEIRA)], [Fin.AREA_SEGUNDA, nomePerfil(Fin.AREA_SEGUNDA)]], 'largo')}${doBolso ? `<span class="dica-campo">Conta como gasto da conjunta e sai da conta de ${esc(nomePerfil(f.pagador))}. A parte do outro entra no acerto.</span>` : ''}</div>` : ''}
      <div class="grade-2">
        <label class="campo"><span>Categoria</span><select id="f-categoria">${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === f.categoriaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
        ${doBolso
          ? `<label class="campo"><span>Saiu de</span><select id="f-conta-pessoal">${contasPagador.map((c) => `<option value="${esc(c.id)}" ${c.id === f.contaPessoal ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>`
          : `<label class="campo"><span>Conta</span><select id="f-conta">${contas.map((c) => `<option value="${esc(c.id)}" ${c.id === f.contaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>`}
      </div>
      ${f.modo === 'fixo'
        ? `<div class="grade-2"><label class="campo"><span>Dia do mês</span><input id="f-dia" type="number" inputmode="numeric" min="1" max="31" value="${Number(f.data.slice(8, 10))}"></label>
           <label class="campo"><span>Repetir até (opcional)</span><input id="f-fim" type="month" value="${esc(f.fim)}"></label></div>`
        : `<label class="campo"><span>${f.repete === 'mensal' ? 'Primeira ocorrência' : f.repete === 'parcelado' ? 'Data da compra' : 'Data'}</span><input id="f-data" type="date" value="${esc(f.data)}"></label>`}
      ${f.modo === 'novo' && !doBolso ? `<div class="campo"><span class="rotulo">Repetição</span>${segmento('f-repete', f.repete, [['uma', 'Uma vez'], ...(f.tipo === 'despesa' ? [['parcelado', 'Parcelado']] : []), ['mensal', 'Todo mês']], 'largo')}</div>` : ''}
      ${f.modo === 'novo' && f.repete === 'parcelado' ? `<label class="campo"><span>Número de parcelas</span><input id="f-parcelas" type="number" inputmode="numeric" min="2" max="120" value="${f.parcelas}"></label>` : ''}
      ${f.modo === 'novo' && f.repete === 'mensal' ? `<label class="campo"><span>Repetir até (opcional)</span><input id="f-fim" type="month" value="${esc(f.fim)}"></label>` : ''}
      ${f.tipo === 'receita' && f.modo !== 'confirmar' ? `<div class="campo"><span class="rotulo">Esta entrada é</span>${segmento('f-certeza', f.certeza, [['certa', 'Certa'], ['provavel', 'Provável']], 'largo')}<span class="dica-campo">As prováveis, como honorários de êxito, ficam fora da projeção conservadora.</span></div>` : ''}
      <label class="marcar" id="f-pago-linha"><input id="f-pago" type="checkbox" ${f.pago ? 'checked' : ''}><span id="f-pago-rotulo"></span></label>
      ${podeSerExcepcional ? `<label class="marcar"><input id="f-excepcional" type="checkbox" ${f.excepcional ? 'checked' : ''}><span>Gasto fora do comum, como um conserto. Não entra na estimativa mensal.</span></label>` : ''}
      <p class="dica-campo" id="f-dica" hidden></p>
      <div class="acoes" style="margin-top:4px">
        <button type="submit" class="btn primario" style="flex:1 1 100%">${f.modo === 'confirmar' ? 'Confirmar' : 'Salvar'}</button>
        ${f.modo === 'confirmar' ? '<button type="button" class="btn" data-acao="pular-mes">Pular este mês</button><button type="button" class="btn" data-acao="fixo-da-ocorrencia">Editar fixo</button>' : ''}
        ${f.modo === 'editar' ? '<button type="button" class="btn perigo" data-acao="excluir-lancamento">Excluir</button>' : ''}
        ${eParcela ? '<button type="button" class="btn perigo" data-acao="excluir-parcelas">Excluir todas as parcelas</button>' : ''}
        ${f.modo === 'fixo' ? '<button type="button" class="btn perigo" data-acao="excluir-fixo">Encerrar este fixo</button>' : ''}
      </div>
    </form>`, focar ? '#f-valor' : null);
    atualizarDicasForm();
  }

  function lerFormulario() {
    const f = form;
    const v = (id) => { const el = $('#' + id, folha()); return el ? el.value : undefined; };
    ['valor:valorTxt', 'descricao:descricao', 'categoria:categoriaId', 'conta:contaId', 'data:data', 'parcelas:parcelas', 'fim:fim'].forEach((par) => {
      const [campo, chave] = par.split(':');
      const lido = v('f-' + campo);
      if (lido !== undefined) f[chave] = lido;
    });
    const dia = v('f-dia');
    if (dia !== undefined) f.dia = dia;
    const contaPessoal = v('f-conta-pessoal');
    if (contaPessoal !== undefined) f.contaPessoal = contaPessoal;
    const pago = $('#f-pago', folha());
    if (pago) f.pago = pago.checked;
    const excepcional = $('#f-excepcional', folha());
    if (excepcional) f.excepcional = excepcional.checked;
  }

  function atualizarDicasForm() {
    const f = form;
    lerFormulario();
    const doBolso = f.pagador && f.pagador !== AREA_CONJUNTA;
    const v = visao(doBolso ? f.pagador : f.area);
    const contaUsada = doBolso ? f.contaPessoal : f.contaId;
    const conta = v.contas[contaUsada];
    const cartao = conta && conta.tipo === 'cartao';
    const linha = $('#f-pago-linha');
    const dica = $('#f-dica');
    const valor = lerReais(f.valorTxt);
    const textos = [];
    if (cartao) {
      if (f.data) textos.push(`Entra na fatura que vence em ${dataBR(Fin.vencimentoFatura(conta, f.data))}.`);
    }
    if (f.modo === 'novo' && f.repete === 'parcelado' && valor) {
      const n = Math.max(2, Number(f.parcelas) || 2);
      textos.push(`${n}x de ${reais(Math.round(valor / n))}.`);
    }
    if (f.modo === 'novo' && f.repete === 'mensal') textos.push('Aparece todo mês como previsto até você confirmar.');
    const mesPassado = f.data && mesDe(f.data) < mesDe(hoje());
    if (f.modo === 'novo' && f.repete === 'mensal' && mesPassado) {
      textos.push(f.certeza === 'provavel' ? 'Os meses anteriores não entram.' : `Os meses anteriores entram como já ${f.tipo === 'receita' ? 'recebidos' : 'pagos'}.`);
    }
    if (f.modo === 'novo' && f.repete === 'parcelado' && f.data && f.data < hoje() && !cartao) textos.push('As parcelas já vencidas entram como pagas.');
    const umaVez = (f.modo === 'novo' || f.modo === 'editar') && f.repete !== 'mensal';
    const corte = conta && Fin.dataDoSaldo(v, { contaId: contaUsada });
    if (umaVez && conta && f.data && Fin.jaNoSaldo(v, { contaId: contaUsada, data: f.data })) {
      textos.push(`Esta data é anterior ao saldo informado em ${dataBR(corte)}: fica no histórico, mas não muda o saldo.`);
    } else if (f.modo === 'novo' && f.repete === 'mensal' && corte && f.data && f.data < corte) {
      textos.push(`O que tiver data anterior ao saldo informado em ${dataBR(corte)} fica no histórico, sem mudar o saldo.`);
    }
    if (dica) { dica.textContent = textos.join(' '); dica.hidden = !textos.length; }
    if (linha) {
      const esconder = cartao || f.modo === 'fixo' || f.modo === 'confirmar';
      linha.hidden = esconder;
      $('#f-pago-rotulo').textContent = f.tipo === 'receita' ? 'Já recebi' : 'Já paguei';
    }
  }

  function salvarFormulario() {
    lerFormulario();
    const f = form;
    const valor = lerReais(f.valorTxt);
    if (valor <= 0) {
      const erro = $('#f-erro');
      erro.textContent = 'Digite um valor maior que zero.';
      erro.hidden = false;
      $('#f-valor').focus();
      return;
    }
    if (!f.contaId) { const erro = $('#f-erro'); erro.textContent = 'Crie uma conta em Ajustes antes de lançar.'; erro.hidden = false; return; }
    const v = visao(f.area);
    const descricao = f.descricao.trim() || (v.categorias[f.categoriaId] || {}).nome || 'Sem descrição';
    const conta = v.contas[f.contaId];
    const cartao = conta && conta.tipo === 'cartao';
    const h = hoje();
    const certeza = f.tipo === 'receita' ? f.certeza : 'certa';
    const base = { area: f.area, tipo: f.tipo, descricao, valor, categoriaId: f.categoriaId, contaId: f.contaId, data: f.data || h, certeza };
    let mensagem = 'Lançamento salvo';

    if (f.modo === 'fixo') {
      const atual = estado.recorrentes[f.id];
      const dia = Math.min(31, Math.max(1, Number(f.dia) || 1));
      const inicio = `${atual.inicio.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
      gravar('recorrentes', { ...atual, ...base, data: undefined, inicio, fim: f.fim || null });
      mensagem = 'Fixo atualizado';
    } else if (f.modo === 'confirmar') {
      gravar('lancamentos', realDaOcorrencia({ recorrenteId: f.recorrenteId, competencia: f.competencia, ...base, data: Fin.dataDoPagamento(v, base) }));
      mensagem = 'Confirmado';
    } else if ((f.modo === 'novo' || f.modo === 'editar') && f.pagador && f.pagador !== AREA_CONJUNTA) {
      salvarGastoDoBolso(f, base, valor);
      mensagem = f.modo === 'novo' ? `Gasto da conjunta pago por ${nomePerfil(f.pagador)}` : 'Alteração salva';
    } else if (f.modo === 'editar') {
      const atual = banco.estado.lancamentos[f.id];
      // Deixou de ser pago do bolso: o espelho na conta pessoal sai.
      const espelhoAntigo = atual.semCaixa ? parDe(atual) : null;
      if (espelhoAntigo) gravar('lancamentos', { ...espelhoAntigo, excluido: true });
      if (espelhoAntigo) Object.assign(atual, { pagoPor: undefined, semCaixa: undefined, parId: undefined });
      const provavelVirouPago = base.tipo === 'receita' && f.pago;
      const pagouAgora = !cartao && f.pago && !atual.pago;
      gravar('lancamentos', {
        ...atual, ...base, pago: cartao ? false : f.pago,
        data: pagouAgora ? Fin.dataDoPagamento(v, base) : base.data,
        certeza: provavelVirouPago ? 'certa' : certeza,
        planejado: base.tipo === 'despesa' && base.data > h && !atual.parcelaGrupo ? true : atual.planejado,
        excepcional: base.tipo === 'despesa' && !!f.excepcional,
        ...(atual.metaId ? { categoriaId: CATEGORIA_META } : {}),
      });
      mensagem = 'Alteração salva';
    } else if (f.repete === 'mensal') {
      const id = novoId();
      gravar('recorrentes', { id, ...base, inicio: base.data, data: undefined, fim: f.fim || null, pulados: [] });
      if (!cartao && base.data <= h) {
        const vencidas = Fin.ocorrencias(visao(f.area), mesDe(h)).filter((o) => o.recorrenteId === id && o.data <= h);
        const ultima = vencidas.pop();
        // Só a mais recente pode estar em aberto; as anteriores já aconteceram.
        if (certeza === 'provavel') {
          if (vencidas.length) gravar('recorrentes', { ...banco.estado.recorrentes[id], pulados: vencidas.map((o) => o.competencia) });
        } else {
          vencidas.forEach((o) => gravar('lancamentos', realDaOcorrencia(o)));
        }
        if (ultima && f.pago) gravar('lancamentos', realDaOcorrencia(ultima));
      }
      confirmarFixosNoCartao();
      mensagem = 'Fixo criado';
    } else if (f.repete === 'parcelado') {
      const n = Math.min(120, Math.max(2, Number(f.parcelas) || 2));
      Fin.criarParcelas(base, n, novoId, Date.now()).forEach((p) => gravar('lancamentos', { ...p, pago: !cartao && f.pago && p.data <= h }));
      mensagem = `${n} parcelas criadas`;
    } else {
      const futuro = base.data > h;
      gravar('lancamentos', {
        id: novoId(), ...base, pago: cartao ? false : (futuro ? false : f.pago),
        certeza: !futuro && f.pago ? 'certa' : certeza,
        ...(futuro && base.tipo === 'despesa' ? { planejado: true } : {}),
        ...(base.tipo === 'despesa' && f.excepcional ? { excepcional: true } : {}),
      });
    }
    if (f.area !== areaAtiva()) mensagem = `Salvo em ${f.area === AREA_CONJUNTA ? 'Conjunta' : 'Minhas'}`;
    fecharFolha();
    concluir();
    avisar(mensagem);
  }

  /* Gasto da conjunta pago do bolso: o da conjunta não mexe no caixa dela; o espelho sai da conta de quem pagou. */
  function salvarGastoDoBolso(f, base, valor) {
    const h = hoje();
    const atual = f.modo === 'editar' ? banco.estado.lancamentos[f.id] : null;
    const idJ = atual ? atual.id : novoId();
    const antigo = atual ? parDe(atual) : null;
    const idM = antigo && Fin.areaDe(antigo) === f.pagador ? antigo.id : novoId();
    if (antigo && antigo.id !== idM) gravar('lancamentos', { ...antigo, excluido: true });
    const conta = contaGlobal(f.contaPessoal);
    const cartao = conta && conta.tipo === 'cartao';
    const futuro = base.data > h;
    const pago = !cartao && !futuro && f.pago;
    gravar('lancamentos', {
      ...(atual || {}), id: idJ, ...base, area: AREA_CONJUNTA, pagoPor: f.pagador, semCaixa: true, parId: idM, pago: false,
      ...(base.tipo === 'despesa' && f.excepcional ? { excepcional: true } : { excepcional: undefined }),
    });
    gravar('lancamentos', {
      ...(antigo && antigo.id === idM ? antigo : {}), id: idM, area: f.pagador, tipo: 'despesa', descricao: base.descricao, valor,
      categoriaId: CATEGORIA_CONJ, contaId: f.contaPessoal, data: pago ? Fin.dataDoPagamento(visao(f.pagador), { contaId: f.contaPessoal, data: base.data }) : base.data,
      certeza: 'certa', pago, espelho: true, parId: idJ, ...(futuro ? { planejado: true } : {}),
    });
  }

  /* ---------- transferências ---------- */
  let tf = null;

  /* Origem e destino possíveis: suas contas, as da conjunta e as da outra pessoa (sem cartões). */
  function contasParaTransferir() {
    const areas = [banco.perfil, AREA_CONJUNTA, ...(temSegundaPessoa() ? [outraPessoa()] : [])];
    return areas.map((area) => ({ area, contas: contasDaArea(area, { cartao: false }) })).filter((g) => g.contas.length);
  }

  function opcoesContas(selecionada) {
    return contasParaTransferir().map((g) => `<optgroup label="${esc(rotuloArea(g.area))}">${g.contas.map((c) => `<option value="${esc(c.id)}" ${c.id === selecionada ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('');
  }

  function novaTransferencia(extras = {}) {
    const grupos = contasParaTransferir();
    const minhas = (grupos.find((g) => g.area === banco.perfil) || { contas: [] }).contas;
    const conj = (grupos.find((g) => g.area === AREA_CONJUNTA) || { contas: [] }).contas;
    tf = { modo: 'novo', valorTxt: '', de: (minhas[0] || {}).id, para: (conj[0] || {}).id, data: hoje(), repete: 'uma', fim: '', descricao: '', pago: true, ...extras };
    if (ui.area === 'conjunta' && minhas[0] && conj[0]) { tf.de = conj[0].id; tf.para = minhas[0].id; }
    pintarTransferencia(true);
  }

  function abrirTransferencia(item) {
    if (item.virtual) {
      const rec = banco.estado.recorrentes[item.recorrenteId];
      const par = parDe(rec, 'recorrentes');
      const recA = rec.tipo === 'despesa' ? rec : par;
      const recB = recA === rec ? par : rec;
      tf = { modo: 'confirmar', recA: recA && recA.id, recB: recB && recB.id, competencia: item.competencia, valorTxt: valorParaCampo(item.valor), data: item.data, de: recA && recA.contaId, para: recB && recB.contaId, descricao: '', pago: true };
    } else {
      const par = parDe(item);
      const a = item.tipo === 'despesa' ? item : par;
      const b = a === item ? par : item;
      tf = { modo: 'editar', idA: a && a.id, idB: b && b.id, valorTxt: valorParaCampo(item.valor), data: item.data, de: a && a.contaId, para: b && b.contaId, descricao: '', pago: !!item.pago, acerto: !!item.acerto };
    }
    pintarTransferencia(false);
  }

  function abrirFixoTransferencia(rec) {
    const par = parDe(rec, 'recorrentes');
    const recA = rec.tipo === 'despesa' ? rec : par;
    const recB = recA === rec ? par : rec;
    tf = { modo: 'fixo', recA: recA && recA.id, recB: recB && recB.id, valorTxt: valorParaCampo(rec.valor), data: rec.inicio, dia: Number(rec.inicio.slice(8, 10)), fim: rec.fim || '', de: recA && recA.contaId, para: recB && recB.contaId, descricao: '' };
    pintarTransferencia(false);
  }

  function pintarTransferencia(focar) {
    const t = tf;
    const titulos = { novo: 'Nova transferência', editar: t.acerto ? 'Acerto' : 'Editar transferência', fixo: 'Transferência fixa', confirmar: 'Confirmar transferência' };
    const fixa = (lado) => `<div class="campo"><span class="rotulo">${lado === 'de' ? 'De' : 'Para'}</span><p>${esc(rotuloConta(contaGlobal(t[lado])))}</p></div>`;
    abrirFolha(`<form data-form="transferencia" novalidate style="display:grid;gap:14px">
      ${topoFolha(titulos[t.modo])}
      ${t.modo === 'novo' ? segmento('t-tipo', 'transferencia', [['despesa', 'Saída'], ['receita', 'Entrada'], ['transferencia', 'Transferência']], 'largo') : ''}
      <label class="campo"><span>Valor</span>
        <div class="valor-grande"><span>R$</span><input id="t-valor" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(t.valorTxt)}"></div></label>
      <p class="erro-campo" id="t-erro" hidden></p>
      <div class="grade-2">
        ${t.modo === 'novo' ? `<label class="campo"><span>De</span><select id="t-de">${opcoesContas(t.de)}</select></label>` : fixa('de')}
        ${t.modo === 'novo' ? `<label class="campo"><span>Para</span><select id="t-para">${opcoesContas(t.para)}</select></label>` : fixa('para')}
      </div>
      ${t.modo === 'confirmar' ? '' : `<label class="campo"><span>Descrição</span><input id="t-descricao" type="text" placeholder="Opcional" autocomplete="off" maxlength="120" value="${esc(t.descricao)}"></label>`}
      ${t.modo === 'fixo'
        ? `<div class="grade-2"><label class="campo"><span>Dia do mês</span><input id="t-dia" type="number" inputmode="numeric" min="1" max="31" value="${t.dia}"></label>
           <label class="campo"><span>Repetir até (opcional)</span><input id="t-fim" type="month" value="${esc(t.fim)}"></label></div>`
        : `<label class="campo"><span>${t.repete === 'mensal' ? 'Primeira transferência' : 'Data'}</span><input id="t-data" type="date" value="${esc(t.data)}"></label>`}
      ${t.modo === 'novo' ? `<div class="campo"><span class="rotulo">Repetição</span>${segmento('t-repete', t.repete, [['uma', 'Uma vez'], ['mensal', 'Todo mês']], 'largo')}</div>` : ''}
      ${t.modo === 'novo' && t.repete === 'mensal' ? `<label class="campo"><span>Repetir até (opcional)</span><input id="t-fim" type="month" value="${esc(t.fim)}"></label>` : ''}
      ${t.modo === 'novo' || t.modo === 'editar' ? `<label class="marcar"><input id="t-pago" type="checkbox" ${t.pago ? 'checked' : ''}><span>Já foi feita</span></label>` : ''}
      <p class="dica-campo" id="t-dica" hidden></p>
      <div class="acoes" style="margin-top:4px">
        <button type="submit" class="btn primario" style="flex:1 1 100%">${t.modo === 'confirmar' ? 'Confirmar' : 'Salvar'}</button>
        ${t.modo === 'confirmar' ? '<button type="button" class="btn" data-acao="t-pular">Pular este mês</button><button type="button" class="btn" data-acao="t-editar-fixo">Editar transferência fixa</button>' : ''}
        ${t.modo === 'editar' ? '<button type="button" class="btn perigo" data-acao="t-excluir">Excluir</button>' : ''}
        ${t.modo === 'fixo' ? '<button type="button" class="btn perigo" data-acao="t-encerrar">Encerrar</button>' : ''}
      </div>
    </form>`, focar ? '#t-valor' : null);
    dicaTransferencia();
  }

  function lerTransferencia() {
    const t = tf;
    const v = (id) => { const el = $('#' + id, folha()); return el ? el.value : undefined; };
    [['t-valor', 'valorTxt'], ['t-de', 'de'], ['t-para', 'para'], ['t-data', 'data'], ['t-fim', 'fim'], ['t-descricao', 'descricao'], ['t-dia', 'dia']].forEach(([id, chave]) => {
      const lido = v(id);
      if (lido !== undefined) t[chave] = lido;
    });
    const pago = $('#t-pago', folha());
    if (pago) t.pago = pago.checked;
  }

  function dicaTransferencia() {
    const dica = $('#t-dica');
    if (!dica || !tf) return;
    lerTransferencia();
    const a = contaGlobal(tf.de);
    const b = contaGlobal(tf.para);
    const textos = [];
    if (a && b && a.id !== b.id) {
      const areaA = Fin.areaDe(a);
      const areaB = Fin.areaDe(b);
      textos.push(areaA === areaB
        ? 'Entre contas da mesma área: muda o saldo das duas, mas não conta como gasto nem como entrada.'
        : `Sai como saída em ${rotuloArea(areaA)} e entra como entrada em ${rotuloArea(areaB)}.`);
    }
    if (tf.modo === 'novo' && tf.repete === 'mensal') textos.push('Aparece todo mês nas duas contas até ser confirmada.');
    dica.textContent = textos.join(' ');
    dica.hidden = !textos.length;
  }

  function salvarTransferencia() {
    lerTransferencia();
    const t = tf;
    const erro = (msg) => { const e = $('#t-erro'); e.textContent = msg; e.hidden = false; };
    const valor = lerReais(t.valorTxt);
    if (valor <= 0) return erro('Digite um valor maior que zero.');
    const h = hoje();
    const descricao = (t.descricao || '').trim();

    if (t.modo === 'novo') {
      const a = contaGlobal(t.de);
      const b = contaGlobal(t.para);
      if (!a || !b) return erro('Escolha as duas contas.');
      if (a.id === b.id) return erro('Escolha contas diferentes.');
      const areaA = Fin.areaDe(a);
      const areaB = Fin.areaDe(b);
      const comum = { valor, categoriaId: CATEGORIA_TRANSF, certeza: 'certa', transferencia: true, ...(areaA !== areaB ? { entreAreas: true } : {}) };
      const lados = [
        { area: areaA, tipo: 'despesa', contaId: a.id, descricao: descricao || `Para ${rotuloConta(b)}` },
        { area: areaB, tipo: 'receita', contaId: b.id, descricao: descricao || `De ${rotuloConta(a)}` },
      ];
      const data = t.data || h;
      if (t.repete === 'mensal') {
        const ids = [novoId(), novoId()];
        lados.forEach((l, i) => gravar('recorrentes', { id: ids[i], parId: ids[1 - i], ...comum, ...l, inicio: data, fim: t.fim || null, pulados: [] }));
        if (data <= h) {
          // Meses que já passaram entram como feitos; o mais recente segue o "já foi feita".
          const vencidas = Fin.ocorrencias(visao(areaA), mesDe(h)).filter((o) => o.recorrenteId === ids[0] && o.data <= h);
          const ultima = vencidas.pop();
          vencidas.forEach((o) => confirmarOcorrencia(o));
          if (ultima && t.pago) confirmarOcorrencia(ultima);
        }
      } else {
        const ids = [novoId(), novoId()];
        const pago = data <= h && t.pago;
        lados.forEach((l, i) => gravar('lancamentos', {
          id: ids[i], parId: ids[1 - i], ...comum, ...l, pago,
          data: pago ? Fin.dataDoPagamento(visao(l.area), { contaId: l.contaId, data }) : data,
        }));
      }
      fecharFolha();
      concluir();
      avisar(t.repete === 'mensal' ? 'Transferência fixa criada' : 'Transferência salva');
      return;
    }

    if (t.modo === 'editar') {
      [t.idA, t.idB].forEach((id) => {
        const atual = banco.estado.lancamentos[id];
        if (!atual) return;
        const pago = t.pago && (t.data || h) <= h;
        gravar('lancamentos', { ...atual, valor, data: t.data || atual.data, pago, ...(descricao ? { descricao } : {}) });
      });
    } else if (t.modo === 'fixo') {
      const dia = String(Math.min(31, Math.max(1, Number(t.dia) || 1))).padStart(2, '0');
      [t.recA, t.recB].forEach((id) => {
        const rec = banco.estado.recorrentes[id];
        if (rec) gravar('recorrentes', { ...rec, valor, inicio: `${rec.inicio.slice(0, 7)}-${dia}`, fim: t.fim || null, ...(descricao ? { descricao } : {}) });
      });
    } else if (t.modo === 'confirmar') {
      const recA = banco.estado.recorrentes[t.recA];
      const o = recA && Fin.ocorrencias(visao(Fin.areaDe(recA)), t.competencia).find((x) => x.recorrenteId === recA.id && x.competencia === t.competencia);
      if (o) confirmarOcorrencia(o, { valor, data: Fin.dataDoPagamento(visao(Fin.areaDe(recA)), { ...o, data: t.data || o.data }) });
    }
    fecharFolha();
    concluir();
    avisar(t.modo === 'confirmar' ? 'Confirmada' : 'Alteração salva');
  }

  /* ---------- acerto ---------- */
  function formAcerto() {
    const s = situacaoAcerto();
    if (!s) return;
    const de = contasDaArea(s.devedor, { cartao: false });
    const para = contasDaArea(s.credor, { cartao: false });
    abrirFolha(`<form data-form="acerto" novalidate style="display:grid;gap:14px">
      ${topoFolha('Registrar acerto')}
      <p class="nota"><b>${esc(nomePerfil(s.devedor))}</b> paga a <b>${esc(nomePerfil(s.credor))}</b>. Fica registrado como transferência entre as contas dos dois e zera o acerto.</p>
      <label class="campo"><span>Valor</span><div class="valor-grande"><span>R$</span><input id="ac-valor" type="text" inputmode="decimal" autocomplete="off" value="${esc(valorParaCampo(s.valor))}"></div></label>
      <p class="erro-campo" id="ac-erro" hidden></p>
      <div class="grade-2">
        <label class="campo"><span>Sai de (${esc(nomePerfil(s.devedor))})</span><select id="ac-de">${de.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>
        <label class="campo"><span>Entra em (${esc(nomePerfil(s.credor))})</span><select id="ac-para">${para.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Data</span><input id="ac-data" type="date" value="${hoje()}"></label>
      <button type="submit" class="btn primario">Registrar</button>
    </form>`, '#ac-valor');
  }

  function salvarAcerto() {
    const s = situacaoAcerto();
    if (!s) { fecharFolha(); return; }
    const valor = lerReais($('#ac-valor').value);
    const erro = $('#ac-erro');
    const a = contaGlobal($('#ac-de').value);
    const b = contaGlobal($('#ac-para').value);
    if (valor <= 0) { erro.textContent = 'Digite um valor maior que zero.'; erro.hidden = false; return; }
    if (!a || !b) { erro.textContent = 'As duas pessoas precisam ter uma conta que não seja cartão.'; erro.hidden = false; return; }
    const data = $('#ac-data').value || hoje();
    const pago = data <= hoje();
    const ids = [novoId(), novoId()];
    const comum = { valor, categoriaId: CATEGORIA_TRANSF, certeza: 'certa', transferencia: true, entreAreas: true, acerto: true, pago };
    gravar('lancamentos', { id: ids[0], parId: ids[1], ...comum, area: s.devedor, tipo: 'despesa', contaId: a.id, data, descricao: `Acerto para ${nomePerfil(s.credor)}` });
    gravar('lancamentos', { id: ids[1], parId: ids[0], ...comum, area: s.credor, tipo: 'receita', contaId: b.id, data, descricao: `Acerto de ${nomePerfil(s.devedor)}` });
    fecharFolha();
    concluir();
    avisar('Acerto registrado', () => {
      ids.forEach((id) => gravar('lancamentos', { ...banco.estado.lancamentos[id], excluido: true }));
      concluir();
    });
  }

  /* ---------- outros formulários ---------- */
  function formNomes() {
    abrirFolha(`<form data-form="nomes" novalidate style="display:grid;gap:14px">
      ${topoFolha('Nomes')}
      <label class="campo"><span>Primeira pessoa</span><input id="n-nome1" type="text" maxlength="30" autocomplete="off" value="${esc(nomePerfil('p1'))}"></label>
      <label class="campo"><span>Segunda pessoa</span><input id="n-nome2" type="text" maxlength="30" autocomplete="off" value="${esc(nomePerfil('p2'))}"></label>
      <p class="erro-campo" id="n-erro" hidden></p>
      <button type="submit" class="btn primario">Salvar</button>
    </form>`);
  }

  function formConta(c) {
    const novo = !c;
    const naConjunta = ui.area === 'conjunta';
    c = c || { nome: '', tipo: 'banco', grupo: naConjunta ? 'Conjunta' : 'Pessoal', saldoInicial: 0, saldoData: hoje(), fechamento: 25, vencimento: 5 };
    const pagadoras = vivos(estado, 'contas').filter((x) => x.tipo !== 'cartao' && x.id !== c.id);
    const pagadora = Fin.contaPagadora(estado, c);
    abrirFolha(`<form data-form="conta" data-id="${esc(c.id || '')}" novalidate style="display:grid;gap:14px">
      ${topoFolha(novo ? 'Nova conta' : 'Editar conta')}
      <label class="campo"><span>Nome</span><input id="c-nome" type="text" maxlength="60" value="${esc(c.nome)}" placeholder="Banco, carteira, cartão…" autocomplete="off"></label>
      <p class="erro-campo" id="c-erro" hidden></p>
      <div class="grade-2">
        <label class="campo"><span>Tipo</span><select id="c-tipo">${[['banco', 'Banco'], ['carteira', 'Carteira'], ['cartao', 'Cartão de crédito']].map(([v, r]) => `<option value="${v}" ${c.tipo === v ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="campo" ${naConjunta ? 'hidden' : ''}><span>Separar em</span><select id="c-grupo">${(naConjunta ? ['Conjunta'] : ['Pessoal', 'Escritório']).map((g) => `<option ${(c.grupo || 'Pessoal') === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      </div>
      <div data-sem-cartao style="display:grid;gap:6px" ${c.tipo === 'cartao' ? 'hidden' : ''}>
        <div class="grade-2">
          <label class="campo"><span>Saldo</span><span class="com-sinal"><input id="c-saldo" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc((c.saldoInicial < 0 ? '-' : '') + valorParaCampo(Math.abs(c.saldoInicial || 0)))}"><button type="button" class="btn sinal" data-acao="inverter-sinal" data-alvo="c-saldo" aria-label="Trocar entre saldo positivo e negativo">±</button></span></label>
          <label class="campo"><span>Saldo do dia</span><input id="c-saldo-data" type="date" max="${hoje()}" value="${esc(c.saldoData || '')}"></label>
        </div>
        <span class="dica-campo">Lançamentos anteriores a este dia já estão nesse saldo e não o alteram.</span>
      </div>
      <div data-so-cartao style="display:grid;gap:14px" ${c.tipo === 'cartao' ? '' : 'hidden'}>
        <div class="grade-2">
          <label class="campo"><span>Dia do fechamento</span><input id="c-fecha" type="number" inputmode="numeric" min="1" max="31" value="${c.fechamento || 25}"></label>
          <label class="campo"><span>Dia do vencimento</span><input id="c-vence" type="number" inputmode="numeric" min="1" max="31" value="${c.vencimento || 5}"></label>
        </div>
        <label class="campo"><span>A fatura é paga por</span><select id="c-paga">${pagadoras.map((x) => `<option value="${esc(x.id)}" ${pagadora && pagadora.id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      </div>
      ${!novo && c.tipo !== 'cartao' ? `<button type="button" class="btn" data-acao="ajustar-banco" data-id="${esc(c.id)}">Ajustar ao saldo do banco</button>` : ''}
      <div class="acoes"><button type="submit" class="btn primario" style="flex:1 1 100%">Salvar</button>
      ${novo ? '' : '<button type="button" class="btn perigo" data-acao="excluir-conta">Excluir conta</button>'}</div>
    </form>`, novo ? '#c-nome' : null);
  }

  function formCategoria(c) {
    const novo = !c;
    c = c || { nome: '', tipo: 'despesa', limite: 0 };
    abrirFolha(`<form data-form="categoria" data-id="${esc(c.id || '')}" novalidate style="display:grid;gap:14px">
      ${topoFolha(novo ? 'Nova categoria' : 'Editar categoria')}
      <label class="campo"><span>Nome</span><input id="k-nome" type="text" maxlength="60" value="${esc(c.nome)}" autocomplete="off"></label>
      <p class="erro-campo" id="k-erro" hidden></p>
      <label class="campo"><span>Tipo</span><select id="k-tipo"><option value="despesa" ${c.tipo === 'despesa' ? 'selected' : ''}>Saída</option><option value="receita" ${c.tipo === 'receita' ? 'selected' : ''}>Entrada</option></select></label>
      <label class="campo"><span>Limite por mês (opcional)</span><input id="k-limite" type="text" inputmode="decimal" placeholder="Sem limite" autocomplete="off" value="${esc(valorParaCampo(c.limite))}"></label>
      <div class="acoes"><button type="submit" class="btn primario" style="flex:1 1 100%">Salvar</button>
      ${novo ? '' : '<button type="button" class="btn perigo" data-acao="excluir-categoria">Excluir categoria</button>'}</div>
    </form>`, novo ? '#k-nome' : null);
  }

  function formMeta(m) {
    const novo = !m;
    const contas = vivos(estado, 'contas').filter((c) => c.tipo !== 'cartao');
    const principal = contas.find((c) => c.tipo === 'banco') || contas[0];
    m = m || { nome: '', alvo: 0, guardado: 0, aporte: 0, contaId: principal ? principal.id : null };
    abrirFolha(`<form data-form="meta" data-id="${esc(m.id || '')}" novalidate style="display:grid;gap:14px">
      ${topoFolha(novo ? 'Nova meta' : 'Editar meta')}
      <label class="campo"><span>Nome</span><input id="m-nome" type="text" maxlength="60" value="${esc(m.nome)}" placeholder="Reserva de emergência" autocomplete="off"></label>
      <p class="erro-campo" id="m-erro" hidden></p>
      <label class="campo"><span>Quanto quer juntar</span><input id="m-alvo" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(valorParaCampo(m.alvo))}"></label>
      <div class="grade-2">
        <label class="campo"><span>Já guardado</span><input id="m-guardado" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(valorParaCampo(m.id ? Fin.guardadoMeta(estado, m) : m.guardado))}"></label>
        <label class="campo"><span>Guardar por mês</span><input id="m-aporte" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(valorParaCampo(m.aporte))}"></label>
      </div>
      <label class="campo"><span>Ao guardar, o dinheiro</span><select id="m-conta">
        ${contas.map((c) => `<option value="${esc(c.id)}" ${m.contaId === c.id ? 'selected' : ''}>Sai de ${esc(c.nome)}</option>`).join('')}
        <option value="" ${m.contaId ? '' : 'selected'}>Continua no saldo</option>
      </select><span class="dica-campo" style="font-weight:400">Se sair, o valor mensal entra na projeção e o saldo diminui ao guardar.</span></label>
      <div class="acoes"><button type="submit" class="btn primario" style="flex:1 1 100%">Salvar</button>
      ${novo ? '' : '<button type="button" class="btn perigo" data-acao="excluir-meta">Excluir meta</button>'}</div>
    </form>`, novo ? '#m-nome' : null);
  }

  function folhaSaldo() {
    const h = hoje();
    const comp = Fin.composicaoSaldo(estado, h, ui.grupo);
    const contas = vivos(estado, 'contas').filter((c) => c.tipo !== 'cartao' && (ui.grupo === 'Tudo' || c.grupo === ui.grupo));
    const linha = (rotulo, valor, classe = '') => `<div class="${classe}"><dt>${rotulo}</dt><dd class="num">${valor}</dd></div>`;
    abrirFolha(`${topoFolha('Como o saldo é calculado')}
      <dl class="composicao">
        ${linha(comp.desde ? `Saldo informado em ${dataBR(comp.desde)}` : 'Saldo informado', reais(comp.informado))}
        ${linha('Entradas recebidas desde então', '+ ' + reais(comp.entrou), 'pos')}
        ${linha('Saídas pagas e faturas vencidas', '− ' + reais(comp.saiu))}
        ${comp.guardado ? linha('Guardado em metas', '− ' + reais(comp.guardado)) : ''}
        ${linha('Saldo hoje', reais(comp.saldo), 'total')}
      </dl>
      <p class="nota">Só conta o que já aconteceu. Fixos não confirmados, contas em aberto e compras no cartão antes do vencimento ficam na previsão, por isso as entradas e saídas do mês podem ser maiores.</p>
      ${comp.antes.length ? `<h3 style="margin-top:6px">Já estavam no saldo informado</h3>
      <p class="nota">Têm data anterior ao dia do saldo informado, então o valor informado já os incluía. Ficam no histórico e nos gráficos, mas não mudam o saldo de novo.</p>
      <div>${comp.antes.slice(0, 8).map((l) => `<div class="linha-item"><button type="button" class="linha-corpo" data-acao="abrir-item" data-id="${esc(l.id)}">
        <span class="linha-texto"><b>${esc(l.descricao)}</b><small>${dataBR(Fin.dataCaixa(estado, l))} · ${esc(nomeConta(l.contaId))}</small></span>
        <span class="linha-valor num ${l.tipo === 'receita' ? 'pos' : 'saida'}">${l.tipo === 'receita' ? '+' : '−'}${reais(l.valor)}</span></button></div>`).join('')}</div>
      ${comp.antes.length > 8 ? `<p class="nota">E mais ${comp.antes.length - 8}.</p>` : ''}
      <p class="nota">Se algum deles saiu ou entrou depois do saldo informado, abra e mude a data.</p>` : ''}
      <h3 style="margin-top:6px">Por conta</h3>
      <div>${contas.map((c) => `<div class="linha-item"><button type="button" class="linha-corpo" data-acao="ajustar-banco" data-id="${esc(c.id)}">
        <span class="linha-texto"><b>${esc(c.nome)}</b><small>Não bate com o banco? Toque para ajustar</small></span>
        <span class="linha-valor num">${reais(Fin.saldoConta(estado, c, h))}</span></button></div>`).join('')}</div>`);
  }

  function formAjuste(c) {
    const h = hoje();
    const noApp = Fin.saldoConta(estado, c, h);
    const adiantados = Fin.pagosAdiantados(estado, c, h);
    abrirFolha(`<form data-form="ajuste" data-id="${esc(c.id)}" novalidate style="display:grid;gap:14px">
      ${topoFolha('Ajustar ao banco')}
      <p class="nota">Em <b>${esc(c.nome)}</b> o app mostra <b class="num">${reais(noApp)}</b>. Digite o saldo que aparece no banco agora: o app acerta o ponto de partida da conta e nenhum lançamento muda.</p>
      ${adiantados.length ? `<div class="alerta">${icone('alerta')}<div><b>Confira antes de ajustar</b><span>${adiantados.length > 1 ? 'Estes estão marcados como pagos, mas a data ainda não chegou' : 'Este está marcado como pago, mas a data ainda não chegou'}: ${adiantados.slice(0, 4).map((l) => `${esc(l.descricao)} (${dataCurta(l.data)}, ${reais(l.valor)})`).join(', ')}${adiantados.length > 4 ? ` e mais ${adiantados.length - 4}` : ''}. Se ainda não saiu do banco, desmarque antes.</span></div></div>` : ''}
      <label class="campo"><span>Saldo no banco agora</span><span class="com-sinal"><span class="valor-grande"><span>R$</span><input id="a-valor" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off"></span><button type="button" class="btn sinal" data-acao="inverter-sinal" data-alvo="a-valor" aria-label="Trocar entre saldo positivo e negativo">±</button></span></label>
      <p class="dica-campo" id="a-dica" hidden></p>
      <p class="erro-campo" id="a-erro" hidden></p>
      <button type="submit" class="btn primario">Ajustar</button>
    </form>`, '#a-valor');
  }

  function dicaAjuste() {
    const form = $('form[data-form="ajuste"]');
    const dica = $('#a-dica');
    if (!form || !dica) return;
    const texto = $('#a-valor').value.trim();
    const conta = estado.contas[form.dataset.id];
    if (!texto || !conta) { dica.hidden = true; return; }
    const { diferenca } = Fin.ajusteAoBanco(estado, conta, hoje(), lerReais(texto));
    dica.textContent = diferenca === 0 ? 'Já está igual ao banco.' : `O saldo do app vai ${diferenca > 0 ? 'subir' : 'descer'} ${reais(Math.abs(diferenca))}.`;
    dica.hidden = false;
  }

  function pedirConfirmacao(titulo, texto, rotulo, aoConfirmar) {
    ui.aoConfirmar = aoConfirmar;
    abrirFolha(`${topoFolha(titulo)}<p>${esc(texto)}</p>
      <div class="acoes"><button type="button" class="btn perigo" data-acao="confirmar-sim" style="flex:1">${esc(rotulo)}</button>
      <button type="button" class="btn" data-acao="fechar" style="flex:1">Cancelar</button></div>`);
  }

  /* ---------- avisos ---------- */
  function avisar(texto, desfazer) {
    const caixa = $('#avisos');
    const item = document.createElement('div');
    item.className = 'aviso-item';
    item.innerHTML = `<span>${esc(texto)}</span>${desfazer ? '<button type="button">Desfazer</button>' : ''}`;
    if (desfazer) item.querySelector('button').onclick = () => { desfazer(); item.remove(); };
    caixa.replaceChildren(item);
    setTimeout(() => item.remove(), desfazer ? 7000 : 3000);
  }

  function excluirVarios(colecao, ids, texto) {
    // banco.estado: os pares (transferência, gasto pago do bolso) ficam em áreas diferentes.
    const existentes = ids.filter((id) => banco.estado[colecao][id]);
    const anteriores = existentes.map((id) => ({ ...banco.estado[colecao][id] }));
    existentes.forEach((id) => gravar(colecao, { ...banco.estado[colecao][id], excluido: true }));
    fecharFolha();
    concluir();
    avisar(texto, () => {
      anteriores.forEach((r) => gravar(colecao, { ...r, excluido: false }));
      concluir();
    });
  }

  /* ---------- PDF ---------- */
  const COR_MARCA = { minhas: [11, 93, 82], conjunta: [74, 63, 159] };

  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => erro(new Error('script'));
      document.head.appendChild(s);
    });
  }

  async function carregarPdf() {
    if (!window.jspdf) await carregarScript('vendor/jspdf.umd.min.js');
    if (!window.Pdf) await carregarScript('pdf.js');
    return window.Pdf;
  }

  function dadosCabecalho(titulo) {
    const conjunta = ui.area === 'conjunta';
    const quem = conjunta ? 'Finanças conjuntas' : `Finanças de ${nomePerfil(banco.perfil)}`;
    return {
      titulo,
      subtitulo: `${titulo} · ${quem}${ui.grupo !== 'Tudo' ? ' · ' + ui.grupo : ''}`,
      emitido: `Emitido em ${dataBR(hoje())}`,
      marca: conjunta ? COR_MARCA.conjunta : COR_MARCA.minhas,
      exemplo: banco.exemplo,
    };
  }

  const nomeArquivoArea = () => (ui.area === 'conjunta' ? 'conjunta' : nomePerfil(banco.perfil).normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'minhas');

  function situacaoDoItem(i) {
    const h = hoje();
    const quando = Fin.dataCaixa(estado, i);
    if (Fin.ehCartao(estado, i)) return Fin.liquidado(estado, i, h) ? 'Fatura paga' : `Fatura ${dataCurta(quando)}`;
    if (Fin.liquidado(estado, i, h)) return i.tipo === 'receita' ? 'Recebido' : 'Pago';
    if (quando < h) return 'Vencido';
    return i.tipo === 'receita' && i.certeza === 'provavel' ? 'Provável' : 'Previsto';
  }

  async function exportarPdf(geracao) {
    avisar('Gerando o PDF…');
    try {
      const pdf = await carregarPdf();
      const { nome, blob } = await geracao(pdf);
      await entregarArquivo(nome, blob);
      avisar('PDF pronto');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      avisar('Não consegui gerar o PDF. Tente de novo.');
    }
  }

  const exportarLancamentos = () => exportarPdf(async (pdf) => {
    const r = Fin.resumoMes(estado, ui.mes, ui.grupo);
    const itens = itensFiltrados().slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    const filtrado = ui.tipo !== 'todos' || ui.texto.trim();
    const notas = [];
    if (r.entradasProvaveis) notas.push(`Mais ${reais(r.entradasProvaveis)} em entradas prováveis, fora da conta acima.`);
    if (r.guardado) notas.push(`${reais(r.guardado)} guardados para metas, fora das saídas.`);
    if (filtrado) notas.push('A lista mostra só os lançamentos do filtro aplicado na tela. O resumo considera o mês inteiro.');
    const blob = pdf.lancamentos({
      ...dadosCabecalho(`Lançamentos de ${nomeMes(ui.mes, true)}`),
      resumo: [
        { rotulo: 'Entradas', valor: reais(r.entradasCertas) },
        { rotulo: 'Saídas', valor: reais(r.saidas) },
        { rotulo: 'Sobra', valor: reais(r.sobra), negativo: r.sobra < 0 },
      ],
      nota: notas.join(' '),
      linhas: itens.map((i) => {
        const situacao = situacaoDoItem(i);
        const marcas = [i.parcelaGrupo ? `parcela ${i.parcela}/${i.parcelas}` : '', i.recorrenteId ? 'fixo' : ''].filter(Boolean).join(', ');
        return {
          data: dataCurta(i.data),
          descricao: i.descricao + (marcas ? ` (${marcas})` : ''),
          categoria: nomeCategoria(i.categoriaId),
          conta: nomeConta(i.contaId),
          situacao,
          valor: (i.tipo === 'receita' ? '+' : '') + reais(i.valor),
          entrada: i.tipo === 'receita',
          atrasado: situacao === 'Vencido',
        };
      }),
    });
    return { nome: `financas-gl-lancamentos-${nomeArquivoArea()}-${ui.mes}.pdf`, blob };
  });

  async function imagemDoGrafico(tipo, cfg) {
    const caixa = document.createElement('div');
    caixa.className = 'pdf-render';
    document.body.appendChild(caixa);
    try {
      Graficos[tipo](caixa, { ...cfg, animar: false, pdf: true });
      const imagem = await Graficos.paraImagem(caixa);
      const tokens = getComputedStyle(caixa);
      const series = cfg.series.map((s) => ({
        nome: s.nome, tracejado: s.tracejado, bloco: tipo === 'colunas',
        cor: tokens.getPropertyValue(s.cor.replace(/var\((.*)\)/, '$1')).trim(),
      }));
      return { imagem, series, corBarra: tokens.getPropertyValue('--s1').trim() };
    } finally {
      caixa.remove();
    }
  }

  const exportarGraficos = () => exportarPdf(async (pdf) => {
    const dc = dadosColunas();
    const dSaldo = dadosSaldo(ui.faixa);
    const col = await imagemDoGrafico('colunas', configColunas(dc, false));
    const sal = await imagemDoGrafico('linhas', configSaldo(dSaldo, false));
    const m = dSaldo.certas.menor;
    const r = Fin.resumoMes(estado, ui.mes, ui.grupo);
    const cats = Object.entries(r.porCategoria).sort((a, b) => b[1] - a[1]);
    const maior = cats.length ? cats[0][1] : 1;
    const blob = pdf.graficos({
      ...dadosCabecalho('Gráficos'),
      imagens: [
        { titulo: 'Entradas × saídas', nota: 'Meses seguintes em tom claro, com o que já está previsto.', imagem: col.imagem, series: col.series },
        { titulo: 'Saldo mês a mês', nota: `Menor saldo previsto: ${reais(m.saldo)} em ${dataBR(m.data)}.`, imagem: sal.imagem, series: sal.series },
      ],
      mesCategorias: nomeMes(ui.mes, true),
      corBarra: col.corBarra,
      categorias: cats.map(([id, v]) => ({ nome: nomeCategoria(id), valor: reais(v), pct: Math.round((v / r.saidas) * 100), proporcao: v / maior })),
      tabela: {
        colunas: ['Mês', 'Entradas', 'Saídas', 'Sobra'],
        linhas: dc.meses.map((mes, i) => {
          const x = dc.resumos[i];
          return [nomeMes(mes) + (mes > dc.atual ? ' (previsto)' : ''), reais(x.entradasCertas), reais(x.saidas), reais(x.sobra)];
        }),
      },
    });
    return { nome: `financas-gl-graficos-${nomeArquivoArea()}-${hoje()}.pdf`, blob };
  });

  /* ---------- arquivos ---------- */
  async function entregarArquivo(nome, blob) {
    // No iPhone, o app instalado não baixa arquivos direto: usa o menu de compartilhar.
    if (navigator.standalone && navigator.canShare) {
      const arquivo = new File([blob], nome, { type: blob.type });
      if (navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome });
        return;
      }
    }
    baixar(nome, blob, blob.type);
  }

  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const baixarBackup = () => entregarArquivo(
    `financas-gl-${hoje()}.json`,
    new Blob([JSON.stringify({ app: ID_BACKUP, geradoEm: new Date().toISOString(), estado: banco.estado })], { type: 'application/json' })
  );

  function gerarCsv() {
    const celula = (v) => {
      let t = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // impede o Excel de executar o texto como fórmula
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const linhas = vivos(estado, 'lancamentos').sort((a, b) => (a.data < b.data ? -1 : 1)).map((l) => {
      const v = ((l.tipo === 'receita' ? 1 : -1) * l.valor / 100).toFixed(2).replace('.', ',');
      return [l.data.split('-').reverse().join('/'), l.tipo === 'receita' ? 'Entrada' : 'Saída', celula(l.descricao), celula(nomeCategoria(l.categoriaId)), celula(nomeConta(l.contaId)), v, Fin.liquidado(estado, l, hoje()) ? 'Sim' : 'Não'].join(';');
    });
    return '﻿' + ['Data;Tipo;Descrição;Categoria;Conta;Valor;Liquidado', ...linhas].join('\r\n');
  }

  function restaurarArquivo(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      let dados;
      try {
        dados = JSON.parse(leitor.result);
        if (dados.app !== ID_BACKUP || !dados.estado) throw new Error('formato');
      } catch (e) {
        avisar('Este arquivo não é um backup do Finanças G&L.');
        return;
      }
      pedirConfirmacao('Restaurar backup?', 'Tudo o que está no backup volta a ser como era, em todos os aparelhos, inclusive o que foi excluído ou alterado depois. O que foi lançado depois do backup continua aqui. Antes, uma cópia de agora é baixada.', 'Restaurar', async () => {
        fecharFolha();
        await baixarBackup().catch(() => { /* cópia recusada: a pessoa já confirmou a restauração */ });
        const total = Sincronia.restaurarBackup(banco.estado, dados.estado, banco.exemplo ? null : banco.pendentes, Date.now());
        concluir();
        avisar(total ? 'Backup restaurado' : 'Tudo já estava como no backup');
      });
    };
    leitor.readAsText(arquivo);
  }

  async function conectar() {
    const url = $('#sinc-url').value.trim();
    const chave = $('#sinc-chave').value.trim();
    const erro = $('#conexao-erro');
    const falha = (t) => { erro.textContent = t; erro.hidden = false; };
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return falha('A URL deve começar com https://script.google.com/macros/s/ e terminar em /exec.');
    if (chave.length < 16) return falha('Cole a chave de acesso completa, mostrada ao rodar a função configurar.');
    erro.hidden = true;
    avisar('Conectando à planilha…');
    let planilha;
    try {
      if (navigator.onLine === false) throw new Error('offline');
      // Só lê: nada deste aparelho vai para a planilha antes de ver o que há nela.
      planilha = await Sincronia.trocarComPlanilha({ url, chave, desde: 0, mudancas: [], buscar: (u, o) => fetch(u, o) });
    } catch (e) {
      return falha(e.message === 'offline' ? 'Sem internet. Tente de novo quando estiver conectado.' : mensagemErroSinc(e));
    }
    if (!Sincronia.conflitoAoConectar(banco.estado, planilha.registros)) return concluirConexao(url, chave);
    pedirConfirmacao(
      'Esta planilha já tem outros dados',
      'Este aparelho começou em separado, e juntar misturaria as finanças de vocês. Para usar a planilha, os dados deste aparelho saem daqui, com um backup baixado antes. Para mantê-los, cancele.',
      'Usar a planilha',
      async () => {
        fecharFolha();
        await baixarBackup().catch(() => { /* cópia recusada: a pessoa já confirmou */ });
        banco = bancoNovo();
        ui.area = 'meu';
        ui.pedirSaldo = false;
        ui.entrada = 'conectar';
        refazerVisao();
        salvar();
        desenhar();
        concluirConexao(url, chave);
      }
    );
  }

  async function concluirConexao(url, chave) {
    const anterior = banco.sinc;
    banco.sinc = { url, chave, desde: 0, ultima: null };
    // Envia tudo que este aparelho já tem; os padrões intactos não precisam ir.
    Fin.COLECOES.forEach((c) => Object.values(banco.estado[c]).forEach((r) => { if (r.atualizadoEm > 1) banco.pendentes[c + '|' + r.id] = 1; }));
    salvar();
    const ok = await sincronizar();
    if (!ok) {
      const mensagem = sinc.mensagem || 'Sem internet. Tente de novo quando estiver conectado.';
      banco.sinc = anterior;
      salvar();
      const alvo = $('#conexao-erro');
      if (alvo) { alvo.textContent = mensagem; alvo.hidden = false; }
      pintarSelo();
      return;
    }
    banco.iniciado = true;
    salvar();
    avisar('Planilha conectada');
    desenhar(true);
  }

  /* ---------- ações ---------- */
  const acoes = {
    fechar: fecharFolha,
    novo: () => formularioNovo(),
    'ver-saldo': folhaSaldo,
    'ajustar-banco': (b) => { const c = estado.contas[b.dataset.id]; if (c) formAjuste(c); },
    'inverter-sinal': (b) => {
      const campo = $('#' + b.dataset.alvo);
      if (!campo) return;
      const v = campo.value.trim();
      campo.value = /^[-−]/.test(v) ? v.replace(/^[-−]\s*/, '') : '-' + v;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.focus();
    },
    'novo-fixo': (b) => formularioNovo({ tipo: b.dataset.valor, repete: 'mensal' }),
    entrada: (b) => { ui.entrada = b.dataset.valor; desenhar(); },
    'comecar-zero': () => {
      banco.iniciado = true;
      ui.pedirSaldo = true;
      salvar();
      desenhar();
    },
    comecar: () => {
      const saldo = lerReais($('#saldo-inicial').value);
      const conta = vivos(estado, 'contas').find((c) => c.tipo === 'banco');
      if (conta) gravar('contas', { ...conta, saldoInicial: saldo, saldoData: hoje() });
      ui.pedirSaldo = false;
      salvar();
      agendarSinc();
      desenhar(true);
    },
    'salvar-nomes': () => {
      const nome1 = $('#p-nome1').value.trim();
      const nome2 = $('#p-nome2').value.trim();
      if (!nome1 || !nome2) {
        const erro = $('#p-erro');
        erro.textContent = 'Informe os dois nomes.';
        erro.hidden = false;
        return;
      }
      gravar('perfis', { id: 'p1', nome: nome1 });
      gravar('perfis', { id: 'p2', nome: nome2 });
      salvar();
      agendarSinc();
      desenhar();
    },
    'escolher-perfil': (b) => {
      banco.perfil = b.dataset.valor;
      ui.area = 'meu';
      ui.grupo = 'Tudo';
      garantirPadroes(banco.perfil);
      garantirPadroes(AREA_CONJUNTA);
      refazerVisao();
      confirmarFixosNoCartao();
      // Primeira vez desta pessoa, sem nada lançado: vale perguntar o saldo.
      const contaPrincipal = vivos(estado, 'contas').find((c) => c.tipo === 'banco');
      if (contaPrincipal && contaPrincipal.atualizadoEm <= 1 && !vivos(estado, 'lancamentos').length) ui.pedirSaldo = true;
      salvar();
      desenhar(true);
    },
    'trocar-perfil': () => pedirConfirmacao('Trocar de pessoa?', 'Nada é apagado. Este aparelho só passa a abrir nas finanças da outra pessoa.', 'Trocar', () => {
      banco.perfil = null;
      ui.area = 'meu';
      salvar();
      fecharFolha();
      desenhar();
    }),
    'editar-nomes': formNomes,
    area: (b) => {
      ui.area = b.dataset.valor;
      ui.grupo = 'Tudo';
      ui.texto = '';
      desenhar(true);
    },
    'pdf-lancamentos': exportarLancamentos,
    'pdf-graficos': exportarGraficos,
    'ver-exemplo': () => { preencherExemplo(); desenhar(true); },
    'apagar-exemplo': () => pedirConfirmacao('Apagar os dados de exemplo?', 'Tudo o que aparece agora será removido deste aparelho, inclusive o que você lançou enquanto testava.', 'Apagar e começar', () => {
      banco = bancoNovo();
      banco.iniciado = true;
      ui.area = 'meu';
      ui.pedirSaldo = true;
      refazerVisao();
      salvar();
      fecharFolha();
      history.replaceState(null, '', location.pathname);
      lerRota();
      desenhar();
    }),
    'confirmar-sim': () => { const f = ui.aoConfirmar; ui.aoConfirmar = null; if (f) f(); },
    grupo: (b) => { ui.grupo = b.dataset.valor; desenhar(true); },
    faixa: (b) => { ui.faixa = Number(b.dataset.valor); desenhar(true); },
    periodo: (b) => { ui.periodo = Number(b.dataset.valor); desenhar(true); },
    mes: (b) => { ui.mes = somaMeses(ui.mes, Number(b.dataset.valor)); desenhar(); },
    tipo: (b) => {
      ui.tipo = b.dataset.valor;
      $$('[data-acao="tipo"]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('#lista-lancamentos').innerHTML = listaLancamentos();
    },
    alternar: (b) => {
      const id = b.dataset.id;
      const item = acharItem(id);
      if (!item) return;
      if (item.virtual) {
        confirmarOcorrencia(item, { data: Fin.dataDoPagamento(estado, item) });
        avisar(item.tipo === 'receita' ? 'Recebimento confirmado' : 'Pagamento confirmado', () => {
          const real = banco.estado.lancamentos[`rc-${item.recorrenteId}-${item.competencia}`];
          [real, parDe(real)].filter(Boolean).forEach((r) => gravar('lancamentos', { ...r, excluido: true }));
          concluir();
        });
      } else {
        const pago = !item.pago;
        // Transferência: as duas pontas ficam feitas (ou não) juntas.
        const lados = item.transferencia ? [item, parDe(item)].filter(Boolean) : [item];
        lados.forEach((l) => {
          const v = visao(Fin.areaDe(l));
          gravar('lancamentos', { ...l, pago, data: pago ? Fin.dataDoPagamento(v, l) : l.data, certeza: pago && l.tipo === 'receita' ? 'certa' : l.certeza });
        });
      }
      concluir();
    },
    'abrir-item': (b) => {
      const item = acharItem(b.dataset.id) || banco.estado.lancamentos[b.dataset.id];
      if (!item) return;
      if (item.transferencia) { abrirTransferencia(item); return; }
      if (item.espelho) { abrirEspelho(item); return; }
      if (item.virtual) {
        form = { modo: 'confirmar', area: areaAtiva(), tipo: item.tipo, valorTxt: valorParaCampo(item.valor), descricao: item.descricao, categoriaId: item.categoriaId, contaId: item.contaId, data: item.data, repete: 'uma', fim: '', certeza: 'certa', pago: true, recorrenteId: item.recorrenteId, competencia: item.competencia };
      } else {
        const espelho = item.semCaixa ? parDe(item) : null;
        form = { modo: 'editar', area: areaAtiva(), id: item.id, tipo: item.tipo, valorTxt: valorParaCampo(item.valor), descricao: item.descricao, categoriaId: item.categoriaId, contaId: item.contaId, data: item.data, repete: 'uma', fim: '', certeza: item.certeza || 'certa', pago: espelho ? !!espelho.pago : !!item.pago, parcelaGrupo: item.parcelaGrupo, parcela: item.parcela, parcelas: item.parcelas, recorrenteId: item.recorrenteId, metaId: item.metaId, excepcional: !!item.excepcional, pagador: item.pagoPor || AREA_CONJUNTA, contaPessoal: espelho ? espelho.contaId : undefined };
      }
      pintarFormulario(false);
    },
    'f-area': (b) => {
      lerFormulario();
      form.area = b.dataset.valor;
      const contas = vivos(visao(form.area), 'contas');
      const preferida = contas.find((c) => c.tipo !== 'cartao') || contas[0];
      form.contaId = preferida ? preferida.id : '';
      form.categoriaId = '';
      pintarFormulario(false);
    },
    'f-tipo': (b) => {
      lerFormulario();
      if (b.dataset.valor === 'transferencia') { novaTransferencia({ valorTxt: form.valorTxt, data: form.data }); return; }
      form.tipo = b.dataset.valor;
      if (form.tipo === 'receita' && form.repete === 'parcelado') form.repete = 'uma';
      pintarFormulario(false);
    },
    'f-pagador': (b) => { lerFormulario(); form.pagador = b.dataset.valor; if (form.pagador !== AREA_CONJUNTA) form.repete = 'uma'; pintarFormulario(false); },
    't-tipo': (b) => {
      lerTransferencia();
      if (b.dataset.valor !== 'transferencia') formularioNovo({ tipo: b.dataset.valor, valorTxt: tf.valorTxt, data: tf.data });
    },
    't-repete': (b) => { lerTransferencia(); tf.repete = b.dataset.valor; pintarTransferencia(false); },
    't-excluir': () => pedirConfirmacao('Excluir a transferência?', 'Sai das duas contas.', 'Excluir', () => excluirVarios('lancamentos', [tf.idA, tf.idB].filter(Boolean), 'Transferência excluída')),
    't-encerrar': () => pedirConfirmacao('Encerrar a transferência fixa?', 'Deixa de aparecer nos próximos meses nas duas contas. O que já foi feito continua no histórico.', 'Encerrar', () => excluirVarios('recorrentes', [tf.recA, tf.recB].filter(Boolean), 'Transferência fixa encerrada')),
    't-pular': () => {
      [tf.recA, tf.recB].forEach((id) => {
        const rec = banco.estado.recorrentes[id];
        if (rec) gravar('recorrentes', { ...rec, pulados: [...(rec.pulados || []), tf.competencia] });
      });
      fecharFolha();
      concluir();
      avisar('Este mês foi pulado');
    },
    't-editar-fixo': () => { const rec = banco.estado.recorrentes[tf.recA]; if (rec) abrirFixoTransferencia(rec); },
    'registrar-acerto': formAcerto,
    'abrir-na-conjunta': (b) => {
      const id = b.dataset.id;
      fecharFolha();
      ui.area = 'conjunta';
      desenhar(true);
      acoes['abrir-item']({ dataset: { id } });
    },
    'f-repete': (b) => { lerFormulario(); form.repete = b.dataset.valor; pintarFormulario(false); },
    'f-certeza': (b) => {
      lerFormulario();
      form.certeza = b.dataset.valor;
      if (form.certeza === 'provavel') form.pago = false;
      pintarFormulario(false);
    },
    'pular-mes': () => {
      const rec = estado.recorrentes[form.recorrenteId];
      [rec, parDe(rec, 'recorrentes')].filter(Boolean).forEach((r) => gravar('recorrentes', { ...r, pulados: [...(r.pulados || []), form.competencia] }));
      fecharFolha();
      concluir();
      avisar('Este mês foi pulado');
    },
    'fixo-da-ocorrencia': () => abrirFixo(form.recorrenteId),
    'editar-fixo': (b) => abrirFixo(b.dataset.id),
    'excluir-fixo': () => {
      const rec = estado.recorrentes[form.id];
      pedirConfirmacao('Encerrar este fixo?', `"${rec.descricao}" deixa de aparecer nos próximos meses. O que já foi confirmado continua no histórico.`, 'Encerrar', () => {
        excluirVarios('recorrentes', [rec.id, rec.parId].filter(Boolean), 'Fixo encerrado');
      });
    },
    'excluir-lancamento': () => {
      const atual = estado.lancamentos[form.id];
      if (atual.recorrenteId && Fin.ehCartao(estado, atual)) {
        const rec = estado.recorrentes[atual.recorrenteId];
        if (rec) gravar('recorrentes', { ...rec, pulados: [...(rec.pulados || []), atual.competencia] });
      }
      // Gasto pago do bolso: o espelho na conta pessoal sai junto.
      excluirVarios('lancamentos', [form.id, atual.parId].filter(Boolean), 'Lançamento excluído');
    },
    'excluir-parcelas': () => {
      const grupo = form.parcelaGrupo;
      const ids = vivos(estado, 'lancamentos').filter((l) => l.parcelaGrupo === grupo).map((l) => l.id);
      pedirConfirmacao('Excluir todas as parcelas?', `${ids.length} parcelas serão removidas.`, 'Excluir', () => excluirVarios('lancamentos', ids, 'Parcelas excluídas'));
    },
    'sim-tipo': (b) => {
      ui.sim.tipo = b.dataset.valor;
      desenhar();
    },
    'sim-lancar': () => formularioNovo({ valorTxt: ui.sim.valorTxt, repete: Number(ui.sim.parcelas) > 1 ? 'parcelado' : 'uma', parcelas: Number(ui.sim.parcelas) || 2, data: ui.sim.inicio }),
    'salvar-variavel': () => {
      const texto = $('#variavel-manual').value.trim();
      gravar('config', { ...estado.config.geral, variavelManual: texto ? lerReais(texto) : null });
      concluir();
      avisar('Estimativa atualizada');
    },
    'limpar-variavel': () => {
      gravar('config', { ...estado.config.geral, variavelManual: null });
      concluir();
    },
    'guardar-meta': (b) => {
      const meta = estado.metas[b.dataset.id];
      const valor = Math.min(meta.aporte, Fin.previsaoMeta(meta, hoje(), estado).falta);
      const conta = meta.contaId && estado.contas[meta.contaId];
      let desfazer;
      if (conta && !conta.excluido) {
        const id = novoId();
        gravar('lancamentos', { id, tipo: 'despesa', descricao: `Guardado: ${meta.nome}`, valor, categoriaId: CATEGORIA_META, contaId: conta.id, data: hoje(), certeza: 'certa', pago: true, metaId: meta.id });
        desfazer = () => gravar('lancamentos', { ...banco.estado.lancamentos[id], excluido: true });
      } else {
        const anterior = { ...meta };
        gravar('metas', { ...meta, guardado: (meta.guardado || 0) + valor, ultimoAporte: mesDe(hoje()) });
        desfazer = () => gravar('metas', anterior);
      }
      concluir();
      avisar(`${reais(valor)} guardados`, () => { desfazer(); concluir(); });
    },
    'nova-meta': () => formMeta(null),
    'editar-meta': (b) => formMeta(estado.metas[b.dataset.id]),
    'excluir-meta': () => excluirVarios('metas', [$('form[data-form="meta"]').dataset.id], 'Meta excluída'),
    'nova-conta': () => formConta(null),
    'editar-conta': (b) => formConta(estado.contas[b.dataset.id]),
    'excluir-conta': () => {
      const id = $('form[data-form="conta"]').dataset.id;
      const usada = vivos(estado, 'lancamentos').some((l) => l.contaId === id) || vivos(estado, 'recorrentes').some((r) => r.contaId === id);
      const erro = $('#c-erro');
      if (usada) { erro.textContent = 'Esta conta tem lançamentos ou fixos. Mude-os de conta antes de excluir.'; erro.hidden = false; return; }
      if (vivos(estado, 'contas').some((c) => c.contaPagamento === id)) { erro.textContent = 'Esta conta paga a fatura de um cartão. Troque isso no cartão antes de excluir.'; erro.hidden = false; return; }
      if (vivos(estado, 'contas').length <= 1) { erro.textContent = 'Mantenha pelo menos uma conta.'; erro.hidden = false; return; }
      excluirVarios('contas', [id], 'Conta excluída');
    },
    'nova-categoria': () => formCategoria(null),
    'editar-categoria': (b) => formCategoria(estado.categorias[b.dataset.id]),
    'excluir-categoria': () => excluirVarios('categorias', [$('form[data-form="categoria"]').dataset.id], 'Categoria excluída'),
    tema: (b) => {
      const v = b.dataset.valor;
      try {
        if (v === 'auto') localStorage.removeItem(CHAVE_TEMA);
        else localStorage.setItem(CHAVE_TEMA, v);
      } catch (e) { /* vale só nesta visita */ }
      if (v === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', v === 'claro' ? 'light' : 'dark');
      desenhar();
    },
    conectar,
    sincronizar: async () => {
      const ok = await sincronizar();
      avisar(ok ? 'Sincronizado' : sinc.mensagem || 'Sem internet no momento');
      if (ok) desenhar();
    },
    desconectar: () => pedirConfirmacao('Desconectar a planilha?', 'Os dados continuam neste aparelho e na planilha, mas deixam de sincronizar.', 'Desconectar', () => {
      banco.sinc = null;
      banco.pendentes = {};
      sinc.situacao = 'desligado';
      salvar();
      fecharFolha();
      desenhar();
    }),
    'copiar-script': async () => {
      try {
        const t = await (await fetch('apps-script/Codigo.gs')).text();
        await navigator.clipboard.writeText(t);
        avisar('Script copiado');
      } catch (e) {
        avisar('Não consegui copiar. Abra apps-script/Codigo.gs no projeto.');
      }
    },
    'baixar-json': () => baixarBackup().catch(() => { /* compartilhamento cancelado */ }),
    'baixar-csv': () => entregarArquivo(`financas-gl-${nomeArquivoArea()}-${hoje()}.csv`, new Blob([gerarCsv()], { type: 'text/csv;charset=utf-8' })).catch(() => { /* compartilhamento cancelado */ }),
    restaurar: () => $('#arquivo-backup').click(),
  };

  function abrirEspelho(item) {
    const conta = estado.contas[item.contaId];
    abrirFolha(`${topoFolha(item.descricao)}
      <p class="nota">Gasto da Conjunta pago por você, de <b>${esc(conta ? conta.nome : 'uma conta sua')}</b>: ${reais(item.valor)} em ${dataBR(item.data)}. Para mudar valor, data ou quem pagou, abra o gasto na Conjunta.</p>
      <div class="acoes"><button type="button" class="btn primario" data-acao="abrir-na-conjunta" data-id="${esc(item.parId)}" style="flex:1">Abrir na Conjunta</button></div>`);
  }

  function abrirFixo(id) {
    const r = estado.recorrentes[id];
    if (!r) return;
    if (r.transferencia) { abrirFixoTransferencia(r); return; }
    form = { modo: 'fixo', area: areaAtiva(), id: r.id, tipo: r.tipo, valorTxt: valorParaCampo(r.valor), descricao: r.descricao, categoriaId: r.categoriaId, contaId: r.contaId, data: r.inicio, repete: 'mensal', fim: r.fim || '', certeza: r.certeza || 'certa', pago: false };
    pintarFormulario(false);
  }

  const formularios = {
    lancamento: salvarFormulario,
    transferencia: salvarTransferencia,
    acerto: salvarAcerto,
    divisao: () => {
      const p1 = Math.min(100, Math.max(0, Math.round(Number($('#d-p1').value) || 0)));
      gravar('config', { ...estado.config.geral, divisaoP1: p1 });
      concluir();
      avisar(`Divisão salva: ${p1}% e ${100 - p1}%`);
    },
    ajuste: (f) => {
      const conta = estado.contas[f.dataset.id];
      const texto = $('#a-valor').value.trim();
      if (!texto) {
        const erro = $('#a-erro');
        erro.textContent = 'Digite o saldo que aparece no banco.';
        erro.hidden = false;
        $('#a-valor').focus();
        return;
      }
      const valor = lerReais(texto);
      const { saldoInicial, diferenca } = Fin.ajusteAoBanco(estado, conta, hoje(), valor);
      fecharFolha();
      if (!diferenca) { avisar('Já estava igual ao banco'); return; }
      const anterior = { ...conta };
      gravar('contas', { ...conta, saldoInicial });
      concluir();
      avisar(`${conta.nome} ajustada para ${reais(valor)}`, () => { gravar('contas', anterior); concluir(); });
    },
    nomes: () => {
      const nome1 = $('#n-nome1').value.trim();
      const nome2 = $('#n-nome2').value.trim();
      if (!nome1 || !nome2) {
        const erro = $('#n-erro');
        erro.textContent = 'Informe os dois nomes.';
        erro.hidden = false;
        return;
      }
      gravar('perfis', { ...banco.estado.perfis.p1, id: 'p1', nome: nome1 });
      gravar('perfis', { ...banco.estado.perfis.p2, id: 'p2', nome: nome2 });
      fecharFolha();
      concluir();
      avisar('Nomes salvos');
    },
    conta: (f) => {
      const nome = $('#c-nome').value.trim();
      if (!nome) { const e = $('#c-erro'); e.textContent = 'Dê um nome à conta.'; e.hidden = false; $('#c-nome').focus(); return; }
      const tipo = $('#c-tipo').value;
      const dia = (el) => Math.min(31, Math.max(1, Number($(el).value) || 1));
      const atual = f.dataset.id ? estado.contas[f.dataset.id] : { id: novoId() };
      const cartao = tipo === 'cartao';
      const saldoData = $('#c-saldo-data').value;
      gravar('contas', {
        ...atual, nome, tipo, grupo: $('#c-grupo').value,
        saldoInicial: cartao ? 0 : lerReais($('#c-saldo').value),
        saldoData: cartao || !saldoData ? undefined : (saldoData > hoje() ? hoje() : saldoData),
        fechamento: cartao ? dia('#c-fecha') : undefined,
        vencimento: cartao ? dia('#c-vence') : undefined,
        contaPagamento: cartao ? $('#c-paga').value || undefined : undefined,
      });
      fecharFolha();
      concluir();
      avisar('Conta salva');
    },
    categoria: (f) => {
      const nome = $('#k-nome').value.trim();
      if (!nome) { const e = $('#k-erro'); e.textContent = 'Dê um nome à categoria.'; e.hidden = false; $('#k-nome').focus(); return; }
      const atual = f.dataset.id ? estado.categorias[f.dataset.id] : { id: novoId() };
      gravar('categorias', { ...atual, nome, tipo: $('#k-tipo').value, limite: lerReais($('#k-limite').value) });
      fecharFolha();
      concluir();
      avisar('Categoria salva');
    },
    meta: (f) => {
      const nome = $('#m-nome').value.trim();
      const alvo = lerReais($('#m-alvo').value);
      if (!nome || alvo <= 0) { const e = $('#m-erro'); e.textContent = 'Informe o nome e o valor da meta.'; e.hidden = false; return; }
      const atual = f.dataset.id ? estado.metas[f.dataset.id] : { id: novoId() };
      // O formulário mostra o total; o que veio de lançamentos continua vindo deles.
      const dosLancamentos = Fin.guardadoMeta(estado, { id: atual.id, guardado: 0 });
      gravar('metas', { ...atual, nome, alvo, guardado: Math.max(0, lerReais($('#m-guardado').value) - dosLancamentos), aporte: lerReais($('#m-aporte').value), contaId: $('#m-conta').value || null });
      fecharFolha();
      concluir();
      avisar('Meta salva');
    },
  };

  /* ---------- eventos ---------- */
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-acao]');
    if (alvo && acoes[alvo.dataset.acao]) {
      e.preventDefault();
      acoes[alvo.dataset.acao](alvo);
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    formularios[f.dataset.form](f);
  });

  folha().addEventListener('click', (e) => {
    // Toque fora da folha fecha.
    if (e.target === folha()) fecharFolha();
  });
  folha().addEventListener('close', () => {
    // O evento chega depois: se outra folha já abriu nesse meio-tempo, não a apaga.
    if (!folha().open) folha().innerHTML = '';
    if (ui.redesenhar) desenhar();
  });

  const PODE_NEGATIVO = new Set(['c-saldo', 'saldo-inicial', 'a-valor']);
  // Ao trocar a conta de origem ou de destino, a dica da transferência acompanha.
  document.addEventListener('change', (e) => { if (tf && (e.target.id === 't-de' || e.target.id === 't-para')) dicaTransferencia(); });
  function pontuarValor(el, e) {
    // Colado, preenchido automaticamente ou ditado: chega de uma vez, então lê o valor inteiro.
    if (e.inputType === 'insertFromPaste' || e.inputType === 'insertReplacementText' || (e.data && e.data.length > 1)) {
      const c = lerReais(el.value);
      el.value = c ? (c < 0 && PODE_NEGATIVO.has(el.id) ? '-' : '') + valorParaCampo(Math.abs(c)) : '';
      return;
    }
    const r = Fin.formatarDigitando(el.value, el.selectionStart == null ? el.value.length : el.selectionStart, {
      digitouPonto: e.data === '.', virgulaDoPonto: el.dataset.virgulaDoPonto === '1', negativo: PODE_NEGATIVO.has(el.id),
    });
    el.value = r.texto;
    el.dataset.virgulaDoPonto = r.virgulaDoPonto ? '1' : '';
    try { el.setSelectionRange(r.cursor, r.cursor); } catch (erro) { /* campo sem cursor */ }
  }

  document.addEventListener('input', (e) => {
    const id = e.target.id;
    if (e.target.inputMode === 'decimal') pontuarValor(e.target, e);
    if (id === 'busca') {
      ui.texto = e.target.value;
      $('#lista-lancamentos').innerHTML = listaLancamentos();
    } else if (id === 'sim-valor' || id === 'sim-parcelas' || id === 'sim-inicio') {
      if (id === 'sim-valor') ui.sim.valorTxt = e.target.value;
      if (id === 'sim-parcelas') ui.sim.parcelas = e.target.value;
      if (id === 'sim-inicio') ui.sim.inicio = e.target.value;
      pintarSimulacao(false);
    } else if (id && id.startsWith('f-') && form) {
      atualizarDicasForm();
    } else if (id && id.startsWith('t-') && tf) {
      dicaTransferencia();
    } else if (id === 'a-valor') {
      dicaAjuste();
    } else if (id === 'c-saldo') {
      // Saldo novo é o de hoje, a menos que a pessoa escolha outro dia.
      $('#c-saldo-data').value = hoje();
    }
  });

  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'f-descricao' && form) {
      // Repete a categoria e a conta usadas da última vez com essa descrição.
      const texto = e.target.value.trim().toLowerCase();
      const ultimo = vivos(visao(form.area), 'lancamentos').filter((l) => l.tipo === form.tipo && !l.metaId && l.descricao.toLowerCase() === texto).sort((a, b) => b.atualizadoEm - a.atualizadoEm)[0];
      if (ultimo && form.modo === 'novo') {
        $('#f-categoria').value = ultimo.categoriaId;
        $('#f-conta').value = ultimo.contaId;
        atualizarDicasForm();
      }
    } else if (id === 'f-data' && form && form.modo !== 'fixo') {
      const data = e.target.value;
      const pago = $('#f-pago');
      if (pago && data) { pago.checked = data <= hoje() && form.certeza !== 'provavel'; atualizarDicasForm(); }
    } else if (id === 'c-tipo') {
      const cartao = e.target.value === 'cartao';
      $('[data-so-cartao]').hidden = !cartao;
      $('[data-sem-cartao]').hidden = cartao;
    } else if (id === 'arquivo-backup' && e.target.files[0]) {
      restaurarArquivo(e.target.files[0]);
      e.target.value = '';
    }
  });

  window.addEventListener('hashchange', () => {
    lerRota();
    if (folha().open) fecharFolha();
    desenhar(true);
    window.scrollTo(0, 0);
  });
  window.addEventListener('storage', (e) => {
    if (e.key === CHAVE && recarregarSeMudou()) desenharSePossivel();
  });
  // Tema automático: o brilho dos gráficos depende de claro ou escuro, então redesenha ao mudar.
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => desenharSePossivel()); } catch (e) { /* navegador antigo */ }
  window.addEventListener('online', () => agendarSinc(200));
  window.addEventListener('offline', () => { sinc.situacao = 'offline'; pintarSelo(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      recarregarSeMudou();
      confirmarFixosNoCartao();
      agendarSinc(200);
      desenharSePossivel();
    }
  });
  setInterval(() => { if (document.visibilityState === 'visible') agendarSinc(0); }, 120000);

  /* ---------- início ---------- */
  lerRota();
  refazerVisao();
  if (banco.iniciado) {
    migrarSaldos();
    confirmarFixosNoCartao();
  }
  desenhar(true);
  agendarSinc(300);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    // Versão nova instalada enquanto o app estava aberto: recarrega uma vez para usá-la.
    const tinhaVersao = !!navigator.serviceWorker.controller;
    let recarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tinhaVersao || recarregou) return;
      recarregou = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => { /* segue funcionando sem o modo offline */ });
  }
})();
