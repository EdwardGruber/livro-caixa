/* Finanças G&L — monta os PDFs. Carregado só na hora de exportar, junto com a biblioteca jsPDF. */
(function (raiz) {
  'use strict';
  const { jsPDF } = raiz.jspdf;

  const LARG = 210;
  const ALT = 297;
  const M = 15;
  const UTIL = LARG - 2 * M;
  const TINTA = [16, 32, 28];
  const TINTA2 = [74, 90, 85];
  const LINHA = [219, 227, 223];
  const POS = [0, 99, 0];
  const NEG = [185, 47, 47];

  /* A fonte padrão do PDF só tem caracteres latinos: troca o resto para o texto não sair quebrado. */
  function limpar(t) {
    return String(t == null ? '' : t)
      .replace(/−/g, '-').replace(/[–—]/g, '-').replace(/ /g, ' ')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
      .replace(/[^\x20-\x7E¡-ÿ]/g, '');
  }

  const corDeHex = (h) => [1, 3, 5].map((i) => parseInt(h.trim().slice(i, i + 2), 16));

  function novoDoc(info) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: limpar(`${info.titulo} - ${info.subtitulo}`), creator: 'Finanças G&L' });
    return doc;
  }

  function cabecalho(doc, info) {
    doc.setFillColor(...info.marca);
    doc.rect(0, 0, LARG, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Finanças G&L', M, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(limpar(info.subtitulo), M, 21);
    doc.setFontSize(8.5);
    doc.text(limpar(info.emitido), LARG - M, 13, { align: 'right' });
    if (info.exemplo) doc.text('Dados de exemplo', LARG - M, 21, { align: 'right' });
    doc.setTextColor(...TINTA);
    return 39;
  }

  function rodapes(doc) {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TINTA2);
      doc.text('Finanças G&L', M, ALT - 8);
      doc.text(`Página ${i} de ${total}`, LARG - M, ALT - 8, { align: 'right' });
    }
  }

  function caixasResumo(doc, itens, y) {
    const gap = 4;
    const w = (UTIL - gap * (itens.length - 1)) / itens.length;
    itens.forEach((it, i) => {
      const x = M + i * (w + gap);
      doc.setFillColor(246, 248, 247);
      doc.roundedRect(x, y, w, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...TINTA2);
      doc.text(limpar(it.rotulo), x + 4, y + 6.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...(it.negativo ? NEG : TINTA));
      doc.text(limpar(it.valor), x + 4, y + 13.5);
    });
    doc.setTextColor(...TINTA);
    return y + 18;
  }

  /* Tabela simples que quebra o texto, troca de página sozinha e repete o título das colunas. */
  function tabela(doc, y, colunas, linhas) {
    const desenhaTitulos = (yy) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...TINTA2);
      let x = M;
      colunas.forEach((c) => {
        const tx = c.direita ? x + c.w : x;
        doc.text(limpar(c.titulo), tx, yy, c.direita ? { align: 'right' } : undefined);
        x += c.w;
      });
      doc.setDrawColor(...TINTA2);
      doc.setLineWidth(0.25);
      doc.line(M, yy + 1.6, M + UTIL, yy + 1.6);
      return yy + 6;
    };
    y = desenhaTitulos(y);
    const ALTURA_LINHA = 3.9;
    linhas.forEach((l) => {
      doc.setFont('helvetica', l.destaque ? 'bold' : 'normal');
      doc.setFontSize(9);
      const textos = colunas.map((c, i) => (c.direita ? [limpar(l.celulas[i])] : doc.splitTextToSize(limpar(l.celulas[i]), c.w - 2)));
      const qtd = Math.max(...textos.map((t) => t.length));
      const h = qtd * ALTURA_LINHA + 1.6;
      if (y + h > ALT - 16) {
        doc.addPage();
        y = desenhaTitulos(18);
        doc.setFont('helvetica', l.destaque ? 'bold' : 'normal');
        doc.setFontSize(9);
      }
      let x = M;
      colunas.forEach((c, i) => {
        const cor = l.cores && l.cores[i];
        doc.setTextColor(...(cor || TINTA));
        const tx = c.direita ? x + c.w : x;
        doc.text(textos[i], tx, y, c.direita ? { align: 'right' } : undefined);
        x += c.w;
      });
      doc.setDrawColor(...LINHA);
      doc.setLineWidth(0.15);
      doc.line(M, y + h - ALTURA_LINHA + 0.4, M + UTIL, y + h - ALTURA_LINHA + 0.4);
      y += h;
    });
    doc.setTextColor(...TINTA);
    return y;
  }

  function lancamentos(info) {
    const doc = novoDoc(info);
    let y = cabecalho(doc, info);
    y = caixasResumo(doc, info.resumo, y) + 5;
    if (info.nota) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TINTA2);
      const partes = doc.splitTextToSize(limpar(info.nota), UTIL);
      doc.text(partes, M, y);
      doc.setTextColor(...TINTA);
      y += partes.length * 4 + 3;
    }
    if (!info.linhas.length) {
      doc.setFontSize(10);
      doc.text('Nenhum lançamento neste período.', M, y + 3);
    } else {
      const colunas = [
        { titulo: 'Data', w: 14 }, { titulo: 'Descrição', w: 58 }, { titulo: 'Categoria', w: 32 },
        { titulo: 'Conta', w: 28 }, { titulo: 'Situação', w: 21 }, { titulo: 'Valor', w: 27, direita: true },
      ];
      const linhas = info.linhas.map((l) => ({
        celulas: [l.data, l.descricao, l.categoria, l.conta, l.situacao, l.valor],
        cores: l.entrada ? [null, null, null, null, null, POS] : (l.atrasado ? [null, null, null, null, NEG, null] : null),
      }));
      tabela(doc, y + 2, colunas, linhas);
    }
    rodapes(doc);
    return doc.output('blob');
  }

  function legenda(doc, series, y) {
    let x = M;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TINTA2);
    series.forEach((s) => {
      const c = corDeHex(s.cor);
      if (s.bloco) {
        doc.setFillColor(...c);
        doc.rect(x, y - 2.4, 3, 3, 'F');
      } else {
        doc.setDrawColor(...c);
        doc.setLineWidth(0.6);
        if (s.tracejado) doc.setLineDashPattern([1.4, 1], 0);
        doc.line(x, y - 1, x + 5, y - 1);
        doc.setLineDashPattern([], 0);
      }
      const larguraMarca = s.bloco ? 4.5 : 6.5;
      doc.text(limpar(s.nome), x + larguraMarca, y);
      x += larguraMarca + doc.getTextWidth(limpar(s.nome)) + 5;
    });
    doc.setTextColor(...TINTA);
  }

  function graficos(info) {
    const doc = novoDoc(info);
    let y = cabecalho(doc, info);
    info.imagens.forEach((g) => {
      const h = (UTIL * g.imagem.altura) / g.imagem.largura;
      if (y + h + 16 > ALT - 14) {
        doc.addPage();
        y = 18;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(limpar(g.titulo), M, y);
      y += 5;
      if (g.nota) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...TINTA2);
        doc.text(limpar(g.nota), M, y);
        doc.setTextColor(...TINTA);
        y += 4.5;
      }
      legenda(doc, g.series, y + 1);
      y += 4;
      doc.addImage(g.imagem.url, 'PNG', M, y, UTIL, h, undefined, 'FAST');
      y += h + 8;
    });

    doc.addPage();
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(limpar(`Para onde foi o dinheiro em ${info.mesCategorias}`), M, y);
    y += 7;
    if (!info.categorias.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Nenhuma saída neste mês.', M, y);
      y += 8;
    }
    info.categorias.forEach((c) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(limpar(c.nome), M, y);
      doc.text(limpar(`${c.valor}  (${c.pct}%)`), LARG - M, y, { align: 'right' });
      y += 1.8;
      doc.setFillColor(238, 242, 240);
      doc.roundedRect(M, y, UTIL, 2.2, 1, 1, 'F');
      doc.setFillColor(...corDeHex(info.corBarra));
      if (c.proporcao > 0) doc.roundedRect(M, y, Math.max(2.2, UTIL * c.proporcao), 2.2, 1, 1, 'F');
      y += 7;
    });

    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Valores mês a mês', M, y);
    y += 7;
    const w = UTIL / info.tabela.colunas.length;
    tabela(doc, y, info.tabela.colunas.map((t, i) => ({ titulo: t, w, direita: i > 0 })), info.tabela.linhas.map((celulas) => ({ celulas })));

    rodapes(doc);
    return doc.output('blob');
  }

  raiz.Pdf = { lancamentos, graficos };
})(globalThis);
