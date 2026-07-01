/* pin.js — экран входа (локализован) */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.pin = function(root){
    const screen = WS.UI.el('div',{class:'screen sys-screen col center pad'});
    const locked = WS.Auth.isLocked();
    const label = WS.UI.el('div',{style:{color:'var(--bone)', marginBottom:'18px', fontSize:'18px', textAlign:'center'}},
      locked ? WS.t('device_locked', WS.Auth.lockRemainingSec()) : WS.t('enter_password'));

    const inp = WS.UI.el('input',{class:'sys-input', type:'password', inputmode:'text',
      placeholder:'••••', autocomplete:'off', autocapitalize:'off', spellcheck:'false'});
    if(locked) inp.disabled = true;

    const fail = () => { inp.classList.add('shake-red'); inp.value=''; setTimeout(()=>inp.classList.remove('shake-red'),450); };
    const submit = () => {
      if(WS.Auth.isLocked()){ fail(); return; }
      const r = WS.Auth.login(inp.value);
      if(r.ok) WS.App.show('role'); else fail();
    };
    inp.addEventListener('keydown', e => { if(e.key === 'Enter') submit(); });

    screen.appendChild(label);
    screen.appendChild(inp);
    screen.appendChild(WS.UI.el('div',{class:'spacer'}));
    screen.appendChild(WS.UI.el('button',{class:'btn', style:{maxWidth:'320px'}, onClick:submit}, WS.t('login_btn')));
    root.appendChild(screen);
    setTimeout(()=>{ if(!locked) inp.focus(); }, 150);

    if(locked){
      const tick = setInterval(()=>{
        if(!WS.Auth.isLocked()){ clearInterval(tick); WS.App.show('pin'); }
        else label.textContent = WS.t('device_locked', WS.Auth.lockRemainingSec());
      }, 1000);
    }
  };
})();
