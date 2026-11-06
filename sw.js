/* Finanças G&L — permite abrir o app sem internet. Nunca toca nas chamadas à planilha. */
const VERSAO = 'financasgl-v2';
const ARQUIVOS = [
  './', 'index.html', 'estilo.css', 'tema.js', 'logica.js', 'sincronia.js', 'graficos.js', 'app.js',
  'pdf.js', 'vendor/jspdf.umd.min.js', 'manifest.webmanifest', 'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(e.request).then((salvo) => salvo || fetch(e.request).then((r) => {
      const copia = r.clone();
      caches.open(VERSAO).then((c) => c.put(e.request, copia));
      return r;
    })));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Com internet, sempre a versão mais nova; sem internet, a última guardada.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((salvo) => {
        if (salvo) return salvo;
        if (e.request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      }))
  );
});
