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
      body.appendChild(WS.UI.el('button',{class:'btn btn-tan', style:{marginTop:'10px'}, onClick:()=>WS.App.show('schedule')}, WS.t('schedule_title')));

      // --- Google Drive (загрузка файлов + резервные копии) ---
      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('drive_section')));
      body.appendChild(WS.UI.el('div',{class:'field-label', style:{marginTop:0, fontSize:'12px'}}, WS.t('drive_client_id')));
      const cid = WS.UI.el('input',{class:'input', placeholder:'…apps.googleusercontent.com', value:WS.Drive.getClientId()});
      body.appendChild(cid);
      body.appendChild(WS.UI.el('div',{class:'spacer'}));
      body.appendChild(WS.UI.el('div',{class:'btn-row'},
        WS.UI.el('button',{class:'btn btn-ghost', onClick:async()=>{
          const v = cid.value.trim();
          WS.Drive.setClientId(v);
          WS.Sync.send({ t:'config', client_id:v });    // мгновенно разослать на все устройства
          // и сохранить в общий config.json (для тех, кто подключится позже)
          try {
            const items = (WS.Data.items('config') || []).slice();
            if(items.length) items[0] = Object.assign({}, items[0], { drive_client_id:v });
            else items.push({ id:'app', drive_client_id:v });
            WS.UI.toast(WS.t('saving'));
            await WS.Data.save('config', items, 'Set Drive client id');
            WS.UI.toast(WS.t('saved'));
          } catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message||''),'error'); }
        }}, WS.t('save')),
        WS.UI.el('button',{class:'btn', onClick:async()=>{
          if(!WS.Drive.isConfigured()){ WS.UI.toast(WS.t('drive_need_id'),'error'); return; }
          try { await WS.Drive.connect(); WS.UI.toast(WS.t('drive_connected')); }
          catch(e){ WS.UI.toast(WS.t('drive_error', e.message||''),'error'); }
        }}, WS.t('connect_drive'))
      ));

      const lastTs = WS.Drive.lastBackup();
      const lastTxt = lastTs ? daysAgo(lastTs) : WS.t('backup_never');
      const lastLine = WS.UI.el('div',{class:'muted', style:{fontSize:'12px', margin:'10px 0'}}, WS.t('backup_last', lastTxt) + (WS.Drive.backupDue() ? ' · ' + WS.t('backup_due') : ''));
      body.appendChild(lastLine);
      body.appendChild(WS.UI.el('button',{class:'btn', onClick:async()=>{
        if(!WS.Drive.isConfigured()){ WS.UI.toast(WS.t('drive_need_id'),'error'); return; }
        WS.UI.toast(WS.t('backup_running'));
        try { await WS.Drive.backup(); WS.UI.toast(WS.t('backup_done')); WS.App.show('settings'); }
        catch(e){ WS.UI.toast(WS.t('drive_error', e.message||''),'error'); }
      }}, WS.t('backup_now')));
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'10px'}, onClick:()=>{
        WS.UI.confirm(WS.t('restore_confirm'), async()=>{
          WS.UI.toast(WS.t('restore_running'));
          try { await WS.Drive.restoreLatest(); WS.UI.toast(WS.t('restore_done')); }
          catch(e){ WS.UI.toast(e.message==='no_backups' ? WS.t('restore_none') : WS.t('drive_error', e.message||''),'error'); }
        }, WS.t('restore_latest'));
      }}, WS.t('restore_latest')));
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

  function daysAgo(ts){
    const d = Math.floor((Date.now() - ts) / (24 * 3600 * 1000));
    return d <= 0 ? WS.t('today_word') : WS.t('days_ago', d);
  }
})();
