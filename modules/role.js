/* ============================================================
   role.js — экран выбора роли. Сверху имя (обязательно), ниже 4 роли.
   Шестерёнка настроек в углу. Stage/Hymns требуют пароль OPERATOR (раз в сутки).
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.role = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    // шапка с шестерёнкой
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('div',{class:'title'},'Worship Signal'),
      WS.UI.el('button',{class:'icon-btn bare', title:'Настройки', onClick:()=>WS.App.show('settings')},'⚙')
    ));

    const body = WS.UI.el('div',{class:'pad col grow'});

    // имя устройства
    body.appendChild(WS.UI.el('div',{class:'field-label'},'Ваше имя'));
    const nameInp = WS.UI.el('input',{class:'input', placeholder:'Введите имя', value:WS.Auth.getDeviceName()});
    body.appendChild(nameInp);
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('div',{class:'spacer'}));

    const roles = [
      { id:'operator', label:'Оператор',      desc:'Приём сообщений и трансляция' },
      { id:'chair',    label:'Кафедра',        desc:'Медиа · Текст · Объявления · Библия' },
      { id:'stage',    label:'Сцена',          desc:'Управление · повтор/далее', needStage:true },
      { id:'hymns',    label:'Псалмы / Песни', desc:'Списки и редактор',          needStage:true },
      { id:'programs', label:'Программы',       desc:'Сценарии служения' },
    ];

    const btns = [];
    roles.forEach(r => {
      const b = WS.UI.el('button',{class:'btn btn-ghost', style:{flexDirection:'column', alignItems:'flex-start', gap:'2px', padding:'16px', marginBottom:'12px'}, onClick:()=>enter(r)},
        WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold'}}, r.label),
        WS.UI.el('div',{class:'muted', style:{fontSize:'13px'}}, r.desc)
      );
      btns.push(b);
      body.appendChild(b);
    });

    function syncEnabled(){
      const ok = (nameInp.value||"").trim().length > 0;
      btns.forEach(b => b.disabled = !ok);
    }
    nameInp.addEventListener('input', () => { WS.Auth.setDeviceName(nameInp.value); syncEnabled(); });
    syncEnabled();

    function enter(r){
      const name = (nameInp.value||"").trim();
      if(!name){ WS.UI.toast('Сначала введите имя','error'); nameInp.focus(); return; }
      WS.Auth.setDeviceName(name);

      if(r.needStage && WS.Auth.needStagePassword()){
        WS.UI.askPassword('Пароль для роли «' + r.label + '»', pw => {
          if(WS.Auth.unlockStage(pw)){ go(r.id); return true; }
          return false;
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
