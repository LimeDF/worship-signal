/* schedule.js — экран «Розклад служіння» (Lime): час служіння + відлік + заставка. */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.schedule = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('settings')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('schedule_title'))));
    const wrap = WS.UI.el('div',{class:'scroll grow pad'}); screen.appendChild(wrap); root.appendChild(screen);

    if(!WS.Auth.canAdmin()){ wrap.appendChild(WS.UI.el('div',{class:'empty'}, WS.t('lime_only'))); return; }

    const s = Object.assign({ mode:'weekly', time:'10:00', weekday:0, date:'', lead:15 }, WS.Schedule.get() || {});
    let splashId = WS.Cfg.get().splash_drive_id || '';

    // режим
    const modeRow = WS.UI.el('div',{class:'btn-row', style:{marginBottom:'12px'}});
    const bWeekly = WS.UI.el('button',{class:'btn', onClick:()=>{ s.mode='weekly'; drawMode(); }}, WS.t('sch_weekly'));
    const bOnce   = WS.UI.el('button',{class:'btn', onClick:()=>{ s.mode='once'; drawMode(); }}, WS.t('sch_once'));
    modeRow.appendChild(bWeekly); modeRow.appendChild(bOnce); wrap.appendChild(modeRow);

    const modeBox = WS.UI.el('div', null); wrap.appendChild(modeBox);
    const wdNames = WS.t('weekday_short').split(',');

    function drawMode(){
      bWeekly.className = 'btn' + (s.mode==='weekly'?'':' btn-ghost');
      bOnce.className   = 'btn' + (s.mode==='once'?'':' btn-ghost');
      WS.UI.clear(modeBox);
      if(s.mode==='weekly'){
        modeBox.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('sch_weekday')));
        const grid = WS.UI.el('div',{style:{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px', marginBottom:'12px'}});
        wdNames.forEach((nm, i) => grid.appendChild(WS.UI.el('button',{class:'btn'+(s.weekday===i?'':' btn-ghost'), style:{padding:'10px 0'}, onClick:()=>{ s.weekday=i; drawMode(); }}, nm)));
        modeBox.appendChild(grid);
      } else {
        modeBox.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('sch_date')));
        const dt = WS.UI.el('input',{class:'input', type:'date', value:s.date||''}); dt.addEventListener('change',()=>s.date=dt.value); modeBox.appendChild(dt);
      }
    }
    drawMode();

    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('sch_time')));
    const timeInp = WS.UI.el('input',{class:'input', type:'time', value:s.time||'10:00'}); timeInp.addEventListener('change',()=>s.time=timeInp.value); wrap.appendChild(timeInp);

    wrap.appendChild(WS.UI.el('div',{class:'field-label'}, WS.t('sch_lead')));
    const leadInp = WS.UI.el('input',{class:'input', type:'number', min:'0', max:'120', value:String(s.lead||15)}); wrap.appendChild(leadInp);

    // заставка
    wrap.appendChild(WS.UI.el('div',{class:'section-h', style:{margin:'16px 0 8px', padding:'0'}}, WS.t('splash_section')));
    const splashInfo = WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginBottom:'8px'}});
    function refreshInfo(){ splashInfo.textContent = splashId ? WS.t('splash_set') : WS.t('splash_none'); }
    refreshInfo(); wrap.appendChild(splashInfo);

    const linkInp = WS.UI.el('input',{class:'input', placeholder:'https://drive.google.com/file/d/…/view', value: splashId ? ('https://drive.google.com/file/d/'+splashId+'/view') : ''});
    wrap.appendChild(linkInp);

    if(WS.Drive && WS.Drive.isConfigured()){
      const fileInp = WS.UI.el('input',{type:'file', accept:'image/*', style:{display:'none'}});
      fileInp.addEventListener('change', async function(){
        const f = fileInp.files && fileInp.files[0]; if(!f) return;
        WS.UI.toast(WS.t('drive_uploading'));
        try { splashId = await WS.Drive.upload(f, f.name); linkInp.value = 'https://drive.google.com/file/d/'+splashId+'/view'; refreshInfo(); WS.UI.toast(WS.t('drive_uploaded')); }
        catch(e){ WS.UI.toast(WS.t('drive_error', e.message||''),'error'); }
        fileInp.value='';
      });
      wrap.appendChild(fileInp);
      wrap.appendChild(WS.UI.el('button',{class:'btn btn-tan', style:{margin:'8px 0'}, onClick:()=>fileInp.click()}, WS.t('splash_upload')));
    }

    wrap.appendChild(WS.UI.el('div',{class:'spacer'}));
    wrap.appendChild(WS.UI.saveBtn(WS.t('save'), save, 'btn'));

    function parseId(v){ v=String(v||'').trim(); const m=v.match(/\/d\/([-\w]{20,})/)||v.match(/[?&]id=([-\w]{20,})/); if(m) return m[1]; if(/^[-\w]{20,}$/.test(v)) return v; return ''; }

    async function save(){
      s.time = timeInp.value || '10:00';
      s.lead = Math.max(0, parseInt(leadInp.value,10) || 15);
      if(s.mode==='once' && !s.date){ WS.UI.toast(WS.t('sch_need_date'),'error'); return; }
      const idFromLink = parseId(linkInp.value);
      const patch = { service: { mode:s.mode, time:s.time, weekday:s.weekday, date:s.date, lead:s.lead }, splash_drive_id: idFromLink || splashId || '' };
      try { await WS.Cfg.save(patch, 'Update schedule'); WS.UI.toast(WS.t('saved')); }
      catch(e){ WS.UI.toast(WS.t('error_prefix') + (e.message||''),'error'); }
    }
  };
})();
