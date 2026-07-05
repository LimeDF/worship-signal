/* services.js — Розклад служінь: календар, редактор (місце/ведучі/пісні/писання/медіа), активація. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};
  const P = ['own','other','basement','pavilion','custom'];
  const TYPES = [
    { id:'service', color:'#4a7a3a' },   // зелений — служіння
    { id:'prayer',  color:'#c9a227' },   // жовтий — молитва
    { id:'rest',    color:'#7a5aa8' },   // фіолетовий — відпочинок/пікнік
    { id:'event',   color:'#3a6ea8' },   // синій — резерв
    { id:'other',   color:'#b0682f' }    // помаранчевий — резерв
  ];
  function typeColor(t){ const f = TYPES.find(x=>x.id===t); return f ? f.color : TYPES[0].color; }
  const BLK_ORDER = ['songs','prayer','preaching','media','note'];
  const BLK_MIN = { songs:'worship', prayer:'prayer', preaching:'preaching', media:'media', note:null };
  function newBlock(t){
    if(t==='songs') return { type:'songs', people:[], songs:[] };
    if(t==='prayer') return { type:'prayer', people:[], note:'' };
    if(t==='preaching') return { type:'preaching', people:[], translator:'', topic:'', scriptures:[], media:[] };
    if(t==='media') return { type:'media', people:[], media:[] };
    return { type:'note', text:'' };
  }
  function normBlock(b){ if(b.type !== 'note' && !Array.isArray(b.people)) b.people = b.person ? [b.person] : []; return b; }
  // миграция старых служений (структурные поля -> блоки), нормализация person->people
  function migrate(s){
    if(!Array.isArray(s.blocks)){
      const b = [];
      if((s.worship_songs && s.worship_songs.length) || s.worship_leader) b.push({ type:'songs', people:s.worship_leader?[s.worship_leader]:[], songs:s.worship_songs||[] });
      if(s.preacher || s.topic || (s.scriptures && s.scriptures.length)) b.push({ type:'preaching', people:s.preacher?[s.preacher]:[], translator:'', topic:s.topic||'', scriptures:s.scriptures||[], media:[] });
      if(s.media && s.media.length) b.push({ type:'media', people:[], media:s.media });
      s.blocks = b;
    }
    s.blocks.forEach(normBlock);
    return s;
  }
  function pad(n){ return (n<10?'0':'')+n; }
  function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function todayStr(){ return ymd(new Date()); }
  function placeLabel(s){ if(!s) return ''; if(s.place==='custom') return s.place_custom||WS.t('pl_custom'); return WS.t('pl_'+(s.place||'own')); }
  function fmtDate(ds){ const d=new Date(ds+'T00:00:00'); const wd=WS.t('weekday_short').split(',')[d.getDay()]; return wd+', '+d.getDate()+' '+WS.t('months_short').split(',')[d.getMonth()]; }

  WS.App.screens.services = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('programs')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('schedule_srv'))));
    const body = WS.UI.el('div',{class:'scroll grow pad'}); screen.appendChild(body); root.appendChild(screen);

    const canEdit = WS.Auth.canPastor();
    let month = new Date(); month = new Date(month.getFullYear(), month.getMonth(), 1);

    WS.UI.clear(body); body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('loading')));
    Promise.all(['services','songs','psalms','media','bible','people'].map(c=>WS.Data.load(c).catch(()=>{}))).then(()=>{ if(WS.state.screen==='services') renderCal(); });

    function services(){ return (WS.Data.items('services')||[]).slice().sort((a,b)=> (a.date+a.time||'').localeCompare(b.date+b.time||'')); }
    function byDate(){ const m={}; services().forEach(s=>{ (m[s.date]=m[s.date]||[]).push(s); }); return m; }

    // ── Календарь + список предстоящих ──
    function renderCal(){
      WS.UI.clear(body);
      if(canEdit) body.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginBottom:'12px'}},
        WS.UI.el('button',{class:'btn', onClick:()=>openEditor(null, todayStr())}, WS.t('srv_new')),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('people')}, WS.t('people_title'))
      ));
      const legend = WS.UI.el('div',{class:'legend'});
      TYPES.forEach(t=> legend.appendChild(WS.UI.el('span',{class:'legend-item'}, WS.UI.el('span',{class:'legend-dot', style:{background:t.color}}), WS.t('st_'+t.id))));
      body.appendChild(legend);

      const y=month.getFullYear(), m=month.getMonth();
      const head = WS.UI.el('div',{class:'cal-head'},
        WS.UI.el('button',{class:'icon-btn', onClick:()=>{ month=new Date(y,m-1,1); renderCal(); }},'‹'),
        WS.UI.el('div',{class:'cal-title'}, WS.t('months_full').split(',')[m]+' '+y),
        WS.UI.el('button',{class:'icon-btn', onClick:()=>{ month=new Date(y,m+1,1); renderCal(); }},'›')
      );
      body.appendChild(head);

      const grid = WS.UI.el('div',{class:'cal-grid'});
      WS.t('weekday_short').split(',').forEach(w=> grid.appendChild(WS.UI.el('div',{class:'cal-dow'}, w)));
      const startDow=new Date(y,m,1).getDay(), days=new Date(y,m+1,1,0).getDate() ? new Date(y,m+1,0).getDate() : 30;
      const map=byDate(), tstr=todayStr();
      for(let i=0;i<startDow;i++) grid.appendChild(WS.UI.el('div',{class:'cal-cell empty'}));
      for(let dnum=1;dnum<=days;dnum++){
        const ds=y+'-'+pad(m+1)+'-'+pad(dnum);
        const dayItems=map[ds]||[];
        const cell=WS.UI.el('div',{class:'cal-cell'+(ds===tstr?' today':'')+(dayItems.length?' filled':''), onClick:()=>openDay(ds)},
          WS.UI.el('span',{class:'cal-num'}, String(dnum)));
        if(dayItems.length){
          cell.style.color = '#fff';
          const cols = dayItems.slice(0,5).map(s=>typeColor(s.type));
          if(cols.length === 1){ cell.style.background = cols[0]; }
          else {
            // 2+ служения — делим клетку по диагонали (conic-gradient)
            const n = cols.length, seg = 360 / n, stops = [];
            cols.forEach((c,k)=>{ stops.push(c + ' ' + (seg*k) + 'deg ' + (seg*(k+1)) + 'deg'); });
            cell.style.background = 'conic-gradient(from 45deg, ' + stops.join(', ') + ')';
          }
        }
        grid.appendChild(cell);
      }
      body.appendChild(grid);

      // предстоящие
      body.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'18px 0 8px'}}, WS.t('srv_upcoming')));
      const up = services().filter(s=> s.date >= tstr);
      if(!up.length) body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('srv_none')));
      up.forEach(s=> body.appendChild(card(s)));
    }

    function card(s){
      migrate(s);
      const c = WS.UI.el('div',{class:'srv-card'+(s.active?' active':'')});
      c.appendChild(WS.UI.el('span',{class:'type-badge', style:{background:typeColor(s.type)}}, WS.t('st_'+(s.type||'service'))));
      if(s.active) c.appendChild(WS.UI.el('span',{class:'srv-badge'}, WS.t('srv_active')));
      c.appendChild(WS.UI.el('div',{class:'srv-when'}, fmtDate(s.date)+'  ·  '+(s.time||'')+'  ·  '+placeLabel(s)));
      (s.blocks||[]).forEach(b=>{
        let extra=''; if(b.type==='songs') extra=' ('+(b.songs||[]).length+')'; if(b.type==='preaching' && b.topic) extra=' — '+b.topic;
        const who = (b.people && b.people.length) ? (': ' + b.people.join(', ')) : '';
        c.appendChild(WS.UI.el('div',{class:'srv-line'}, WS.t('blk_'+b.type) + who + extra));
      });
      if(canEdit){
        c.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginTop:'10px'}},
          WS.UI.el('button',{class:'btn'+(s.active?' btn-ghost':''), onClick:()=>activate(s)}, s.active?WS.t('srv_deactivate'):WS.t('srv_activate')),
          WS.UI.el('button',{class:'btn btn-ghost', style:{flex:'0 0 auto'}, onClick:()=>openEditor(s, s.date)}, WS.t('edit')),
          WS.UI.el('button',{class:'btn btn-ghost', style:{flex:'0 0 auto'}, onClick:()=>del(s)}, '🗑')
        ));
      }
      return c;
    }

    function closeOverlays(){ document.querySelectorAll('.day-panel').forEach(n=>{ n.classList.remove('open'); setTimeout(()=>{ try{n.remove();}catch(e){} }, 260); }); }
    function openDay(ds){
      const list = byDate()[ds] || [];
      const overlay = WS.UI.el('div',{class:'day-panel'});
      overlay.appendChild(WS.UI.el('div',{class:'topbar', style:{flex:'none'}},
        WS.UI.el('button',{class:'icon-btn bare', onClick:closeOverlays},'←'),
        WS.UI.el('div',{class:'title'}, fmtDate(ds)),
        canEdit ? WS.UI.el('button',{class:'icon-btn', onClick:()=>{ closeOverlays(); openEditor(null, ds); }},'＋') : null
      ));
      const bd = WS.UI.el('div',{class:'scroll grow pad'});
      if(list.length) bd.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:()=>whoParticipates(ds, list)}, '👥 ' + WS.t('who_participates')));
      if(!list.length) bd.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('srv_none_day')));
      list.forEach(s=> bd.appendChild(detailCard(s)));
      overlay.appendChild(bd);
      document.body.appendChild(overlay);
      requestAnimationFrame(()=> overlay.classList.add('open'));
    }
    // все участники дня: имя + что делает
    function whoParticipates(ds, list){
      const rows = [];
      list.forEach(s=>{ migrate(s); (s.blocks||[]).forEach(b=>{
        const role = WS.t('blk_'+b.type);
        (b.people && b.people.length ? b.people : (b.person ? [b.person] : [])).forEach(nm=> rows.push({ name:nm, role:role }));
        if(b.translator) rows.push({ name:b.translator, role:WS.t('srv_translator') });
      }); });
      const b = WS.UI.el('div', null);
      if(!rows.length) b.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('who_none')));
      // сгруппировать по человеку
      const byName = {};
      rows.forEach(r=>{ (byName[r.name] = byName[r.name] || []).push(r.role); });
      Object.keys(byName).forEach(nm=>{
        b.appendChild(WS.UI.el('div',{class:'row'},
          WS.UI.el('div',{class:'person-av', style:{width:'40px', height:'40px', flex:'0 0 40px', fontSize:'16px', margin:'0 12px 0 0'}}, (nm||'?')[0]),
          WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, nm), WS.UI.el('div',{class:'prev'}, byName[nm].join(', ')))
        ));
      });
      WS.UI.modal({ title:WS.t('who_participates'), body:b, buttons:[{label:WS.t('close'), kind:'ghost'}] });
    }
    function detailCard(s){
      migrate(s);
      const c = WS.UI.el('div',{class:'srv-detail'});
      c.appendChild(WS.UI.el('span',{class:'type-badge', style:{background:typeColor(s.type)}}, WS.t('st_'+(s.type||'service'))));
      if(s.active) c.appendChild(WS.UI.el('span',{class:'srv-badge'}, WS.t('srv_active')));
      c.appendChild(WS.UI.el('div',{class:'srv-when'}, (s.time||'') + '  ·  ' + placeLabel(s)));
      const item = (txt)=> c.appendChild(WS.UI.el('div',{class:'srv-item'}, txt));
      (s.blocks||[]).forEach(b=>{
        const who = (b.people && b.people.length) ? (': ' + b.people.join(', ')) : '';
        c.appendChild(WS.UI.el('div',{class:'srv-sec'}, WS.t('blk_'+b.type) + who));
        if(b.translator) item('🎧  ' + WS.t('srv_translator') + ': ' + b.translator);
        if(b.type==='songs') (b.songs||[]).forEach(r=> item('♪  #'+(r.number||'')+' '+(r.title||'')));
        else if(b.type==='preaching'){ if(b.topic) item('— '+b.topic); (b.scriptures||[]).forEach(r=> item('✝  '+r.ref)); (b.media||[]).forEach(r=> item('▣  '+(r.title||''))); }
        else if(b.type==='prayer'){ if(b.note) item(b.note); }
        else if(b.type==='media') (b.media||[]).forEach(r=> item('▣  '+(r.title||'')));
        else if(b.type==='note'){ if(b.text) item(b.text); }
      });
      if(canEdit){
        c.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginTop:'14px'}},
          WS.UI.el('button',{class:'btn'+(s.active?' btn-ghost':''), onClick:()=>{ activate(s); closeOverlays(); }}, s.active?WS.t('srv_deactivate'):WS.t('srv_activate')),
          WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ closeOverlays(); openEditor(s, s.date); }}, WS.t('edit')),
          WS.UI.el('button',{class:'btn btn-ghost', style:{flex:'0 0 auto'}, onClick:()=>{ del(s); closeOverlays(); }}, '🗑')
        ));
      }
      return c;
    }

    async function activate(s){
      const items=(WS.Data.items('services')||[]).map(x=> Object.assign({}, x, { active: (x.id===s.id ? !s.active : false) }));
      WS.UI.toast(WS.t('saving'));
      try{ await WS.Data.save('services', items, 'Activate service'); WS.UI.toast(s.active?WS.t('srv_deactivated'):WS.t('srv_activated')); renderCal(); }
      catch(e){ WS.UI.toast(WS.t('error_prefix')+(e.message||''),'error'); }
    }
    function del(s){
      WS.UI.confirm(WS.t('srv_del_q'), async()=>{
        const items=(WS.Data.items('services')||[]).filter(x=>x.id!==s.id);
        try{ await WS.Data.save('services', items, 'Delete service'); renderCal(); }catch(e){ WS.UI.toast(WS.t('error_prefix')+(e.message||''),'error'); }
      });
    }

    // ── Редактор служіння (блочний) ──
    function personPicker(ministry, onPick){
      const people = WS.People ? WS.People.forMinistry(ministry) : [];
      const all = WS.People ? WS.People.list() : [];
      const src = (people && people.length) ? people : all;
      const b = WS.UI.el('div', null);
      const mo = WS.UI.modal({ title:WS.t('srv_pick_person'), body:b, buttons:[{ label:WS.t('people_manage'), kind:'ghost', onClick:()=>{ mo.close(); WS.App.show('people'); } }, { label:WS.t('close'), kind:'ghost' }] });
      if(!src.length){ b.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('people_none'))); return; }
      const grid = WS.UI.el('div',{class:'people-grid'});
      src.forEach(p=>{
        const card = WS.UI.el('div',{class:'person-card', onClick:()=>{ onPick(WS.People.name(p)); mo.close(); }});
        const av = WS.UI.el('div',{class:'person-av'});
        if(p.photo){ const img=document.createElement('img'); img.src='https://drive.google.com/thumbnail?id='+p.photo+'&sz=w200'; img.onerror=function(){ img.remove(); av.textContent=(p.first||'?')[0]; }; av.appendChild(img); }
        else av.textContent=(p.first||'?')[0];
        card.appendChild(av);
        card.appendChild(WS.UI.el('div',{class:'person-name'}, WS.People.name(p)));
        card.appendChild(WS.UI.el('div',{class:'person-min'}, (p.ministries||[]).map(mm=>WS.t('min_'+mm)).join(', ')));
        grid.appendChild(card);
      });
      b.appendChild(grid);
    }
    function openEditor(existing, dateStr){
      const m = existing ? migrate(JSON.parse(JSON.stringify(existing))) : { id:WS.Data.newId(), date:dateStr||todayStr(), time:'10:00', type:'service', place:'own', place_custom:'', blocks:[], active:false };
      if(!m.type) m.type='service'; if(!Array.isArray(m.blocks)) m.blocks=[];
      WS.UI.clear(body);
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:renderCal}, '← '+WS.t('back')));

      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('sch_date')));
      const dt=WS.UI.el('input',{class:'input', type:'date', value:m.date}); dt.addEventListener('change',()=>m.date=dt.value); body.appendChild(dt);
      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('sch_time')));
      const tm=WS.UI.el('input',{class:'input', type:'time', value:m.time}); tm.addEventListener('change',()=>m.time=tm.value); body.appendChild(tm);

      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('srv_type')));
      const tc=WS.UI.el('div',{class:'chips'});
      function drawType(){ WS.UI.clear(tc); TYPES.forEach(t=> tc.appendChild(WS.UI.el('button',{class:'chip'+(m.type===t.id?' on':''), style: m.type===t.id?{background:t.color, color:'#fff', borderColor:'transparent'}:{}, onClick:()=>{ m.type=t.id; drawType(); }}, WS.t('st_'+t.id)))); }
      drawType(); body.appendChild(tc);

      body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('srv_place')));
      const pl=WS.UI.el('div',{class:'chips'});
      const customInp=WS.UI.el('input',{class:'input', placeholder:WS.t('pl_custom_ph'), value:m.place_custom, style:{marginTop:'8px', display: m.place==='custom'?'':'none'}});
      customInp.addEventListener('input',()=>m.place_custom=customInp.value);
      function drawPl(){ WS.UI.clear(pl); P.forEach(p=> pl.appendChild(WS.UI.el('button',{class:'chip'+(m.place===p?' on':''), onClick:()=>{ m.place=p; customInp.style.display=p==='custom'?'':'none'; drawPl(); }}, WS.t('pl_'+p)))); }
      drawPl(); body.appendChild(pl); body.appendChild(customInp);

      body.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'18px 0 8px'}}, WS.t('srv_blocks')));
      const blocksBox=WS.UI.el('div', null); body.appendChild(blocksBox);
      function drawBlocks(){
        WS.UI.clear(blocksBox);
        m.blocks.forEach((b,i)=> blocksBox.appendChild(blockCard(b,i)));
        blocksBox.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'4px'}, onClick:addBlock}, '+ '+WS.t('blk_add')));
      }
      function addBlock(){
        const bd=WS.UI.el('div', null);
        const mo=WS.UI.modal({ title:WS.t('blk_add'), body:bd, buttons:[{label:WS.t('close'), kind:'ghost'}] });
        BLK_ORDER.forEach(t=> bd.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{width:'100%', marginBottom:'8px'}, onClick:()=>{ m.blocks.push(newBlock(t)); drawBlocks(); mo.close(); }}, WS.t('blk_'+t))));
      }
      function blockCard(b,i){
        const card=WS.UI.el('div',{class:'blk-card'});
        card.appendChild(WS.UI.el('div',{class:'blk-head'},
          WS.UI.el('div',{class:'blk-title'}, WS.t('blk_'+b.type)),
          WS.UI.el('div',{class:'blk-tools'},
            WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i>0){ const t=m.blocks[i-1]; m.blocks[i-1]=m.blocks[i]; m.blocks[i]=t; drawBlocks(); } }},'↑'),
            WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i<m.blocks.length-1){ const t=m.blocks[i+1]; m.blocks[i+1]=m.blocks[i]; m.blocks[i]=t; drawBlocks(); } }},'↓'),
            WS.UI.el('button',{class:'icon-btn', onClick:()=>{ m.blocks.splice(i,1); drawBlocks(); }},'✕')
          )
        ));
        if(b.type!=='note'){
          normBlock(b);
          const ministry = BLK_MIN[b.type] || 'other';
          card.appendChild(WS.UI.el('div',{class:'field-label', style:{fontSize:'12px'}}, WS.t('blk_person')));
          const pw = WS.UI.el('div',{class:'ppl-wrap'}); card.appendChild(pw);
          const drawPeople=()=>{ WS.UI.clear(pw);
            (b.people||[]).forEach((nm,k)=> pw.appendChild(WS.UI.el('div',{class:'ppl-chip'}, WS.UI.el('span',null,nm), WS.UI.el('button',{class:'ppl-x', onClick:()=>{ b.people.splice(k,1); drawPeople(); }},'✕'))));
            pw.appendChild(WS.UI.el('button',{class:'ppl-add', onClick:()=>personPicker(ministry, (nm)=>{ b.people=b.people||[]; if(b.people.indexOf(nm)<0) b.people.push(nm); drawPeople(); })}, '+ '+WS.t('blk_pick_person')));
          };
          drawPeople();
        }
        if(b.type==='songs'){
          const box=WS.UI.el('div',{style:{marginTop:'8px'}}); card.appendChild(box);
          const rd=()=>{ WS.UI.clear(box); b.songs=b.songs||[]; b.songs.forEach((r,j)=> box.appendChild(WS.UI.el('div',{class:'pick-row'}, WS.UI.el('span',null,'#'+(r.number||'')+' '+(r.title||'')), WS.UI.el('button',{class:'icon-btn', onClick:()=>{ b.songs.splice(j,1); rd(); }},'✕')))); box.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'4px'}, onClick:()=>pickSongs(b.songs, rd)}, '+ '+WS.t('srv_add_songs'))); };
          rd();
        } else if(b.type==='preaching'){
          card.appendChild(WS.UI.el('div',{class:'field-label', style:{fontSize:'12px'}}, WS.t('srv_translator')));
          const tw=WS.UI.el('div',{class:'ppl-wrap'}); card.appendChild(tw);
          const drawTr=()=>{ WS.UI.clear(tw); if(b.translator){ tw.appendChild(WS.UI.el('div',{class:'ppl-chip'}, WS.UI.el('span',null,b.translator), WS.UI.el('button',{class:'ppl-x', onClick:()=>{ b.translator=''; drawTr(); }},'✕'))); } else tw.appendChild(WS.UI.el('button',{class:'ppl-add', onClick:()=>personPicker('translation',(nm)=>{ b.translator=nm; drawTr(); })}, '+ '+WS.t('srv_translator'))); };
          drawTr();
          const tp=WS.UI.el('input',{class:'input', placeholder:WS.t('srv_topic_ph'), value:b.topic||'', style:{marginTop:'8px'}}); tp.addEventListener('input',()=>b.topic=tp.value); card.appendChild(tp);
          const sb=WS.UI.el('div',{style:{marginTop:'8px'}}); card.appendChild(sb);
          const rs=()=>{ WS.UI.clear(sb); b.scriptures=b.scriptures||[]; b.scriptures.forEach((r,j)=> sb.appendChild(WS.UI.el('div',{class:'pick-row'}, WS.UI.el('span',null,r.ref), WS.UI.el('button',{class:'icon-btn', onClick:()=>{ b.scriptures.splice(j,1); rs(); }},'✕')))); sb.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'4px'}, onClick:()=>pickScripture(b.scriptures, rs)}, '+ '+WS.t('srv_add_scr'))); };
          rs();
          const mb=WS.UI.el('div',{style:{marginTop:'8px'}}); card.appendChild(mb);
          const rm=()=>{ WS.UI.clear(mb); b.media=b.media||[]; b.media.forEach((r,j)=> mb.appendChild(WS.UI.el('div',{class:'pick-row'}, WS.UI.el('span',null,r.title||WS.t('m_media')), WS.UI.el('button',{class:'icon-btn', onClick:()=>{ b.media.splice(j,1); rm(); }},'✕')))); mb.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'4px'}, onClick:()=>pickMedia(b.media, rm)}, '+ '+WS.t('srv_add_media'))); };
          rm();
        } else if(b.type==='media'){
          const mb=WS.UI.el('div',{style:{marginTop:'8px'}}); card.appendChild(mb);
          const rm=()=>{ WS.UI.clear(mb); b.media=b.media||[]; b.media.forEach((r,j)=> mb.appendChild(WS.UI.el('div',{class:'pick-row'}, WS.UI.el('span',null,r.title||WS.t('m_media')), WS.UI.el('button',{class:'icon-btn', onClick:()=>{ b.media.splice(j,1); rm(); }},'✕')))); mb.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'4px'}, onClick:()=>pickMedia(b.media, rm)}, '+ '+WS.t('srv_add_media'))); };
          rm();
        } else if(b.type==='note'){
          const ta=WS.UI.el('textarea',{class:'input', placeholder:WS.t('blk_note_ph'), style:{minHeight:'70px'}}); ta.value=b.text||''; ta.addEventListener('input',()=>b.text=ta.value); card.appendChild(ta);
        }
        return card;
      }
      drawBlocks();

      body.appendChild(WS.UI.el('div',{class:'spacer'}));
      body.appendChild(WS.UI.el('button',{class:'btn', style:{marginTop:'12px'}, onClick:()=>save(m, !existing)}, WS.t('save')));
    }

    async function save(m, isNew){
      const items=(WS.Data.items('services')||[]).slice();
      const idx=items.findIndex(x=>x.id===m.id);
      if(idx>=0) items[idx]=m; else items.push(m);
      WS.UI.toast(WS.t('saving'));
      try{ await WS.Data.save('services', items, (isNew?'Add':'Edit')+' service'); WS.UI.toast(WS.t('saved')); renderCal(); }
      catch(e){ WS.UI.toast(WS.t('error_prefix')+(e.message||''),'error'); }
    }

    // ── Пикеры (мутируют переданный массив) ──
    function pickSongs(arr, done){
      const all=[].concat((WS.Data.items('songs')||[]).map(s=>({s,coll:'songs'})), (WS.Data.items('psalms')||[]).map(s=>({s,coll:'psalms'})));
      const b=WS.UI.el('div', null);
      const search=WS.UI.el('input',{class:'input', type:'search', placeholder:WS.t('search_ph'), style:{marginBottom:'10px'}}); b.appendChild(search);
      const listW=WS.UI.el('div', null); b.appendChild(listW);
      const rows=all.map(({s,coll})=>{
        const has=arr.some(r=>r.id===s.id && r.coll===coll);
        const row=WS.UI.el('div',{class:'row', onClick:()=>{ const i=arr.findIndex(r=>r.id===s.id&&r.coll===coll); if(i>=0){ arr.splice(i,1); row.classList.remove('sel'); } else { arr.push({coll,id:s.id,number:s.number,title:s.title}); row.classList.add('sel'); } }},
          WS.UI.el('div',{class:'num'}, '#'+(s.number||'')),
          WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, (coll==='psalms'?WS.t('t_psalms'):WS.t('t_songs'))+' · '+(s.title||'')))
        );
        if(has) row.classList.add('sel');
        row._hay=(String(s.number||'')+' '+(s.title||'')).toLowerCase(); listW.appendChild(row); return row;
      });
      search.addEventListener('input',()=>{ const q=search.value.trim().toLowerCase(); rows.forEach(r=>r.style.display=(!q||r._hay.indexOf(q)!==-1)?'':'none'); });
      WS.UI.modal({ title:WS.t('srv_add_songs'), body:b, buttons:[{label:WS.t('done'), onClick:done}] });
    }

    function pickScripture(arr, done){
      const books=WS.Data.items('bible')||[];
      const b=WS.UI.el('div', null);
      const sel=WS.UI.el('select',{class:'input'});
      books.forEach((bk,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=bk.ua+' / '+bk.en; sel.appendChild(o); });
      b.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('srv_book'))); b.appendChild(sel);
      const ch=WS.UI.el('input',{class:'input', type:'number', min:'1', placeholder:WS.t('srv_ch')});
      const v=WS.UI.el('input',{class:'input', type:'number', min:'1', placeholder:WS.t('srv_v')});
      b.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginTop:'8px'}}, ch, v));
      WS.UI.modal({ title:WS.t('srv_add_scr'), body:b, buttons:[
        { label:WS.t('add'), onClick:()=>{ const i=parseInt(sel.value,10); const bk=books[i]; const c=parseInt(ch.value,10), vv=parseInt(v.value,10); if(!bk||!c||!vv) return true; arr.push({ bi:i+1, book_ua:bk.ua, book_en:bk.en, ch:c, v:vv, ref:bk.ua+' '+c+':'+vv }); done(); ch.value=''; v.value=''; return true; } },
        { label:WS.t('close'), kind:'ghost' }
      ]});
    }

    function pickMedia(arr, done){
      const items=WS.Data.items('media')||[];
      const b=WS.UI.el('div', null);
      if(!items.length) b.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('no_media')));
      items.forEach(it=>{
        const has=arr.some(r=>r.id===it.id);
        const row=WS.UI.el('div',{class:'row', onClick:()=>{ const i=arr.findIndex(r=>r.id===it.id); if(i>=0){ arr.splice(i,1); row.classList.remove('sel'); } else { arr.push({id:it.id,title:it.title,type:it.type,drive_id:it.drive_id}); row.classList.add('sel'); } }},
          WS.UI.el('div',{class:'num'}, ({video:'▶',image:'▣',presentation:'▤'}[it.type]||'•')),
          WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, it.title||WS.t('untitled')))
        );
        if(has) row.classList.add('sel');
        b.appendChild(row);
      });
      WS.UI.modal({ title:WS.t('srv_add_media'), body:b, buttons:[{label:WS.t('done'), onClick:done}] });
    }
  };

  // активное служіння (для оператора)
  WS.Services = {
    active(){ return (WS.Data.items('services')||[]).find(s=>s.active) || null; },
    migrate: migrate,
    placeLabel: placeLabel
  };
})();
