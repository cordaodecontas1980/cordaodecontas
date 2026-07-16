/* ============================================================
   Cordão de Contas — Service Worker
   REDE PRIMEIRO para o app (index.html): sempre tenta a versão
   nova; só usa a cópia salva se estiver sem internet.
   CACHE PRIMEIRO para imagens/ícones: abre rápido.
   ============================================================ */
const VERSAO = 'cdc-v3';   // sobe junto com o APP_VERSAO do index.html
const CACHE  = VERSAO;

self.addEventListener('install', function (e) {
  // não assume o controle sozinho: espera o app avisar (botão "Atualizar")
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(['./', './index.html']).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const nomes = await caches.keys();
    await Promise.all(nomes.map(function (n) { return n === CACHE ? null : caches.delete(n); }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  // Firebase, Cloudinary, Photon, fontes: passam direto, sem cache
  if (url.origin !== self.location.origin) return;

  const ehPagina = req.mode === 'navigate'
    || req.destination === 'document'
    || url.pathname === '/'
    || url.pathname.endsWith('.html');

  if (ehPagina) {
    // ---- REDE PRIMEIRO ----
    e.respondWith((async function () {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.status === 200) {
          const c = await caches.open(CACHE);
          c.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const salvo = await caches.match(req);
        return salvo || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // ---- CACHE PRIMEIRO (imagens, ícones, manifest) ----
  e.respondWith((async function () {
    const salvo = await caches.match(req);
    const rede = fetch(req).then(function (res) {
      if (res && res.status === 200) {
        caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
      }
      return res;
    }).catch(function () { return null; });
    return salvo || (await rede) || Response.error();
  })());
});
