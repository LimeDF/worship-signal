/* ============================================================
   admin.js — экран «Устройства» (только Lime).
   Список онлайн-устройств. Тап → сменить уровень или заблокировать (3 мин).
   Данные берутся из WS.Presence (realtime через ntfy).
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.admin = function(root){
    if(!WS.Auth.canAdmin()){ WS.UI.denied(); WS.App.show('role'); return; }

    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>{ WS.Presence.clearOnChange(); WS.App.show('settings'); }},'←'),
      WS.UI.el('div',{class:'title'},'Устройства'),
      WS.UI.el('button',{class:'icon-btn', title:'Обновить', onClick:()=>WS.Presence.ping()},'⟳')
    ));
    screen.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', padding:'0 14px 4px'}},
      'Онлайн-устройства. Тап — изменить уровень или заблокировать (на 3 мин).'));

    const listWrap = WS.UI.el('div',{class:'scroll grow pad'});
    screen.appendChild(listWrap);
    root.appendChild(screen);

    function render(){
      WS.UI.clear(listWrap);
      const devs = WS.Presence.list();

      const limeOnline = devs.filter(d => d.online && d.level === 'lime').length;
      if(limeOnline > 1){
        listWrap.appendChild(WS.UI.el('div',{class:'banner', style:{marginBottom:'12px'}},
          'Внимание: онлайн несколько Lime-устройств'));
      }

      if(!devs.length){
        listWrap.appendChild(WS.UI.el('div',{class:'empty'},'Никого онлайн. Нажмите ⟳ для обновления.'));
        return;
      }

      const me = WS.Auth.getDeviceId();
      devs.forEach(d => {
        const isMe = d.id === me;
        const dot = WS.UI.el('span',{style:{width:'10px', height:'10px', borderRadius:'50%', background:d.online?'#7bbf5a':'#777', flex:'none'}});
        listWrap.appendChild(WS.UI.el('div',{class:'row', onClick: isMe ? null : ()=>actions(d)},
          dot,
          WS.UI.el('div',{class:'main'},
            WS.UI.el('div',{class:'ttl'}, d.name + (isMe ? ' (Вы)' : '')),
            WS.UI.el('div',{class:'prev'},
              WS.Presence.levelName(d.level) + (d.role ? ' · ' + roleName(d.role) : '') + (d.online ? '' : ' · оффлайн'))
          ),
          isMe ? null : WS.UI.el('span',{class:'muted'}, '›')
        ));
      });
    }

    function actions(d){
      const body = WS.UI.el('div',{class:'col'});
      const m = WS.UI.modal({ title:d.name, body, buttons:[{ label:'Закрыть', kind:'ghost' }] });

      body.appendChild(WS.UI.el('div',{class:'field-label'},'Изменить уровень'));
      [['regular','Обычный'],['stage','Сцена'],['lime','Lime']].forEach(function(pair){
        const lv = pair[0], label = pair[1], cur = (d.level === lv);
        body.appendChild(WS.UI.el('button',{class:'btn ' + (cur ? '' : 'btn-ghost'), style:{marginBottom:'8px'}, onClick:function(){
          WS.Presence.setLevel(d.id, lv); WS.UI.toast('Команда отправлена: ' + label); m.close();
        }}, label + (cur ? '  ✓' : '')));
      });

      body.appendChild(WS.UI.el('div',{class:'spacer'}));
      body.appendChild(WS.UI.el('button',{class:'btn btn-danger', onClick:function(){
        WS.Presence.block(d.id); WS.UI.toast('Заблокировано на 3 мин'); m.close();
      }},'Заблокировать (3 мин)'));
    }

    WS.Presence.onChange(render);
    render();
    WS.Presence.ping();   // запросить всех при открытии экрана
  };

  function roleName(r){ return { operator:'Оператор', chair:'Кафедра', stage:'Сцена', hymns:'Псалмы' }[r] || r; }
})();
