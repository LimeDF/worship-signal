/* ============================================================
   projector.js — единый «источник правды» для проекции.
   Любой контент (block/text/media/clear) проходит через WS.Projector.
   Экран трансляции «подписывается» (attach) своей функцией отрисовки.
   Отрисовка происходит ВСЕГДА при любом обновлении — не зависит от того,
   какой экран открыт и установлен ли onMessage. Это и чинит «то рисует, то нет».
   ============================================================ */
(function(){
  const P = { current:null, _paint:null };

  // обновить отображаемый контент и сразу перерисовать (если экран трансляции открыт)
  P.set = function(p){
    if(p && p.t === 'clear') P.current = null;
    else if(p) P.current = p;
    P.repaint();
  };

  // экран трансляции регистрирует свою функцию отрисовки
  P.attach = function(paintFn){ P._paint = paintFn; P.repaint(); };
  P.detach = function(){ P._paint = null; };

  P.repaint = function(){ if(P._paint){ try { P._paint(); } catch(e){ console.error('projector', e); } } };

  WS.Projector = P;
})();
