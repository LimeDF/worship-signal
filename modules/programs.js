/* ============================================================
   programs.js — Программы служения (сценарии).
   Программа = упорядоченный список элементов:
     psalm / song / text / announcement — ссылка на элемент коллекции (ref_id)
     note — заметка (Проповедь, Молитва и т.п.), ничего не отправляет.
   Использование: открыть программу → идти по списку. Тап:
     псалом/песня → блоки этого элемента прямо здесь (отправка на проектор);
     текст/объявление → сразу на проектор;
     заметка → просто отметка.
   Составление (создать/изменить/удалить) — для уровня Сцена и выше.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  const COLL = { psalm:'psalms', song:'songs', text:'texts', announcement:'announcements' };
  const TYPE_LABEL = { psalm:'Псалом', song:'Песня', text:'Текст', announcement:'Объявление', note:'Заметка' };
  let current = null;   // активная программа (клон) для detail/edit

  WS.App.screens.programs = function(root, params){
    const view = (params && params.view) || 'list';
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    const content = WS.UI.el('div',{class:'scroll grow pad'});

    function top(title, back){
      const bar = WS.UI.el('div',{class:'topbar'},
        WS.UI.el('button',{class:'icon-btn bare', onClick:back},'←'),
        WS.UI.el('div',{class:'title'}, title)
      );
      return bar;
    }

    if(view === 'list'){
      screen.appendChild(top('Программы служения', ()=>WS.App.show('role')));
      screen.appendChild(content);
      root.appendChild(screen);
      content.appendChild(WS.UI.el('div',{class:'empty'},'Загрузка…'));
      // грузим программы + коллекции для ссылок
      Promise.all(['programs','psalms','songs','texts','announcements'].map(c => WS.Data.load(c).catch(()=>{})))
        .then(()=>{ if(WS.state.screen==='programs') renderList(content); });
      return;
    }

    if(view === 'detail'){
      if(!current){ WS.App.show('programs', {view:'list'}); return; }
      screen.appendChild(top(current.title || 'Программа', ()=>WS.App.show('programs', {view:'list'})));
      screen.appendChild(content);
      root.appendChild(screen);
      renderDetail(content);
      return;
    }

    if(view === 'edit'){
      if(!current){ WS.App.show('programs', {view:'list'}); return; }
      screen.appendChild(top('Редактирование', ()=>WS.App.show('programs', {view: current._saved ? 'detail' : 'list'})));
      screen.appendChild(content);
      root.appendChild(screen);
      renderEdit(content);
      return;
    }
  };

  // ---------- СПИСОК ПРОГРАММ ----------
  function renderList(content){
    WS.UI.clear(content);
    if(WS.Auth.canEdit()){
      content.appendChild(WS.UI.el('button',{class:'btn', style:{marginBottom:'14px'}, onClick:()=>{
        current = { id:WS.Data.newId(), title:'', date:'', items:[], _saved:false };
        WS.App.show('programs', {view:'edit'});
      }},'+ Создать программу'));
    }
    const items = (WS.Data.items('programs') || []).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if(!items.length){ content.appendChild(WS.UI.el('div',{class:'empty'},'Программ нет')); return; }
    items.forEach(p => {
      content.appendChild(WS.UI.el('div',{class:'row', onClick:()=>{ current = JSON.parse(JSON.stringify(p)); current._saved = true; WS.App.show('programs', {view:'detail'}); }},
        WS.UI.el('div',{class:'main'},
          WS.UI.el('div',{class:'ttl'}, p.title || '(без названия)'),
          WS.UI.el('div',{class:'prev'}, (p.date ? p.date + ' · ' : '') + (p.items ? p.items.length : 0) + ' элем.')
        ),
        WS.UI.el('span',{class:'muted'},'›')
      ));
    });
  }

  // ---------- ПРОСМОТР/ВЕДЕНИЕ ПРОГРАММЫ ----------
  function renderDetail(content){
    WS.UI.clear(content);

    const bar = WS.UI.el('div',{class:'btn-row', style:{marginBottom:'12px'}});
    bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view:'list'})},'← К программам'));
    if(WS.Auth.canEdit()) bar.appendChild(WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view:'edit'})},'Изменить'));
    content.appendChild(bar);

    if(current.date) content.appendChild(WS.UI.el('div',{class:'muted', style:{marginBottom:'10px'}}, current.date));

    if(!current.items || !current.items.length){ content.appendChild(WS.UI.el('div',{class:'empty'},'В программе пусто')); return; }

    current.items.forEach((el, i) => {
      const row = WS.UI.el('div',{class:'row', onClick:()=>useItem(content, el)},
        WS.UI.el('div',{class:'num', style:{minWidth:'30px'}}, String(i+1)),
        WS.UI.el('div',{class:'main'},
          WS.UI.el('div',{class:'ttl'}, label(el)),
          WS.UI.el('div',{class:'prev'}, TYPE_LABEL[el.type] || '')
        ),
        el.type === 'note' ? null : WS.UI.el('span',{class:'muted'},'›')
      );
      content.appendChild(row);
    });
  }

  function useItem(content, el){
    if(el.type === 'note'){ WS.UI.toast(el.text || 'Заметка'); return; }

    if(el.type === 'psalm' || el.type === 'song'){
      const coll = COLL[el.type];
      const item = (WS.Data.items(coll) || []).find(x => x.id === el.ref_id);
      if(!item){ WS.UI.toast('Элемент не найден (удалён?)','error'); return; }
      // показываем блоки прямо здесь, кнопка назад возвращает к программе
      WS.Hymns.renderBlocks(content, item, { onBack: ()=>renderDetail(content) });
      return;
    }

    if(el.type === 'text' || el.type === 'announcement'){
      const coll = COLL[el.type];
      const item = (WS.Data.items(coll) || []).find(x => x.id === el.ref_id);
      const body = item ? (item.text || item.body || '') : (el.text || '');
      if(!body){ WS.UI.toast('Текст не найден','error'); return; }
      const payload = { t:'text', body };
      WS.Sync.send(payload); WS.state.lastDisplay = payload;
      WS.UI.toast('Отправлено на проектор');
    }
  }

  // ---------- РЕДАКТОР ПРОГРАММЫ ----------
  function renderEdit(content){
    WS.UI.clear(content);

    content.appendChild(WS.UI.el('div',{class:'field-label'},'Название'));
    const titleInp = WS.UI.el('input',{class:'input', value:current.title || '', placeholder:'Воскресное служение'});
    content.appendChild(titleInp);

    content.appendChild(WS.UI.el('div',{class:'field-label'},'Дата'));
    const dateInp = WS.UI.el('input',{class:'input', type:'date', value:current.date || ''});
    content.appendChild(dateInp);

    content.appendChild(WS.UI.el('div',{class:'field-label', style:{marginTop:'16px'}},'Элементы программы'));
    const itemsWrap = WS.UI.el('div', null);
    content.appendChild(itemsWrap);

    function drawItems(){
      WS.UI.clear(itemsWrap);
      if(!current.items.length){ itemsWrap.appendChild(WS.UI.el('div',{class:'muted', style:{padding:'8px 0'}},'Пока пусто')); }
      current.items.forEach((el, i) => {
        itemsWrap.appendChild(WS.UI.el('div',{class:'row'},
          WS.UI.el('div',{class:'num', style:{minWidth:'30px'}}, String(i+1)),
          WS.UI.el('div',{class:'main'},
            WS.UI.el('div',{class:'ttl'}, label(el)),
            WS.UI.el('div',{class:'prev'}, TYPE_LABEL[el.type] || '')),
          WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i>0){ swap(current.items,i,i-1); drawItems(); } }},'↑'),
          WS.UI.el('button',{class:'icon-btn', onClick:()=>{ if(i<current.items.length-1){ swap(current.items,i,i+1); drawItems(); } }},'↓'),
          WS.UI.el('button',{class:'icon-btn', onClick:()=>{ current.items.splice(i,1); drawItems(); }},'×')
        ));
      });
    }
    drawItems();

    content.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{margin:'12px 0'}, onClick:()=>addItem(drawItems)},'+ Добавить элемент'));

    content.appendChild(WS.UI.el('div',{class:'btn-row'},
      WS.UI.el('button',{class:'btn', onClick:save},'Сохранить'),
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>WS.App.show('programs', {view: current._saved ? 'detail' : 'list'})},'Отмена')
    ));
    if(current._saved && WS.Auth.canEdit())
      content.appendChild(WS.UI.el('button',{class:'btn btn-danger', style:{marginTop:'10px'}, onClick:remove},'Удалить программу'));

    async function save(){
      current.title = titleInp.value.trim();
      current.date = dateInp.value;
      if(!current.title){ WS.UI.toast('Введите название','error'); return; }
      const clean = { id:current.id, title:current.title, date:current.date, items:current.items };

      const items = (WS.Data.items('programs') || []).slice();
      const idx = items.findIndex(x => x.id === current.id);
      if(idx >= 0) items[idx] = clean; else items.push(clean);

      WS.UI.toast('Сохранение…');
      try {
        await WS.Data.save('programs', items, (idx>=0?'Edit ':'Add ') + 'program ' + current.title);
        current._saved = true; WS.UI.toast('Сохранено ✓');
        WS.App.show('programs', {view:'detail'});
      } catch(e){ WS.UI.toast('Ошибка: ' + (e.message || ''), 'error'); }
    }
    async function remove(){
      WS.UI.confirm('Удалить программу «' + current.title + '»?', async ()=>{
        const items = (WS.Data.items('programs') || []).filter(x => x.id !== current.id);
        try { await WS.Data.save('programs', items, 'Delete program'); WS.UI.toast('Удалено'); WS.App.show('programs', {view:'list'}); }
        catch(e){ WS.UI.toast('Ошибка: ' + (e.message || ''), 'error'); }
      },'Удалить');
    }
  }

  // выбор элемента для добавления
  function addItem(after){
    const body = WS.UI.el('div',{class:'col'});
    const m = WS.UI.modal({ title:'Тип элемента', body, buttons:[{label:'Отмена', kind:'ghost'}] });
    [['psalm','Псалом'],['song','Песня'],['text','Текст'],['announcement','Объявление'],['note','Заметка']].forEach(([type,label])=>{
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'8px'}, onClick:()=>{
        m.close();
        if(type === 'note') addNote(after);
        else pickFrom(type, after);
      }}, label));
    });
  }

  function addNote(after){
    const inp = WS.UI.el('input',{class:'input', placeholder:'Напр. Проповедь'});
    const m = WS.UI.modal({ title:'Заметка', body:inp, buttons:[
      { label:'Отмена', kind:'ghost' },
      { label:'Добавить', onClick:()=>{ const t = inp.value.trim(); if(!t) return true; current.items.push({ type:'note', text:t }); after(); } }
    ]});
    setTimeout(()=>inp.focus(), 100);
  }

  function pickFrom(type, after){
    const coll = COLL[type];
    const items = WS.Data.items(coll) || [];
    const body = WS.UI.el('div',{class:'col', style:{maxHeight:'50vh', overflowY:'auto'}});
    const m = WS.UI.modal({ title:'Выберите: ' + TYPE_LABEL[type], body, buttons:[{label:'Отмена', kind:'ghost'}] });
    if(!items.length){ body.appendChild(WS.UI.el('div',{class:'empty'},'Список пуст')); return; }
    const sorted = items.slice().sort((a,b)=> (a.number||0)-(b.number||0) || String(a.title||'').localeCompare(String(b.title||'')));
    sorted.forEach(it => {
      const cap = (it.number ? '#'+it.number+' ' : '') + (it.title || WS.UI.preview(it.text||it.body, 30));
      body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'8px', textAlign:'left'}, onClick:()=>{
        current.items.push({ type, ref_id:it.id, number:it.number, title:it.title || WS.UI.preview(it.text||it.body, 30) });
        m.close(); after();
      }}, cap));
    });
  }

  // подпись элемента (с попыткой освежить из коллекции)
  function label(el){
    if(el.type === 'note') return '✎ ' + (el.text || 'Заметка');
    const coll = COLL[el.type];
    const live = coll ? (WS.Data.items(coll) || []).find(x => x.id === el.ref_id) : null;
    if(live) return (live.number ? '#'+live.number+' ' : '') + (live.title || WS.UI.preview(live.text||live.body, 30));
    return (el.number ? '#'+el.number+' ' : '') + (el.title || '(элемент)');
  }

  function swap(a,i,j){ const t = a[i]; a[i] = a[j]; a[j] = t; }
})();
