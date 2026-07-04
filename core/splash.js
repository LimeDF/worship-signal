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
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#000;';
      container.appendChild(root);

      if(d.logo){
        const img = document.createElement('img');
        img.src = logoUrl(d.logo);
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
        img.onerror = function(){ img.style.display = 'none'; if(d.brand){ const t = document.createElement('div'); t.textContent = d.brand; t.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8vmin;font-weight:bold;'; root.insertBefore(t, root.firstChild); } };
        root.appendChild(img);
      } else if(d.brand){
        const t = document.createElement('div'); t.textContent = d.brand;
        t.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8vmin;font-weight:bold;';
        root.appendChild(t);
      }

      // затемнённая полоса снизу + таймер поверх картинки (стиль Snapchat)
      const grad = document.createElement('div');
      grad.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:40%;background:linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.35) 45%, rgba(0,0,0,0));display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 4vmin 5vmin;box-sizing:border-box;';
      root.appendChild(grad);
      const cd = document.createElement('div');
      cd.style.cssText = 'color:#fff;font-size:12vmin;font-weight:600;letter-spacing:2px;font-variant-numeric:tabular-nums;text-shadow:0 2px 14px rgba(0,0,0,0.85);line-height:1;';
      grad.appendChild(cd);
      const note = document.createElement('div');
      note.style.cssText = 'color:rgba(255,255,255,0.92);font-size:3.6vmin;text-shadow:0 1px 8px rgba(0,0,0,0.85);margin-top:1.5vmin;';
      grad.appendChild(note);

      let stopped = false;
      function tick(){
        if(stopped) return;
        const now = Date.now(), remain = d.target - now;
        if(remain > 0){
          grad.style.display = 'flex';
          cd.textContent = fmt(remain); note.textContent = d.note || '';
        } else if(now < d.target + 3 * 60000){
          grad.style.display = 'none';       // после начала — только картинка на 3 хв
        } else {
          container.innerHTML = ''; stop();   // потім чорний екран
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
