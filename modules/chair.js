/* ============================================================
   chair.js — роль Кафедра. Подменю: Медиа · Текст · Чат · Библия.
     Текст  — список заготовок (texts.json), тап → на проектор.
     Библия — книга→глава→стих, EN/UA, выбор стиха → оператору в ленту
              (на проектор НЕ идёт), отправляется сразу на двух языках.
     Медиа  — список media.json, тап → embed на проекторе (Google Drive preview).
     Чат    — общий чат с оператором.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  let bibleLang = WS.ls.get('bible_lang','ua');  // 'ua' | 'en'

  WS.App.screens.chair = function(root, params){
    const view = params.view || 'menu';
    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    function header(title, back){
      return WS.UI.el('div',{class:'topbar'},
        WS.UI.el('button',{class:'icon-btn bare', onClick: back },'←'),
        WS.UI.el('div',{class:'title'}, title)
      );
    }

    if(view === 'menu'){
      screen.appendChild(header('Кафедра', ()=>WS.App.show('role')));
      const body = WS.UI.el('div',{class:'pad col'});
      [['media','Медиа'],['text','Текст'],['chat','Чат'],['bible','Библия']].forEach(([v,label])=>{
        body.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px', padding:'18px', fontSize:'18px'}, onClick:()=>{
          if(v==='chat') WS.App.show('chat', { back:'chair' });
          else WS.App.show('chair', { view:v });
        }}, label));
      });
      screen.appendChild(body);
      root.appendChild(screen); return;
    }

    if(view === 'text'){
      screen.appendChild(header('Текст', ()=>WS.App.show('chair')));
      const wrap = WS.UI.el('div',{class:'scroll grow pad'});
      screen.appendChild(wrap); root.appendChild(screen);
      renderTexts(wrap); return;
    }

    if(view === 'media'){
      screen.appendChild(header('Медиа', ()=>WS.App.show('chair')));
      const wrap = WS.UI.el('div',{class:'scroll grow pad'});
      screen.appendChild(wrap); root.appendChild(screen);
      renderMedia(wrap); return;
    }

    if(view === 'bible'){
      screen.appendChild(header('Библия', ()=>WS.App.show('chair')));
      const wrap = WS.UI.el('div',{class:'scroll grow pad'});
      screen.appendChild(wrap); root.appendChild(screen);
      renderBible(wrap); return;
    }
  };

  // ---------- ТЕКСТ ----------
  function renderTexts(wrap){
    WS.UI.clear(wrap);
    const items = WS.Data.items('texts');
    if(!items.length) wrap.appendChild(WS.UI.el('div',{class:'empty'},'Заготовок нет. Загружаю…'));
    items.forEach(it => {
      wrap.appendChild(WS.UI.el('div',{class:'row', onClick:()=>{
        const payload = { t:'text', body: it.text || it.body || '' };
        WS.Sync.send(payload); WS.state.lastDisplay = payload;
        WS.UI.toast('Отправлено на проектор');
      }},
        WS.UI.el('div',{class:'main'},
          WS.UI.el('div',{class:'ttl'}, it.title || WS.UI.preview(it.text||it.body, 40)),
          WS.UI.el('div',{class:'prev'}, WS.UI.preview(it.text||it.body, 60))
        )
      ));
    });
    WS.Data.load('texts').then(()=>{ if(WS.state.screen==='chair') renderTexts(wrap); }).catch(()=>{});
  }

  // ---------- МЕДИА ----------
  function renderMedia(wrap){
    WS.UI.clear(wrap);
    const items = WS.Data.items('media');
    wrap.appendChild(WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'12px'}},
      'Файлы добавляются в media.json (ссылки Google Drive). Тап — показать на проекторе.'));
    if(!items.length) wrap.appendChild(WS.UI.el('div',{class:'empty'},'Медиа нет'));
    items.forEach(it => {
      wrap.appendChild(WS.UI.el('div',{class:'row', onClick:()=>{
        const payload = { t:'media', mediaType: it.type||'video', driveId: it.drive_id||'', title: it.title||'' };
        WS.Sync.send(payload); WS.state.lastDisplay = payload;
        WS.UI.toast('Запущено на проекторе');
      }},
        WS.UI.el('div',{class:'num'}, ({video:'▶',image:'▣',presentation:'▤'}[it.type]||'•')),
        WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, it.title||'(без названия)'),
          WS.UI.el('div',{class:'prev'}, it.type||''))
      ));
    });
    WS.Data.load('media').then(()=>{ if(WS.state.screen==='chair') renderMedia(wrap); }).catch(()=>{});
  }

  // ---------- БИБЛИЯ ----------
  function renderBible(wrap){
    WS.UI.clear(wrap);

    // переключатель языка
    const langRow = WS.UI.el('div',{class:'tabs', style:{padding:'0 0 12px'}},
      WS.UI.el('button',{class:'tab'+(bibleLang==='ua'?' on':''), onClick:()=>{ bibleLang='ua'; WS.ls.set('bible_lang','ua'); renderBible(wrap); }},'Українська'),
      WS.UI.el('button',{class:'tab'+(bibleLang==='en'?' on':''), onClick:()=>{ bibleLang='en'; WS.ls.set('bible_lang','en'); renderBible(wrap); }},'English')
    );
    wrap.appendChild(langRow);

    const books = WS.Data.items('bible');
    if(!books.length){
      wrap.appendChild(WS.UI.el('div',{class:'empty'},'Загружаю книги…'));
      WS.Data.load('bible').then(()=>{ if(WS.state.screen==='chair') renderBible(wrap); }).catch(()=>{});
      return;
    }

    const listWrap = WS.UI.el('div',null);
    wrap.appendChild(listWrap);

    function bookName(b){ return bibleLang==='en' ? b.en : b.ua; }

    function showBooks(){
      WS.UI.clear(listWrap);
      books.forEach(b => {
        listWrap.appendChild(WS.UI.el('div',{class:'row', onClick:()=>showChapters(b)},
          WS.UI.el('div',{class:'main'}, WS.UI.el('div',{class:'ttl'}, bookName(b)))
        ));
      });
    }
    function showChapters(b){
      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:showBooks},'← Книги'));
      listWrap.appendChild(WS.UI.el('div',{style:{fontWeight:'bold', marginBottom:'10px'}}, bookName(b)));
      const grid = WS.UI.el('div',{style:{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px'}});
      for(let c=1; c<=b.chapters; c++){
        grid.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'12px 0'}, onClick:()=>showVerses(b,c)}, String(c)));
      }
      listWrap.appendChild(grid);
    }
    function showVerses(b, c){
      WS.UI.clear(listWrap);
      listWrap.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{marginBottom:'12px'}, onClick:()=>showChapters(b)},'← Главы'));
      listWrap.appendChild(WS.UI.el('div',{style:{fontWeight:'bold', marginBottom:'10px'}}, bookName(b) + ' ' + c));
      // число стихов заранее неизвестно — даём сетку 1..60 (стихи из json подключим позже)
      const grid = WS.UI.el('div',{style:{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px'}});
      for(let v=1; v<=60; v++){
        grid.appendChild(WS.UI.el('button',{class:'btn btn-ghost', style:{padding:'12px 0'}, onClick:()=>sendVerse(b,c,v)}, String(v)));
      }
      listWrap.appendChild(grid);
    }
    function sendVerse(b, c, v){
      // отправляем оператору В ЛЕНТУ (не на проектор), сразу на двух языках
      const refUa = b.ua + ' ' + c + ':' + v;
      const refEn = b.en + ' ' + c + ':' + v;
      WS.Sync.send({ t:'activity', kind:'bible', label: refUa + '  /  ' + refEn });
      WS.UI.toast('Отправлено оператору: ' + (bibleLang==='en'?refEn:refUa));
    }

    showBooks();
  }
})();
