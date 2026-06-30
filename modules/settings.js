/* ============================================================
   settings.js — Настройки. Имя, GitHub-токен, выход. Внизу — админка (только Lime).
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.settings = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'},'Настройки')
    ));

    const body = WS.UI.el('div',{class:'pad scroll grow'});

    // уровень доступа (информативно)
    const lvl = WS.Auth.getLevel();
    const lvlName = { regular:'Обычный', stage:'Сцена', lime:'Lime' }[lvl] || '—';
    body.appendChild(WS.UI.el('div',{class:'card'},
      WS.UI.el('div',{class:'muted', style:{fontSize:'13px'}},'Уровень доступа'),
      WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold'}}, lvlName)
    ));

    // имя
    body.appendChild(WS.UI.el('div',{class:'field-label'},'Имя устройства'));
    const nameInp = WS.UI.el('input',{class:'input', value:WS.Auth.getDeviceName()});
    body.appendChild(nameInp);
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('button',{class:'btn', onClick:()=>{
      WS.Auth.setDeviceName(nameInp.value); WS.UI.toast('Имя сохранено');
    }},'Сохранить имя'));

    // GitHub-токен и репозиторий — ТОЛЬКО Lime (технические/бэкграунд настройки)
    if(WS.Auth.canAdmin()){
      body.appendChild(WS.UI.el('div',{class:'field-label'},'GitHub-токен (для сохранения данных в репозиторий)'));
      const tok = WS.UI.el('input',{class:'input', type:'password', placeholder: WS.Data.getToken() ? '•••••• (сохранён)' : 'ghp_…'});
      body.appendChild(tok);
      body.appendChild(WS.UI.el('div',{class:'spacer'}));
      body.appendChild(WS.UI.el('button',{class:'btn', onClick:()=>{
        if(tok.value.trim()){ WS.Data.setToken(tok.value.trim()); tok.value=''; WS.UI.toast('Токен сохранён'); }
      }},'Сохранить токен'));
      const cfg = WS.Data.ghConfig();
      body.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'12px', marginTop:'6px'}},
        cfg ? ('Репозиторий: ' + cfg.owner + '/' + cfg.repo) : 'Не на GitHub Pages — запись недоступна'));
    }

    // Lime-админка
    if(WS.Auth.canAdmin()){
      body.appendChild(WS.UI.el('div',{class:'field-label'},'Администрирование (только Lime)'));
      body.appendChild(WS.UI.el('button',{class:'btn btn-tan', onClick:()=>{
        WS.App.show('admin');
      }},'Устройства и уровни'));
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'10px'}, onClick:()=>{
        WS.UI.toast('Google Drive и бэкапы — позже');
      }},'Подключить Google Drive'));
    }

    // выход
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('button',{class:'btn btn-danger', onClick:()=>{
      WS.UI.confirm('Выйти? Имя и уровень сбросятся, нужно будет ввести пароль заново.', ()=>{
        WS.Auth.logout(); WS.App.show('pin');
      },'Выйти');
    }},'Выйти'));

    screen.appendChild(body);
    root.appendChild(screen);
  };
})();
