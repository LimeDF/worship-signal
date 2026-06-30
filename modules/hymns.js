/* ============================================================
   hymns.js — роль Псалмы/Песни.
   Две вкладки = две коллекции: songs / psalms (отдельные json).
   Список → карточки с предпросмотром. Тап → экран блоков → тап по блоку
   отправляет его на проектор (подсвечивается текущий отправленный).
   Редактор: номер, название, блоки (куплет/припев/бридж), перевод к каждому
   блоку, чекбокс «показывать перевод». Добавление/правка сразу пишется в json.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let tab = 'songs';               // 'songs' | 'psalms'
  let sentBlockKey = null;         // подсветка последнего отправленного блока

  const TAB_TITLE = { songs:'Песни', psalms:'Псалмы' };

  WS.App.screens.hymns = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'},'Псалмы / Песни')
    ));

    // вкладки
    const tabsEl = WS.UI.el('div',{class:'tabs'},
      WS.UI.el('button',{class:'tab' + (tab==='songs'?' on':''), onClick:()=>{ tab='songs'; renderList(); }},'Песни'),
      WS.UI.el('button',{class:'tab' + (tab==='psalms'?' on':''), onClick:()=>{ tab='psalms'; renderList(); }},'Псалмы')
    );
    screen.appendChild(tabsEl);

    const listWrap = WS.UI.el('div',{class:'scroll grow pad'});
    screen.appendChild(listWrap);
    root.appendChild(screen);

    function setTabs(){
      tabsEl.children[0].className = 'tab' + (tab==='songs'?' on':'');
      tabsEl.children[1].className = 'tab' + (tab==='psalms'?' on':'');
    }

    function renderList(){
      setTabs();
      WS.UI.clear(listWrap);

      // кнопка добавления
      if(WS.Auth.canAdd()){
        listWrap.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>openEditor(null)},
          '+ Добавить ' + (tab==='songs'?'песню':'псалом')));
      }

      const items = sortItems(WS.Data.items(tab));
      if(!items.length){
        listWrap.appendChild(WS.UI.el('div',{class:'empty'},'Список пуст. Загружаю…'));
      }
      items.forEach(it => {
        const first = (it.blocks && it.blocks[0]) ? it.blocks[0].text : '';
        listWrap.appendChild(WS.UI.el('div',{class:'row', onClick:()=>openBlocks(it)},
          WS.UI.el('div',{class:'num'}, '#' + (it.number ?? '—')),
          WS.UI.el('div',{class:'main'},
            WS.UI.el('div',{class:'ttl'}, it.title || '(без названия)'),
            WS.UI.el('div',{class:'prev'}, WS.UI.preview(first, 60))
          )
        ));
      });

      // подгрузить свежее с сервера и перерисовать
      WS.Data.load(tab).then(() => { if(WS.state.screen==='hymns') renderList(); }).catch(()=>{});
    }

    // ---- экран блоков (выбор и отправка) ----
    function openBlocks(it){
      WS.UI.clear(listWrap);
      sentBlockKey = null;

      listWrap.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginBottom:'12px'}},
        WS.UI.el('button',{class:'btn btn-ghost', onClick:renderList},'← К списку'),
        WS.Auth.canEdit() ? WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>openEditor(it)},'Изменить') : null
      ));

      listWrap.appendChild(WS.UI.el('div',{class:'card'},
        WS.UI.el('div',{style:{fontWeight:'bold', fontSize:'18px'}}, '#' + (it.number ?? '—') + '  ' + (it.title||'')),
        it.show_translation ? WS.UI.el('div',{class:'muted', style:{fontSize:'13px'}},'С переводом') : null
      ));

      (it.blocks || []).forEach((b, i) => {
        const key = it.id + ':' + i;
        const tagClass = b.type === 'chorus' ? 'tag-chorus' : b.type === 'bridge' ? 'tag-bridge' : 'tag-verse';
        const tagName  = b.type === 'chorus' ? 'Припев'      : b.type === 'bridge' ? 'Бридж'     : 'Куплет';
        const row = WS.UI.el('div',{class:'card', style:{cursor:'pointer'}, onClick:()=>sendBlock(it, b, key, row)},
          WS.UI.el('span',{class:'block-tag ' + tagClass}, tagName),
          WS.UI.el('div',{style:{whiteSpace:'pre-wrap'}}, b.text || ''),
          (it.show_translation && b.translation) ? WS.UI.el('div',{class:'muted', style:{whiteSpace:'pre-wrap', marginTop:'8px', fontSize:'14px'}}, b.translation) : null
        );
        if(key === sentBlockKey) row.style.borderColor = 'var(--tan)';
        listWrap.appendChild(row);
      });

      // кнопка очистки проектора
      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginTop:'8px'}, onClick:()=>{
        WS.Sync.send({ t:'clear' }); WS.state.lastDisplay=null; sentBlockKey=null;
        listWrap.querySelectorAll('.card').forEach(c=>c.style.borderColor='');
        WS.UI.toast('Проектор очищен');
      }},'Очистить проектор'));
    }

    function sendBlock(it, b, key, rowEl){
      const payload = {
        t:'block',
        title: it.title || '',
        number: it.number ?? '',
        blockType: b.type || 'verse',
        text: b.text || '',
        translation: (it.show_translation && b.translation) ? b.translation : '',
        showTranslation: !!(it.show_translation && b.translation)
      };
      WS.Sync.send(payload);
      WS.state.lastDisplay = payload;
      // подсветка
      sentBlockKey = key;
      listWrap.querySelectorAll('.card').forEach(c => c.style.borderColor='');
      if(rowEl) rowEl.style.borderColor = 'var(--tan)';
    }

    // ---- редактор ----
    function openEditor(existing){
      const isNew = !existing;
      if(!isNew && !WS.Auth.canEdit()){ WS.UI.denied(); return; }
      if(isNew && !WS.Auth.canAdd()){ WS.UI.denied(); return; }

      const model = existing ? JSON.parse(JSON.stringify(existing)) : {
        id: WS.Data.newId(), number:'', title:'', show_translation:false,
        blocks:[ { type:'verse', text:'', translation:'' } ]
      };

      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('div',{style:{fontSize:'18px', fontWeight:'bold', marginBottom:'12px'}},
        isNew ? 'Новый ' + (tab==='songs'?'песня':'псалом') : 'Редактирование'));

      // номер
      listWrap.appendChild(WS.UI.el('div',{class:'field-label'},'Номер'));
      const numInp = WS.UI.el('input',{class:'input', type:'number', inputmode:'numeric',
        min:WS.config.PSALM_NUM_MIN, max:WS.config.PSALM_NUM_MAX, value:model.number});
      listWrap.appendChild(numInp);

      // название
      listWrap.appendChild(WS.UI.el('div',{class:'field-label'},'Название'));
      const titleInp = WS.UI.el('input',{class:'input', value:model.title});
      listWrap.appendChild(titleInp);

      // показывать перевод
      const transChk = WS.UI.el('input',{type:'checkbox'});
      transChk.checked = !!model.show_translation;
      const chkRow = WS.UI.el('label',{style:{display:'flex', alignItems:'center', gap:'10px', margin:'16px 0'}},
        transChk, WS.UI.el('span',null,'Показывать перевод на проекторе'));
      listWrap.appendChild(chkRow);

      // блоки
      const blocksWrap = WS.UI.el('div',null);
      listWrap.appendChild(blocksWrap);

      function drawBlocks(){
        WS.UI.clear(blocksWrap);
        model.blocks.forEach((b, i) => {
          const card = WS.UI.el('div',{class:'card'});
          // тип + перемещение + удаление
          const typeSel = WS.UI.el('select',{class:'input', style:{borderBottom:'2px solid var(--line)'}},
            opt('verse','Куплет', b.type),
            opt('chorus','Припев', b.type),
            opt('bridge','Бридж', b.type)
          );
          typeSel.addEventListener('change', ()=> b.type = typeSel.value);
          const ctrl = WS.UI.el('div',{style:{display:'flex', gap:'8px', alignItems:'center', marginBottom:'8px'}},
            WS.UI.el('div',{style:{flex:1}}, typeSel),
            WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i>0){ swap(model.blocks,i,i-1); drawBlocks(); } }},'↑'),
            WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i<model.blocks.length-1){ swap(model.blocks,i,i+1); drawBlocks(); } }},'↓'),
            WS.UI.el('button',{class:'icon-btn', onClick:()=>{
              if(model.blocks.length<=1){ WS.UI.toast('Нужен хотя бы один блок','error'); return; }
              WS.UI.confirm('Удалить блок?', ()=>{ model.blocks.splice(i,1); drawBlocks(); });
            }},'×')
          );
          card.appendChild(ctrl);

          const txt = WS.UI.el('textarea',{class:'input', placeholder:'Текст блока'}); txt.value = b.text||'';
          txt.addEventListener('input', ()=> b.text = txt.value);
          card.appendChild(txt);

          // перевод (если включён)
          if(transChk.checked){
            const tr = WS.UI.el('textarea',{class:'input', placeholder:'Перевод', style:{marginTop:'8px'}}); tr.value = b.translation||'';
            tr.addEventListener('input', ()=> b.translation = tr.value);
            card.appendChild(tr);
          }
          blocksWrap.appendChild(card);
        });
      }
      transChk.addEventListener('change', drawBlocks);
      drawBlocks();

      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'14px'}, onClick:()=>{
        model.blocks.push({ type:'verse', text:'', translation:'' }); drawBlocks();
      }},'+ Блок'));

      // сохранить / удалить / отмена
      listWrap.appendChild(WS.UI.el('div',{class:'btn-row'},
        WS.UI.el('button',{class:'btn', onClick:save},'Сохранить'),
        WS.UI.el('button',{class:'btn btn-ghost', onClick:renderList},'Отмена')
      ));
      if(!isNew && WS.Auth.canEdit()){
        listWrap.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove},'Удалить'));
      }

      async function save(){
        model.number = clampNum(numInp.value);
        model.title = titleInp.value.trim();
        model.show_translation = transChk.checked;
        if(!model.title){ WS.UI.toast('Введите название','error'); return; }

        const items = WS.Data.items(tab).slice();
        const idx = items.findIndex(x => x.id === model.id);
        if(idx >= 0) items[idx] = model; else items.push(model);

        WS.UI.toast('Сохранение…');
        try {
          await WS.Data.save(tab, items, (idx>=0?'Edit ':'Add ') + model.number + '. ' + model.title);
          WS.UI.toast('Сохранено ✓');
          renderList();
        } catch(e){ WS.UI.toast('Ошибка: ' + (e.message||'не удалось'),'error'); }
      }
      async function remove(){
        WS.UI.confirm('Удалить «' + model.title + '»?', async ()=>{
          const items = WS.Data.items(tab).filter(x => x.id !== model.id);
          try {
            await WS.Data.save(tab, items, 'Delete ' + model.number + '. ' + model.title);
            WS.UI.toast('Удалено'); renderList();
          } catch(e){ WS.UI.toast('Ошибка: ' + (e.message||''),'error'); }
        },'Удалить');
      }
    }

    renderList();
  };

  // утилиты
  function opt(val, label, cur){ const o = document.createElement('option'); o.value=val; o.textContent=label; if(cur===val) o.selected=true; return o; }
  function swap(a,i,j){ const t=a[i]; a[i]=a[j]; a[j]=t; }
  function clampNum(v){ let n = parseInt(v,10); if(isNaN(n)) return ''; n=Math.max(WS.config.PSALM_NUM_MIN, Math.min(WS.config.PSALM_NUM_MAX,n)); return n; }
  function sortItems(arr){ return arr.slice().sort((a,b)=>(a.number||0)-(b.number||0)); }
})();
