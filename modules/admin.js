/* admin.js — экран «Устройства» (Lime), локализован */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.admin = function(root){
    if(!WS.Auth.canAdmin()){ WS.UI.denied(); WS.App.show('role'); return; }

    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>{ WS.Presence.clearOnChange(); WS.App.show('settings'); }},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('devices_title')),
      WS.UI.el('button',{class:'icon-btn', title:WS.t('refresh'), onClick:()=>WS.Presence.ping()},'⟳')
    ));
    screen.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', padding:'0 14px 4px'}}, WS.t('admin_hint')));

    const listWrap = WS.UI.el('div',{class:'scroll grow pad'});
    screen.appendChild(listWrap);
    root.appendChild(screen);

    function render(){
      WS.UI.clear(listWrap);
      const devs = WS.Presence.list();
      const limeOnline = devs.filter(d => d.online && d.level === 'lime').length;
      if(limeOnline > 1) listWrap.appendChild(WS.UI.el('div',{class:'banner', style:{marginBottom:'12px'}}, WS.t('multi_lime')));
      if(!devs.length){ listWrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('nobody_online'))); return; }

      const me = WS.Auth.getDeviceId();
      devs.forEach(d => {
        const isMe = d.id === me;
        const dot = WS.UI.el('span',{style:{width:'10px', height:'10px', borderRadius:'50%', background:d.online?'#7bbf5a':'#777', flex:'none'}});
        listWrap.appendChild(WS.UI.el('div',{class:'row', onClick: isMe ? null : ()=>actions(d)},
          dot,
          WS.UI.el('div',{class:'main'},
            WS.UI.el('div',{class:'ttl'}, d.name + (isMe ? WS.t('you_suffix') : '')),
            WS.UI.el('div',{class:'prev'}, levelName(d.level) + (d.role ? ' · ' + roleName(d.role) : '') + (d.online ? '' : ' · ' + WS.t('offline')))
          ),
          isMe ? null : WS.UI.el('span',{class:'muted'}, '›')
        ));
      });
    }

    function actions(d){
      const body = WS.UI.el('div',{class:'col'});
      const m = WS.UI.modal({ title:d.name, body, buttons:[{ label:WS.t('close'), kind:'ghost' }] });
      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('change_level')));
      [['regular',WS.t('lvl_regular')],['stage',WS.t('lvl_stage')],['lime',WS.t('lvl_lime')]].forEach(function(pair){
        const lv = pair[0], label = pair[1], cur = (d.level === lv);
        body.appendChild(WS.UI.el('button',{class:'btn ' + (cur ? '' : 'btn-ghost'), style:{marginBottom:'8px'}, onClick:function(){
          WS.Presence.setLevel(d.id, lv); WS.UI.toast(WS.t('command_sent', label)); m.close();
        }}, label + (cur ? '  ✓' : '')));
      });
      body.appendChild(WS.UI.el('div',{class:'spacer'}));
      body.appendChild(WS.UI.el('button',{class:'btn btn-danger', onClick:function(){
        WS.Presence.block(d.id); WS.UI.toast(WS.t('blocked_3min')); m.close();
      }}, WS.t('block_btn')));
    }

    WS.Presence.onChange(render);
    render();
    WS.Presence.ping();
  };

  function levelName(l){ return { regular:WS.t('lvl_regular'), stage:WS.t('lvl_stage'), lime:WS.t('lvl_lime') }[l] || '—'; }
  function roleName(r){ return { operator:WS.t('r_operator'), chair:WS.t('r_chair'), stage:WS.t('r_stage'), hymns:WS.t('r_hymns') }[r] || r; }
})();
