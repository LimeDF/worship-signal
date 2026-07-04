/* hymns.js — роль Псалмы/Песни (локализован). Чистая навигация без гонки.
   WS.Hymns.renderBlocks переиспользуется Программами. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};
  WS.Hymns = WS.Hymns || {};

  let tab = 'songs';

  function blockTag(type){ return type==='chorus' ? WS.t('chorus') : type==='bridge' ? WS.t('bridge') : WS.t('verse'); }
  function blockTagClass(type){ return type==='chorus' ? 'tag-chorus' : type==='bridge' ? 'tag-bridge' : 'tag-verse'; }

  // ПЕРЕИСПОЛЬЗУЕМЫЙ ПОКАЗ БЛОКОВ
  WS.Hymns.renderBlocks = function(container, item, opts){
    opts = opts || {};
    WS.UI.clear(container);
    let sentKey = null;

    const bar = WS.UI.el('div',{class:'btn-row', style:{marginBottom:'12px'}});
    if(opts.onBack) bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:opts.onBack}, WS.t('back')));
    if(opts.onEdit) bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:opts.onEdit}, WS.t('edit')));
    bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>printChooser(item)}, WS.t('print_pdf')));
    if(bar.children.length) container.appendChild(bar);

    container.appendChild(WS.UI.el('div',{class:'card'},
      WS.UI.el('div',{style:{fontWeight:'bold', fontSize:'18px'}}, '#' + (item.number ?? '—') + '  ' + (item.title || '')),
      item.show_translation ? WS.UI.el('div',{class:'muted', style:{fontSize:'13px'}}, WS.t('with_translation')) : null
    ));

    const cards = [];
    (item.blocks || []).forEach((b, i) => {
      const key = item.id + ':' + i;
      const card = WS.UI.el('div',{class:'card', style:{cursor:'pointer'}, onClick:()=>send(b, key, card)},
        WS.UI.el('span',{class:'block-tag ' + blockTagClass(b.type)}, blockTag(b.type)),
        WS.UI.el('div',{style:{whiteSpace:'pre-wrap'}}, b.text || ''),
        (item.show_translation && b.translation) ? WS.UI.el('div',{class:'muted', style:{whiteSpace:'pre-wrap', marginTop:'8px', fontSize:'14px'}}, b.translation) : null
      );
      cards.push(card); container.appendChild(card);
    });

    container.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'8px'}, onClick:()=>{
      WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' }); sentKey = null;
      cards.forEach(c => c.style.borderColor = ''); WS.UI.toast(WS.t('projector_cleared'));
    }}, WS.t('clear_projector')));

    function send(b, key, cardEl){
      const payload = { t:'block', title:item.title || '', number:item.number ?? '', blockType:b.type || 'verse',
        text:b.text || '', translation:(item.show_translation && b.translation) ? b.translation : '',
        showTranslation: !!(item.show_translation && b.translation) };
      WS.Sync.send(payload); WS.Projector.set(payload);
      sentKey = key; cards.forEach(c => c.style.borderColor = ''); cardEl.style.borderColor = 'var(--tan)';
    }
  };

  WS.App.screens.hymns = function(root, params){
    params = params || {};
    if(params.tab) tab = params.tab;

    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('hymns_title')),
      WS.UI.el('button',{class:'icon-btn', title:WS.t('refresh'), onClick:loadList},'⟳')
    ));

    const tabsEl = WS.UI.el('div',{class:'tabs'},
      WS.UI.el('button',{class:'tab', onClick:()=>{ tab='songs'; loadList(); }}, WS.t('tab_songs')),
      WS.UI.el('button',{class:'tab', onClick:()=>{ tab='psalms'; loadList(); }}, WS.t('tab_psalms'))
    );
    screen.appendChild(tabsEl);

    const listWrap = WS.UI.el('div',{class:'scroll grow pad'});
    screen.appendChild(listWrap);
    if(WS.StagePanel) WS.StagePanel.attach(screen);
    root.appendChild(screen);

    function setTabs(){
      tabsEl.children[0].className = 'tab' + (tab==='songs' ? ' on' : '');
      tabsEl.children[1].className = 'tab' + (tab==='psalms' ? ' on' : '');
    }

    function loadList(){
      setTabs(); WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('loading')));
      WS.Data.load(tab).then(renderList).catch(renderList);
    }

    function renderList(){
      if(WS.state.screen !== 'hymns') return;
      setTabs(); WS.UI.clear(listWrap);
      if(WS.Auth.canAdd())
        listWrap.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>openEditor(null)}, tab==='songs' ? WS.t('add_song') : WS.t('add_psalm')));

      const items = sortItems(WS.Data.items(tab));
      if(!items.length){ listWrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('list_empty_add'))); return; }

      // поиск по номеру и названию (фильтрует вживую, без перерисовки)
      const search = WS.UI.el('input',{class:'input', type:'search', placeholder:WS.t('search_ph'), style:{marginBottom:'12px'}});
      listWrap.appendChild(search);
      const rowsWrap = WS.UI.el('div', null);
      listWrap.appendChild(rowsWrap);
      const noRes = WS.UI.el('div',{class:'empty'}, WS.t('nothing_found'));
      noRes.style.display = 'none'; listWrap.appendChild(noRes);

      const rows = items.map(it => {
        const first = (it.blocks && it.blocks[0]) ? it.blocks[0].text : '';
        const row = WS.UI.el('div',{class:'row', onClick:()=>openBlocks(it)},
          WS.UI.el('div',{class:'num'}, '#' + (it.number ?? '—')),
          WS.UI.el('div',{class:'main'},
            WS.UI.el('div',{class:'ttl'}, it.title || WS.t('untitled')),
            WS.UI.el('div',{class:'prev'}, WS.UI.preview(first, 60))
          )
        );
        row._hay = (String(it.number ?? '') + ' ' + (it.title || '')).toLowerCase();
        rowsWrap.appendChild(row);
        return row;
      });

      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        rows.forEach(r => { const ok = !q || r._hay.indexOf(q) !== -1; r.style.display = ok ? '' : 'none'; if(ok) shown++; });
        noRes.style.display = shown ? 'none' : '';
      });
    }

    function openBlocks(it){
      WS.Hymns.renderBlocks(listWrap, it, { onBack: renderList, onEdit: WS.Auth.canEdit() ? () => openEditor(it) : null });
    }

    function openEditor(existing){
      const isNew = !existing;
      if(isNew && !WS.Auth.canAdd()){ WS.UI.denied(); return; }
      if(!isNew && !WS.Auth.canEdit()){ WS.UI.denied(); return; }

      const model = existing ? JSON.parse(JSON.stringify(existing)) : { id:WS.Data.newId(), number:'', title:'', show_translation:false, blocks:[ { type:'verse', text:'', translation:'' } ] };

      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold', marginBottom:'12px'}}, isNew ? (tab==='songs' ? WS.t('new_song') : WS.t('new_psalm')) : WS.t('editing')));

      listWrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('number')));
      const numInp = WS.UI.el('input',{class:'input', type:'number', inputmode:'numeric', min:WS.config.PSALM_NUM_MIN, max:WS.config.PSALM_NUM_MAX, value:model.number});
      listWrap.appendChild(numInp);

      listWrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('title_field')));
      const titleInp = WS.UI.el('input',{class:'input', value:model.title});
      listWrap.appendChild(titleInp);

      const transChk = WS.UI.el('input',{type:'checkbox'}); transChk.checked = !!model.show_translation;
      listWrap.appendChild(WS.UI.el('label',{style:{display:'flex', alignItems:'center', gap:'10px', margin:'16px 0'}}, transChk, WS.UI.el('span', null, WS.t('show_tr_label'))));

      // ── Импорт целого текста с авто-разбивкой ──
      const importPanel = WS.UI.el('div',{class:'card', style:{display:'none'}});
      const impText = WS.UI.el('textarea',{class:'input', placeholder:WS.t('import_text_ph'), style:{minHeight:'120px'}});
      const impTr   = WS.UI.el('textarea',{class:'input', placeholder:WS.t('import_tr_ph'), style:{minHeight:'90px', marginTop:'8px'}});
      importPanel.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'8px'}}, WS.t('import_hint')));
      importPanel.appendChild(impText);
      importPanel.appendChild(impTr);
      importPanel.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginTop:'10px'}},
        WS.UI.el('button',{class:'btn', onClick:()=>{
          const blocks = splitLyrics(impText.value);
          if(!blocks.length){ WS.UI.toast(WS.t('import_empty'),'error'); return; }
          const trBlocks = impTr.value.trim() ? splitLyrics(impTr.value) : [];
          if(trBlocks.length){
            transChk.checked = true;
            blocks.forEach((b,i) => { b.translation = trBlocks[i] ? trBlocks[i].text : ''; });
          }
          model.blocks = blocks;
          importPanel.style.display = 'none'; impBtn.textContent = WS.t('import_whole');
          drawBlocks();
          WS.UI.toast(WS.t('import_done', blocks.length));
        }}, WS.t('split_fill')),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ importPanel.style.display='none'; impBtn.textContent = WS.t('import_whole'); }}, WS.t('cancel'))
      ));

      const impBtn = WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:()=>{
        const open = importPanel.style.display === 'none';
        importPanel.style.display = open ? '' : 'none';
        impBtn.textContent = open ? WS.t('collapse') : WS.t('import_whole');
      }}, WS.t('import_whole'));
      listWrap.appendChild(impBtn);
      listWrap.appendChild(importPanel);

      const blocksWrap = WS.UI.el('div', null);
      listWrap.appendChild(blocksWrap);

      function drawBlocks(){
        WS.UI.clear(blocksWrap);
        model.blocks.forEach((b, i) => {
          const typeSel = WS.UI.el('select',{class:'input', style:{borderBottom:'2px solid var(--line)'}}, opt('verse',WS.t('verse'), b.type), opt('chorus',WS.t('chorus'), b.type), opt('bridge',WS.t('bridge'), b.type));
          typeSel.addEventListener('change', () => b.type = typeSel.value);
          const card = WS.UI.el('div',{class:'card'},
            WS.UI.el('div',{style:{display:'flex', gap:'8px', alignItems:'center', marginBottom:'8px'}},
              WS.UI.el('div',{style:{flex:1}}, typeSel),
              WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i>0){ swap(model.blocks,i,i-1); drawBlocks(); } }},'↑'),
              WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i<model.blocks.length-1){ swap(model.blocks,i,i+1); drawBlocks(); } }},'↓'),
              WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(model.blocks.length <= 1){ WS.UI.toast(WS.t('need_one_block'),'error'); return; } WS.UI.confirm(WS.t('del_block_q'), ()=>{ model.blocks.splice(i,1); drawBlocks(); }); }},'×')
            )
          );
          const txt = WS.UI.el('textarea',{class:'input', placeholder:WS.t('block_text_ph')}); txt.value = b.text || '';
          txt.addEventListener('input', () => b.text = txt.value); card.appendChild(txt);
          if(transChk.checked){
            const tr = WS.UI.el('textarea',{class:'input', placeholder:WS.t('translation_ph'), style:{marginTop:'8px'}}); tr.value = b.translation || '';
            tr.addEventListener('input', () => b.translation = tr.value); card.appendChild(tr);
          }
          blocksWrap.appendChild(card);
        });
      }
      transChk.addEventListener('change', drawBlocks);
      drawBlocks();

      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'14px'}, onClick:()=>{ model.blocks.push({ type:'verse', text:'', translation:'' }); drawBlocks(); }}, WS.t('add_block')));
      listWrap.appendChild(WS.UI.el('div',{class:'btn-row'},
        WS.UI.el('button',{class:'btn', onClick:save}, WS.t('save')),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:loadList}, WS.t('cancel'))
      ));
      if(!isNew && WS.Auth.canEdit()) listWrap.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove}, WS.t('del')));

      async function save(){
        model.number = clampNum(numInp.value); model.title = titleInp.value.trim(); model.show_translation = transChk.checked;
        if(!model.title){ WS.UI.toast(WS.t('enter_title'),'error'); return; }
        const items = WS.Data.items(tab).slice();
        const idx = items.findIndex(x => x.id === model.id);
        if(idx >= 0) items[idx] = model; else items.push(model);
        WS.UI.toast(WS.t('saving'));
        try { await WS.Data.save(tab, items, (idx>=0 ? 'Edit ' : 'Add ') + model.number + '. ' + model.title); WS.UI.toast(WS.t('saved')); loadList(); }
        catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
      }
      async function remove(){
        WS.UI.confirm(WS.t('del') + ' «' + model.title + '»?', async ()=>{
          const items = WS.Data.items(tab).filter(x => x.id !== model.id);
          try { await WS.Data.save(tab, items, 'Delete ' + model.number + '. ' + model.title); WS.UI.toast(WS.t('deleted')); loadList(); }
          catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message || ''),'error'); }
        }, WS.t('del'));
      }
    }

    loadList();
  };

  function opt(val, label, cur){ const o = document.createElement('option'); o.value = val; o.textContent = label; if(cur === val) o.selected = true; return o; }
  function swap(a,i,j){ const t = a[i]; a[i] = a[j]; a[j] = t; }
  function clampNum(v){ let n = parseInt(v,10); if(isNaN(n)) return ''; return Math.max(WS.config.PSALM_NUM_MIN, Math.min(WS.config.PSALM_NUM_MAX, n)); }
  function sortItems(arr){ return arr.slice().sort((a,b) => (a.number||0) - (b.number||0)); }

  // Авто-разбивка вставленного текста на блоки (куплет/приспів/міст) ≈ по 4 строки.
  function splitLyrics(raw){
    const text = String(raw || '').replace(/\r\n?/g,'\n').trim();
    if(!text) return [];
    const KW = /(приспів|приспев|chorus|refrain|міст|мост|bridge|бридж|брідж|куплет|verse|стих|строфа|pre-?chorus|програш|проигрыш|intro|вступ|ending|кінцівка|coda|коду)/i;
    function typeFor(s){
      if(/приспів|приспев|chorus|refrain/i.test(s)) return 'chorus';
      if(/міст|мост|bridge|бридж|брідж/i.test(s)) return 'bridge';
      return 'verse';
    }
    // разбить на строфы по пустым строкам
    const stanzas = text.split(/\n\s*\n+/);
    const blocks = [];
    stanzas.forEach(st => {
      let lines = st.split('\n').map(l => l.trim()).filter(l => l.length);
      if(!lines.length) return;
      let type = 'verse';
      const head = lines[0];
      const isHeader = KW.test(head) && (head.length <= 30 || head.indexOf('[') !== -1 || head.indexOf('/') !== -1);
      if(isHeader){
        type = typeFor(head);
        const colon = head.indexOf(':');
        const after = colon >= 0 ? head.slice(colon+1).trim() : '';
        if(after) lines[0] = after; else lines = lines.slice(1);
      }
      if(!lines.length) return;
      chunkEven(lines, 4).forEach(group => blocks.push({ type:type, text:group.join('\n'), translation:'' }));
    });
    return blocks;
  }

  // поделить массив строк на почти равные группы ≤ target (6→3+3, 5→3+2, 7→4+3 …)
  function chunkEven(arr, target){
    const n = arr.length;
    if(n <= target) return [arr];
    const chunks = Math.ceil(n / target);
    const base = Math.floor(n / chunks);
    let rem = n % chunks, idx = 0;
    const out = [];
    for(let c = 0; c < chunks; c++){
      const size = base + (rem > 0 ? 1 : 0); if(rem > 0) rem--;
      out.push(arr.slice(idx, idx + size)); idx += size;
    }
    return out;
  }

  // ── Печать / PDF (через системный диалог «Зберегти як PDF», чёрным по белому) ──
  function printChooser(item){
    const hasTr = (item.blocks || []).some(b => b.translation && b.translation.trim());
    if(!hasTr){ printSong(item, false); return; }
    WS.UI.modal({ title: WS.t('print_tr_q'), buttons: [
      { label: WS.t('print_with_tr'), onClick: () => printSong(item, true) },
      { label: WS.t('print_no_tr'), kind:'ghost', onClick: () => printSong(item, false) },
      { label: WS.t('cancel'), kind:'ghost' }
    ]});
  }
  function printPage(title, pick, item, brk){
    const sec = document.createElement('section'); sec.className = 'print-page' + (brk ? ' brk' : '');
    const h = document.createElement('h1'); h.className = 'print-title'; h.textContent = title; sec.appendChild(h);
    let any = false;
    (item.blocks || []).forEach(b => {
      const txt = pick(b); if(!(txt && txt.trim())) return; any = true;
      const d = document.createElement('div'); d.className = 'print-block' + (b.type === 'chorus' ? ' chorus' : '');
      d.textContent = txt; sec.appendChild(d);
    });
    return any ? sec : null;
  }
  function printSong(item, withTr){
    document.querySelectorAll('.print-only').forEach(n => n.remove());
    const doc = document.createElement('div'); doc.className = 'print-only';
    const orig = printPage('#' + (item.number != null ? item.number : '') + '  ' + (item.title || ''), b => b.text, item, false);
    if(orig) doc.appendChild(orig);
    if(withTr){
      const tr = printPage((item.title || '') + ' — ' + WS.t('translation_word'), b => b.translation, item, true);
      if(tr) doc.appendChild(tr);
    }
    document.body.appendChild(doc);
    const cleanup = () => { try { doc.remove(); } catch(e){} window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => { try { window.print(); } catch(e){ cleanup(); } }, 80);
  }
})();
