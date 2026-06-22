/* ============================================================
   Service Worker — Cordão de Contas
   Estratégia: network-first (busca a versão mais nova online,
   usa o cache só quando estiver offline). Assim o app sempre
   carrega atualizado quando há internet, mas continua abrindo
   sem conexão.
   ============================================================ */

const CACHE_NOME = 'cordao-de-contas-v1';
const ARQUIVOS_BASE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalação: guarda os arquivos base no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_BASE))
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((n) => n !== CACHE_NOME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Busca: network-first
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só intercepta GET. Deixa POST/PUT (Firebase, Cloudinary etc) passar direto.
  if (req.method !== 'GET') return;

  // Não interfere em chamadas a outros domínios (Firebase, Cloudinary, fontes).
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((resp) => {
        // Atualiza o cache com a versão nova
        const copia = resp.clone();
        caches.open(CACHE_NOME).then((cache) => cache.put(req, copia)).catch(() => {});
        return resp;
      })
      .catch(() =>
        // Offline: tenta servir do cache; se não tiver, devolve o index
        caches.match(req).then((c) => c || caches.match('./index.html'))
      )
  );
});
