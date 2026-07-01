/* role.js — выбор роли (локализован) */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.role = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('div',{class:'title'}, WS.t('brand')),
      WS.UI.el('button',{class:'icon-btn bare', title:WS.t('settings'), onClick:()=>WS.App.show('settings')},'⚙')
    ));

    const body = WS.UI.el('div',{class:'pad col grow'});
    body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('your_name')));
    const nameInp = WS.UI.el('input',{class:'input', placeholder:WS.t('enter_name'), value:WS.Auth.getDeviceName()});
    body.appendChild(nameInp);
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('div',{class:'spacer'}));

    const roles = [
      { id:'operator', label:WS.t('r_operator'), desc:WS.t('r_operator_d') },
      { id:'chair',    label:WS.t('r_chair'),    desc:WS.t('r_chair_d') },
      { id:'stage',    label:WS.t('r_stage'),    desc:WS.t('r_stage_d'), needStage:true },
      { id:'hymns',    label:WS.t('r_hymns'),    desc:WS.t('r_hymns_d'), needStage:true },
      { id:'programs', label:WS.t('r_programs'), desc:WS.t('r_programs_d') },
    ];

    const btns = [];
    roles.forEach(r => {
      const b = WS.UI.el('button',{class:'btn btn-ghost', style:{flexDirection:'column', alignItems:'flex-start', gap:'2px', padding:'16px', marginBottom:'12px'}, onClick:()=>enter(r)},
        WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold'}}, r.label),
        WS.UI.el('div',{class:'muted', style:{fontSize:'13px'}}, r.desc)
      );
      btns.push(b); body.appendChild(b);
    });

    function syncEnabled(){ const ok = (nameInp.value||'').trim().length > 0; btns.forEach(b => b.disabled = !ok); }
    nameInp.addEventListener('input', () => { WS.Auth.setDeviceName(nameInp.value); syncEnabled(); });
    syncEnabled();

    function enter(r){
      const name = (nameInp.value||'').trim();
      if(!name){ WS.UI.toast(WS.t('enter_name_first'),'error'); nameInp.focus(); return; }
      WS.Auth.setDeviceName(name);
      if(r.needStage && WS.Auth.needStagePassword()){
        WS.UI.askPassword(WS.t('password_for_role', r.label), pw => {
          if(WS.Auth.unlockStage(pw)){ go(r.id); return true; } return false;
        });
        return;
      }
      go(r.id);
    }
    function go(id){ WS.state.role = id; WS.App.show(id); }

    screen.appendChild(body);
    root.appendChild(screen);
  };
})();
