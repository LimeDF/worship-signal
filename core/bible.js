/* bible.js — тексты Библии. Бесплатные переводы тянутся с bolls.life и кэшируются
   в localStorage по главам (после первого открытия работают без интернета).
   Позже сюда же добавим NKJV/NIV/укр. через api.bible (по ключу). */
(function(){
  const B = {};
  const PREFIX = 'bible_';

  // Доступные сейчас (бесплатные, public/свободные). Позже добавим API-переводы.
  B.translations = [
    { code:'UBIO', lang:'ua', name:'Огієнко (укр.)',  src:'bolls' },
    { code:'WEB',  lang:'en', name:'World English Bible', src:'bolls' }
  ];
  B.get = function(code){ return B.translations.find(t => t.code === code) || B.translations[0]; };

  function strip(html){
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"')
      .replace(/[ \t]{2,}/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  // Промис -> массив [{verse, text}] для главы. book = 1..66, chapter = 1..N
  B.getChapter = async function(code, book, chapter){
    const key = PREFIX + code + '_' + book + '_' + chapter;
    const cached = WS.ls.get(key, null);
    if(cached){ try { const arr = JSON.parse(cached); if(Array.isArray(arr) && arr.length) return arr; } catch(e){} }
    const url = 'https://bolls.life/get-chapter/' + code + '/' + book + '/' + chapter + '/';
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const verses = (Array.isArray(data) ? data : []).map(v => ({ verse: v.verse, text: strip(v.text) })).filter(v => v.text);
    if(verses.length){ try { WS.ls.set(key, JSON.stringify(verses)); } catch(e){} }
    return verses;
  };

  // один стих из уже загруженной главы
  B.verseText = function(verses, v){ const f = (verses || []).find(x => x.verse === v); return f ? f.text : ''; };

  WS.Bible = B;
})();
