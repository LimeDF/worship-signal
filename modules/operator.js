/* operator.js — роль Оператор (локализован). Лог глобальный, проектор через WS.Projector.
   Wake Lock: в режиме трансляции экран не гаснет. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let connDot = null, stageEl = null, lostSince = 0, wasLost = false, timers = [], wakeLock = null, splashStop = null, lastAutoTarget = 0;

  // показать заставку с обратным отсчётом до начала служіння
  function emitSplash(){
    const cfg = WS.Cfg ? WS.Cfg.get() : {};
    let target = WS.Schedule ? WS.Schedule.nextStart() : null;
    const lead = WS.Schedule ? WS.Schedule.lead() : 15;
    if(!target || target <= Date.now() - 3 * 60000) target = Date.now() + lead * 60000;
    const p = { t:'splash', logo: cfg.splash_drive_id || '', brand: WS.t('brand'), target: target, note: WS.t('splash_note') };
    WS.Sync.send(p); WS.Projector.set(p); WS.UI.toast(WS.t('splash_shown'));
  }

  function clearTimers(){ timers.forEach(t => clearInterval(t)); timers = []; }
  function mode(){ return WS.ls.get('operator_mode','normal'); }
  function setMode(m){ WS.ls.set('operator_mode', m); WS.App.show('operator'); }

  async function requestWake(){ try { if(navigator.wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); } } catch(e){} }
  function releaseWake(){ try { if(wakeLock){ wakeLock.release(); wakeLock = null; } } catch(e){} }

  WS.App.screens.operator = function(root){
    clearTimers();
    if(mode() === 'transmission') renderTransmission(root); else renderNormal(root);
  };

  function blockName(t){ return t==='chorus'?WS.t('chorus'):t==='bridge'?WS.t('bridge'):WS.t('verse'); }

  // ОБЫЧНЫЙ
  function renderNormal(root){
    releaseWake();
    const screen = WS.UI.el('div',{class:'screen app-screen col', style:{height:'100dvh', minHeight:'0', overflow:'hidden'}});
    connDot = WS.UI.el('span',{style:dotStyle(WS.Sync.isLive())});
    screen.appendChild(WS.UI.el('div',{class:'topbar', style:{flex:'none'}},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('operator_title')),
      connDot
    ));

    // ── зона 1: кнопки (слева) + предпросмотр проектора (справа) ──
    const svcBtn = WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'11px'}, onClick:openService}, WS.t('srv_service'));
    const btns = WS.UI.el('div',{style:{display:'flex', flexDirection:'column', gap:'8px', flex:'1 1 0', minWidth:'0'}},
      WS.UI.el('button',{class:'btn', style:{padding:'12px'}, onClick:()=>setMode('transmission')}, WS.t('transmission')),
      WS.UI.el('button',{class:'btn btn-tan', style:{padding:'12px'}, onClick:emitSplash}, WS.t('show_splash')),
      WS.UI.el('div',{class:'btn-row'},
        WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'11px'}, onClick:openMedia}, WS.t('m_media')),
        WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'11px'}, onClick:()=>{ WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' }); }}, WS.t('clear_projector'))
      ),
      svcBtn
    );
    const preview = WS.UI.el('div',{class:'proj-preview', title:WS.t('pp_title')});
    screen.appendChild(WS.UI.el('div',{class:'pad', style:{flex:'none'}},
      WS.UI.el('div',{style:{display:'flex', gap:'10px', alignItems:'stretch'}}, btns, preview)
    ));

    function renderPreview(){
      WS.UI.clear(preview);
      const d = WS.Projector.current;
      if(!d || d.t === 'clear'){ preview.appendChild(WS.UI.el('div',{class:'pp-empty'}, WS.t('pp_empty'))); return; }
      let tag = '', text = '';
      if(d.t === 'block') text = d.text || '';
      else if(d.t === 'text') text = d.body || '';
      else if(d.t === 'bible') text = (d.ref ? d.ref + '\n' : '') + (d.text || '');
      else if(d.t === 'media') tag = '▣ ' + (d.title || WS.t('m_media'));
      else if(d.t === 'splash') tag = WS.t('show_splash');
      else if(d.t === 'qr') tag = 'QR';
      else if(d.t === 'announce_loop'){ const i = WS.Loop ? WS.Loop.index(d) : 0; text = ((d.items || [])[i] || {}).text || ''; }
      preview.appendChild(WS.UI.el('div',{class: tag ? 'pp-tag' : 'pp-text'}, tag || text));
    }
    renderPreview();
    timers.push(setInterval(renderPreview, 1000));

    // активное служіння: подсветить кнопку + собрать ресурсы
    WS.Data.load('services').then(() => { if(WS.Services && WS.Services.active()) svcBtn.classList.add('btn-tan'); }).catch(()=>{});

    function openService(){
      WS.Data.load('services').then(() => {
        const svc = WS.Services ? WS.Services.active() : null;
        if(!svc){ WS.UI.toast(WS.t('srv_no_active')); return; }
        const b = WS.UI.el('div', null);
        b.appendChild(WS.UI.el('div',{class:'muted', style:{marginBottom:'10px', fontSize:'13px'}}, (svc.topic || '') + (svc.preacher ? ('  ·  ' + svc.preacher) : '')));
        if(svc.worship_songs && svc.worship_songs.length){
          b.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'6px 0'}}, WS.t('srv_worship')));
          svc.worship_songs.forEach(r => b.appendChild(WS.UI.el('div',{class:'row', onClick:()=>openSong(r)},
            WS.UI.el('div',{class:'num'}, '#'+(r.number||'')), WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, r.title||'')), WS.UI.el('span',{class:'muted'},'›'))));
        }
        if(svc.scriptures && svc.scriptures.length){
          b.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'10px 0 6px'}}, WS.t('srv_scriptures')));
          svc.scriptures.forEach(sc => b.appendChild(WS.UI.el('div',{class:'row'},
            WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, sc.ref)),
            WS.UI.el('button',{class:'btn btn-tan', style:{flex:'0 0 auto', width:'auto', padding:'8px 12px'}, onClick:()=>sendScr(sc)}, WS.t('bible_to_screen')))));
        }
        if(svc.media && svc.media.length){
          b.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'10px 0 6px'}}, WS.t('m_media')));
          svc.media.forEach(mm => b.appendChild(WS.UI.el('div',{class:'row'},
            WS.UI.el('div',{class:'num'}, ({video:'▶',image:'▣',presentation:'▤'}[mm.type]||'•')),
            WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, mm.title||WS.t('m_media'))),
            WS.UI.el('button',{class:'btn btn-tan', style:{flex:'0 0 auto', width:'auto', padding:'8px 12px'}, onClick:()=>{ if(!mm.drive_id) return; const p={t:'media', mediaType:mm.type||'video', driveId:mm.drive_id, title:mm.title||''}; WS.Sync.send(p); WS.Projector.set(p); WS.UI.toast(WS.t('sent_projector')); }}, WS.t('bible_to_screen')))));
        }
        WS.UI.modal({ title:WS.t('srv_service'), body:b, buttons:[{ label:WS.t('close'), kind:'ghost' }] });
      }).catch(()=>{});
    }
    function openSong(r){
      const item = (WS.Data.items(r.coll)||[]).find(i=>i.id===r.id);
      if(!item){ WS.UI.toast(WS.t('srv_song_missing'),'error'); return; }
      const c = WS.UI.el('div', null);
      WS.Hymns.renderBlocks(c, item, {});
      WS.UI.modal({ title:item.title||'', body:c, buttons:[{ label:WS.t('close'), kind:'ghost' }] });
    }
    function sendScr(sc){
      WS.Bible.getChapter('UBIO', sc.bi, sc.ch).then(arr => {
        const text = WS.Bible.verseText(arr, sc.v);
        const p = { t:'bible', ref: sc.ref, text: text };
        WS.Sync.send(p); WS.Projector.set(p); WS.UI.toast(WS.t('sent_projector'));
      }).catch(()=>{ WS.UI.toast(WS.t('bible_load_fail'),'error'); });
    }

    // быстрый доступ к медіа (завантаженим з будь-якого пристрою) з відправкою на проектор
    function openMedia(){
      WS.Data.load('media').then(() => {
        const items = WS.Data.items('media') || [];
        const body = WS.UI.el('div', null);
        if(!items.length) body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('no_media')));
        items.forEach(it => {
          body.appendChild(WS.UI.el('div',{class:'row'},
            WS.UI.el('div',{class:'num'}, ({video:'▶',image:'▣',presentation:'▤'}[it.type] || '•')),
            WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, it.title || WS.t('untitled')), WS.UI.el('div',{class:'prev'}, 'Drive · ' + (it.type||''))),
            WS.UI.el('button',{class:'btn btn-tan', style:{flex:'0 0 auto', width:'auto', padding:'8px 14px'}, onClick:()=>{ if(!it.drive_id){ WS.UI.toast(WS.t('no_drive_link'),'error'); return; } const p = { t:'media', mediaType:it.type||'video', driveId:it.drive_id, title:it.title||'' }; WS.Sync.send(p); WS.Projector.set(p); WS.UI.toast(WS.t('sent_projector')); }}, WS.t('bible_to_screen'))
          ));
        });
        WS.UI.modal({ title:WS.t('m_media'), body: body, buttons:[{ label:WS.t('close'), kind:'ghost' }] });
      }).catch(()=>{});
    }

    // ── зона 2: лог (фикс. высота ~3 сообщения, свій скрол, не розтягує екран) ──
    const logHead = WS.UI.el('div',{class:'topbar', style:{flex:'none', borderBottom:'1px solid var(--line)', borderTop:'1px solid var(--line)'}},
      WS.UI.el('div',{class:'section-h', style:{padding:0, flex:1}}, WS.t('activity_log')),
      WS.UI.el('button',{class:'icon-btn', title:WS.t('clear_log'), onClick:()=>{ WS.UI.confirm(WS.t('clear_log_q'), ()=>WS.Log.clear()); }},'🗑')
    );
    screen.appendChild(logHead);
    const logWrap = WS.UI.el('div',{class:'activity scroll', style:{flex:'0 0 30vh', minHeight:'0', overflowY:'auto'}});
    screen.appendChild(logWrap);
    renderLog(logWrap);
    WS.Log.onAdd(() => { if(WS.state.screen === 'operator' && mode() === 'normal') renderLog(logWrap); });

    // ── зона 3: чат (заповнює решту, свій скрол) ──
    screen.appendChild(WS.UI.el('div',{class:'section-h', style:{flex:'none'}}, WS.t('chat_section')));
    const chatBox = WS.UI.el('div',{class:'col', style:{flex:'1 1 auto', minHeight:'0', overflow:'hidden', borderTop:'1px solid var(--line)'}});
    chatBox.appendChild(WS.Chat.widget(true));
    screen.appendChild(chatBox);

    root.appendChild(screen);
    timers.push(setInterval(() => { if(connDot) Object.assign(connDot.style, dotStyle(WS.Sync.isLive())); }, 2000));
    WS.state._cleanup = () => { WS.Log.offAdd(); };
  }

  function renderLog(wrap){
    WS.UI.clear(wrap);
    const items = WS.Log.list();
    if(!items.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('empty_log'))); return; }
    items.slice().reverse().forEach(a => {
      wrap.appendChild(WS.UI.el('div',{class:'act-item ' + (a.kind || '')},
        WS.UI.el('div', null, a.label),
        WS.UI.el('div',{class:'act-meta'}, a.source + ' · ' + WS.UI.time(a.ts))
      ));
    });
  }

  // ТРАНСЛЯЦИЯ
  function renderTransmission(root){
    const wrap = WS.UI.el('div',{class:'proj-wrap'});
    wrap.appendChild(WS.UI.el('button',{class:'proj-exit', title:WS.t('close'), onClick:()=>setMode('normal')},'×'));
    root.appendChild(wrap);

    requestWake();   // экран не гаснет

    function build(){
      Array.from(wrap.querySelectorAll('.proj-stage')).forEach(n => n.remove());
      stageEl = buildStage(wrap); stageEl.classList.add('proj-stage'); paint();
    }
    function paint(){
      if(!stageEl) return;
      if(splashStop){ splashStop(); splashStop = null; }
      if(wasLost){ WS.UI.clear(stageEl); return; }
      WS.UI.clear(stageEl);
      const d = WS.Projector.current;
      if(!d) return;
      if(d.t === 'splash'){ const h = WS.Splash.render(stageEl, d); splashStop = h.stop; return; }
      if(d.t === 'announce_loop'){
        splashStop = WS.Loop.watch(d, (i) => {
          WS.UI.clear(stageEl);
          const it = (d.items || [])[i] || {};
          const content = (it.title ? it.title + '\n\n' : '') + (it.text || '');
          const textEl = WS.UI.el('div',{class:'proj-text'}, content);
          stageEl.appendChild(textEl);
          requestAnimationFrame(() => WS.UI.fitText(textEl, stageEl, 16, 240));
        }).stop;
        return;
      }
      if(d.t === 'media'){
        if(d.driveId){
          const fr = WS.UI.el('iframe',{class:'proj-iframe', src:'https://drive.google.com/file/d/'+d.driveId+'/preview', allow:'autoplay; fullscreen'});
          fr.style.width = stageEl.style.width; fr.style.height = stageEl.style.height; stageEl.appendChild(fr);
        }
        return;
      }
      // QR для залу (follow-along)
      if(d.t === 'qr'){
        const box = WS.UI.el('div');
        Object.assign(box.style, { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2vmin', height:'100%' });
        if(WS.Follow && window.qrcode) box.appendChild(WS.Follow.qrEl(d.url, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.5)));
        box.appendChild(WS.UI.el('div',{style:{color:'#fff', fontSize:'3.4vmin', opacity:'0.85', textAlign:'center', padding:'0 4vmin'}}, d.caption || WS.t('qr_scan_hint')));
        stageEl.appendChild(box);
        return;
      }
      // ── Библия: текст (при двух языках — сплит), ссылка тонким шрифтом внизу справа ──
      if(d.t === 'bible'){
        const main = WS.UI.el('div');
        Object.assign(main.style, { position:'absolute', left:'0', top:'0', right:'0', bottom:'0', display:'flex', flexDirection:'column', boxSizing:'border-box', padding:'2% 3% 7% 3%' });
        stageEl.appendChild(main);
        if(d.ref) stageEl.appendChild(WS.UI.el('div',{class:'proj-ref'}, d.ref));
        if(d.bilingual && d.text_en){
          const top = WS.UI.el('div',{class:'proj-half'}); const bot = WS.UI.el('div',{class:'proj-half'});
          const t1 = WS.UI.el('div',{class:'proj-text'}, d.text || ''); const t2 = WS.UI.el('div',{class:'proj-text'}, d.text_en || '');
          top.appendChild(t1); bot.appendChild(t2); main.appendChild(top); main.appendChild(bot);
          requestAnimationFrame(() => { WS.UI.fitText(t1, top, 12, 150); WS.UI.fitText(t2, bot, 12, 150); });
        } else {
          const box = WS.UI.el('div',{class:'proj-half'}); const t = WS.UI.el('div',{class:'proj-text'}, d.text || '');
          box.appendChild(t); main.appendChild(box);
          requestAnimationFrame(() => WS.UI.fitText(t, box, 16, 240));
        }
        return;
      }
      let content = '';
      if(d.t === 'block'){ content = d.text || ''; if(d.showTranslation && d.translation) content += '\n\n' + d.translation; }
      else if(d.t === 'text'){ content = d.body || ''; }
      const textEl = WS.UI.el('div',{class:'proj-text'}, content);
      stageEl.appendChild(textEl);
      requestAnimationFrame(() => WS.UI.fitText(textEl, stageEl, 16, 260));
    }

    build();
    WS.Projector.attach(paint);

    const onResize = () => build();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const onVis = () => { if(!document.hidden){ requestWake(); } };
    document.addEventListener('visibilitychange', onVis);

    timers.push(setInterval(() => {
      if(WS.Sync.isLive()){ if(wasLost){ wasLost = false; lostSince = 0; paint(); } }
      else { if(!lostSince) lostSince = Date.now(); if(Date.now() - lostSince > WS.config.STALE_MS){ wasLost = true; if(stageEl) WS.UI.clear(stageEl); } }
    }, 3000));

    // авто-заставка: за N хв до служіння (за розкладом), якщо проектор порожній
    timers.push(setInterval(() => {
      const d = WS.Projector.current;
      if(d && d.t !== 'clear') return;
      const t = WS.Schedule && WS.Schedule.nextStart();
      if(!t) return;
      const now = Date.now(), lead = (WS.Schedule.lead() || 15) * 60000;
      if(t - now <= lead && t - now > 0 && lastAutoTarget !== t){ lastAutoTarget = t; emitSplash(); }
    }, 30000));

    WS.state._cleanup = () => {
      WS.Projector.detach(); releaseWake();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }

  function buildStage(container){
    const W = window.innerWidth, H = window.innerHeight, portrait = H > W;
    const s = WS.UI.el('div');
    Object.assign(s.style, { position:'absolute', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#000' });
    if(portrait){ s.style.width = H+'px'; s.style.height = W+'px'; s.style.left='50%'; s.style.top='50%'; s.style.transform='translate(-50%,-50%) rotate(90deg)'; }
    else { s.style.width = W+'px'; s.style.height = H+'px'; s.style.left='0'; s.style.top='0'; }
    container.appendChild(s); return s;
  }

  function dotStyle(live){ return { width:'12px', height:'12px', borderRadius:'50%', background: live ? '#7bbf5a' : '#b4452f', flex:'none' }; }
})();
