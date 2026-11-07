/* Finanças G&L — gráficos em SVG, sem bibliotecas. Todo gráfico traz legenda, dica ao tocar e versão em tabela. */
(function (raiz) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Marcas de eixo em valores redondos, em centavos. */
  function marcas(min, max, qtd = 4) {
    if (min === max) { min -= 10000; max += 10000; }
    const bruto = (max - min) / qtd;
    const ordem = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * ordem).find((p) => p >= bruto);
    const inicio = Math.floor(min / passo) * passo;
    const fim = Math.ceil(max / passo) * passo;
    const lista = [];
    for (let v = inicio; v <= fim + passo / 2; v += passo) lista.push(Math.round(v));
    return lista;
  }

  function eixoReais(c) {
    const v = Math.abs(c) / 100;
    const s = v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    return (c < 0 ? '−' : '') + s;
  }

  function legendaHtml(series, bloco) {
    if (series.length < 2) return '';
    return `<div class="legenda">${series.map((s) => `<span><i class="${bloco ? 'bloco' : ''}${s.tracejado ? ' tracejado' : ''}" style="--c:${s.cor}"></i>${esc(s.nome)}</span>`).join('')}</div>`;
  }

  function tabelaHtml(titulo, rotulos, series, formatar) {
    const linhas = rotulos.map((r, i) => {
      const vals = series.map((s) => (s.valores[i] == null ? '<td>—</td>' : `<td>${esc(formatar(s.valores[i]))}</td>`)).join('');
      return `<tr><td>${esc(r)}</td>${vals}</tr>`;
    }).join('');
    return `<table><caption class="oculto-visual">${esc(titulo)}</caption><thead><tr><th>Período</th>${series.map((s) => `<th>${esc(s.nome)}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table>`;
  }

  /* Monta legenda, área do desenho e botão de tabela; redesenha ao mudar a largura. */
  function montar(el, cfg, desenhar) {
    el.classList.add('grafico');
    el.innerHTML = `${legendaHtml(cfg.series, cfg.bloco)}
      <div class="plot" tabindex="0" role="group" aria-label="${esc(cfg.titulo)}. Use as setas para percorrer os valores."></div>
      <button type="button" class="link" data-tabela>Ver em tabela</button>
      <div class="tabela-rolagem" hidden>${tabelaHtml(cfg.titulo, cfg.rotulos, cfg.series, cfg.formatar)}</div>`;
    const plot = el.querySelector('.plot');
    const botao = el.querySelector('[data-tabela]');
    const tabela = el.querySelector('.tabela-rolagem');
    botao.addEventListener('click', () => {
      tabela.hidden = !tabela.hidden;
      botao.textContent = tabela.hidden ? 'Ver em tabela' : 'Ocultar tabela';
    });
    let largura = 0;
    let animar = cfg.animar && !semMovimento();
    const pintar = () => {
      const w = Math.floor(plot.clientWidth);
      if (!w || w === largura) return;
      largura = w;
      desenhar(plot, w, animar);
      animar = false;
    };
    pintar();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(pintar).observe(plot);
  }

  function ligarDica(plot, { w, qtd, indicePorX, conteudo, destacar, limpar, xDoIndice }) {
    const dica = document.createElement('div');
    dica.className = 'dica';
    dica.hidden = true;
    plot.appendChild(dica);
    let atual = null;
    const mostrar = (i) => {
      atual = i;
      dica.innerHTML = conteudo(i);
      dica.hidden = false;
      destacar(i);
      const x = xDoIndice(i);
      const dw = dica.offsetWidth;
      const left = x + 12 + dw > w ? Math.max(0, x - 12 - dw) : x + 12;
      dica.style.transform = `translate(${left}px, 4px)`;
    };
    const esconder = () => {
      atual = null;
      dica.hidden = true;
      limpar();
    };
    plot.onpointermove = (e) => {
      const caixa = plot.getBoundingClientRect();
      mostrar(indicePorX(e.clientX - caixa.left));
    };
    plot.onpointerdown = plot.onpointermove;
    plot.onpointerleave = esconder;
    plot.onblur = esconder;
    plot.onkeydown = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const passo = e.key === 'ArrowLeft' ? -1 : 1;
      const base = atual == null ? (passo > 0 ? -1 : qtd) : atual;
      mostrar(Math.min(qtd - 1, Math.max(0, base + passo)));
    };
  }

  const novoId = () => Math.random().toString(36).slice(2, 8);

  /* Degradê vertical da cor da série até transparente, para áreas e barras. */
  const degrade = (id, cor, topo, base = 0) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:${cor};stop-opacity:${topo}"/><stop offset="1" style="stop-color:${cor};stop-opacity:${base}"/></linearGradient>`;

  /* Curva suave passando pelos pontos (só no detalhe decorativo do topo). */
  function curva(pontos) {
    if (pontos.length < 3) return pontos.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    let d = `M${pontos[0][0].toFixed(1)} ${pontos[0][1].toFixed(1)}`;
    for (let i = 0; i < pontos.length - 1; i++) {
      const p0 = pontos[i - 1] || pontos[i];
      const p1 = pontos[i];
      const p2 = pontos[i + 1];
      const p3 = pontos[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  const linhaDica = (s, valor, formatar) => `<div><span><i style="--c:${s.cor}"></i>${esc(s.nome)}</span><strong class="num">${esc(formatar(valor))}</strong></div>`;

  /* ---------- linhas: saldo real e projetado ---------- */
  function linhas(el, cfg) {
    montar(el, cfg, (plot, w, animar) => {
      const h = Math.max(190, Math.min(280, w * 0.5));
      const m = { t: 10, r: 10, b: 24, l: 46 };
      const todos = cfg.series.flatMap((s) => s.valores.filter((v) => v != null));
      const ticks = marcas(Math.min(0, ...todos), Math.max(0, ...todos));
      const yMin = ticks[0];
      const yMax = ticks[ticks.length - 1];
      const n = cfg.rotulos.length;
      const X = (i) => m.l + (n === 1 ? 0 : (i * (w - m.l - m.r)) / (n - 1));
      const Y = (v) => m.t + ((yMax - v) * (h - m.t - m.b)) / (yMax - yMin || 1);
      const passo = Math.max(1, Math.ceil(46 / ((w - m.l - m.r) / Math.max(1, n - 1))));
      const uid = novoId();
      const idClip = 'c' + uid;
      const efeitos = !cfg.pdf;

      const grade = ticks.map((t) => `<line class="${t === 0 ? 'zero' : 'grade'}" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(eixoReais(t))}</text>`).join('');
      const rotX = cfg.rotulos.map((r, i) => {
        const obrigatorio = i === cfg.indiceHoje;
        if (!obrigatorio && (i % passo !== 0 || (cfg.indiceHoje != null && Math.abs(i - cfg.indiceHoje) < passo))) return '';
        const ancora = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        return `<text x="${X(i)}" y="${h - 6}" text-anchor="${ancora}">${esc(r)}</text>`;
      }).join('');

      const defs = efeitos ? cfg.series.map((s, j) => degrade(`a${uid}${j}`, s.cor, s.area ? 0.38 : 0.12)).join('') : '';
      const chao = Y(Math.max(yMin, 0));
      const caminhos = cfg.series.map((s, j) => {
        const pontos = s.valores.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
        if (!pontos.length) return '';
        const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
        const fechar = `L${pontos[pontos.length - 1][0].toFixed(1)} ${chao}L${pontos[0][0].toFixed(1)} ${chao}Z`;
        let area = '';
        if (pontos.length > 1 && efeitos) area = `<path d="${d}${fechar}" fill="url(#a${uid}${j})"/>`;
        else if (pontos.length > 1 && s.area) area = `<path d="${d}${fechar}" fill="${s.cor}" opacity=".1"/>`;
        const fimP = pontos[pontos.length - 1];
        const ponto = `<circle cx="${fimP[0]}" cy="${fimP[1]}" r="4" fill="${s.cor}" stroke="var(--superficie)" stroke-width="2"/>`;
        return `${area}<path${efeitos ? ` class="brilha" style="--c:${s.cor}"` : ''} d="${d}" fill="none" stroke="${s.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.tracejado ? ' stroke-dasharray="6 5"' : ''}/>${ponto}`;
      }).join('');

      const hoje = cfg.indiceHoje != null ? `<line class="zero linha-hoje" x1="${X(cfg.indiceHoje)}" x2="${X(cfg.indiceHoje)}" y1="${m.t}" y2="${h - m.b}"/>` : '';
      const serieHoje = cfg.indiceHoje != null && cfg.series.find((s) => s.valores[cfg.indiceHoje] != null);
      const aceso = efeitos && serieHoje
        ? `<g class="aceso" style="--c:${serieHoje.cor}"><circle class="halo" cx="${X(cfg.indiceHoje)}" cy="${Y(serieHoje.valores[cfg.indiceHoje])}" r="9" fill="${serieHoje.cor}"/>
           <circle cx="${X(cfg.indiceHoje)}" cy="${Y(serieHoje.valores[cfg.indiceHoje])}" r="4.5" fill="${serieHoje.cor}" stroke="var(--superficie)" stroke-width="2"/></g>` : '';

      plot.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
        <defs><clipPath id="${idClip}"><rect x="-12" y="-10" width="${animar ? 0 : w + 24}" height="${h + 20}"/></clipPath>${defs}</defs>
        ${grade}${hoje}${rotX}
        <g clip-path="url(#${idClip})">${caminhos}${aceso}</g>
        <line class="cruz" y1="${m.t}" y2="${h - m.b}" x1="0" x2="0" visibility="hidden"/>
        <g class="destaques"></g>
      </svg>`;

      if (animar) {
        const rect = plot.querySelector(`#${idClip} rect`);
        const t0 = performance.now();
        const passoAnim = (t) => {
          const p = Math.max(0, Math.min(1, (t - t0) / 900));
          rect.setAttribute('width', (w + 24) * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(passoAnim);
        };
        requestAnimationFrame(passoAnim);
      }

      const cruz = plot.querySelector('.cruz');
      const destaques = plot.querySelector('.destaques');
      ligarDica(plot, {
        w, qtd: n,
        xDoIndice: X,
        indicePorX: (x) => Math.max(0, Math.min(n - 1, Math.round(((x - m.l) * (n - 1)) / (w - m.l - m.r)))),
        conteudo: (i) => `<b>${esc(cfg.rotulosLongos ? cfg.rotulosLongos[i] : cfg.rotulos[i])}</b>${cfg.series.filter((s) => s.valores[i] != null).map((s) => linhaDica(s, s.valores[i], cfg.formatar)).join('')}`,
        destacar: (i) => {
          cruz.setAttribute('x1', X(i));
          cruz.setAttribute('x2', X(i));
          cruz.setAttribute('visibility', 'visible');
          destaques.innerHTML = cfg.series.filter((s) => s.valores[i] != null).map((s) => `<circle cx="${X(i)}" cy="${Y(s.valores[i])}" r="4.5" fill="${s.cor}" stroke="var(--superficie)" stroke-width="2"/>`).join('');
        },
        limpar: () => {
          cruz.setAttribute('visibility', 'hidden');
          destaques.innerHTML = '';
        },
      });
    });
  }

  /* ---------- colunas: entradas × saídas ---------- */
  function colunas(el, cfg) {
    montar(el, { ...cfg, bloco: true }, (plot, w, animar) => {
      const h = Math.max(190, Math.min(260, w * 0.48));
      const m = { t: 10, r: 4, b: 24, l: 46 };
      const todos = cfg.series.flatMap((s) => s.valores);
      const ticks = marcas(0, Math.max(0, ...todos));
      const yMax = ticks[ticks.length - 1] || 1;
      const n = cfg.rotulos.length;
      const banda = (w - m.l - m.r) / n;
      const k = cfg.series.length;
      const larg = Math.max(3, Math.min(24, (banda - 6 - (k - 1) * 2) / k));
      const Y = (v) => m.t + ((yMax - v) * (h - m.t - m.b)) / yMax;
      const base = Y(0);
      const passo = Math.max(1, Math.ceil(42 / banda));

      const grade = ticks.map((t) => `<line class="${t === 0 ? 'zero' : 'grade'}" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(eixoReais(t))}</text>`).join('');
      const uid = novoId();
      const efeitos = !cfg.pdf;
      const defs = efeitos ? cfg.series.map((s, j) => degrade(`b${uid}${j}`, s.cor, 1, 0.35)).join('') : '';
      const xBarra = (i, j) => m.l + banda * i + (banda - (k * larg + (k - 1) * 2)) / 2 + j * (larg + 2);

      const barras = cfg.rotulos.map((_, i) => cfg.series.map((s, j) => {
        const v = s.valores[i];
        if (!v) return '';
        const x = xBarra(i, j);
        const y = Y(v);
        const r = Math.min(4, larg / 2, base - y);
        const d = `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + larg - r}Q${x + larg} ${y} ${x + larg} ${y + r}V${base}Z`;
        const previsto = cfg.indiceFuturo != null && i >= cfg.indiceFuturo;
        const classes = [efeitos ? 'brilha-barra' : '', animar ? 'cresce' : ''].filter(Boolean).join(' ');
        const estilo = [efeitos ? `--c:${s.cor}` : '', animar ? `animation-delay:${i * 35}ms` : ''].filter(Boolean).join(';');
        return `<path d="${d}" fill="${efeitos ? `url(#b${uid}${j})` : s.cor}"${previsto ? ' opacity=".45"' : ''}${classes ? ` class="${classes}"` : ''}${estilo ? ` style="${estilo}"` : ''}/>`;
      }).join('')).join('');

      const rotX = cfg.rotulos.map((r, i) => (i % passo === 0 ? `<text x="${m.l + banda * i + banda / 2}" y="${h - 6}" text-anchor="middle">${esc(r)}</text>` : '')).join('');

      plot.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
        <defs>${defs}</defs>
        <rect class="faixa" x="0" y="${m.t}" width="${banda}" height="${h - m.t - m.b}" visibility="hidden"/>
        ${grade}${barras}${rotX}
      </svg>`;

      const faixa = plot.querySelector('.faixa');
      ligarDica(plot, {
        w, qtd: n,
        xDoIndice: (i) => m.l + banda * i + banda / 2,
        indicePorX: (x) => Math.max(0, Math.min(n - 1, Math.floor((x - m.l) / banda))),
        conteudo: (i) => {
          const previsto = cfg.indiceFuturo != null && i >= cfg.indiceFuturo;
          return `<b>${esc(cfg.rotulos[i])}${previsto ? ' (previsto)' : ''}</b>${cfg.series.map((s) => linhaDica(s, s.valores[i], cfg.formatar)).join('')}`;
        },
        destacar: (i) => {
          faixa.setAttribute('x', m.l + banda * i);
          faixa.setAttribute('visibility', 'visible');
        },
        limpar: () => faixa.setAttribute('visibility', 'hidden'),
      });
    });
  }

  /* ---------- faísca: linha do saldo, decorativa, atrás do número principal ---------- */
  function faisca(el, valores, indiceHoje, animar = false) {
    let animarAgora = animar && !semMovimento();
    const pintar = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      const vals = valores.filter((v) => v != null);
      if (!w || !h || vals.length < 2) { el.innerHTML = ''; return; }
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const folga = (max - min) * 0.2 || Math.abs(max) * 0.1 || 1;
      const X = (i) => 4 + (i * (w - 12)) / (valores.length - 1);
      const Y = (v) => 10 + ((max + folga - v) * (h - 20)) / (max - min + 2 * folga);
      const pontos = valores.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
      const corte = indiceHoje == null ? pontos.length - 1 : Math.min(pontos.length - 1, indiceHoje);
      const passado = pontos.slice(0, corte + 1);
      const futuro = pontos.slice(corte);
      const uid = novoId();
      const dPassado = curva(passado);
      const dFuturo = futuro.length > 1 ? curva(futuro) : '';
      const dTudo = curva(pontos);
      const hoje = pontos[corte];
      // Ao abrir: o passado se desenha, a área surge, depois a projeção e o ponto de hoje acendem.
      const a = animarAgora;
      animarAgora = false;
      el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
        <defs>${degrade(`f${uid}`, 'var(--heroi-acento)', 0.32)}</defs>
        <path${a ? ' class="surge" style="--atraso:.5s"' : ''} d="${dTudo}L${pontos[pontos.length - 1][0].toFixed(1)} ${h}L${pontos[0][0].toFixed(1)} ${h}Z" fill="url(#f${uid})"/>
        ${passado.length > 1 ? `<path class="brilha${a ? ' desenha' : ''}" pathLength="1" style="--c:var(--heroi-acento)" d="${dPassado}" fill="none" stroke="var(--heroi-acento)" stroke-width="2.2" stroke-linecap="round"/>` : ''}
        ${dFuturo ? `<path${a ? ' class="surge" style="--atraso:1.15s"' : ''} d="${dFuturo}" fill="none" stroke="var(--heroi-acento)" stroke-width="1.6" stroke-dasharray="5 5" opacity=".7"/>` : ''}
        <g class="aceso${a ? ' surge' : ''}" style="--c:var(--heroi-acento);--atraso:1.05s"><circle class="halo" cx="${hoje[0]}" cy="${hoje[1]}" r="9" fill="var(--heroi-acento)"/>
          <circle cx="${hoje[0]}" cy="${hoje[1]}" r="4" fill="var(--heroi-acento)"/></g>
      </svg>`;
    };
    pintar();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(pintar).observe(el);
  }

  /* ---------- número que sobe ao abrir ---------- */
  function contar(el, valor, formatar, ms = 750) {
    el.textContent = formatar(valor);
    if (semMovimento()) return;
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.max(0, Math.min(1, (t - t0) / ms));
      const atual = p >= 1 ? valor : Math.round(valor * (1 - Math.pow(1 - p, 3)));
      el.textContent = formatar(atual);
      if (p < 1 && el.isConnected) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  /* ---------- gráfico já desenhado vira imagem, para entrar no PDF ---------- */
  const PROPS_IMAGEM = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-size', 'font-weight', 'text-anchor'];

  async function paraImagem(el, escala = 2.5) {
    const svg = el.querySelector('.plot svg');
    const copia = svg.cloneNode(true);
    const originais = [svg, ...svg.querySelectorAll('*')];
    const copias = [copia, ...copia.querySelectorAll('*')];
    originais.forEach((o, i) => {
      const estilo = getComputedStyle(o);
      if (estilo.visibility === 'hidden' || o.getAttribute('visibility') === 'hidden') { copias[i].remove(); return; }
      const texto = PROPS_IMAGEM.map((p) => `${p}:${estilo.getPropertyValue(p)}`).join(';');
      copias[i].setAttribute('style', `${texto};font-family:Helvetica,Arial,sans-serif;animation:none`);
    });
    const [, , largura, altura] = svg.getAttribute('viewBox').split(' ').map(Number);
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', largura);
    copia.setAttribute('height', altura);
    copia.removeAttribute('aria-hidden');
    const imagem = new Image();
    imagem.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copia));
    await imagem.decode();
    const tela = document.createElement('canvas');
    tela.width = Math.round(largura * escala);
    tela.height = Math.round(altura * escala);
    const ctx = tela.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
    return { url: tela.toDataURL('image/png'), largura, altura };
  }

  raiz.Graficos = { linhas, colunas, faisca, contar, paraImagem };
})(globalThis);
