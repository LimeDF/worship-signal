/* ============================================================
   data.js — слой данных. JSON-файлы в репозитории = «база».
   Читает через GitHub API (свежо) с фоллбеком на raw + кэш в localStorage.
   Пишет через Contents API (нужен токен в Настройках).

   Коллекции → файлы data/<name>.json, форма { schema_version, <key>:[...] }:
     songs, psalms       → ключ "items"
     texts               → ключ "items"
     announcements       → ключ "items"
     bible               → ключ "books"
     media               → ключ "items"
   ============================================================ */
(function(){
  const GH_API = 'https://api.github.com';
  const RAW = 'https://raw.githubusercontent.com';

  const KEY = { songs:'items', psalms:'items', texts:'items', announcements:'items', bible:'books', media:'items' };

  function utf8_to_b64(str){ return btoa(unescape(encodeURIComponent(str))); }
  function b64_to_utf8(b64){ return decodeURIComponent(escape(atob(String(b64).replace(/\s/g,'')))); }

  function ghConfig(){
    const host = location.hostname;                 // напр. limedf.github.io
    if(!host.endsWith('.github.io')) return null;
    const owner = host.replace('.github.io','');
    const parts = location.pathname.split('/').filter(p => p && !/\.html?$/i.test(p));
    const repo = parts.length ? parts[0] : (owner + '.github.io');
    return { owner, repo, branch:'main' };
  }

  const D = {};
  D.key = function(name){ return KEY[name] || 'items'; };
  D.getToken = function(){ return WS.ls.get('gh_token','') || ''; };
  D.setToken = function(t){ WS.ls.set('gh_token', String(t||'').trim()); };
  D.ghConfig = ghConfig;

  // путь к файлу в репозитории
  function filePath(name){ return WS.config.DATA_DIR + '/' + name + '.json'; }

  // свежее чтение через API (минует CDN-кэш). Возвращает {json, sha}
  async function fetchApi(name){
    const cfg = ghConfig(); if(!cfg) throw new Error('not gh pages');
    const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath(name)}?ref=${cfg.branch}`;
    const headers = { 'Accept':'application/vnd.github.v3+json' };
    const tok = D.getToken(); if(tok) headers.Authorization = 'token ' + tok;
    const res = await fetch(url, { headers, cache:'no-store' });
    if(!res.ok) throw new Error('api ' + res.status);
    const data = await res.json();
    return { json: JSON.parse(b64_to_utf8(data.content)), sha: data.sha };
  }
  // запасное чтение через raw (может быть закэшировано ~5 мин)
  async function fetchRaw(name){
    const cfg = ghConfig();
    let url;
    if(cfg) url = `${RAW}/${cfg.owner}/${cfg.repo}/${cfg.branch}/${filePath(name)}?t=${Date.now()}`;
    else    url = `${filePath(name)}?t=${Date.now()}`;   // относительный путь (локально)
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('raw ' + res.status);
    return await res.json();
  }

  function cacheKey(name){ return 'cache_' + name; }
  D.getCached = function(name){
    const c = WS.ls.get(cacheKey(name), null);
    return c && Array.isArray(c[D.key(name)]) ? c : null;
  };

  // загрузка коллекции: API → raw → кэш. Кладёт результат в кэш. Возвращает массив элементов.
  D.load = async function(name){
    let json = null;
    try { json = (await fetchApi(name)).json; } catch(e){}
    if(!json){ try { json = await fetchRaw(name); } catch(e){} }
    if(json && Array.isArray(json[D.key(name)])){
      WS.ls.set(cacheKey(name), json);
      return json[D.key(name)];
    }
    const cached = D.getCached(name);
    return cached ? cached[D.key(name)] : [];
  };

  // быстрый доступ из кэша (без сети)
  D.items = function(name){
    const c = D.getCached(name);
    return c ? c[D.key(name)] : [];
  };

  // запись коллекции целиком. items — массив. Требует токен. Шлёт data-broadcast.
  D.save = async function(name, items, message){
    const cfg = ghConfig(); if(!cfg) throw new Error('Не на GitHub Pages — запись недоступна');
    const tok = D.getToken();
    if(!tok){ WS.UI.toast('Нужен GitHub-токен (Настройки)','error'); throw new Error('no token'); }

    // свежий sha
    let sha = null;
    try { sha = (await fetchApi(name)).sha; } catch(e){ /* файла может не быть */ }

    const full = { schema_version:1 };
    full[D.key(name)] = items;

    const body = {
      message: (message || ('Update ' + name)).replace(/[\r\n]+/g,' ').slice(0,100),
      content: utf8_to_b64(JSON.stringify(full, null, 2)),
      branch: cfg.branch
    };
    if(sha) body.sha = sha;

    const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath(name)}`;
    const doPut = () => fetch(url, {
      method:'PUT',
      headers:{ Authorization:'token '+tok, 'Accept':'application/vnd.github.v3+json', 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    let res = await doPut();
    if(res.status === 409 || res.status === 422){
      // устаревший sha (кто-то сохранил параллельно) — берём свежий и повторяем один раз
      try { sha = (await fetchApi(name)).sha; } catch(e){ sha = null; }
      if(sha) body.sha = sha; else delete body.sha;
      res = await doPut();
    }
    if(!res.ok){ const t = await res.text(); throw new Error('PUT ' + res.status + ': ' + t.slice(0,120)); }

    WS.ls.set(cacheKey(name), full);          // обновляем кэш
    WS.Sync.send({ t:'data', collection:name }); // оповещаем другие устройства
    return true;
  };

  // обновление кэша по data-broadcast (другое устройство изменило коллекцию)
  D.refresh = async function(name){
    try { return await D.load(name); } catch(e){ return D.items(name); }
  };

  D.newId = function(){ return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); };

  WS.Data = D;
})();
