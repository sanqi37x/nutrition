/*
  每日营养记录 · 离线缓存（Service Worker）

  作用：把应用文件存到手机里，断网也能打开。
  策略：
  - 页面本身：先联网拿最新版（这样改了代码立刻生效），断网时用缓存兜底
  - 图标等其他文件：先用缓存（快），没有才联网

  改代码后不需要手动改这个文件；只有增删「需要离线可用的文件」时，
  才需要把文件名加进下面的 ASSETS 列表，并把 CACHE 的版本号加一。
*/
var CACHE = 'nutrition-v1';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// 安装：把应用文件预先存进缓存
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(ASSETS);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

// 激活：删掉旧版本的缓存
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k !== CACHE;
      }).map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// 取文件
self.addEventListener('fetch', function(e){
  var req = e.request;

  // 只处理 GET，且只处理本站的文件（不碰外部请求）
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;

  // 打开页面的请求：先联网，失败再用缓存
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(hit){
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // 其他静态文件：先缓存，没有再联网
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
