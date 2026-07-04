/* splash.js — заставка + відлік + розклад.
   WS.Cfg — чтение/запись общего config.json (розклад, заставка).
   WS.Schedule — вычисление времени наступного служіння.
   WS.Splash — рендер заставки з живим відліком (лого → відлік → лого 3 хв → чорний). */
(function(){
  function p2(n){ return (n<10?'0':'') + n; }

  const Cfg = {
    get(){ return (WS.Data.items('config') || [])[0] || { id:'app' }; },
    async save(patch, msg){
      const items = (WS.Data.items('config') || []).slice();
      const base = items.length ? Object.assign({}, items[0]) : { id:'app' };
      Object.assign(base, patch);
      if(items.length) items[0] = base; else items.push(base);
      await WS.Data.save('config', items, msg || 'Update config');
    }
  };
  WS.Cfg = Cfg;

  const Schedule = {
    // объект розкладу: { mode:'weekly'|'once', time:'HH:MM', weekday:0..6, date:'YYYY-MM-DD', lead:хв }
    get(){ return Cfg.get().service || null; },
    lead(){ const s = Schedule.get(); return (s && s.lead) ? s.lead : 15; },
    // ms наступного початку служіння (для 'once' може бути в минулому — вирішує викликаючий)
    nextStart(){
      const s = Schedule.get();
      if(!s || !s.time) return null;
      const parts = s.time.split(':'); const hh = +parts[0], mm = +parts[1];
      if(isNaN(hh) || isNaN(mm)) return null;
      const now = new Date();
      if(s.mode === 'once'){
        if(!s.date) return null;
        const d = new Date(s.date + 'T' + p2(hh) + ':' + p2(mm) + ':00');
        return d.getTime();
      }
      const target = new Date(now); target.setHours(hh, mm, 0, 0);
      const wd = (typeof s.weekday === 'number') ? s.weekday : target.getDay();
      let add = (wd - now.getDay() + 7) % 7;
      if(add === 0 && target.getTime() <= now.getTime()) add = 7;
      target.setDate(target.getDate() + add);
      return target.getTime();
    }
  };
  WS.Schedule = Schedule;

  function fmt(ms){
    if(ms < 0) ms = 0;
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0 ? (h + ':' + p2(m) + ':' + p2(ss)) : (p2(m) + ':' + p2(ss));
  }
  function logoUrl(id){ return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600'; }

  // Рендер заставки в контейнер. d = { t:'splash', logo, brand, target }. Возвращает { stop }.
  const Splash = {
    fmt: fmt,
    render(container, d){
      container.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4vmin;text-align:center;padding:5vmin;box-sizing:border-box;';
      container.appendChild(wrap);

      if(d.logo){
        const img = document.createElement('img');
        img.src = logoUrl(d.logo);
        img.style.cssText = 'max-width:70%;max-height:55%;object-fit:contain;';
        img.onerror = function(){ img.style.display = 'none'; if(d.brand){ const t = document.createElement('div'); t.textContent = d.brand; t.style.cssText = 'color:#fff;font-size:7vmin;font-weight:bold;'; wrap.insertBefore(t, wrap.firstChild); } };
        wrap.appendChild(img);
      } else if(d.brand){
        const t = document.createElement('div'); t.textContent = d.brand; t.style.cssText = 'color:#fff;font-size:7vmin;font-weight:bold;'; wrap.appendChild(t);
      }

      const cd = document.createElement('div');
      cd.style.cssText = 'color:#fff;font-size:9vmin;font-weight:300;letter-spacing:2px;font-variant-numeric:tabular-nums;';
      wrap.appendChild(cd);
      const note = document.createElement('div');
      note.style.cssText = 'color:rgba(255,255,255,0.55);font-size:3.2vmin;';
      wrap.appendChild(note);

      let stopped = false;
      function tick(){
        if(stopped) return;
        const now = Date.now(), remain = d.target - now;
        if(remain > 0){
          cd.style.display = ''; note.style.display = '';
          cd.textContent = fmt(remain);
          note.textContent = d.note || '';
        } else if(now < d.target + 3 * 60000){
          cd.style.display = 'none'; note.style.display = 'none';   // лого само на 3 хв
        } else {
          container.innerHTML = '';                                  // потім — чорний екран
          stop();
        }
      }
      tick();
      const id = setInterval(tick, 1000);
      function stop(){ stopped = true; clearInterval(id); }
      return { stop: stop };
    }
  };
  WS.Splash = Splash;

  // Цикл оголошень: показ по кругу за таймером. d = { items:[{title,text}], interval(сек), start(ms) }
  const Loop = {
    index(d){ const n = (d.items || []).length; if(!n) return 0; const el = Math.max(0, Date.now() - d.start); return Math.floor(el / (d.interval * 1000)) % n; },
    watch(d, onChange){
      let last = -1, stopped = false;
      function tick(){ if(stopped) return; const i = Loop.index(d); if(i !== last){ last = i; onChange(i); } }
      tick(); const id = setInterval(tick, 1000);
      return { stop(){ stopped = true; clearInterval(id); } };
    }
  };
  WS.Loop = Loop;
})();
