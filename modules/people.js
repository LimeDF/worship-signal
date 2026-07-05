/* people.js — довідник людей (фото, ім'я, служіння). Редагує Пастор/Lime. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};
  const MIN = ['worship','preaching','media','sound','translation','prayer','other'];
  function minName(m){ return WS.t('min_'+m) || m; }
  function fullName(p){ return ((p.first||'') + ' ' + (p.last||'')).trim() || WS.t('untitled'); }
  function photoUrl(id){ return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w200'; }
  WS.People = { list:function(){ return WS.Data.items('people') || []; }, name:fullName, forMinistry:function(m){ return (WS.Data.items('people')||[]).filter(p=>(p.ministries||[]).indexOf(m)>=0); } };

  WS.App.screens.people = function(root){
    const canEdit = WS.Auth.canPastor();
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('services')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('people_title'))));
    const body = WS.UI.el('div',{class:'scroll grow pad'}); screen.appendChild(body); root.appendChild(screen);

    WS.UI.clear(body); body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('loading')));
    WS.Data.load('people').then(()=>{ if(WS.state.screen==='people') render(); }).catch(()=>{ if(WS.state.screen==='people') render(); });

    function render(){
      WS.UI.clear(body);
      if(canEdit) body.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>edit(null)}, WS.t('person_add')));
      const list = WS.People.list();
      if(!list.length){ body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('people_none'))); return; }
      const grid = WS.UI.el('div',{class:'people-grid'});
      list.forEach(p=>{
        const card = WS.UI.el('div',{class:'person-card', onClick: canEdit?(()=>edit(p)):null});
        const av = WS.UI.el('div',{class:'person-av'});
        if(p.photo){ const img=document.createElement('img'); img.src=photoUrl(p.photo); img.onerror=function(){ img.remove(); av.textContent=(p.first||'?')[0]; }; av.appendChild(img); }
        else av.textContent = (p.first||'?')[0];
        card.appendChild(av);
        card.appendChild(WS.UI.el('div',{class:'person-name'}, fullName(p)));
        card.appendChild(WS.UI.el('div',{class:'person-min'}, (p.ministries||[]).map(minName).join(', ')));
        grid.appendChild(card);
      });
      body.appendChild(grid);
    }

    function edit(existing){
      if(!canEdit) return;
      const m = existing ? JSON.parse(JSON.stringify(existing)) : { id:WS.Data.newId(), first:'', last:'', photo:'', ministries:[] };
      const b = WS.UI.el('div', null);
      b.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('person_first')));
      const f=WS.UI.el('input',{class:'input', value:m.first}); f.addEventListener('input',()=>m.first=f.value); b.appendChild(f);
      b.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('person_last')));
      const l=WS.UI.el('input',{class:'input', value:m.last}); l.addEventListener('input',()=>m.last=l.value); b.appendChild(l);
      b.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('person_photo')));
      const ph=WS.UI.el('input',{class:'input', placeholder:'https://drive.google.com/file/d/…/view', value: m.photo?('https://drive.google.com/file/d/'+m.photo+'/view'):''}); b.appendChild(ph);
      b.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('person_ministries')));
      const chips=WS.UI.el('div',{class:'chips'});
      function drawChips(){ WS.UI.clear(chips); MIN.forEach(mm=>{ const on=(m.ministries||[]).indexOf(mm)>=0; chips.appendChild(WS.UI.el('button',{class:'chip'+(on?' on':''), onClick:()=>{ m.ministries=m.ministries||[]; const i=m.ministries.indexOf(mm); if(i>=0)m.ministries.splice(i,1); else m.ministries.push(mm); drawChips(); }}, minName(mm))); }); }
      drawChips(); b.appendChild(chips);

      function parseId(v){ v=String(v||'').trim(); const mm=v.match(/\/d\/([-\w]{20,})/)||v.match(/[?&]id=([-\w]{20,})/); if(mm) return mm[1]; if(/^[-\w]{20,}$/.test(v)) return v; return ''; }
      const buttons = [
        { label:WS.t('save'), onClick: async ()=>{ m.photo=parseId(ph.value); const items=(WS.Data.items('people')||[]).slice(); const i=items.findIndex(x=>x.id===m.id); if(i>=0)items[i]=m; else items.push(m); WS.UI.toast(WS.t('saving')); try{ await WS.Data.save('people', items, 'Save person'); WS.UI.toast(WS.t('saved')); render(); }catch(e){ WS.UI.toast(WS.t('error_prefix')+(e.message||''),'error'); } } },
        { label:WS.t('close'), kind:'ghost' }
      ];
      if(existing) buttons.splice(1,0,{ label:WS.t('delete'), kind:'ghost', onClick: async ()=>{ const items=(WS.Data.items('people')||[]).filter(x=>x.id!==m.id); try{ await WS.Data.save('people', items, 'Delete person'); render(); }catch(e){} } });
      WS.UI.modal({ title:WS.t('person_add'), body:b, buttons:buttons });
    }
  };
})();
