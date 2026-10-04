/* 羽球訓練手冊：離線快取 */
const PREFIX = 'badminton-handbook-';
const CACHE = PREFIX + '6d87a6f277cb';
const SHELL = './';
const FILES = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const scope = self.registration.scope;                 // 這個 App 所在的資料夾網址，結尾是 /

/* 有些主機會把 index.html 轉址到資料夾網址。帶著「轉址過」標記的回應不能拿來回應頁面導覽，存進快取前重包一次 */
const clean = res => !res.redirected ? Promise.resolve(res) : res.blob().then(b => {
  const h = new Headers(res.headers);
  h.delete('content-encoding'); h.delete('content-length');      // 內容已經解壓過，這兩個標頭不再適用
  return new Response(b, { status: res.status, statusText: res.statusText, headers: h });
});
const store = (c, key, res) => clean(res).then(r => c.put(key, r));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all([SHELL].concat(FILES).map(u => fetch(new Request(u, { cache: 'reload' })).then(res => {
      if (!res.ok) throw new Error(u + ' ' + res.status);
      return store(c, u, res);
    }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  /* 只清這個 App 自己的舊快取；同一個網域上如果還有別的 App，它們的快取不能動 */
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return;
  const file = req.url.slice(scope.length).split(/[?#]/)[0];
  const shell = file === '' || file === 'index.html';
  if (!shell && !FILES.includes(file)) return;         // 不是這個 App 的檔案：交還給瀏覽器
  const key = shell ? SHELL : file;
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => {
    if (hit) {
      /* 先回快取，背景更新 */
      e.waitUntil(fetch(new Request(key, { cache: 'no-cache' })).then(res => (res.ok ? store(c, key, res) : null)).catch(() => {}));
      return hit;
    }
    return fetch(req).then(res => {
      if (res.ok && res.type === 'basic') store(c, key, res.clone()).catch(() => {});
      return res;
    });
  })));
});
