/* ============================================================
   drive.js — Google Drive: загрузка файлов с устройства + резервные копии.
   Авторизация через Google Identity Services (токен доступа в памяти, ~1ч).
   Область drive.file — приложение видит только созданные им файлы.
   Нужен Google Client ID (задаётся в Настройках, только Lime).
   Прямые вызовы Drive REST через fetch + Bearer — без тяжёлых библиотек.
   ============================================================ */
(function(){
  const D = {};
  const CID_KEY = 'gdrive_client_id';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  let token = null, exp = 0, tc = null;

  D.getClientId = function(){ return WS.ls.get(CID_KEY, '') || ''; };
  D.setClientId = function(v){ WS.ls.set(CID_KEY, (v || '').trim()); token = null; exp = 0; tc = null; };
  D.isConfigured = function(){ return !!D.getClientId(); };

  // подгрузить скрипт Google Identity Services один раз
  function loadGis(){
    return new Promise(function(resolve, reject){
      if(window.google && google.accounts && google.accounts.oauth2){ resolve(); return; }
      let s = document.getElementById('gis-script');
      if(s){ s.addEventListener('load', function(){ resolve(); }); s.addEventListener('error', function(){ reject(new Error('GIS')); }); return; }
      s = document.createElement('script');
      s.id = 'gis-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = function(){ resolve(); }; s.onerror = function(){ reject(new Error('GIS load failed')); };
      document.head.appendChild(s);
    });
  }

  // получить действительный токен (при необходимости — окно согласия Google)
  D.ensureToken = async function(){
    if(token && Date.now() < exp - 60000) return token;
    if(!D.isConfigured()) throw new Error('no_client_id');
    await loadGis();
    return new Promise(function(resolve, reject){
      try {
        tc = google.accounts.oauth2.initTokenClient({
          client_id: D.getClientId(),
          scope: SCOPE,
          callback: function(resp){
            if(resp && resp.access_token){ token = resp.access_token; exp = Date.now() + (resp.expires_in || 3600) * 1000; resolve(token); }
            else reject(new Error('no_token'));
          },
          error_callback: function(err){ reject(new Error((err && err.type) || 'oauth_error')); }
        });
        tc.requestAccessToken({ prompt: token ? '' : 'consent' });
      } catch(e){ reject(e); }
    });
  };

  D.connect = async function(){ await D.ensureToken(); return true; };
  D.isConnected = function(){ return !!token && Date.now() < exp - 60000; };

  // загрузка файла/блоба на Drive → делаем публичным по ссылке → возвращаем fileId
  D.upload = async function(blob, name){
    const t = await D.ensureToken();
    const metadata = { name: name || (blob.name || 'file') };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type:'application/json' }));
    form.append('file', blob, name || blob.name);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method:'POST', headers:{ Authorization:'Bearer ' + t }, body: form
    });
    if(!res.ok) throw new Error('upload_' + res.status);
    const data = await res.json();
    await makePublic(data.id, t);
    return data.id;
  };

  async function makePublic(fileId, t){
    try {
      await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions', {
        method:'POST', headers:{ Authorization:'Bearer ' + t, 'Content-Type':'application/json' },
        body: JSON.stringify({ role:'reader', type:'anyone' })
      });
    } catch(e){}
  }

  // резервная копия всех коллекций (кроме статичной Библии) одним JSON-файлом
  const BACKUP_COLLECTIONS = ['songs','psalms','texts','announcements','media','programs'];
  D.backup = async function(){
    const bundle = { schema:'worship-signal-backup', version:1, created:new Date().toISOString(), data:{} };
    BACKUP_COLLECTIONS.forEach(function(c){ bundle.data[c] = WS.Data.items(c) || []; });
    const name = 'worship-signal-backup-' + new Date().toISOString().slice(0,10) + '.json';
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type:'application/json' });
    const id = await D.upload(blob, name);
    WS.ls.set('last_backup', Date.now());
    return { id, name };
  };

  D.lastBackup = function(){ return WS.ls.get('last_backup', 0) || 0; };
  D.backupDue = function(){ const t = D.lastBackup(); return !t || (Date.now() - t) > 7 * 24 * 3600 * 1000; };

  // список резервных копий на Drive (только созданные приложением)
  D.listBackups = async function(){
    const t = await D.ensureToken();
    const q = encodeURIComponent("name contains 'worship-signal-backup' and trashed=false");
    const res = await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=20', { headers:{ Authorization:'Bearer ' + t } });
    if(!res.ok) throw new Error('list_' + res.status);
    const data = await res.json();
    return data.files || [];
  };

  D.download = async function(fileId){
    const t = await D.ensureToken();
    const res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers:{ Authorization:'Bearer ' + t } });
    if(!res.ok) throw new Error('download_' + res.status);
    return res.json();
  };

  // восстановить из последней копии: перезаписать коллекции в GitHub (нужен токен GitHub у Lime)
  D.restoreLatest = async function(){
    const files = await D.listBackups();
    if(!files.length) throw new Error('no_backups');
    const bundle = await D.download(files[0].id);
    if(!bundle || !bundle.data) throw new Error('bad_backup');
    for(const c of BACKUP_COLLECTIONS){
      if(bundle.data[c]) await WS.Data.save(c, bundle.data[c], 'Restore ' + c + ' from backup');
    }
    return files[0].name;
  };

  WS.Drive = D;
})();
