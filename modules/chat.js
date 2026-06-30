/* ============================================================
   chat.js — чат между Оператором и Кафедрой.
   Хранится в localStorage 1 день (старое само-очищается).
   Писать могут: оператор и кафедра. Используется как встраиваемый блок.
   ============================================================ */
(function(){
  const C = {};
  const KEY = 'chat_log';
  let liveListEl = null;   // если открыт UI чата — сюда дорисовываем

  function load(){
    const arr = WS.ls.get(KEY, []) || [];
    const cutoff = Date.now() - WS.config.CHAT_TTL_MS;
    const fresh = arr.filter(m => m.ts >= cutoff);
    if(fresh.length !== arr.length) WS.ls.set(KEY, fresh);
    return fresh;
  }
  function push(m){
    const arr = load();
    arr.push(m);
    WS.ls.set(KEY, arr.slice(-300));
  }

  // приём входящего чата (вызывается глобальным диспетчером в app.js)
  C.receive = function(p){
    const m = { ts:p.ts || Date.now(), from:p._name || '—', dev:p._dev, text:p.text || '' };
    push(m);
    if(liveListEl) appendBubble(liveListEl, m, false);
  };

  function appendBubble(list, m, mine){
    const b = WS.UI.el('div',{class:'chat-msg' + (mine ? ' mine' : '')},
      WS.UI.el('div',{class:'chat-from'}, mine ? 'Вы' : m.from),
      WS.UI.el('div', null, m.text)
    );
    list.appendChild(b);
    list.scrollTop = list.scrollHeight;
  }

  // встраиваемый виджет чата. Возвращает Node. canWrite — можно ли писать.
  C.widget = function(canWrite){
    const wrap = WS.UI.el('div',{class:'col grow'});
    const list = WS.UI.el('div',{class:'chat-list'});
    liveListEl = list;
    const myId = WS.Auth.getDeviceId();
    const msgs = load();
    if(!msgs.length) list.appendChild(WS.UI.el('div',{class:'empty'},'Сообщений пока нет'));
    msgs.forEach(m => appendBubble(list, m, m.dev === myId));
    wrap.appendChild(list);

    if(canWrite){
      const inp = WS.UI.el('input',{class:'input', placeholder:'Сообщение…'});
      const send = () => {
        const text = inp.value.trim(); if(!text) return;
        const m = { ts:Date.now(), from:WS.Auth.getDeviceName(), dev:myId, text };
        push(m);
        // убрать заглушку «пусто»
        const empty = list.querySelector('.empty'); if(empty) empty.remove();
        appendBubble(list, m, true);
        WS.Sync.send({ t:'chat', text, ts:m.ts });
        inp.value = '';
      };
      inp.addEventListener('keydown', e => { if(e.key === 'Enter') send(); });
      const bar = WS.UI.el('div',{class:'chat-bar'},
        inp,
        WS.UI.el('button',{class:'btn', style:{width:'auto', padding:'10px 16px'}, onClick:send}, 'Отпр.')
      );
      wrap.appendChild(bar);
    } else {
      wrap.appendChild(WS.UI.el('div',{class:'banner'},'Только оператор и кафедра могут писать'));
    }
    return wrap;
  };

  // вызывать при уходе с экрана чата
  C.detach = function(){ liveListEl = null; };

  // отдельный полноэкранный экран чата (используется кнопкой-чатом)
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};
  WS.App.screens.chat = function(root, params){
    const back = params.back || 'role';
    const canWrite = (WS.state.role === 'operator' || WS.state.role === 'chair');
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>{ C.detach(); WS.App.show(back); }},'←'),
      WS.UI.el('div',{class:'title'},'Чат')
    ));
    screen.appendChild(C.widget(canWrite));
    root.appendChild(screen);
  };

  WS.Chat = C;
})();
