/* Shared ratio / resolution policy. Coordinates are always source-image pixels. */
function installPerspectiveMath(scope) {
  const ratioError = '比例格式錯誤，請輸入「高:寬」，例如 2:3。';
  function gcd(a,b) { while (b) { const remainder=a%b; a=b; b=remainder; } return a; }
  function ratio(text) {
    const parts=String(text).trim().split(/[:：]/);
    if(parts.length!==2||parts.some(s=>!/^\d+$/.test(s.trim())))throw Error(ratioError);
    const [h,w]=parts.map(s=>Number(s.trim()));
    if(!Number.isSafeInteger(h)||!Number.isSafeInteger(w)||h<=0||w<=0)throw Error(ratioError);
    const divisor=gcd(h,w);return {h:h/divisor,w:w/divisor};
  }
  function dimensions(points, proportion) {
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const width=Math.max(distance(points[0],points[1]),distance(points[3],points[2]));
    const height=Math.max(distance(points[0],points[3]),distance(points[1],points[2]));
    // Integer multiples preserve H:W exactly. Side lengths set scale, never ratio.
    const multiple=Math.max(1,Math.ceil(Math.max(width/proportion.w,height/proportion.h)));
    const w=multiple*proportion.w,h=multiple*proportion.h;
    if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<2||h<2||w>16000||h>16000||w*h>24000000)
      throw Error('指定比例的輸出超過上限（24 百萬像素／單邊 16,000 像素），請調整比例或縮小四角範圍。');
    return {width:w,height:h};
  }
  scope.PerspectiveMath={ratio,dimensions,gcd};
}
installPerspectiveMath(globalThis);
