/* follow.js — режим «Дивитися екран» (follow-along) для залу.
   Без пароля. Зеркалит проектор через ntfy (только чтение), у каждого свои
   настройки: размер шрифта, субтитры (осн/переклад 70/30), какой язык основной.
   Плюс генерация QR для входа в этот режим. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};
  const F = {};

  F.url = function(){ return location.origin + location.pathname + '#watch'; };
  F.appUrl = function(){ return location.origin + location.pathname; };

  // элемент с QR-кодом (тёмный на белом)
  F.qrEl = function(text, sizePx){
    const box = WS.UI.el('div',{style:{background:'#fff', padding:'14px', borderRadius:'12px', width:sizePx+'px', height:sizePx+'px', margin:'0 auto', boxSizing:'content-box', display:'flex', alignItems:'center', justifyContent:'center'}});
    try {
      const q = window.qrcode(0, 'M'); q.addData(text || ' '); q.make();
      box.innerHTML = q.createSvgTag({ scalable:true, margin:0 });
      const svg = box.querySelector('svg'); if(svg){ svg.style.width='100%'; svg.style.height='100%'; svg.removeAttribute('width'); svg.removeAttribute('height'); }
    } catch(e){ box.textContent = 'QR'; }
    return box;
  };

  // модалка-генератор QR: додаток / для залу / будь-яке посилання (пожертви тощо) + підпис
  F.showQR = function(){
    let url = F.appUrl(), caption = WS.t('brand');
    const preview = WS.UI.el('div', null);
    function draw(){ WS.UI.clear(preview); preview.appendChild(F.qrEl(url, 230)); }
    const urlInp = WS.UI.el('input',{class:'input', value:url, placeholder:'https://…'});
    urlInp.addEventListener('input', ()=>{ url = urlInp.value.trim(); draw(); });
    const capInp = WS.UI.el('input',{class:'input', value:caption, placeholder:WS.t('qr_caption_ph'), style:{marginTop:'8px'}});
    capInp.addEventListener('input', ()=>{ caption = capInp.value; });

    const body = WS.UI.el('div', null);
    body.appendChild(WS.UI.el('div',{class:'btn-row', style:{marginBottom:'10px'}},
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ url=F.appUrl(); urlInp.value=url; caption=WS.t('brand'); capInp.value=caption; draw(); }}, WS.t('qr_app')),
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ url=F.url(); urlInp.value=url; caption=WS.t('qr_scan_hint'); capInp.value=caption; draw(); }}, WS.t('qr_for_hall'))
    ));
    body.appendChild(preview);
    body.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('qr_link_label')));
    body.appendChild(urlInp);
    body.appendChild(capInp);
    draw();

    const buttons = [{ label:WS.t('close'), kind:'ghost' }];
    if(WS.Auth.canEdit()) buttons.unshift({ label:WS.t('qr_to_screen'), onClick:()=>{ const p = { t:'qr', url:url, caption:caption }; WS.Sync.send(p); WS.Projector.set(p); WS.UI.toast(WS.t('sent_projector')); } });
    WS.UI.modal({ title:WS.t('qr_hall'), body:body, buttons:buttons });
  };

  WS.Follow = F;

  // ---- экран зрителя ----
  WS.App.screens.follow = function(root){
    let scale = parseFloat(WS.ls.get('watch_scale','1')) || 1;
    let sub   = WS.ls.get('watch_sub','1') === '1';
    let swap  = WS.ls.get('watch_swap','') === '1';

    const screen = WS.UI.el('div',{class:'watch-screen'});
    const bar = WS.UI.el('div',{class:'watch-bar'});
    const content = WS.UI.el('div',{class:'watch-content'});
    screen.appendChild(bar); screen.appendChild(content);
    root.appendChild(screen);

    function ctrlBtn(txt, on){ return WS.UI.el('button',{class:'watch-btn', onClick:on}, txt); }
    function buildBar(){
      WS.UI.clear(bar);
      bar.appendChild(ctrlBtn('A−', ()=>{ scale = Math.max(0.6, scale-0.15); WS.ls.set('watch_scale', String(scale)); paint(); }));
      bar.appendChild(ctrlBtn('A+', ()=>{ scale = Math.min(2.6, scale+0.15); WS.ls.set('watch_scale', String(scale)); paint(); }));
      bar.appendChild(ctrlBtn((sub?'☑ ':'☐ ')+WS.t('watch_sub'), ()=>{ sub = !sub; WS.ls.set('watch_sub', sub?'1':''); paint(); }));
      bar.appendChild(ctrlBtn('⇅ '+WS.t('watch_swap'), ()=>{ swap = !swap; WS.ls.set('watch_swap', swap?'1':''); paint(); }));
      bar.appendChild(ctrlBtn(WS.I18n.getLang()==='en'?'УКР':'ENG', ()=>{ WS.I18n.setLang(WS.I18n.getLang()==='en'?'uk':'en'); buildBar(); }));
      bar.appendChild(ctrlBtn('⛶', ()=>{ try { if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch(e){} }));
      bar.appendChild(ctrlBtn('✕', ()=>{ location.hash=''; location.reload(); }));
    }

    function textBlock(str, big){
      const d = WS.UI.el('div',{class:'watch-text'}, str || '');
      d.style.fontSize = ((big ? 6.6 : 3.7) * scale) + 'vw';
      return d;
    }

    let splashStop = null;
    function paint(){
      buildBar();
      if(splashStop){ splashStop(); splashStop = null; }
      WS.UI.clear(content);
      const d = WS.Projector.current;
      if(d && d.t === 'splash'){ const h = WS.Splash.render(content, d); splashStop = h.stop; return; }
      if(d && d.t === 'announce_loop'){
        splashStop = WS.Loop.watch(d, (i) => {
          WS.UI.clear(content);
          const it = (d.items || [])[i] || {};
          const box = WS.UI.el('div',{class:'watch-box'});
          if(it.title){ const tt = WS.UI.el('div',{class:'watch-text'}, it.title); tt.style.fontSize = (4 * scale) + 'vw'; tt.style.opacity = '0.8'; tt.style.marginBottom = '2vw'; box.appendChild(tt); }
          const tx = WS.UI.el('div',{class:'watch-text'}, it.text || ''); tx.style.fontSize = (6.6 * scale) + 'vw'; box.appendChild(tx);
          content.appendChild(box);
        }).stop;
        return;
      }
      if(!d || d.t === 'clear' || d.t === 'qr'){
        content.appendChild(WS.UI.el('div',{class:'watch-wait'}, WS.t('watch_waiting')));
        return;
      }
      if(d.t === 'media'){
        if(d.driveId){
          const fr = WS.UI.el('iframe',{class:'watch-media', src:'https://drive.google.com/file/d/'+d.driveId+'/preview', allow:'autoplay'});
          content.appendChild(fr);
        } else content.appendChild(WS.UI.el('div',{class:'watch-wait'}, WS.t('watch_screen_only')));
        return;
      }
      // текстовый контент: определить основной/вторичный язык
      let prim = '', sec = '', ref = '';
      if(d.t === 'block'){ prim = d.text || ''; sec = (d.showTranslation && d.translation) ? d.translation : ''; }
      else if(d.t === 'bible'){ prim = d.text || ''; sec = d.bilingual ? (d.text_en || '') : ''; ref = d.ref || ''; }
      else if(d.t === 'text'){ prim = d.body || ''; }
      if(swap && sec){ const t = prim; prim = sec; sec = t; }

      const box = WS.UI.el('div',{class:'watch-box'});
      box.appendChild(textBlock(prim, true));
      if(sec && sub){
        box.appendChild(WS.UI.el('div',{class:'watch-div'}));
        box.appendChild(textBlock(sec, false));
      }
      if(ref) box.appendChild(WS.UI.el('div',{class:'watch-ref'}, ref));
      content.appendChild(box);
    }

    WS.Projector.attach(paint);
    paint();
  };
})();
