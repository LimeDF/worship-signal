/* programs.js — Программы служения (локализован). */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  const COLL = { psalm:'psalms', song:'songs', text:'texts', announcement:'announcements' };
  function typeLabel(t){ return { psalm:WS.t('pt_psalm'), song:WS.t('pt_song'), text:WS.t('pt_text'), announcement:WS.t('pt_announce'), note:WS.t('pt_note') }[t] || t; }
  let current = null;

  WS.App.screens.programs = function(root, params){
    const view = (params && params.view) || 'list';
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    const content = WS.UI.el('div',{class:'scroll grow pad'});

    function top(title, back){ return WS.UI.el('div',{class:'topbar'}, WS.UI.el('button',{class:'icon-btn bare', onClick:back},'←'), WS.UI.el('div',{class:'title'}, title)); }

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
  };

  function renderList(content){
    WS.UI.clear(content);
    if(WS.Auth.canEdit()) content.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>{ current = { id:WS.Data.newId(), title:'', date:'', items:[], _saved:false }; WS.App.show('programs', {view:'edit'}); }}, WS.t('create_program')));
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
    if(WS.Auth.canEdit()) bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view:'edit'})}, WS.t('edit')));
    content.appendChild(bar);
    if(current.date) content.appendChild(WS.UI.el('div',{class:'muted', style:{marginBottom:'10px'}}, current.date));
    if(!current.items || !current.items.length){ content.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('program_empty'))); return; }

    current.items.forEach((el, i) => {
      content.appendChild(WS.UI.el('div',{class:'row', onClick:()=>useItem(content, el)},
        WS.UI.el('div',{class:'num', style:{minWidth:'30px'}}, String(i+1)),
        WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, label(el)), WS.UI.el('div',{class:'prev'}, typeLabel(el.type))),
        el.type === 'note' ? null : WS.UI.el('span',{class:'muted'},'›')
      ));
    });
  }

  function useItem(content, el){
    if(el.type === 'note'){ WS.UI.toast(el.text || WS.t('pt_note')); return; }
    if(el.type === 'psalm' || el.type === 'song'){
      const item = (WS.Data.items(COLL[el.type]) || []).find(x => x.id === el.ref_id);
      if(!item){ WS.UI.toast(WS.t('item_not_found'),'error'); return; }
      WS.Sync.send({ t:'activity', kind:'program', label: WS.t('program_arrow', el.type==='psalm'?WS.t('pt_psalm'):WS.t('pt_song'), (item.number||''), (item.title||'')) });
      WS.Hymns.renderBlocks(content, item, { onBack: ()=>renderDetail(content) });
      return;
    }
    if(el.type === 'text' || el.type === 'announcement'){
      const item = (WS.Data.items(COLL[el.type]) || []).find(x => x.id === el.ref_id);
      const body = item ? (item.text || item.body || '') : (el.text || '');
      if(!body){ WS.UI.toast(WS.t('text_not_found'),'error'); return; }
      const payload = { t:'text', body };
      WS.Sync.send(payload); WS.Projector.set(payload); WS.UI.toast(WS.t('sent_projector'));
    }
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
      WS.UI.el('button',{class:'btn', onClick:save}, WS.t('save')),
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view: current._saved ? 'detail' : 'list'})}, WS.t('cancel'))
    ));
    if(current._saved && WS.Auth.canEdit()) content.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove}, WS.t('del_program')));

    async function save(){
      current.title = titleInp.value.trim(); current.date = dateInp.value;
      if(!current.title){ WS.UI.toast(WS.t('enter_title'),'error'); return; }
      const clean = { id:current.id, title:current.title, date:current.date, items:current.items };
      const items = (WS.Data.items('programs') || []).slice();
      const idx = items.findIndex(x => x.id === current.id);
      if(idx >= 0) items[idx] = clean; else items.push(clean);
      WS.UI.toast(WS.t('saving'));
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
    [['psalm',WS.t('pt_psalm')],['song',WS.t('pt_song')],['text',WS.t('pt_text')],['announcement',WS.t('pt_announce')],['note',WS.t('pt_note')]].forEach(([type,label])=>{
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'8px'}, onClick:()=>{ m.close(); if(type === 'note') addNote(after); else pickFrom(type, after); }}, label));
    });
  }

  function addNote(after){
    const inp = WS.UI.el('input',{class:'input', placeholder:WS.t('note_ph')});
    const m = WS.UI.modal({ title:WS.t('pt_note'), body:inp, buttons:[
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
