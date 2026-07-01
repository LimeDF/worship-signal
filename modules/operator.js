/* operator.js — роль Оператор (локализован). Лог глобальный, проектор через WS.Projector.
   Wake Lock: в режиме трансляции экран не гаснет. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let connDot = null, stageEl = null, lostSince = 0, wasLost = false, timers = [], wakeLock = null;

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
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    connDot = WS.UI.el('span',{style:dotStyle(WS.Sync.isLive())});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('operator_title')),
      connDot
    ));

    screen.appendChild(WS.UI.el('div',{class:'pad'},
      WS.UI.el('div',{class:'btn-row', style:{marginBottom:'10px'}},
        WS.UI.el('button',{class:'btn', onClick:()=>setMode('transmission')}, WS.t('transmission')),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{
          WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' });
          WS.Log.add({ source:WS.t('you'), kind:'signal', label:WS.t('projector_cleared') });
        }}, WS.t('clear_projector'))
      )
    ));

    const logHead = WS.UI.el('div',{class:'topbar', style:{borderBottom:'1px solid var(--line)', borderTop:'1px solid var(--line)'}},
      WS.UI.el('div',{class:'section-h', style:{padding:0, flex:1}}, WS.t('activity_log')),
      WS.UI.el('button',{class:'icon-btn', title:WS.t('clear_log'), onClick:()=>{ WS.UI.confirm(WS.t('clear_log_q'), ()=>WS.Log.clear()); }},'🗑')
    );
    screen.appendChild(logHead);
    const logWrap = WS.UI.el('div',{class:'activity'});
    screen.appendChild(logWrap);
    renderLog(logWrap);
    WS.Log.onAdd(() => { if(WS.state.screen === 'operator' && mode() === 'normal') renderLog(logWrap); });

    screen.appendChild(WS.UI.el('div',{class:'section-h'}, WS.t('chat_section')));
    const chatBox = WS.UI.el('div',{class:'col', style:{height:'38vh', borderTop:'1px solid var(--line)'}});
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
      if(wasLost){ WS.UI.clear(stageEl); return; }
      WS.UI.clear(stageEl);
      const d = WS.Projector.current;
      if(!d) return;
      if(d.t === 'media'){
        if(d.driveId){
          const fr = WS.UI.el('iframe',{class:'proj-iframe', src:'https://drive.google.com/file/d/'+d.driveId+'/preview', allow:'autoplay; fullscreen'});
          fr.style.width = stageEl.style.width; fr.style.height = stageEl.style.height; stageEl.appendChild(fr);
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
