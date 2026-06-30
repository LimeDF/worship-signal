/* ============================================================
   operator.js — роль Оператор. Два режима (запоминается на устройстве):
     ОБЫЧНЫЙ      — лента активности + чат + кнопки «Трансляция» / «Очистить».
                    Библия и сигналы приходят сюда как сообщения.
     ТРАНСЛЯЦИЯ   — чёрный экран, белый текст по центру, авто-подгонка,
                    всегда горизонтально, крошечный × в углу.
                    Показывает только блоки/тексты/медиа. Чат — никогда.
                    Связь потеряна > 60с → чёрный экран.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let activity = [];          // лента (только текущая сессия)
  let connDot = null;         // индикатор связи
  let stageEl = null;         // контейнер трансляции (для авто-fit)
  let textEl = null;
  let lostSince = 0;
  let timers = [];

  function clearTimers(){ timers.forEach(t=>clearInterval(t)); timers = []; }
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

    // кнопки управления
    screen.appendChild(WS.UI.el('div',{class:'pad'},
      WS.UI.el('div',{class:'btn-row'},
        WS.UI.el('button',{class:'btn', onClick:()=>setMode('transmission')},'⏻ Трансляция'),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{
          WS.Sync.send({ t:'clear' }); WS.state.lastDisplay=null;
          addActivity({ source:'Вы', kind:'signal', label:'Проектор очищен' });
        }},'Очистить проектор')
      )
    ));

    // секция активности
    const actWrap = WS.UI.el('div',{class:'activity'});
    screen.appendChild(WS.UI.el('div',{class:'section-h'},'Активность'));
    screen.appendChild(actWrap);
    renderActivity(actWrap);

    // секция чата (только чтение/запись — оператор может писать)
    screen.appendChild(WS.UI.el('div',{class:'section-h'},'Чат'));
    const chatBox = WS.UI.el('div',{class:'col', style:{height:'40vh', borderTop:'1px solid var(--line)'}});
    chatBox.appendChild(WS.Chat.widget(true));
    screen.appendChild(chatBox);

    root.appendChild(screen);

    // обработчик входящих
    WS.state.onMessage = function(p){
      if(p.t === 'block'){ addActivity({ source:srcName(p), kind:'block', label:'#'+(p.number||'')+' '+(p.title||'')+' — '+blockName(p.blockType) }); }
      else if(p.t === 'text'){ addActivity({ source:srcName(p), kind:'block', label:'Текст: '+WS.UI.preview(p.body,40) }); }
      else if(p.t === 'media'){ addActivity({ source:srcName(p), kind:'block', label:'Медиа: '+(p.title||'') }); }
      else if(p.t === 'signal'){ addActivity({ source:srcName(p), kind:'signal', label:'Сигнал: '+signalName(p.action) }); }
      else if(p.t === 'activity' && p.kind === 'bible'){ addActivity({ source:srcName(p), kind:'bible', label:'Библия: '+p.label }); }
      else if(p.t === 'clear'){ addActivity({ source:srcName(p), kind:'signal', label:'Проектор очищен' }); }
      if(WS.state.screen==='operator' && mode()==='normal') renderActivity(actWrap);
    };

    // индикатор связи
    timers.push(setInterval(()=>{ if(connDot) Object.assign(connDot.style, dotStyle(WS.Sync.isLive())); }, 2000));
  }

  function renderActivity(wrap){
    WS.UI.clear(wrap);
    if(!activity.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'},'Пока тихо')); return; }
    activity.slice().reverse().forEach(a => {
      wrap.appendChild(WS.UI.el('div',{class:'act-item '+(a.kind||'')},
        WS.UI.el('div', null, a.label),
        WS.UI.el('div',{class:'act-meta'}, a.source + ' · ' + WS.UI.time(a.ts))
      ));
    });
  }
  function addActivity(a){ a.ts = Date.now(); activity.push(a); if(activity.length>200) activity = activity.slice(-200); }

  // ---------------- ТРАНСЛЯЦИЯ ----------------
  function renderTransmission(root){
    const wrap = WS.UI.el('div',{class:'proj-wrap'});
    // кнопка выхода
    wrap.appendChild(WS.UI.el('button',{class:'proj-exit', title:'Выход', onClick:()=>setMode('normal')},'×'));
    root.appendChild(wrap);

    function build(){
      // убрать прошлый stage
      Array.from(wrap.querySelectorAll('.proj-stage')).forEach(n=>n.remove());
      stageEl = buildStage(wrap);
      stageEl.classList.add('proj-stage');
      paint();
    }
    build();

    WS.state.onMessage = function(p){
      if(p.t==='block' || p.t==='text' || p.t==='media' || p.t==='clear'){ paint(); }
      // сигналы/библия/чат — на трансляции не показываем
    };

    // перестроение при повороте/ресайзе
    const onResize = () => build();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    timers.push(setInterval(()=>{
      // контроль связи: нет соединения > 60с → чёрный экран
      if(WS.Sync.isLive()){ lostSince = 0; }
      else { if(!lostSince) lostSince = Date.now(); if(Date.now()-lostSince > WS.config.STALE_MS) showBlack(); }
    }, 3000));
    // при уходе с экрана снять слушатели
    WS.state._cleanup = () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }

  function paint(){
    if(!stageEl) return;
    WS.UI.clear(stageEl);
    const d = WS.state.lastDisplay;
    if(!d){ return; } // пусто = чёрный экран

    if(d.t === 'media'){
      if(d.driveId){
        const src = 'https://drive.google.com/file/d/' + d.driveId + '/preview';
        const fr = WS.UI.el('iframe',{class:'proj-iframe', src, allow:'autoplay; fullscreen'});
        fr.style.width = stageEl.style.width; fr.style.height = stageEl.style.height;
        stageEl.appendChild(fr);
      }
      return;
    }

    // block / text → текст по центру с авто-подгонкой
    let content = '';
    if(d.t === 'block'){
      content = d.text || '';
      if(d.showTranslation && d.translation) content += '\n\n' + d.translation;
    } else if(d.t === 'text'){
      content = d.body || '';
    }
    textEl = WS.UI.el('div',{class:'proj-text'}, content);
    stageEl.appendChild(textEl);
    requestAnimationFrame(()=> WS.UI.fitText(textEl, stageEl, 16, 260));
  }

  function showBlack(){ if(stageEl) WS.UI.clear(stageEl); }

  // построить «сцену» в логическом ландшафте (повернуть если телефон вертикально)
  function buildStage(container){
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W;
    const s = WS.UI.el('div');
    s.style.position='absolute'; s.style.display='flex'; s.style.alignItems='center'; s.style.justifyContent='center'; s.style.overflow='hidden'; s.style.background='#000';
    if(portrait){
      s.style.width = H+'px'; s.style.height = W+'px';
      s.style.left='50%'; s.style.top='50%';
      s.style.transform='translate(-50%,-50%) rotate(90deg)';
    } else {
      s.style.width = W+'px'; s.style.height = H+'px';
      s.style.left='0'; s.style.top='0';
    }
    container.appendChild(s);
    return s;
  }

  // утилиты
  function srcName(p){ return p._name || '—'; }
  function blockName(t){ return t==='chorus'?'Припев':t==='bridge'?'Бридж':'Куплет'; }
  function signalName(a){ return {repeat:'Повтор',next:'Далее',prev:'Назад',exit:'Стоп'}[a]||a; }
  function dotStyle(live){ return { width:'12px', height:'12px', borderRadius:'50%', background: live?'#7bbf5a':'#b4452f', flex:'none' }; }
})();
