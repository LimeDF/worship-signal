/* chat.js — общий чат (локализован) */
(function(){
  const C = {};
  const KEY = 'chat_log';
  let liveListEl = null;

  function load(){
    const arr = WS.ls.get(KEY, []) || [];
    const cutoff = Date.now() - WS.config.CHAT_TTL_MS;
    const fresh = arr.filter(m => m.ts >= cutoff);
    if(fresh.length !== arr.length) WS.ls.set(KEY, fresh);
    return fresh;
  }
  function push(m){ const arr = load(); arr.push(m); WS.ls.set(KEY, arr.slice(-300)); }

  C.receive = function(p){
    const m = { ts:p.ts || Date.now(), from:p._name || '—', dev:p._dev, text:p.text || '' };
    push(m);
    if(liveListEl) appendBubble(liveListEl, m, false);
  };

  function appendBubble(list, m, mine){
    const b = WS.UI.el('div',{class:'chat-msg' + (mine ? ' mine' : '')},
      WS.UI.el('div',{class:'chat-from'}, mine ? WS.t('you') : m.from),
      WS.UI.el('div', null, m.text)
    );
    list.appendChild(b); list.scrollTop = list.scrollHeight;
  }

  C.widget = function(canWrite){
    const wrap = WS.UI.el('div',{class:'col grow'});
    const list = WS.UI.el('div',{class:'chat-list'});
    liveListEl = list;
    const myId = WS.Auth.getDeviceId();
    const msgs = load();
    if(!msgs.length) list.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('no_messages')));
    msgs.forEach(m => appendBubble(list, m, m.dev === myId));
    wrap.appendChild(list);

    if(canWrite){
      const inp = WS.UI.el('input',{class:'input', placeholder:WS.t('message_ph')});
      const send = () => {
        const text = inp.value.trim(); if(!text) return;
        const m = { ts:Date.now(), from:WS.Auth.getDeviceName(), dev:myId, text };
        push(m);
        const empty = list.querySelector('.empty'); if(empty) empty.remove();
        appendBubble(list, m, true);
        WS.Sync.send({ t:'chat', text, ts:m.ts });
        inp.value = '';
      };
      inp.addEventListener('keydown', e => { if(e.key === 'Enter') send(); });
      wrap.appendChild(WS.UI.el('div',{class:'chat-bar'}, inp,
        WS.UI.el('button',{class:'btn', style:{width:'auto', padding:'10px 16px'}, onClick:send}, WS.t('send_short'))));
    } else {
      wrap.appendChild(WS.UI.el('div',{class:'banner'}, WS.t('chat_only')));
    }
    return wrap;
  };

  C.detach = function(){ liveListEl = null; };

  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};
  WS.App.screens.chat = function(root, params){
    const back = params.back || 'role';
    const canWrite = (WS.state.role === 'operator' || WS.state.role === 'chair');
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>{ C.detach(); WS.App.show(back); }},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('chat_title'))
    ));
    screen.appendChild(C.widget(canWrite));
    root.appendChild(screen);
  };

  WS.Chat = C;
})();
