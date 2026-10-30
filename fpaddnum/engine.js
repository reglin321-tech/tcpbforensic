/* All computation runs in a Blob Worker. No fetch, imports or remote requests. */
function installImageEngine(scope) {
  'use strict';
  function processImage(cv, input, st) {
    const owned = [];
    const mat = () => { const m = new cv.Mat(); owned.push(m); return m; };
    const keep = m => { owned.push(m); return m; };
    try {
      const rgba = keep(cv.matFromImageData(input));
      if (st.mirror) cv.flip(rgba, rgba, 1);
      const alpha = new Uint8Array(input.width * input.height);
      const rgbaBytes=rgba.data;
      for (let p = 0; p < alpha.length; p++) {
        alpha[p] = rgbaBytes[p * 4 + 3];
        if (st.negative) for (let c = 0; c < 3; c++) rgbaBytes[p * 4 + c] = 255 - rgbaBytes[p * 4 + c];
      }
      let rgb = mat(); cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
      if (st.equalize) {
        const ycc = mat(), y = mat(), eq = mat();
        cv.cvtColor(rgb, ycc, cv.COLOR_RGB2YCrCb);
        cv.extractChannel(ycc, y, 0); cv.equalizeHist(y, eq); cv.insertChannel(eq, ycc, 0);
        cv.cvtColor(ycc, rgb, cv.COLOR_YCrCb2RGB);
      }
      const gray = () => { const g = mat(); cv.cvtColor(rgb, g, cv.COLOR_RGB2GRAY); return g; };
      const toRgb = g => { const result = mat(); cv.cvtColor(g, result, cv.COLOR_GRAY2RGB); rgb = result; };
      const clahe = (g, clip) => { const result = mat(), c = new cv.CLAHE(clip, new cv.Size(8, 8)); try { c.apply(g, result); } finally { c.delete(); } return result; };
      const blur = (g, sigma) => { const out = mat(); cv.GaussianBlur(g, out, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT); return out; };
      const background = (g, sigma) => { const out = mat(); cv.divide(g, blur(g, sigma), out, 235); return out; };
      const denoise = (g, strength) => { const out = mat(); cv.bilateralFilter(g, out, 9, strength * 3, 7, cv.BORDER_DEFAULT); return out; };
      const sharpen = (g, amount, sigma) => { const out = mat(); cv.addWeighted(g, 1 + amount, blur(g, sigma), -amount, 0, out); return out; };
      if (st.preset === 'scan') toRgb(denoise(clahe(gray(), 2), 8));
      if (st.preset === 'ridge') toRgb(sharpen(clahe(gray(), 2.5), .8, 1.2));
      if (st.preset === 'background') toRgb(background(gray(), 21));
      if (st.preset === 'bw') {
        let block = Math.max(3, st.bw_threshold || 31); if (!(block % 2)) block++;
        const out = mat(); cv.adaptiveThreshold(clahe(gray(), 3), out, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, block, 7); toRgb(out);
      }
      if (st.background > 0) toRgb(background(gray(), Math.max(3, st.background * 2 + 1)));
      if (st.denoise > 0) toRgb(denoise(gray(), st.denoise));
      if (st.clahe > 0) toRgb(clahe(gray(), 1 + st.clahe / 20));
      if (st.sharpen > 0) rgb = sharpen(rgb, st.sharpen / 100, 1);
      const lut = new Uint8Array(256), inv = 1 / st.gamma;
      for (let i = 0; i < 256; i++) lut[i] = Math.floor(Math.pow(i / 255, inv) * 255);
      const data = new Uint8ClampedArray(input.width * input.height * 4);
      const rgbBytes=rgb.data;
      let mean = 0;
      for (let p = 0; p < alpha.length; p++) {
        for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.min(255, Math.floor(lut[rgbBytes[p * 3 + c]] * st.brightness));
        data[p * 4 + 3] = alpha[p];
        mean += Math.round(data[p * 4] * .299 + data[p * 4 + 1] * .587 + data[p * 4 + 2] * .114);
      }
      mean = Math.round(mean / alpha.length);
      if (st.contrast !== 1) for (let p = 0; p < alpha.length; p++) for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.max(0, Math.min(255, Math.floor(mean + (data[p * 4 + c] - mean) * st.contrast)));
      return {width: input.width, height: input.height, data};
    } finally { for (const m of owned.reverse()) m.delete(); }
  }
  function cropImage(cv, input, crop) {
    const w = Math.max(1, Math.round(crop.width)), h = Math.max(1, Math.round(crop.height));
    const error=scope.ImageLimits.check(w,h);if(error)throw Error(error);
    if(![crop.x,crop.y,crop.angle,crop.width,crop.height].every(Number.isFinite)||crop.width<=0||crop.height<=0)throw Error('裁切框座標或尺寸無效。');
    const owned = [], keep = m => { owned.push(m); return m; };
    try {
      const source = keep(cv.matFromImageData(input));
      // Crops have always produced opaque output. Avoid full-size RGB and RGBA conversion buffers.
      const sourceBytes=source.data;
      for(let p=3;p<sourceBytes.length;p+=4)sourceBytes[p]=255;
      const a = crop.angle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      const corners = [[0,0],[crop.width,0],[crop.width,crop.height],[0,crop.height]].flatMap(([x,y]) => [crop.x+x*co-y*si,crop.y+x*si+y*co]);
      const from = keep(cv.matFromArray(4,1,cv.CV_32FC2,corners));
      const to = keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w,0,w,h,0,h]));
      const transform = keep(cv.getPerspectiveTransform(from,to)), out = keep(new cv.Mat());
      cv.warpPerspective(source,out,transform,new cv.Size(w,h),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));
      return {width:w,height:h,data:new Uint8ClampedArray(out.data)};
    } finally { for (const m of owned.reverse()) m.delete(); }
  }
  function perspectiveImage(cv, input, correction) {
    const points=correction.points;
    if(!Array.isArray(points)||points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>input.width-1||p.y>input.height-1))
      throw Error('四角必須位於圖片範圍內。');
    const owned=[],keep=m=>{owned.push(m);return m;};
    try {
      const from=keep(cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y])));
      // OpenCV validates convexity; never reorder the user's corners.
      if(!cv.isContourConvex(from)||cv.contourArea(from,true)<4)
        throw Error('四角不可交叉、重疊或形成凹形；請依左上、右上、右下、左下調整為凸四邊形。');
      for(let i=0;i<4;i++)if(Math.hypot(points[i].x-points[(i+1)%4].x,points[i].y-points[(i+1)%4].y)<1)
        throw Error('角點距離過近，請重新定位四角。');
      const proportion=scope.PerspectiveMath.ratio(correction.ratio);
      const {width:w,height:h}=scope.PerspectiveMath.dimensions(points,proportion);
      const to=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]));
      const source=keep(cv.matFromImageData(input)),rgb=keep(new cv.Mat()),out=keep(new cv.Mat()),rgba=keep(new cv.Mat());
      cv.cvtColor(source,rgb,cv.COLOR_RGBA2RGB);
      const matrix=keep(cv.getPerspectiveTransform(from,to));
      cv.warpPerspective(rgb,out,matrix,new cv.Size(w,h),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));
      cv.cvtColor(out,rgba,cv.COLOR_RGB2RGBA);
      return {width:w,height:h,data:new Uint8ClampedArray(rgba.data)};
    }finally{for(const m of owned.reverse())m.delete();}
  }
  scope.onmessage = function (event) {
    const m = event.data;
    try {
      let out;
      if(m.type==='rotate'){
        const src=cv.matFromImageData(m.image),dst=new cv.Mat();
        try{cv.rotate(src,dst,m.direction==='left'?cv.ROTATE_90_COUNTERCLOCKWISE:cv.ROTATE_90_CLOCKWISE);out={width:dst.cols,height:dst.rows,data:new Uint8ClampedArray(dst.data)};}
        finally{src.delete();dst.delete();}
      }else out = m.type === 'perspective' ? perspectiveImage(cv,m.image,m.correction) : m.type === 'crop' ? cropImage(cv, m.image, m.crop) : processImage(cv, m.image, m.adjustments);
      scope.postMessage({id:m.id,image:out}, [out.data.buffer]);
    } catch (error) { scope.postMessage({id:m.id,error:typeof error === 'number' ? 'OpenCV 處理失敗（'+error+'）' : error.message || String(error)}); }
  };
  if (cv.Mat) scope.postMessage({ready:true});
  else cv.onRuntimeInitialized = () => scope.postMessage({ready:true});
}
