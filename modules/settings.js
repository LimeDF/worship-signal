/* settings.js — Настройки (локализован). Переключатель языка для всех ролей.
   Технические настройки (GitHub-токен/репозиторий) — только Lime. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.settings = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('settings'))
    ));

    const body = WS.UI.el('div',{class:'pad scroll grow'});

    // язык (доступно всем ролям)
    body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('language')));
    const lang = WS.I18n.getLang();
    body.appendChild(WS.UI.el('div',{class:'tabs', style:{padding:'0 0 6px'}},
      WS.UI.el('button',{class:'tab' + (lang==='uk'?' on':''), onClick:()=>setLang('uk')}, WS.t('lang_uk')),
      WS.UI.el('button',{class:'tab' + (lang==='en'?' on':''), onClick:()=>setLang('en')}, WS.t('lang_en'))
    ));

    function setLang(l){ WS.I18n.setLang(l); WS.App.show('settings'); }

    // уровень доступа
    const lvl = WS.Auth.getLevel();
    const lvlName = { regular:WS.t('lvl_regular'), stage:WS.t('lvl_stage'), lime:WS.t('lvl_lime') }[lvl] || '—';
    body.appendChild(WS.UI.el('div',{class:'card', style:{marginTop:'14px'}},
      WS.UI.el('div',{class:'muted', style:{fontSize:'13px'}}, WS.t('access_level')),
      WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold'}}, lvlName)
    ));

    // имя
    body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('device_name')));
    const nameInp = WS.UI.el('input',{class:'input', value:WS.Auth.getDeviceName()});
    body.appendChild(nameInp);
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('button',{class:'btn', onClick:()=>{ WS.Auth.setDeviceName(nameInp.value); WS.UI.toast(WS.t('name_saved')); }}, WS.t('save_name')));

    // технические настройки — только Lime
    if(WS.Auth.canAdmin()){
      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('gh_token')));
      const tok = WS.UI.el('input',{class:'input', type:'password', placeholder: WS.Data.getToken() ? '••••••' : 'ghp_…'});
      body.appendChild(tok);
      body.appendChild(WS.UI.el('div',{class:'spacer'}));
      body.appendChild(WS.UI.el('button',{class:'btn', onClick:()=>{ if(tok.value.trim()){ WS.Data.setToken(tok.value.trim()); tok.value=''; WS.UI.toast(WS.t('token_saved')); } }}, WS.t('save_token')));
      const cfg = WS.Data.ghConfig();
      body.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'12px', marginTop:'6px'}}, cfg ? (WS.t('repo_prefix') + cfg.owner + '/' + cfg.repo) : WS.t('not_gh')));

      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('admin_section')));
      body.appendChild(WS.UI.el('button',{class:'btn btn-tan', onClick:()=>WS.App.show('admin')}, WS.t('devices_levels')));
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'10px'}, onClick:()=>WS.UI.toast(WS.t('drive_soon'))}, WS.t('connect_drive')));
    }

    // выход
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('div',{class:'spacer'}));
    body.appendChild(WS.UI.el('button',{class:'btn btn-danger', onClick:()=>{
      WS.UI.confirm(WS.t('sign_out_q'), ()=>{ WS.Auth.logout(); WS.App.show('pin'); }, WS.t('sign_out'));
    }}, WS.t('sign_out')));

    screen.appendChild(body);
    root.appendChild(screen);
  };
})();
