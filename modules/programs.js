/* programs.js — Программы служения (локализован) + режим ведения (презентер).
   Тап по пункту программы открывает презентер:
     - предпросмотр контента (блоки песни/псалма или текст),
     - стрелки ◀ ▶ по краям — переход между пунктами программы,
     - внизу 2 кнопки: [⚑ Оператору] (запрос, все уровни) и [На экран] (показ, Сцена+),
     - иконка очистки экрана в шапке (Сцена+).
   Песня/псалом/текст/объявление — всё можно вывести на экран. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  const COLL = { psalm:'psalms', song:'songs', text:'texts', announcement:'announcements' };
  function typeLabel(t){ return { psalm:WS.t('pt_psalm'), song:WS.t('pt_song'), text:WS.t('pt_text'), announcement:WS.t('pt_announce'), note:WS.t('pt_note') }[t] || t; }
  let current = null;

  WS.App.screens.programs = function(root, params){
    const view = (params && params.view) || 'list';
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    const content = WS.UI.el('div',{class:'scroll grow pad'});

    function top(title, back, right){ return WS.UI.el('div',{class:'topbar'}, WS.UI.el('button',{class:'icon-btn bare', onClick:back},'←'), WS.UI.el('div',{class:'title'}, title), right || null); }

    if(view === 'list'){
      screen.appendChild(top(WS.t('programs_title'), ()=>WS.App.show('role')));
      screen.appendChild(content); root.appendChild(screen);
      content.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('loading')));
      Promise.all(['programs','psalms','songs','texts','announcements'].map(c => WS.Data.load(c).catch(()=>{}))).then(()=>{ if(WS.state.screen==='programs') renderList(content); });
      return;
    }
    if(view === 'detail'){
      if(!current){ WS.App.show('programs', {view:'list'}); return; }
      screen.appendChild(top(current.title || WS.t('programs_title'), ()=>WS.App.show('programs', {view:'list'})));
      screen.appendChild(content); root.appendChild(screen); renderDetail(content); return;
    }
    if(view === 'edit'){
      if(!current){ WS.App.show('programs', {view:'list'}); return; }
      screen.appendChild(top(WS.t('editing'), ()=>WS.App.show('programs', {view: current._saved ? 'detail' : 'list'})));
      screen.appendChild(content); root.appendChild(screen); renderEdit(content); return;
    }
    if(view === 'present'){
      if(!current){ WS.App.show('programs', {view:'list'}); return; }
      renderPresent(root, (params && params.index) || 0);
      return;
    }
  };

  function renderList(content){
    WS.UI.clear(content);
    content.appendChild(WS.UI.el('button',{class:'btn btn-tan', style:{marginBottom:'12px'}, onClick:()=>WS.App.show('services')}, '📅 ' + WS.t('schedule_srv')));
    if(WS.Auth.canPastor()) content.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>{ current = { id:WS.Data.newId(), title:'', date:'', items:[], _saved:false }; WS.App.show('programs', {view:'edit'}); }}, WS.t('create_program')));
    const items = (WS.Data.items('programs') || []).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if(!items.length){ content.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('no_programs'))); return; }
    items.forEach(p => {
      content.appendChild(WS.UI.el('div',{class:'row', onClick:()=>{ current = JSON.parse(JSON.stringify(p)); current._saved = true; WS.App.show('programs', {view:'detail'}); }},
        WS.UI.el('div',{class:'main'},
          WS.UI.el('div',{class:'ttl'}, p.title || WS.t('untitled')),
          WS.UI.el('div',{class:'prev'}, (p.date ? p.date + ' · ' : '') + WS.t('items_count', (p.items ? p.items.length : 0)))
        ),
        WS.UI.el('span',{class:'muted'},'›')
      ));
    });
  }

  function renderDetail(content){
    WS.UI.clear(content);
    const bar = WS.UI.el('div',{class:'btn-row', style:{marginBottom:'12px'}});
    bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view:'list'})}, WS.t('back_programs')));
    if(WS.Auth.canPastor()) bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view:'edit'})}, WS.t('edit')));
    content.appendChild(bar);
    if(current.date) content.appendChild(WS.UI.el('div',{class:'muted', style:{marginBottom:'10px'}}, current.date));
    if(!current.items || !current.items.length){ content.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('program_empty'))); return; }

    current.items.forEach((el, i) => {
      content.appendChild(WS.UI.el('div',{class:'row', onClick:()=>WS.App.show('programs', {view:'present', index:i})},
        WS.UI.el('div',{class:'num', style:{minWidth:'30px'}}, String(i+1)),
        WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, label(el)), WS.UI.el('div',{class:'prev'}, typeLabel(el.type))),
        WS.UI.el('span',{class:'muted'},'›')
      ));
    });
  }

  // ---------- ПРЕЗЕНТЕР (ведение) ----------
  function renderPresent(root, index){
    const items = current.items || [];
    if(!items.length){ WS.App.show('programs', {view:'detail'}); return; }
    index = Math.max(0, Math.min(items.length - 1, index));
    const el = items[index];
    const canProject = WS.Auth.canEdit();   // Сцена и выше
    let selectedBlock = 0;

    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    // шапка: назад к программе + очистка экрана (Сцена+)
    const clearBtn = canProject ? WS.UI.el('button',{class:'icon-btn', title:WS.t('clear_projector'), onClick:()=>{ WS.Sync.send({t:'clear'}); WS.Projector.set({t:'clear'}); WS.UI.toast(WS.t('projector_cleared')); }},'🗑') : null;
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('programs', {view:'detail'})},'←'),
      WS.UI.el('div',{class:'title'}, current.title || WS.t('programs_title')),
      clearBtn
    ));

    // навигация между пунктами: ◀ N/M ▶
    const prevBtn = WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(index>0) WS.App.show('programs', {view:'present', index:index-1}); }},'◀');
    const nextBtn = WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(index<items.length-1) WS.App.show('programs', {view:'present', index:index+1}); }},'▶');
    if(index===0) prevBtn.disabled = true;
    if(index===items.length-1) nextBtn.disabled = true;
    screen.appendChild(WS.UI.el('div',{style:{display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', borderBottom:'1px solid var(--line)'}},
      prevBtn,
      WS.UI.el('div',{style:{flex:1, textAlign:'center'}},
        WS.UI.el('div',{style:{fontWeight:'bold'}}, typeLabel(el.type) + ' · ' + label(el)),
        WS.UI.el('div',{class:'muted', style:{fontSize:'12px'}}, WS.t('present_pos', index+1, items.length))
      ),
      nextBtn
    ));

    // тело: предпросмотр
    const body = WS.UI.el('div',{class:'scroll grow pad'});
    screen.appendChild(body);

    let blockCards = [];
    function project(payload, toast){ WS.Sync.send(payload); WS.Projector.set(payload); if(toast) WS.UI.toast(toast); }

    if(el.type === 'psalm' || el.type === 'song'){
      const item = (WS.Data.items(COLL[el.type]) || []).find(x => x.id === el.ref_id);
      if(!item){ body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('item_not_found'))); }
      else {
        if(canProject) body.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'10px'}}, WS.t('tap_block_hint')));
        (item.blocks || []).forEach((b, bi) => {
          const tag = b.type==='chorus'?WS.t('chorus'):b.type==='bridge'?WS.t('bridge'):WS.t('verse');
          const tagCls = b.type==='chorus'?'tag-chorus':b.type==='bridge'?'tag-bridge':'tag-verse';
          const card = WS.UI.el('div',{class:'card', style:{cursor: canProject?'pointer':'default'}, onClick: canProject ? ()=>{
            selectedBlock = bi;
            const payload = { t:'block', title:item.title||'', number:item.number??'', blockType:b.type||'verse', text:b.text||'', translation:(item.show_translation&&b.translation)?b.translation:'', showTranslation:!!(item.show_translation&&b.translation) };
            project(payload); blockCards.forEach(c=>c.style.borderColor=''); card.style.borderColor='var(--tan)';
          } : null },
            WS.UI.el('span',{class:'block-tag '+tagCls}, tag),
            WS.UI.el('div',{style:{whiteSpace:'pre-wrap'}}, b.text || ''),
            (item.show_translation && b.translation) ? WS.UI.el('div',{class:'muted', style:{whiteSpace:'pre-wrap', marginTop:'8px', fontSize:'14px'}}, b.translation) : null
          );
          blockCards.push(card); body.appendChild(card);
        });
      }
    } else if(el.type === 'text' || el.type === 'announcement'){
      const item = (WS.Data.items(COLL[el.type]) || []).find(x => x.id === el.ref_id);
      const bodyText = item ? (item.text || item.body || '') : (el.text || '');
      body.appendChild(WS.UI.el('div',{class:'card'}, WS.UI.el('div',{style:{whiteSpace:'pre-wrap'}}, bodyText || WS.t('no_preview'))));
    } else {
      body.appendChild(WS.UI.el('div',{class:'card'}, WS.UI.el('div',{style:{whiteSpace:'pre-wrap'}}, el.text || WS.t('pt_note'))));
    }

    // низ: 2 кнопки [⚑ Оператору] [На экран]
    function sendToScreen(){
      if(!canProject){ WS.UI.toast(WS.t('need_stage'),'error'); return; }
      if(el.type === 'psalm' || el.type === 'song'){
        const item = (WS.Data.items(COLL[el.type]) || []).find(x => x.id === el.ref_id);
        if(!item || !item.blocks || !item.blocks.length){ WS.UI.toast(WS.t('item_not_found'),'error'); return; }
        const b = item.blocks[selectedBlock] || item.blocks[0];
        project({ t:'block', title:item.title||'', number:item.number??'', blockType:b.type||'verse', text:b.text||'', translation:(item.show_translation&&b.translation)?b.translation:'', showTranslation:!!(item.show_translation&&b.translation) }, WS.t('sent_projector'));
        blockCards.forEach((c,i)=> c.style.borderColor = (i===(selectedBlock|0))?'var(--tan)':'');
      } else if(el.type === 'text' || el.type === 'announcement'){
        const item = (WS.Data.items(COLL[el.type]) || []).find(x => x.id === el.ref_id);
        const bodyText = item ? (item.text || item.body || '') : (el.text || '');
        if(!bodyText){ WS.UI.toast(WS.t('text_not_found'),'error'); return; }
        project({ t:'text', body:bodyText }, WS.t('sent_projector'));
      } else { WS.UI.toast(WS.t('no_preview'),'error'); }
    }
    function requestOperator(){
      WS.Sync.send({ t:'activity', kind:'program', label: WS.t('op_request', typeLabel(el.type)+' · '+label(el)) });
      WS.UI.toast(WS.t('request_sent'));
    }

    const screenBtn = WS.UI.el('button',{class:'btn', onClick:sendToScreen}, WS.t('to_screen'));
    if(!canProject) screenBtn.classList.add('btn-ghost');
    screen.appendChild(WS.UI.el('div',{style:{padding:'10px 12px', borderTop:'1px solid var(--line)', display:'flex', gap:'10px'}},
      WS.UI.el('button',{class:'btn btn-ghost', onClick:requestOperator, style:{flex:1}}, WS.t('to_operator')),
      WS.UI.el('div',{style:{flex:1, display:'flex'}}, screenBtn)
    ));

    root.appendChild(screen);
  }

  function renderEdit(content){
    WS.UI.clear(content);
    content.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('title_field')));
    const titleInp = WS.UI.el('input',{class:'input', value:current.title || ''}); content.appendChild(titleInp);
    content.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('date_field')));
    const dateInp = WS.UI.el('input',{class:'input', type:'date', value:current.date || ''}); content.appendChild(dateInp);
    content.appendChild(WS.UI.el('div',{class:'field-label', style:{marginTop:'16px'}}, WS.t('program_items')));
    const itemsWrap = WS.UI.el('div', null); content.appendChild(itemsWrap);

    function drawItems(){
      WS.UI.clear(itemsWrap);
      if(!current.items.length) itemsWrap.appendChild(WS.UI.el('div',{class:'muted', style:{padding:'8px 0'}}, WS.t('empty_generic')));
      current.items.forEach((el, i) => {
        itemsWrap.appendChild(WS.UI.el('div',{class:'row'},
          WS.UI.el('div',{class:'num', style:{minWidth:'30px'}}, String(i+1)),
          WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, label(el)), WS.UI.el('div',{class:'prev'}, typeLabel(el.type))),
          WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i>0){ swap(current.items,i,i-1); drawItems(); } }},'↑'),
          WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i<current.items.length-1){ swap(current.items,i,i+1); drawItems(); } }},'↓'),
          WS.UI.el('button',{class:'icon-btn', onClick:()=>{ current.items.splice(i,1); drawItems(); }},'×')
        ));
      });
    }
    drawItems();

    content.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{margin:'12px 0'}, onClick:()=>addItem(drawItems)}, WS.t('add_element')));
    content.appendChild(WS.UI.el('div',{class:'btn-row'},
      WS.UI.saveBtn(WS.t('save'), save),
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view: current._saved ? 'detail' : 'list'})}, WS.t('cancel'))
    ));
    if(current._saved && WS.Auth.canPastor()) content.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove}, WS.t('del_program')));

    async function save(){
      current.title = titleInp.value.trim(); current.date = dateInp.value;
      if(!current.title){ WS.UI.toast(WS.t('enter_title'),'error'); return; }
      const clean = { id:current.id, title:current.title, date:current.date, items:current.items };
      const items = (WS.Data.items('programs') || []).slice();
      const idx = items.findIndex(x => x.id === current.id);
      if(idx >= 0) items[idx] = clean; else items.push(clean);
      try { await WS.Data.save('programs', items, (idx>=0?'Edit ':'Add ') + 'program ' + current.title); current._saved = true; WS.UI.toast(WS.t('saved')); WS.App.show('programs', {view:'detail'}); }
      catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
    }
    async function remove(){
      WS.UI.confirm(WS.t('del_program_q', current.title), async ()=>{
        const items = (WS.Data.items('programs') || []).filter(x => x.id !== current.id);
        try { await WS.Data.save('programs', items, 'Delete program'); WS.UI.toast(WS.t('deleted')); WS.App.show('programs', {view:'list'}); }
        catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
      }, WS.t('del'));
    }
  }

  function addItem(after){
    const body = WS.UI.el('div',{class:'col'});
    const m = WS.UI.modal({ title:WS.t('element_type'), body, buttons:[{label:WS.t('cancel'), kind:'ghost'}] });
    [['psalm',WS.t('pt_psalm')],['song',WS.t('pt_song')],['text',WS.t('pt_text')],['announcement',WS.t('pt_announce')],['note',WS.t('pt_note')]].forEach(([type,lbl])=>{
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'8px'}, onClick:()=>{ m.close(); if(type === 'note') addNote(after); else pickFrom(type, after); }}, lbl));
    });
  }

  function addNote(after){
    const inp = WS.UI.el('input',{class:'input', placeholder:WS.t('note_ph')});
    WS.UI.modal({ title:WS.t('pt_note'), body:inp, buttons:[
      { label:WS.t('cancel'), kind:'ghost' },
      { label:WS.t('add_btn'), onClick:()=>{ const t = inp.value.trim(); if(!t) return true; current.items.push({ type:'note', text:t }); after(); } }
    ]});
    setTimeout(()=>inp.focus(), 100);
  }

  function pickFrom(type, after){
    const items = WS.Data.items(COLL[type]) || [];
    const body = WS.UI.el('div',{class:'col', style:{maxHeight:'50vh', overflowY:'auto'}});
    const m = WS.UI.modal({ title:WS.t('choose_x', typeLabel(type)), body, buttons:[{label:WS.t('cancel'), kind:'ghost'}] });
    if(!items.length){ body.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('list_empty'))); return; }
    const sorted = items.slice().sort((a,b)=> (a.number||0)-(b.number||0) || String(a.title||'').localeCompare(String(b.title||'')));
    sorted.forEach(it => {
      const cap = (it.number ? '#'+it.number+' ' : '') + (it.title || WS.UI.preview(it.text||it.body, 30));
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'8px', textAlign:'left'}, onClick:()=>{ current.items.push({ type, ref_id:it.id, number:it.number, title:it.title || WS.UI.preview(it.text||it.body, 30) }); m.close(); after(); }}, cap));
    });
  }

  function label(el){
    if(el.type === 'note') return '✎ ' + (el.text || WS.t('pt_note'));
    const coll = COLL[el.type];
    const live = coll ? (WS.Data.items(coll) || []).find(x => x.id === el.ref_id) : null;
    if(live) return (live.number ? '#'+live.number+' ' : '') + (live.title || WS.UI.preview(live.text||live.body, 30));
    return (el.number ? '#'+el.number+' ' : '') + (el.title || '(item)');
  }

  function swap(a,i,j){ const t = a[i]; a[i] = a[j]; a[j] = t; }
})();
