/* chair.js — роль Кафедра (локализован). Медиа(Drive)/Текст/Объявления/Чат/Библия. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let bibleCode = WS.ls.get('bible_code','UBIO');

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
      const menu = [
        { v:'media', label:WS.t('m_media'), ico:'▣', feat:true },
        { v:'msgs',  label:WS.t('m_text_announce'), ico:'✎' },
        { v:'bible', label:WS.t('m_bible'), ico:'✝', feat:true },
        { v:'chat',  label:WS.t('m_chat'),  ico:'✉' },
      ];
      menu.forEach(m => {
        b.appendChild(WS.UI.el('button',{class:'menu-btn' + (m.feat?' feat':''), onClick:()=>{
          if(m.v==='chat') WS.App.show('chat', { back:'chair' }); else WS.App.show('chair', { view:m.v });
        }}, WS.UI.el('span',{class:'menu-ico'}, m.ico), WS.UI.el('span',null, m.label)));
      });
      screen.appendChild(b); root.appendChild(screen); return;
    }

    const wrap = WS.UI.el('div',{class:'scroll grow pad'});
    const titles = { msgs:WS.t('m_text_announce'), media:WS.t('m_media'), bible:WS.t('m_bible') };
    screen.appendChild(header(titles[view] || WS.t('chair_title'), ()=>WS.App.show('chair')));
    screen.appendChild(wrap); root.appendChild(screen);

    if(view === 'media')    loadThen('media',  ()=>renderMedia(wrap));
    if(view === 'bible')    loadThen('bible',  ()=>renderBible(wrap));
    if(view === 'msgs'){
      WS.UI.clear(wrap); wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('loading')));
      Promise.all([WS.Data.load('announcements'), WS.Data.load('texts')]).then(()=>{ if(WS.state.screen==='chair'){ WS.UI.clear(wrap); renderMessages(wrap); } }).catch(()=>{ if(WS.state.screen==='chair'){ WS.UI.clear(wrap); renderMessages(wrap); } });
    }

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

    let selected = null, updateStart = function(){};
    if(isAnn){
      selected = new Set();
      const ctrl = WS.UI.el('div',{class:'card'});
      ctrl.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'8px'}}, WS.t('loop_hint')));
      const intervalInp = WS.UI.el('input',{class:'input', type:'number', min:'3', max:'180', value:'10', style:{maxWidth:'90px'}});
      ctrl.appendChild(WS.UI.el('div',{style:{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px'}},
        WS.UI.el('span',{class:'muted', style:{fontSize:'13px'}}, WS.t('loop_interval')), intervalInp));
      const startBtn = WS.UI.el('button',{class:'btn', onClick:()=>{
        if(!selected.size) return;
        const chosen = items.filter(it => selected.has(it.id)).map(it => ({ title: it.title || '', text: it.text || it.body || '' }));
        const interval = Math.max(3, parseInt(intervalInp.value,10) || 10);
        const p = { t:'announce_loop', items: chosen, interval: interval, start: Date.now() };
        WS.Sync.send(p); WS.Projector.set(p); WS.UI.toast(WS.t('loop_started'));
      }}, WS.t('loop_start'));
      const stopBtn = WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' }); WS.UI.toast(WS.t('projector_cleared')); }}, WS.t('loop_stop'));
      ctrl.appendChild(WS.UI.el('div',{class:'btn-row'}, startBtn, stopBtn));
      wrap.appendChild(ctrl);
      updateStart = function(){ startBtn.disabled = selected.size === 0; startBtn.textContent = WS.t('loop_start') + (selected.size ? (' (' + selected.size + ')') : ''); };
      updateStart();
    }

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
      if(isAnn){
        const chk = WS.UI.el('div',{class:'vchk', onClick:(e)=>{ e.stopPropagation(); if(selected.has(it.id)){ selected.delete(it.id); chk.textContent='○'; row.classList.remove('sel'); } else { selected.add(it.id); chk.textContent='●'; row.classList.add('sel'); } updateStart(); }},'○');
        row.insertBefore(chk, row.firstChild);
      }
      if(WS.Auth.canAdd()) row.appendChild(WS.UI.el('button',{class:'icon-btn', title:WS.t('edit'), onClick:()=>openItemEditor(wrap, coll, it)},'✎'));
      wrap.appendChild(row);
    });
  }

  // объединённый раздел «Текст і оголошення»
  function renderMessages(wrap){
    WS.UI.clear(wrap);
    wrap.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'0 0 6px'}}, WS.t('m_announce')));
    const annBox = WS.UI.el('div', null); wrap.appendChild(annBox);
    renderItemList(annBox, 'announcements');
    wrap.appendChild(WS.UI.el('div',{class:'section-h', style:{padding:'18px 0 6px'}}, WS.t('m_text')));
    const txtBox = WS.UI.el('div', null); wrap.appendChild(txtBox);
    renderItemList(txtBox, 'texts');
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
    if(WS.Auth.canAdd()){
      wrap.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'8px'}, onClick:()=>openMediaEditor(wrap, null)}, WS.t('add_drive')));
      if(WS.Drive && WS.Drive.isConfigured()){
        const fileInp = WS.UI.el('input',{type:'file', style:{display:'none'}});
        fileInp.addEventListener('change', async function(){
          const f = fileInp.files && fileInp.files[0]; if(!f) return;
          WS.UI.toast(WS.t('drive_uploading'));
          try {
            const id = await WS.Drive.upload(f, f.name);
            const type = f.type.indexOf('image') === 0 ? 'image' : (f.type.indexOf('video') === 0 ? 'video' : 'presentation');
            const items = WS.Data.items('media').slice();
            items.push({ id:WS.Data.newId(), title:f.name, type:type, drive_id:id });
            await WS.Data.save('media', items, 'Upload media ' + f.name);
            WS.UI.toast(WS.t('drive_uploaded')); renderMedia(wrap);
          } catch(e){ WS.UI.toast(WS.t('drive_error', e.message||''),'error'); }
          fileInp.value = '';
        });
        wrap.appendChild(fileInp);
        wrap.appendChild(WS.UI.el('button',{class:'btn btn-tan', style:{marginBottom:'12px'}, onClick:()=>fileInp.click()}, WS.t('drive_upload')));
      }
    }
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

  // БИБЛИЯ — полный текст, режим чтения (скролл + активный стих), мультивыбор
  let bibleBi = WS.ls.get('bible_bi','') === '1';         // две мови (укр+англ) сплітом на проекторі
  function renderBible(wrap){
    WS.UI.clear(wrap);
    wrap.appendChild(WS.UI.el('button',{class:'btn'+(bibleBi?'':' btn-ghost'), style:{width:'100%', marginBottom:'12px'}, onClick:()=>{ bibleBi=!bibleBi; WS.ls.set('bible_bi', bibleBi?'1':''); renderBible(wrap); }}, (bibleBi?'✓ ':'') + WS.t('bible_two_lang')));

    const tabs = WS.UI.el('div',{class:'tabs', style:{padding:'0 0 12px', flexWrap:'wrap'}});
    WS.Bible.translations.forEach(tr => tabs.appendChild(WS.UI.el('button',{class:'tab'+(bibleCode===tr.code?' on':''), onClick:()=>{ bibleCode=tr.code; WS.ls.set('bible_code',tr.code); renderBible(wrap); }}, tr.name)));
    wrap.appendChild(tabs);

    const books = WS.Data.items('bible');
    if(!books.length){ wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('bible_not_loaded'))); return; }
    const lang = WS.Bible.get(bibleCode).lang;
    const bookName = b => lang==='en' ? b.en : b.ua;
    const listWrap = WS.UI.el('div', null); wrap.appendChild(listWrap);

    function showBooks(){
      WS.UI.clear(listWrap);
      const search = WS.UI.el('input',{class:'input', type:'search', placeholder:WS.t('search_book_ph'), style:{marginBottom:'12px'}});
      listWrap.appendChild(search);
      const rowsWrap = WS.UI.el('div', null); listWrap.appendChild(rowsWrap);
      const rows = books.map(b => {
        const row = WS.UI.el('div',{class:'row', onClick:()=>showChapters(b)}, WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, bookName(b))));
        row._hay = (bookName(b) || '').toLowerCase(); rowsWrap.appendChild(row); return row;
      });
      search.addEventListener('input', ()=>{ const q = search.value.trim().toLowerCase(); rows.forEach(r => r.style.display = (!q || r._hay.indexOf(q) !== -1) ? '' : 'none'); });
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
      const bookNum = books.indexOf(b) + 1;
      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'10px'}, onClick:()=>showChapters(b)}, WS.t('back_chapters')));
      listWrap.appendChild(WS.UI.el('div',{style:{fontWeight:'bold', marginBottom:'8px'}}, bookName(b) + ' ' + c));
      listWrap.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'12px', marginBottom:'10px'}}, WS.t('bible_tap_hint')));
      const status = WS.UI.el('div',{class:'empty'}, WS.t('loading')); listWrap.appendChild(status);
      const need = bibleBi ? ['UBIO','WEB'] : [bibleCode];
      Promise.all(need.map(code => WS.Bible.getChapter(code, bookNum, c))).then(results => {
        if(WS.state.screen !== 'chair') return;
        status.remove();
        const listArr = results[0];
        if(!listArr || !listArr.length){ listWrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('bible_load_fail'))); return; }

        const selected = new Set(); const rowEls = {};
        const mvBar = WS.UI.el('div',{class:'mv-bar', style:{display:'none'}});
        const bcast = WS.UI.el('button',{class:'btn', onClick:()=>{ if(selected.size) emitMany(b, c, [...selected].sort((x,y)=>x-y), results); }});
        const clrBtn = WS.UI.el('button',{class:'btn btn-ghost', style:{flex:'0 0 auto'}, onClick:()=>{ selected.clear(); Object.keys(rowEls).forEach(k=>{ rowEls[k].classList.remove('sel'); const ch=rowEls[k].querySelector('.vchk'); if(ch) ch.textContent='○'; }); updateBar(); }}, WS.t('clear_sel'));
        mvBar.appendChild(bcast); mvBar.appendChild(clrBtn); listWrap.appendChild(mvBar);
        function updateBar(){ if(!selected.size){ mvBar.style.display='none'; return; } mvBar.style.display=''; bcast.textContent = WS.t('broadcast_sel') + ' (' + rangeStr([...selected]) + ')'; }

        listArr.forEach(vo => {
          const chk = WS.UI.el('div',{class:'vchk', onClick:(e)=>{ e.stopPropagation(); if(selected.has(vo.verse)){ selected.delete(vo.verse); row.classList.remove('sel'); chk.textContent='○'; } else { selected.add(vo.verse); row.classList.add('sel'); chk.textContent='●'; } updateBar(); }},'○');
          const row = WS.UI.el('div',{class:'row bverse', onClick:()=>openReading(b, c, results, vo.verse)},
            chk,
            WS.UI.el('div',{class:'num'}, String(vo.verse)),
            WS.UI.el('div',{class:'main'}, WS.UI.el('div',{style:{whiteSpace:'pre-wrap', lineHeight:'1.4'}}, vo.text))
          );
          rowEls[vo.verse] = row; listWrap.appendChild(row);
        });
      }).catch(() => { if(WS.state.screen !== 'chair') return; status.remove(); listWrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('bible_load_fail'))); });
    }

    // Режим чтения — весь розділ прокруткою, активний стих крупно/в рамці (анімовано)
    function openReading(b, c, results, startVerse){
      const arr = results[0];
      let idx = arr.findIndex(x => x.verse === startVerse); if(idx < 0) idx = 0;
      WS.UI.clear(listWrap);
      const actions = WS.UI.el('div',{class:'rd-actions'},
        WS.UI.el('button',{class:'btn btn-ghost', style:{flex:'1 1 0'}, onClick:()=>showVerses(b, c)}, '← ' + WS.t('back')),
        WS.UI.el('button',{class:'btn', style:{flex:'1 1 0'}, onClick:()=>emitOne(b, c, arr[idx].verse, results, 'screen')}, WS.t('bible_to_screen')),
        WS.UI.el('button',{class:'btn btn-tan', style:{flex:'1 1 0'}, onClick:()=>emitOne(b, c, arr[idx].verse, results, 'operator')}, WS.t('bible_to_operator'))
      );
      listWrap.appendChild(actions);
      const list = WS.UI.el('div', null); listWrap.appendChild(list);
      const cards = arr.map((vo, i) => {
        const card = WS.UI.el('div',{class:'rd-card' + (i===idx?' active':''), onClick:()=>setActive(i)},
          WS.UI.el('span',{class:'rd-vnum'}, String(vo.verse)),
          WS.UI.el('span',{style:{whiteSpace:'pre-wrap'}}, vo.text));
        list.appendChild(card); return card;
      });
      function setActive(i){ if(i===idx) return; cards[idx].classList.remove('active'); idx = i; cards[idx].classList.add('active'); cards[idx].scrollIntoView({ block:'center', behavior:'smooth' }); }
      requestAnimationFrame(() => { if(cards[idx]) cards[idx].scrollIntoView({ block:'center' }); });
    }

    function emitOne(b, c, v, results, target){
      const uaRef = b.ua + ' ' + c + ':' + v, enRef = b.en + ' ' + c + ':' + v;
      let payload;
      if(bibleBi){
        payload = (target==='screen')
          ? { t:'bible', ref: uaRef+' / '+enRef, text: WS.Bible.verseText(results[0], v), text_en: WS.Bible.verseText(results[1], v), bilingual:true }
          : { t:'activity', kind:'bible', label: uaRef+' / '+enRef+' — '+WS.Bible.verseText(results[0], v)+'  /  '+WS.Bible.verseText(results[1], v) };
      } else {
        const ref = (lang==='en') ? enRef : uaRef;
        payload = (target==='screen')
          ? { t:'bible', ref: ref, text: WS.Bible.verseText(results[0], v) }
          : { t:'activity', kind:'bible', label: ref+' — '+WS.Bible.verseText(results[0], v) };
      }
      WS.Sync.send(payload);
      if(target==='screen') WS.Projector.set(payload);
      WS.UI.toast(target==='screen' ? WS.t('sent_projector') : WS.t('sent_operator', (lang==='en'?enRef:uaRef)));
    }

    function emitMany(b, c, nums, results){
      const rs = rangeStr(nums);
      const uaRef = b.ua + ' ' + c + ':' + rs, enRef = b.en + ' ' + c + ':' + rs;
      const join = (arr) => nums.map(n => WS.Bible.verseText(arr, n)).filter(Boolean).join('\n');
      const payload = bibleBi
        ? { t:'bible', ref: uaRef+' / '+enRef, text: join(results[0]), text_en: join(results[1]), bilingual:true }
        : { t:'bible', ref: (lang==='en'?enRef:uaRef), text: join(results[0]) };
      WS.Sync.send(payload); WS.Projector.set(payload);
      WS.UI.toast(WS.t('sent_projector'));
    }

    showBooks();
  }

  // "16,17,18" -> "16-18"; "16,18,20" -> "16, 18, 20"; "16,17,20" -> "16-17, 20"
  function rangeStr(nums){
    const a = [...new Set(nums)].sort((x,y)=>x-y); if(!a.length) return '';
    const parts = []; let s = a[0], p = a[0];
    for(let i=1;i<=a.length;i++){
      if(i < a.length && a[i] === p + 1){ p = a[i]; continue; }
      parts.push(s === p ? String(s) : (s + '-' + p));
      if(i < a.length){ s = a[i]; p = a[i]; }
    }
    return parts.join(', ');
  }
})();
