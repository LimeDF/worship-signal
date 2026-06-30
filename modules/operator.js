/* ============================================================
   operator.js — роль Оператор. Два режима (запоминается на устройстве):
     ОБЫЧНЫЙ      — лог активности (общий, из WS.Log) + чат +
                    кнопки «Трансляция» / «Очистить проектор» / «Очистить лог».
                    Лог виден всегда, даже если зайти позже или перезайти.
     ТРАНСЛЯЦИЯ   — чёрный экран, текст по центру, авто-подгонка, всегда
                    горизонтально. Рисует через WS.Projector — НАДЁЖНО, при
                    каждом обновлении, независимо от навигации.
                    Связь потеряна > 60с → чёрный экран.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let connDot = null;
  let stageEl = null;
  let lostSince = 0, wasLost = false;
  let timers = [];

  function clearTimers(){ timers.forEach(t => clearInterval(t)); timers = []; }
  function mode(){ return WS.ls.get('operator_mode','normal'); }
  function setMode(m){ WS.ls.set('operator_mode', m); WS.App.show('operator'); }

  WS.App.screens.operator = function(root){
    clearTimers();
    if(mode() === 'transmission') renderTransmission(root);
    else renderNormal(root);
  };

  // ---------------- ОБЫЧНЫЙ ----------------
  function renderNormal(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    connDot = WS.UI.el('span',{style:dotStyle(WS.Sync.isLive())});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'},'Оператор'),
      connDot
    ));

    screen.appendChild(WS.UI.el('div',{class:'pad'},
      WS.UI.el('div',{class:'btn-row', style:{marginBottom:'10px'}},
        WS.UI.el('button',{class:'btn', onClick:()=>setMode('transmission')},'⏻ Трансляция'),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{
          WS.Sync.send({ t:'clear' });
          WS.Projector.set({ t:'clear' });                 // локально тоже очистить
          WS.Log.add({ source:'Вы', kind:'signal', label:'Проектор очищен' });
        }},'Очистить проектор')
      )
    ));

    // лог
    const logHead = WS.UI.el('div',{class:'topbar', style:{borderBottom:'1px solid var(--line)', borderTop:'1px solid var(--line)'}},
      WS.UI.el('div',{class:'section-h', style:{padding:0, flex:1}},'Лог активности'),
      WS.UI.el('button',{class:'icon-btn', title:'Очистить лог', onClick:()=>{
        WS.UI.confirm('Очистить лог у всех операторов?', ()=>{ WS.Log.clear(); });
      }},'🗑')
    );
    screen.appendChild(logHead);
    const logWrap = WS.UI.el('div',{class:'activity'});
    screen.appendChild(logWrap);
    renderLog(logWrap);
    WS.Log.onAdd(() => { if(WS.state.screen === 'operator' && mode() === 'normal') renderLog(logWrap); });

    // чат
    screen.appendChild(WS.UI.el('div',{class:'section-h'},'Чат'));
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
    if(!items.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'},'Пока пусто')); return; }
    items.slice().reverse().forEach(a => {
      wrap.appendChild(WS.UI.el('div',{class:'act-item ' + (a.kind || '')},
        WS.UI.el('div', null, a.label),
        WS.UI.el('div',{class:'act-meta'}, a.source + ' · ' + WS.UI.time(a.ts))
      ));
    });
  }

  // ---------------- ТРАНСЛЯЦИЯ ----------------
  function renderTransmission(root){
    const wrap = WS.UI.el('div',{class:'proj-wrap'});
    wrap.appendChild(WS.UI.el('button',{class:'proj-exit', title:'Выход', onClick:()=>setMode('normal')},'×'));
    root.appendChild(wrap);

    function build(){
      Array.from(wrap.querySelectorAll('.proj-stage')).forEach(n => n.remove());
      stageEl = buildStage(wrap);
      stageEl.classList.add('proj-stage');
      paint();
    }

    function paint(){
      if(!stageEl) return;
      // если связь давно потеряна — держим чёрный
      if(wasLost){ WS.UI.clear(stageEl); return; }
      WS.UI.clear(stageEl);
      const d = WS.Projector.current;
      if(!d) return;                         // пусто = чёрный экран

      if(d.t === 'media'){
        if(d.driveId){
          const fr = WS.UI.el('iframe',{class:'proj-iframe', src:'https://drive.google.com/file/d/'+d.driveId+'/preview', allow:'autoplay; fullscreen'});
          fr.style.width = stageEl.style.width; fr.style.height = stageEl.style.height;
          stageEl.appendChild(fr);
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
    WS.Projector.attach(paint);              // ВСЕГДА рисует при обновлении контента

    const onResize = () => build();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    timers.push(setInterval(() => {
      if(WS.Sync.isLive()){ if(wasLost){ wasLost = false; lostSince = 0; paint(); } }
      else { if(!lostSince) lostSince = Date.now(); if(Date.now() - lostSince > WS.config.STALE_MS){ wasLost = true; if(stageEl) WS.UI.clear(stageEl); } }
    }, 3000));

    WS.state._cleanup = () => {
      WS.Projector.detach();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }

  // «сцена» в логическом ландшафте (поворот, если телефон вертикально)
  function buildStage(container){
    const W = window.innerWidth, H = window.innerHeight, portrait = H > W;
    const s = WS.UI.el('div');
    Object.assign(s.style, { position:'absolute', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#000' });
    if(portrait){ s.style.width = H+'px'; s.style.height = W+'px'; s.style.left='50%'; s.style.top='50%'; s.style.transform='translate(-50%,-50%) rotate(90deg)'; }
    else { s.style.width = W+'px'; s.style.height = H+'px'; s.style.left='0'; s.style.top='0'; }
    container.appendChild(s);
    return s;
  }

  function dotStyle(live){ return { width:'12px', height:'12px', borderRadius:'50%', background: live ? '#7bbf5a' : '#b4452f', flex:'none' }; }
})();
