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
      items.forEach(it => {
        const first = (it.blocks && it.blocks[0]) ? it.blocks[0].text : '';
        listWrap.appendChild(WS.UI.el('div',{class:'row', onClick:()=>openBlocks(it)},
          WS.UI.el('div',{class:'num'}, '#' + (it.number ?? '—')),
          WS.UI.el('div',{class:'main'},
            WS.UI.el('div',{class:'ttl'}, it.title || WS.t('untitled')),
            WS.UI.el('div',{class:'prev'}, WS.UI.preview(first, 60))
          )
        ));
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
})();
