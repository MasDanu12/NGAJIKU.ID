const CACHE='tpq-v1';
const LOKAL=['./','./index.html','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN=['https://cdn.tailwindcss.com','https://cdn.jsdelivr.net/npm/chart.js'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async c=>{
    for(const u of LOKAL){ try{ await c.add(u); }catch(err){} }
    for(const u of CDN){
      try{ const r=await fetch(u,{mode:'no-cors'}); await c.put(u,r); }catch(err){}
    }
  }));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const sama=new URL(e.request.url).origin===location.origin;
  if(sama){
    e.respondWith(
      fetch(e.request).then(r=>{
        const cp=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,cp));
        return r;
      }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
    );
  }else{
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
        const cp=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,cp));
        return res;
      }))
    );
  }
});