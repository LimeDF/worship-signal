/* ============================================================
   ui.js — общие UI-помощники: el(), тосты, модалки, авто-подгонка текста.
   ============================================================ */
(function(){
  const U = {};

  // мини-конструктор DOM: el('div',{class:'x', onClick:fn}, child, child...)
  U.el = function(tag, props){
    const n = document.createElement(tag);
    if(props){
      for(const k in props){
        const v = props[k];
        if(v == null || v === false) continue;
        if(k === 'class') n.className = v;
        else if(k === 'html') n.innerHTML = v;
        else if(k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, v);
      }
    }
    for(let i = 2; i < arguments.length; i++){
      const kids = Array.isArray(arguments[i]) ? arguments[i] : [arguments[i]];
      kids.forEach(c => {
        if(c == null || c === false) return;
        n.appendChild((typeof c === 'string' || typeof c === 'number') ? document.createTextNode(String(c)) : c);
      });
    }
    return n;
  };

  U.clear = function(node){ while(node && node.firstChild) node.removeChild(node.firstChild); };
  U.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };

  // тост
  U.toast = function(msg, type){
    let box = document.getElementById('toasts');
    if(!box){ box = U.el('div',{id:'toasts'}); document.body.appendChild(box); }
    const t = U.el('div',{class:'toast' + (type === 'error' ? ' error' : '')}, msg);
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2200);
  };
  U.denied = function(){ U.toast(WS.t('denied'), 'error'); };

  // модалка: U.modal({ title, body:Node|string, buttons:[{label,kind,onClick,close}] })
  U.modal = function(opts){
    const overlay = U.el('div',{class:'overlay'});
    const close = () => overlay.remove();
    const card = U.el('div',{class:'modal'});
    if(opts.title) card.appendChild(U.el('h3', null, opts.title));
    const body = U.el('div',{class:'modal-body'});
    if(typeof opts.body === 'string') body.appendChild(document.createTextNode(opts.body));
    else if(opts.body) body.appendChild(opts.body);
    card.appendChild(body);
    if(opts.buttons && opts.buttons.length){
      const row = U.el('div',{class:'btn-row'});
      opts.buttons.forEach(b => {
        row.appendChild(U.el('button',{
          class:'btn ' + (b.kind === 'ghost' ? 'btn-ghost' : b.kind === 'danger' ? 'btn-danger' : b.kind === 'tan' ? 'btn-tan' : ''),
          onClick: () => { let keep = false; if(b.onClick) keep = b.onClick(); if(b.close !== false && !keep) close(); }
        }, b.label));
      });
      card.appendChild(row);
    }
    overlay.appendChild(card);
    overlay.addEventListener('click', e => { if(e.target === overlay && opts.dismissable !== false) close(); });
    document.body.appendChild(overlay);
    return { close };
  };

  U.confirm = function(msg, onYes, yesLabel){
    U.modal({ title:WS.t('confirm_title'), body:msg, buttons:[
      { label:WS.t('cancel'), kind:'ghost' },
      { label:yesLabel || WS.t('yes'), kind:'danger', onClick:onYes }
    ]});
  };

  // запрос пароля (системный café-стиль внутри модалки)
  U.askPassword = function(title, onSubmit){
    const inp = U.el('input',{class:'sys-input', type:'password', inputmode:'text', placeholder:'••••', autocomplete:'off'});
    inp.style.maxWidth = '100%';
    const m = U.modal({ title, body:inp, buttons:[
      { label:'Отмена', kind:'ghost' },
      { label:'OK', onClick: () => {
          const ok = onSubmit(inp.value);
          if(!ok){ inp.classList.add('err'); inp.value=''; setTimeout(()=>inp.classList.remove('err'),1500); return true; } // keep open
        } }
    ]});
    setTimeout(() => inp.focus(), 100);
    inp.addEventListener('keydown', e => { if(e.key==='Enter'){ const ok=onSubmit(inp.value); if(ok) m.close(); else { inp.classList.add('err'); inp.value=''; setTimeout(()=>inp.classList.remove('err'),1500);} } });
    return m;
  };

  // авто-подгонка размера шрифта чтобы текст влез в контейнер (бинарный поиск)
  U.fitText = function(textEl, container, min, max){
    min = min || 14; max = max || 240;
    const aH = container.clientHeight, aW = container.clientWidth;
    if(aH <= 0 || aW <= 0) return;
    let lo = min, hi = max, best = min;
    while(lo <= hi){
      const mid = (lo + hi) >> 1;
      textEl.style.fontSize = mid + 'px';
      if(textEl.scrollHeight <= aH && textEl.scrollWidth <= aW){ best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    textEl.style.fontSize = best + 'px';
  };

  // короткий предпросмотр первой строки блока
  U.preview = function(text, n){
    const s = String(text || '').replace(/\s+/g,' ').trim();
    n = n || 60;
    return s.length > n ? s.slice(0, n) + '…' : s;
  };

  U.time = function(ts){
    const d = new Date(ts || Date.now());
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  };

  WS.UI = U;
})();
