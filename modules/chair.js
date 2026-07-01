/* chair.js — роль Кафедра (локализован). Медиа(Drive)/Текст/Объявления/Чат/Библия. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let bibleLang = WS.ls.get('bible_lang','ua');

  WS.App.screens.chair = function(root, params){
    const view = (params && params.view) || 'menu';
    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    function header(title, back){
      return WS.UI.el('div',{class:'topbar'},
        WS.UI.el('button',{class:'icon-btn bare', onClick:back},'←'),
        WS.UI.el('div',{class:'title'}, title));
    }

    if(view === 'menu'){
      screen.appendChild(header(WS.t('chair_title'), ()=>WS.App.show('role')));
      const b = WS.UI.el('div',{class:'pad col'});
      [['media',WS.t('m_media')],['text',WS.t('m_text')],['announce',WS.t('m_announce')],['chat',WS.t('m_chat')],['bible',WS.t('m_bible')]].forEach(([v,label])=>{
        b.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px', padding:'18px', fontSize:'18px'}, onClick:()=>{
          if(v==='chat') WS.App.show('chat', { back:'chair' }); else WS.App.show('chair', { view:v });
        }}, label));
      });
      screen.appendChild(b); root.appendChild(screen); return;
    }

    const wrap = WS.UI.el('div',{class:'scroll grow pad'});
    const titles = { text:WS.t('m_text'), announce:WS.t('m_announce'), media:WS.t('m_media'), bible:WS.t('m_bible') };
    screen.appendChild(header(titles[view] || WS.t('chair_title'), ()=>WS.App.show('chair')));
    screen.appendChild(wrap); root.appendChild(screen);

    if(view === 'text')     loadThen('texts',  ()=>renderItemList(wrap, 'texts'));
    if(view === 'announce') loadThen('announcements', ()=>renderItemList(wrap, 'announcements'));
    if(view === 'media')    loadThen('media',  ()=>renderMedia(wrap));
    if(view === 'bible')    loadThen('bible',  ()=>renderBible(wrap));

    function loadThen(coll, draw){
      WS.UI.clear(wrap); wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('loading')));
      WS.Data.load(coll).then(()=>{ if(WS.state.screen==='chair'){ WS.UI.clear(wrap); draw(); } }).catch(()=>{ if(WS.state.screen==='chair'){ WS.UI.clear(wrap); draw(); } });
    }
  };

  // ТЕКСТЫ / ОБЪЯВЛЕНИЯ
  function renderItemList(wrap, coll){
    WS.UI.clear(wrap);
    const isAnn = coll === 'announcements';
    if(WS.Auth.canAdd()) wrap.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>openItemEditor(wrap, coll, null)}, isAnn ? WS.t('add_announce') : WS.t('add_text')));
    if(isAnn) wrap.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'10px'}}, WS.t('announce_ttl')));

    const items = activeItems(coll);
    if(!items.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'}, isAnn ? WS.t('no_announce') : WS.t('no_texts'))); return; }

    items.forEach(it => {
      const row = WS.UI.el('div',{class:'row'},
        WS.UI.el('div',{class:'main', style:{cursor:'pointer'}, onClick:()=>{
          const payload = { t:'text', body: it.text || it.body || '' };
          WS.Sync.send(payload); WS.Projector.set(payload); WS.UI.toast(WS.t('sent_projector'));
        }},
          WS.UI.el('div',{class:'ttl'}, it.title || WS.UI.preview(it.text||it.body, 40)),
          WS.UI.el('div',{class:'prev'}, WS.UI.preview(it.text||it.body, 60))
        )
      );
      if(WS.Auth.canAdd()) row.appendChild(WS.UI.el('button',{class:'icon-btn', title:WS.t('edit'), onClick:()=>openItemEditor(wrap, coll, it)},'✎'));
      wrap.appendChild(row);
    });
  }

  function openItemEditor(wrap, coll, existing){
    const isNew = !existing, isAnn = coll === 'announcements';
    if(isNew && !WS.Auth.canAdd()){ WS.UI.denied(); return; }
    if(!isNew && !WS.Auth.canEdit()){ WS.UI.denied(); return; }
    const model = existing ? JSON.parse(JSON.stringify(existing)) : { id:WS.Data.newId(), title:'', text:'', created:Date.now() };

    WS.UI.clear(wrap);
    wrap.appendChild(WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold', marginBottom:'12px'}}, isNew ? (isAnn ? WS.t('new_announce') : WS.t('new_text')) : WS.t('editing')));
    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('title_optional')));
    const titleInp = WS.UI.el('input',{class:'input', value:model.title || ''}); wrap.appendChild(titleInp);
    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('text_field')));
    const textArea = WS.UI.el('textarea',{class:'input', style:{minHeight:'140px'}}); textArea.value = model.text || model.body || ''; wrap.appendChild(textArea);

    wrap.appendChild(WS.UI.el('div',{class:'spacer'}));
    wrap.appendChild(WS.UI.el('div',{class:'btn-row'},
      WS.UI.el('button',{class:'btn', onClick:save}, WS.t('save')),
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>renderItemList(wrap, coll)}, WS.t('cancel'))
    ));
    if(!isNew && WS.Auth.canEdit()) wrap.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove}, WS.t('del')));

    async function save(){
      model.title = titleInp.value.trim(); model.text = textArea.value.trim();
      if('body' in model) delete model.body;
      if(!model.text){ WS.UI.toast(WS.t('enter_text'),'error'); return; }
      if(isAnn && !model.created) model.created = Date.now();
      let items = activeItems(coll).slice();
      const idx = items.findIndex(x => x.id === model.id);
      if(idx >= 0) items[idx] = model; else items.push(model);
      WS.UI.toast(WS.t('saving'));
      try { await WS.Data.save(coll, items, (idx>=0?'Edit ':'Add ') + (model.title || 'text')); WS.UI.toast(WS.t('saved')); renderItemList(wrap, coll); }
      catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
    }
    async function remove(){
      WS.UI.confirm(WS.t('del') + '?', async ()=>{
        const items = activeItems(coll).filter(x => x.id !== model.id);
        try { await WS.Data.save(coll, items, 'Delete'); WS.UI.toast(WS.t('deleted')); renderItemList(wrap, coll); }
        catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
      }, WS.t('del'));
    }
  }

  function activeItems(coll){
    const items = WS.Data.items(coll) || [];
    if(coll !== 'announcements') return items;
    const cutoff = Date.now() - WS.config.ANNOUNCE_TTL_MS;
    return items.filter(it => !it.created || it.created >= cutoff);
  }

  // МЕДИА (Google Drive)
  function renderMedia(wrap){
    WS.UI.clear(wrap);
    if(WS.Auth.canAdd()) wrap.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'12px'}, onClick:()=>openMediaEditor(wrap, null)}, WS.t('add_drive')));
    wrap.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'12px'}}, WS.t('drive_hint')));
    const items = WS.Data.items('media');
    if(!items.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('no_media'))); return; }
    items.forEach(it => {
      const row = WS.UI.el('div',{class:'row'},
        WS.UI.el('div',{class:'num', style:{cursor:'pointer'}, onClick:()=>sendMedia(it)}, ({video:'▶',image:'▣',presentation:'▤'}[it.type] || '•')),
        WS.UI.el('div',{class:'main', style:{cursor:'pointer'}, onClick:()=>sendMedia(it)},
          WS.UI.el('div',{class:'ttl'}, it.title || WS.t('untitled')),
          WS.UI.el('div',{class:'prev'}, it.drive_id ? ('Drive · ' + (it.type||'')) : WS.t('no_link'))
        )
      );
      if(WS.Auth.canAdd()) row.appendChild(WS.UI.el('button',{class:'icon-btn', title:WS.t('edit'), onClick:()=>openMediaEditor(wrap, it)},'✎'));
      wrap.appendChild(row);
    });
  }

  function sendMedia(it){
    if(!it.drive_id){ WS.UI.toast(WS.t('no_drive_link'),'error'); return; }
    const payload = { t:'media', mediaType:it.type||'video', driveId:it.drive_id, title:it.title||'' };
    WS.Sync.send(payload); WS.Projector.set(payload); WS.UI.toast(WS.t('started_projector'));
  }

  function parseDriveId(s){
    s = String(s || '').trim();
    let m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/);
    if(m) return m[1];
    if(/^[-\w]{20,}$/.test(s)) return s;
    return '';
  }

  function openMediaEditor(wrap, existing){
    const isNew = !existing;
    if(isNew && !WS.Auth.canAdd()){ WS.UI.denied(); return; }
    if(!isNew && !WS.Auth.canEdit()){ WS.UI.denied(); return; }
    const model = existing ? JSON.parse(JSON.stringify(existing)) : { id:WS.Data.newId(), title:'', type:'video', drive_id:'' };

    WS.UI.clear(wrap);
    wrap.appendChild(WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold', marginBottom:'12px'}}, isNew ? WS.t('new_file') : WS.t('edit_file')));
    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('title_field')));
    const titleInp = WS.UI.el('input',{class:'input', value:model.title||''}); wrap.appendChild(titleInp);
    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('drive_link_label')));
    const linkInp = WS.UI.el('input',{class:'input', placeholder:'https://drive.google.com/file/d/…/view', value: model.drive_id ? ('https://drive.google.com/file/d/'+model.drive_id+'/view') : ''}); wrap.appendChild(linkInp);
    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('type_field')));
    const typeSel = WS.UI.el('select',{class:'input', style:{borderBottom:'2px solid var(--line)'}}, optEl('video',WS.t('t_video'), model.type), optEl('image',WS.t('t_image'), model.type), optEl('presentation',WS.t('t_presentation'), model.type)); wrap.appendChild(typeSel);

    wrap.appendChild(WS.UI.el('div',{class:'spacer'}));
    wrap.appendChild(WS.UI.el('div',{class:'btn-row'},
      WS.UI.el('button',{class:'btn', onClick:save}, WS.t('save')),
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>renderMedia(wrap)}, WS.t('cancel'))
    ));
    if(!isNew && WS.Auth.canEdit()) wrap.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove}, WS.t('del')));

    async function save(){
      model.title = titleInp.value.trim(); model.type = typeSel.value;
      const id = parseDriveId(linkInp.value);
      if(!id){ WS.UI.toast(WS.t('drive_parse_fail'),'error'); return; }
      model.drive_id = id; if(!model.title) model.title = WS.t('file_default');
      const items = WS.Data.items('media').slice();
      const idx = items.findIndex(x => x.id === model.id);
      if(idx >= 0) items[idx] = model; else items.push(model);
      WS.UI.toast(WS.t('saving'));
      try { await WS.Data.save('media', items, (idx>=0?'Edit ':'Add ') + 'media ' + model.title); WS.UI.toast(WS.t('saved')); renderMedia(wrap); }
      catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
    }
    async function remove(){
      WS.UI.confirm(WS.t('del') + ' «' + model.title + '»?', async ()=>{
        const items = WS.Data.items('media').filter(x => x.id !== model.id);
        try { await WS.Data.save('media', items, 'Delete media'); WS.UI.toast(WS.t('deleted')); renderMedia(wrap); }
        catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
      }, WS.t('del'));
    }
  }

  function optEl(val, label, cur){ const o = document.createElement('option'); o.value = val; o.textContent = label; if(cur === val) o.selected = true; return o; }

  // БИБЛИЯ
  function renderBible(wrap){
    WS.UI.clear(wrap);
    wrap.appendChild(WS.UI.el('div',{class:'tabs', style:{padding:'0 0 12px'}},
      WS.UI.el('button',{class:'tab'+(bibleLang==='ua'?' on':''), onClick:()=>{ bibleLang='ua'; WS.ls.set('bible_lang','ua'); renderBible(wrap); }},'Українська'),
      WS.UI.el('button',{class:'tab'+(bibleLang==='en'?' on':''), onClick:()=>{ bibleLang='en'; WS.ls.set('bible_lang','en'); renderBible(wrap); }},'English')
    ));
    const books = WS.Data.items('bible');
    if(!books.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('bible_not_loaded'))); return; }
    const listWrap = WS.UI.el('div', null); wrap.appendChild(listWrap);
    const bookName = b => bibleLang==='en' ? b.en : b.ua;

    function showBooks(){
      WS.UI.clear(listWrap);
      books.forEach(b => listWrap.appendChild(WS.UI.el('div',{class:'row', onClick:()=>showChapters(b)}, WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, bookName(b))))));
    }
    function showChapters(b){
      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:showBooks}, WS.t('back_books')));
      listWrap.appendChild(WS.UI.el('div',{style:{fontWeight:'bold', marginBottom:'10px'}}, bookName(b)));
      const grid = WS.UI.el('div',{style:{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px'}});
      for(let c=1;c<=b.chapters;c++) grid.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'12px 0'}, onClick:()=>showVerses(b,c)}, String(c)));
      listWrap.appendChild(grid);
    }
    function showVerses(b, c){
      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:()=>showChapters(b)}, WS.t('back_chapters')));
      listWrap.appendChild(WS.UI.el('div',{style:{fontWeight:'bold', marginBottom:'10px'}}, bookName(b) + ' ' + c));
      const grid = WS.UI.el('div',{style:{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px'}});
      for(let v=1;v<=60;v++) grid.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'12px 0'}, onClick:()=>sendVerse(b,c,v)}, String(v)));
      listWrap.appendChild(grid);
    }
    function sendVerse(b, c, v){
      const refUa = b.ua + ' ' + c + ':' + v, refEn = b.en + ' ' + c + ':' + v;
      WS.Sync.send({ t:'activity', kind:'bible', label: refUa + '  /  ' + refEn });
      WS.UI.toast(WS.t('sent_operator', bibleLang==='en'?refEn:refUa));
    }
    showBooks();
  }
})();
