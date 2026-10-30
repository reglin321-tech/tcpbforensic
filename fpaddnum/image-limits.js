/* Shared by the UI and worker: input and output have separate pixel budgets. */
function installImageLimits(scope) {
  const inputPixels=24000000, outputPixels=48000000, maxSide=16000;
  function check(width,height,kind='output') {
    const limit=kind==='input'?inputPixels:outputPixels;
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)
      return '寬、高必須是大於零的有效像素尺寸。';
    if(width>maxSide||height>maxSide||width*height>limit)
      return (kind==='input'?'載入圖片':'輸出')+'上限為 '+(limit/10000).toLocaleString('en-US')+' 萬像素、單邊 16,000 像素；目前 '+width.toLocaleString('en-US')+' × '+height.toLocaleString('en-US')+'。';
    return '';
  }
  scope.ImageLimits={inputPixels,outputPixels,maxSide,check};
}
installImageLimits(globalThis);
