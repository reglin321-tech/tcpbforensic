/* Offline-only application. No network. Only the document prefix is persisted locally. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const VERSION = '1.3.0', MAX_PIXELS = 24000000;
  const defaults = () => ({preset:'original',brightness:1,contrast:1,gamma:1,equalize:false,negative:false,mirror:false,sharpen:0,clahe:0,denoise:0,background:0,bw_threshold:31});
  const sliderDefs = [
    ['brightness','亮度',.1,3,.1,1,'basic-sliders'],['contrast','對比',.1,3,.1,1,'basic-sliders'],['gamma','Gamma',.1,5,.1,1,'basic-sliders'],
    ['sharpen','銳化',0,200,1,0,'advanced-sliders'],['clahe','局部對比 CLAHE',0,100,1,0,'advanced-sliders'],['denoise','雙邊去雜訊',0,30,1,0,'advanced-sliders'],['background','背景校正',0,30,1,0,'advanced-sliders'],['bw_threshold','黑白門檻區塊',3,101,2,31,'advanced-sliders']
  ];
  for (const [id,name,min,max,step,value,parent] of sliderDefs) {
    const label = document.createElement('label'); label.className='slider-label'; label.htmlFor=id; label.append(document.createTextNode(name));
    const out = document.createElement('output'); out.id=id+'-value'; out.textContent=value; label.append(out);
    const input=document.createElement('input'); Object.assign(input,{type:'range',id,min,max,step,value}); input.dataset.image='';
    const wrapper=document.createElement('div');wrapper.className='slider-group';wrapper.append(label,input);$(parent).append(wrapper);
  }
  let previewSource=null, previewBase=null, fullCache=null;
  let loadedImage=null, source=null, processed=null, originalName='', originalSize=null, sourceHash='', adjustments=defaults();
  let cropActive=false, measuring=0, measureStart=null, compare=false, dirty=false, locked=false, ready=false, fontReady=false, space=false;
  let cropHistory=[], history=[], textRotation=0, historyBeforeDrag=null, pendingTimer=null, processedSettings='';
  const fieldIds=['prefix','docno','index','scale','note','font-size','text-width','text-color'];
  let labelState={enabled:false,x:40,y:40};
  const PREFIX_KEY='addnum.offline.document-prefix.v1';
  try{$('prefix').value=localStorage.getItem(PREFIX_KEY)||'';}catch{}
  function rememberPrefix(){try{localStorage.setItem(PREFIX_KEY,$('prefix').value);}catch{status('瀏覽器未允許本機記憶，送鑑文號無法保存到下次。',true);}}
  $('prefix').addEventListener('input',rememberPrefix);
  const viewport=$('viewport'), stage=new Konva.Stage({container:'stage',width:viewport.clientWidth,height:viewport.clientHeight});
  const layer=new Konva.Layer();stage.add(layer);
  const paddingGroup=new Konva.Group({listening:false});layer.add(paddingGroup);
  for(let i=0;i<4;i++)paddingGroup.add(new Konva.Rect({fill:'#fff',listening:false}));
  const imageNode=new Konva.Image({listening:false});layer.add(imageNode);
  const label=new Konva.Group({draggable:true,visible:false});
  const labelBg=new Konva.Rect({fill:'#fff5db',opacity:.35,stroke:'#9ca3af',strokeWidth:1,cornerRadius:6});
  const labelText=new Konva.Text({x:10,y:6,fontFamily:'EvidenceSans',fontSize:32,fill:'#111827',wrap:'char',lineHeight:1.3,padding:0});
  label.add(labelBg,labelText);layer.add(label);
  const textTransformer=new Konva.Transformer({nodes:[],rotateEnabled:false,flipEnabled:false,enabledAnchors:['middle-right','bottom-right'],keepRatio:true,anchorSize:9,borderStroke:'#5bd6bc',anchorStroke:'#16796c',anchorFill:'white'});layer.add(textTransformer);
  const cropRect=new Konva.Rect({name:'crop-frame',x:0,y:0,width:200,height:140,stroke:'#78ead0',strokeWidth:2,strokeScaleEnabled:false,fill:'#62e1ba12',draggable:true,visible:false});layer.add(cropRect);
  const guides=new Konva.Group({listening:false,visible:false});for(let i=0;i<4;i++)guides.add(new Konva.Line({stroke:'#e5fff599',strokeWidth:1,strokeScaleEnabled:false}));layer.add(guides);
  const cropTransformer=new Konva.Transformer({nodes:[],flipEnabled:false,rotateEnabled:true,keepRatio:true,anchorSize:10,borderStroke:'#78ead0',anchorStroke:'#16796c'});layer.add(cropTransformer);
  const ruler=new Konva.Line({points:[],stroke:'#f4ce70',strokeWidth:2,strokeScaleEnabled:false,listening:false});layer.add(ruler);
  const status=(message,error=false)=>{$('status').textContent=message;$('status').style.color=error?'#af443b':'#39675e';};
  const perspective=createPerspectiveTool({stage,layer,viewport,getImage:()=>source,status,modeChanged:syncModeUI,apply:applyPerspective});
  function syncModeUI(){const mode=cropActive||perspective.active;$('normal-toolbar').hidden=mode;$('normal-bottom').hidden=mode;$('advanced-bar').hidden=mode||$('advanced-toggle').getAttribute('aria-expanded')!=='true';refreshLabel();updateButtons();}
  function updateButtons(){document.querySelectorAll('[data-image]').forEach(el=>el.disabled=!source||locked||!ready||!fontReady||((cropActive||perspective.active)&&!!el.closest('#normal-toolbar,#normal-bottom,#advanced-bar')));$('open').disabled=locked||!ready||!fontReady||cropActive||perspective.active;$('undo').disabled=locked||!history.length||cropActive||perspective.active;$('crop-panel').querySelectorAll('button,input,select').forEach(el=>el.disabled=locked);perspective.setLocked(locked);label.draggable(!locked&&!cropActive&&!perspective.active);cropRect.draggable(!locked);stage.listening(!locked);}
  function setBusy(value,message='影像處理中…'){locked=value;$('busy').hidden=!value;$('busy-text').textContent=message;updateButtons();}
  const workerURL=URL.createObjectURL(new Blob([window.CV_WORKER_SOURCE,'\n;(',installPerspectiveMath.toString(),')(self);\n;(',installImageEngine.toString(),')(self);'],{type:'text/javascript'}));
  const worker=new Worker(workerURL);URL.revokeObjectURL(workerURL);delete window.CV_WORKER_SOURCE;
  let sequence=0;const jobs=new Map();
  worker.onmessage=event=>{const data=event.data;if(data.ready){ready=true;updateButtons();if(fontReady)status('已就緒 · 開啟圖片即可開始');return;}const job=jobs.get(data.id);if(!job)return;clearTimeout(job.timeout);jobs.delete(data.id);data.error?job.reject(Error(data.error)):job.resolve(data.image);};
  worker.onerror=event=>{ready=false;for(const job of jobs.values()){clearTimeout(job.timeout);job.reject(Error('影像引擎中斷，請重新開啟頁面。'));}jobs.clear();setBusy(false);status('影像引擎無法啟動。請使用 Edge／Chrome，並確認已完整解壓縮資料夾。',true);};
  function compute(type,image,extra){return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{jobs.delete(id);worker.terminate();ready=false;reject(Error('影像運算超時。請重新開啟網頁，改用較小圖片。'));},180000);jobs.set(id,{resolve,reject,timeout});worker.postMessage({id,type,image,...extra});});}
  document.fonts.load('16px EvidenceSans').then(fonts=>{if(!fonts.length)throw Error('字型未載入');fontReady=true;updateButtons();if(ready)status('已就緒 · 開啟圖片即可開始');}).catch(()=>{status('中文字型載入失敗。請確認 fonts 資料夾完整。',true);});
  function toCanvas(image){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);return canvas;}
  function previewForSource(){
    if(previewSource===source)return previewBase;
    previewSource=source;fullCache=null;
    const factor=Math.min(1,1600/Math.max(source.width,source.height),Math.sqrt(1600000/(source.width*source.height)));
    if(factor===1){previewBase=source;return previewBase;}
    const original=toCanvas(source),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*factor));canvas.height=Math.max(1,Math.round(source.height*factor));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(original,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);previewBase={width:pixels.width,height:pixels.height,data:pixels.data};original.width=original.height=0;return previewBase;
  }
  async function fullResolution(){
    const key=JSON.stringify(adjustments);
    if(key===JSON.stringify(defaults()))return source;
    if(fullCache?.source===source&&fullCache.settings===key)return fullCache.image;
    $('busy-text').textContent='正在以原解析度處理影像…';
    const image=await compute('process',source,{adjustments});fullCache={source,settings:key,image};return image;
  }
  function drawImage(){if(!source)return;imageNode.image(toCanvas(compare||processed===source||!processed?previewForSource():processed));imageNode.size({width:source.width,height:source.height});updateExtent();layer.batchDraw();}
  function fit(){if(!source)return;const bounds=perspective.active?{x:0,y:0,width:source.width,height:source.height}:cropActive?cropBounds():outputBounds();const margin=cropActive?140:64;const scale=Math.max(.001,Math.min((stage.width()-margin)/bounds.width,(stage.height()-margin)/bounds.height));stage.scale({x:scale,y:scale});stage.position({x:(stage.width()-bounds.width*scale)/2-bounds.x*scale,y:(stage.height()-bounds.height*scale)/2-bounds.y*scale});updateZoom();}
  function updateZoom(){$('zoom-label').textContent=Math.round(stage.scaleX()*100)+'%';perspective.redraw();layer.batchDraw();}
  function zoom(factor,point={x:stage.width()/2,y:stage.height()/2}){if(!source||locked)return;const old=stage.scaleX(),scale=Math.max(.01,Math.min(20,old*factor)),p={x:(point.x-stage.x())/old,y:(point.y-stage.y())/old};stage.scale({x:scale,y:scale});stage.position({x:point.x-p.x*scale,y:point.y-p.y*scale});updateZoom();}
  function values(){return Object.fromEntries(fieldIds.map(id=>[id,$(id).value]));}
  function snapshot(){return {source,adjustments:{...adjustments},fields:values(),label:{...labelState,x:label.x(),y:label.y()},textRotation,cropHistory:structuredClone(cropHistory)};}
  function push(snap=snapshot()){history.push(snap);let bytes=0;const images=new Set([source,loadedImage]);for(let i=history.length-1;i>=0;i--){images.add(history[i].source);bytes=[...images].reduce((n,img)=>n+img.data.byteLength,0);if(bytes>160*1024*1024){history=history.slice(i+1);break;}}if(history.length>25)history.shift();$('undo').disabled=locked||!history.length||cropActive||perspective.active;}
  function change(){dirty=true;}
  function readAdjustments(){for(const [id] of sliderDefs){adjustments[id]=Number($(id).value);$(id+'-value').textContent=$(id).value;}for(const id of ['mirror','negative','equalize'])adjustments[id]=$(id).checked;adjustments.preset=$('preset').value;}
  function syncAdjustments(){for(const [id] of sliderDefs){$(id).value=adjustments[id];$(id+'-value').textContent=adjustments[id];}for(const id of ['mirror','negative','equalize'])$(id).checked=adjustments[id];$('preset').value=adjustments.preset;}
  async function render(){if(!source||locked)return;clearTimeout(pendingTimer);pendingTimer=null;processedSettings='';setBusy(true);try{const input=previewForSource();const key=JSON.stringify(adjustments);if(fullCache?.settings!==key)fullCache=null;processed=key===JSON.stringify(defaults())?input:await compute('process',input,{adjustments});processedSettings=key;compare=false;drawImage();status('預覽完成 · '+processed.width+' × '+processed.height+' px；存檔使用 '+source.width+' × '+source.height+' px');}catch(e){status(e.message+'；請重設調整後再輸出。',true);}finally{setBusy(false);}}
  async function flush(){if(pendingTimer){clearTimeout(pendingTimer);pendingTimer=null;await render();}}
  function labelString(){const v=values(),p=v.prefix.trim();let text=(p.endsWith('字第')?p:p+'字第')+v.docno+'號，編號'+v.index+'，'+(v.scale.trim()||'   ')+'倍大';if(v.note.trim())text+='('+v.note.trim()+')';return text;}
  function outputBounds(){
    let left=0,top=0,right=source.width,bottom=source.height;
    if(labelState.enabled){const r=label.getClientRect({relativeTo:layer});left=Math.min(0,Math.floor(r.x));top=Math.min(0,Math.floor(r.y));right=Math.max(right,Math.ceil(r.x+r.width));bottom=Math.max(bottom,Math.ceil(r.y+r.height));}
    return {x:left,y:top,width:right-left,height:bottom-top};
  }
  function updateExtent(){
    if(!source)return;
    const b=cropActive?cropBounds():outputBounds(),normal=!cropActive&&!perspective.active;
    paddingGroup.visible(cropActive||(normal&&labelState.enabled));
    const strips=[{x:b.x,y:b.y,width:b.width,height:-b.y},{x:b.x,y:source.height,width:b.width,height:b.y+b.height-source.height},{x:b.x,y:0,width:-b.x,height:source.height},{x:source.width,y:0,width:b.x+b.width-source.width,height:source.height}];
    strips.forEach((r,i)=>paddingGroup.children[i].setAttrs({...r,visible:r.width>0&&r.height>0}));
    $('dimensions').textContent=source.width+' × '+source.height+' px'+(normal&&(b.width!==source.width||b.height!==source.height)?' → 輸出 '+b.width+' × '+b.height+' px':'');
  }
  function syncLabelPosition(){labelState.x=label.x();labelState.y=label.y();updateExtent();}
  function refreshLabel(){const font=Math.min(1000,Math.max(8,Number($('font-size').value)||32)),width=Math.min(20000,Math.max(60,Number($('text-width').value)||420));labelText.setAttrs({text:labelString(),fontSize:font,width:Math.max(40,width-20),fill:$('text-color').value});labelBg.size({width,height:labelText.height()+12});label.rotation(textRotation);label.visible(labelState.enabled&&!cropActive&&!perspective.active);syncLabelPosition();textTransformer.nodes(labelState.enabled&&!cropActive&&!perspective.active?[label]:[]);layer.batchDraw();}
  function cropBounds(){const r=cropRect.getClientRect({relativeTo:layer,skipStroke:true});const x=Math.min(0,Math.floor(r.x)),y=Math.min(0,Math.floor(r.y));return{x,y,width:Math.max(source.width,Math.ceil(r.x+r.width))-x,height:Math.max(source.height,Math.ceil(r.y+r.height))-y};}
  function cropState(){return{x:cropRect.x(),y:cropRect.y(),width:cropRect.width()*cropRect.scaleX(),height:cropRect.height()*cropRect.scaleY(),angle:cropRect.rotation()};}
  function drawGuides(){const c=cropState();guides.setAttrs({x:c.x,y:c.y,rotation:c.angle});guides.children[0].points([c.width/3,0,c.width/3,c.height]);guides.children[1].points([c.width*2/3,0,c.width*2/3,c.height]);guides.children[2].points([0,c.height/3,c.width,c.height/3]);guides.children[3].points([0,c.height*2/3,c.width,c.height*2/3]);$('crop-angle').value=Math.round(c.angle);$('crop-width').value=Math.round(c.width);$('crop-height').value=Math.round(c.height);updateExtent();layer.batchDraw();}
  function exitCrop(){cropActive=false;measuring=0;measureStart=null;ruler.points([]);cropRect.draggable(true);cropRect.hide();guides.hide();cropTransformer.nodes([]);$('crop-panel').hidden=true;$('crop-toggle').textContent='剪裁';syncModeUI();}
  function enterCrop(){if(!source||locked)return;cropActive=true;label.hide();textTransformer.nodes([]);const ratio=Number($('ratio').value)||1.5,w=Math.min(source.width*.75,source.height*.75*ratio),h=w/ratio;cropRect.setAttrs({x:(source.width-w)/2,y:(source.height-h)/2,width:w,height:h,scaleX:1,scaleY:1,rotation:0,visible:true});guides.show();cropTransformer.nodes([cropRect]);cropTransformer.keepRatio(!!Number($('ratio').value));$('crop-panel').hidden=false;$('crop-toggle').textContent='剪裁';syncModeUI();drawGuides();}
  function validateSize(w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>MAX_PIXELS||w>16000||h>16000)throw Error('圖片超過上限：24 百萬像素、單邊 16,000 像素。請先縮小圖片。');}
  async function loadFile(file){if(!file||locked||cropActive||perspective.active)return;if(dirty&&!confirm('目前編輯尚未匯出。要捨棄並開啟另一張圖片嗎？'))return;await flush();setBusy(true,'正在讀取本機圖片…');try{if(file.size>100*1024*1024)throw Error('檔案超過 100 MB 上限。');let image;const buffer=await file.arrayBuffer();let firstPage=false;
      if(/\.tiff?$/i.test(file.name)){const pages=UTIF.decode(buffer);if(!pages.length)throw Error('無法解碼 TIFF。');const page=pages[0];validateSize(Number(page.t256?.[0]),Number(page.t257?.[0]));UTIF.decodeImage(buffer,page);image={width:page.width,height:page.height,data:new Uint8ClampedArray(UTIF.toRGBA8(page))};firstPage=pages.length>1;}
      else {const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('無法讀取這個圖片格式。'));img.src=url;});validateSize(img.naturalWidth,img.naturalHeight);const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);image=ctx.getImageData(0,0,canvas.width,canvas.height);}finally{URL.revokeObjectURL(url);}}
      validateSize(image.width,image.height);source={width:image.width,height:image.height,data:new Uint8ClampedArray(image.data)};processed=source;loadedImage=source;originalName=file.name;originalSize={width:source.width,height:source.height};sourceHash=crypto.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join(''):'';adjustments=defaults();processedSettings=JSON.stringify(adjustments);history=[];cropHistory=[];textRotation=0;labelState={enabled:false,x:Math.min(40,source.width/10),y:Math.min(40,source.height/10)};label.position(labelState);$('font-size').value=Math.max(8,Math.round(source.width/32));$('text-width').value=Math.max(60,Math.round(source.width*.7));$('format').value='jpeg';$('note').value=$('note').value.split('、').filter(x=>x!=='已鏡像').join('、');syncAdjustments();exitCrop();drawImage();fit();$('filename').textContent=file.name;$('filename').title=file.name;updateExtent();$('empty').hidden=true;dirty=false;status(firstPage?'已載入 TIFF 第一頁（其他頁面不處理）':/\.gif$/i.test(file.name)?'已載入 GIF 第一幀':'圖片已載入 · 可調整影像或添加文號');
    }catch(e){status('載入失敗：'+e.message,true);}finally{setBusy(false);$('file').value='';}}
  $('open').onclick=()=>$('file').click();$('file').onchange=()=>loadFile($('file').files[0]);
  viewport.addEventListener('dragover',e=>{e.preventDefault();viewport.classList.add('dragging');});viewport.addEventListener('dragleave',()=>viewport.classList.remove('dragging'));viewport.addEventListener('drop',e=>{e.preventDefault();viewport.classList.remove('dragging');loadFile(e.dataTransfer.files[0]);});
  $('help').onclick=()=>$('help-dialog').showModal();$('fit').onclick=fit;$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);
  stage.on('wheel',e=>{e.evt.preventDefault();zoom(e.evt.deltaY<0?1.1:1/1.1,stage.getPointerPosition());});
  for(const [id] of sliderDefs){$(id).addEventListener('input',()=>{if(!source||locked)return;if(!pendingTimer)push();readAdjustments();change();clearTimeout(pendingTimer);pendingTimer=setTimeout(render,220);});}
  for(const id of ['preset','mirror','negative','equalize'])$(id).addEventListener('change',()=>{if(!source||locked)return;push();readAdjustments();if(id==='mirror'){const notes=$('note').value.split('、').map(s=>s.trim()).filter(s=>s&&s!=='已鏡像');if(adjustments.mirror)notes.push('已鏡像');$('note').value=notes.join('、');refreshLabel();}change();render();});
  $('reset').onclick=async()=>{if(!loadedImage||locked)return;clearTimeout(pendingTimer);pendingTimer=null;push();source=loadedImage;cropHistory=[];adjustments=defaults();syncAdjustments();$('note').value=$('note').value.split('、').filter(x=>x!=='已鏡像').join('、');refreshLabel();change();await render();fit();status('已重設為最初載入影像（含剪裁／梯形校正前）；可按復原回到重設前。');};
  for(const id of fieldIds){$(id).addEventListener('focus',()=>{$(id)._before=snapshot();});$(id).addEventListener('input',()=>{if(!source||locked)return;if($(id)._before){push($(id)._before);$(id)._before=null;}change();refreshLabel();});}
  $('add-text').onclick=()=>{if(!source||locked)return;push();labelState.enabled=true;refreshLabel();change();status('文字已加入 · 可拖曳移位與調整大小');};
  $('remove-text').onclick=()=>{if(!labelState.enabled||locked)return;push();labelState.enabled=false;refreshLabel();change();};
  $('rotate-text').onclick=()=>{if(!source||locked)return;push();textRotation=(textRotation+90)%360;refreshLabel();change();};
  label.on('dragstart transformstart',()=>{historyBeforeDrag=snapshot();});
  label.on('dragmove',syncLabelPosition);
  label.on('transform',()=>{const anchor=textTransformer.getActiveAnchor();if(anchor==='middle-right'){$('text-width').value=Math.max(60,Math.round(labelBg.width()*label.scaleX()));}else{$('font-size').value=Math.max(8,Math.min(1000,Math.round(labelText.fontSize()*label.scaleX())));$('text-width').value=Math.max(60,Math.min(20000,Math.round(labelBg.width()*label.scaleX())));}label.scale({x:1,y:1});refreshLabel();});
  label.on('dragend transformend',()=>{if(historyBeforeDrag)push(historyBeforeDrag);historyBeforeDrag=null;syncLabelPosition();change();});
  $('undo').onclick=async()=>{if(locked||!history.length)return;clearTimeout(pendingTimer);pendingTimer=null;const s=history.pop();source=s.source;adjustments=s.adjustments;for(const id of fieldIds)$(id).value=s.fields[id];rememberPrefix();labelState=s.label;label.position({x:s.label.x,y:s.label.y});textRotation=s.textRotation;cropHistory=s.cropHistory;syncAdjustments();exitCrop();change();await render();updateExtent();fit();};
  function startCompare(){if(!source||locked||pendingTimer)return;compare=true;drawImage();$('compare').textContent='顯示處理前影像';}
  function endCompare(){if(!compare)return;compare=false;drawImage();$('compare').textContent='按住看原圖';}
  $('compare').addEventListener('pointerdown',e=>{$('compare').setPointerCapture(e.pointerId);startCompare();});$('compare').addEventListener('pointerup',endCompare);$('compare').addEventListener('pointercancel',endCompare);$('compare').addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();startCompare();}});$('compare').addEventListener('keyup',endCompare);$('compare').addEventListener('blur',endCompare);
  $('crop-toggle').onclick=()=>cropActive?exitCrop():enterCrop();$('crop-cancel').onclick=exitCrop;
  cropRect.on('transform dragmove',drawGuides);cropRect.on('transformend',()=>{const c=cropState();cropRect.setAttrs({width:c.width,height:c.height,scaleX:1,scaleY:1});drawGuides();});
  cropTransformer.boundBoxFunc((oldBox,newBox)=>Math.abs(newBox.width)<10||Math.abs(newBox.height)<10?oldBox:newBox);
  $('ratio').onchange=()=>{if(!cropActive)return;const r=Number($('ratio').value);cropTransformer.keepRatio(!!r);if(r){cropRect.height(cropRect.width()/r);cropRect.scale({x:1,y:1});}drawGuides();};
  for(const axis of ['width','height'])$('crop-'+axis).onchange=()=>{const value=Number($('crop-'+axis).value);if(!Number.isFinite(value)||value<1||value>16000){status('裁切尺寸需介於 1 到 16,000 像素。',true);drawGuides();return;}const c=cropState(),ratio=Number($('ratio').value);c[axis]=value;if(ratio){if(axis==='width')c.height=value/ratio;else c.width=value*ratio;}cropRect.setAttrs({width:c.width,height:c.height,scaleX:1,scaleY:1});drawGuides();};
  $('crop-angle').oninput=()=>{cropRect.rotation(Math.max(-180,Math.min(180,Number($('crop-angle').value)||0)));drawGuides();};
  for(const n of [4,5])$('frame'+n).onclick=()=>{measuring=n;measureStart=null;cropRect.draggable(false);cropTransformer.nodes([]);status('請在影像中的 1 公分比例尺兩端拖曳；Esc 可取消');};
  stage.on('mousedown touchstart',e=>{if(locked)return;if(measuring){e.evt.preventDefault();measureStart=stage.getRelativePointerPosition();ruler.points([measureStart.x,measureStart.y,measureStart.x,measureStart.y]);}else if(source&&(space||e.target===stage)){viewport.focus({preventScroll:true});stage.draggable(true);stage.startDrag();}});
  stage.on('mousemove touchmove',()=>{if(measuring&&measureStart){const p=stage.getRelativePointerPosition();ruler.points([measureStart.x,measureStart.y,p.x,p.y]);layer.batchDraw();}});
  stage.on('mouseup touchend',()=>{stage.draggable(false);if(!measuring||!measureStart)return;const p=stage.getRelativePointerPosition(),distance=Math.hypot(p.x-measureStart.x,p.y-measureStart.y);if(distance<5){status('比例尺太短，請至少選取 5 個原圖像素。',true);measureStart=null;return;}const factor=measuring;const w=distance*(factor===4?3.75:3),h=distance*(factor===4?2.5:2);cropRect.setAttrs({x:(source.width-w)/2,y:(source.height-h)/2,width:w,height:h,rotation:0,scaleX:1,scaleY:1});$('ratio').value='0';cropTransformer.keepRatio(true);cropTransformer.nodes([cropRect]);measuring=0;measureStart=null;cropRect.draggable(true);ruler.points([]);drawGuides();status(factor+' 倍框已建立 · 列印倍率仍需配合實際列印尺寸');});
  $('crop-apply').onclick=async()=>{if(!source||locked)return;await flush();if(processedSettings!==JSON.stringify(adjustments)){status('請先完成影像處理再裁切。',true);return;}const c=cropState(),before=snapshot();setBusy(true,'正在依原圖像素裁切…');try{const output=await compute('crop',await fullResolution(),{crop:c});push(before);cropHistory.push({inputSize:{width:source.width,height:source.height},adjustments:{...adjustments},crop:c});source=output;processed=output;adjustments=defaults();processedSettings=JSON.stringify(adjustments);labelState.enabled=false;syncAdjustments();exitCrop();drawImage();fit();updateExtent();change();status('裁切已完成 · 可使用復原返回裁切前');}catch(e){status(e.message,true);}finally{setBusy(false);}};
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function outputName(ext){
    const name=$('index').value.trim();
    if(!name)throw Error('請先填寫現場編號，作為存檔檔名。');
    if(/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw Error('現場編號含無法用於檔名的字元或保留名稱，請修改後再存檔。');
    return name+'.'+ext;
  }
  $('export').onclick=async()=>{if(!source||locked)return;await flush();if(!ready)return;if(processedSettings!==JSON.stringify(adjustments)){status('影像處理尚未成功，請重設後再匯出。',true);return;}if(cropActive||perspective.active){status('請先套用或取消幾何校正，再匯出圖片。',true);return;}endCompare();setBusy(true,'正在合成原尺寸圖片…');try{outputName($('format').value==='jpeg'?'jpg':'png');const bounds=outputBounds();validateSize(bounds.width,bounds.height);const fullImage=await fullResolution();
    const canvas=document.createElement('canvas');canvas.width=bounds.width;canvas.height=bounds.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.clearRect(-bounds.x,-bounds.y,fullImage.width,fullImage.height);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(fullImage.data),fullImage.width,fullImage.height),-bounds.x,-bounds.y);
    if(labelState.enabled){const rect=label.getClientRect({relativeTo:layer}),left=Math.floor(rect.x),top=Math.floor(rect.y);const exportLabel=label.clone();try{const bitmap=exportLabel.toCanvas({x:left,y:top,width:Math.ceil(rect.x+rect.width)-left,height:Math.ceil(rect.y+rect.height)-top,pixelRatio:1});ctx.drawImage(bitmap,left-bounds.x,top-bounds.y);}finally{exportLabel.destroy();}}const format=$('format').value;if(format==='jpeg'){ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/'+format,1));if(!blob)throw Error('瀏覽器無法產生此尺寸的圖片。');download(blob,outputName(format==='jpeg'?'jpg':'png'));dirty=false;status('已送出下載 · 請確認下載檔案已保存');}catch(e){status('匯出失敗：'+e.message,true);}finally{setBusy(false);}};
  $('record').onclick=()=>{if(!source||locked)return;let name;try{name=outputName('json');}catch(e){status(e.message,true);return;}const data={application:'送鑑文號添加器離線網頁版',version:VERSION,createdAt:new Date().toISOString(),originalFile:originalName,originalSize,originalSHA256:sourceHash,outputSize:outputBounds(),imageOffset:{x:-outputBounds().x,y:-outputBounds().y},format:$('format').value,adjustments,cropHistory,text:{...values(),enabled:labelState.enabled,x:label.x(),y:label.y(),rotation:textRotation,backgroundOpacity:0.35,font:'Noto Sans CJK TC'},notes:['去雜訊使用 OpenCV bilateralFilter，與桌面版 fastNlMeansDenoising 不同。','JPEG 由瀏覽器編碼；此紀錄不是數位簽章，也不驗證來源真實性。','倍率框不設定列印 DPI。']};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);status('處理紀錄已送出下載');};
  window.addEventListener('keydown',e=>{const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);if(!editing&&perspective.key(e)){e.preventDefault();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('export').click();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='t'){e.preventDefault();$('add-text').click();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!editing){e.preventDefault();$('undo').click();}else if(e.key==='Delete'&&!editing){$('remove-text').click();}else if(e.code==='Space'&&!editing&&e.target!==$('compare')){e.preventDefault();space=true;viewport.style.cursor='grab';}else if(e.key==='Escape'){if(measuring){measuring=0;measureStart=null;cropRect.draggable(true);ruler.points([]);cropTransformer.nodes([cropRect]);status('量測已取消');}else if(cropActive)exitCrop();}});
  window.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;stage.draggable(false);viewport.style.cursor='';}});window.addEventListener('blur',()=>{space=false;stage.draggable(false);endCompare();});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  new ResizeObserver(()=>{stage.size({width:viewport.clientWidth,height:viewport.clientHeight});if(source)fit();}).observe(viewport);
  $('advanced-toggle').onclick=()=>{const expanded=$('advanced-toggle').getAttribute('aria-expanded')!=='true';$('advanced-toggle').setAttribute('aria-expanded',String(expanded));syncModeUI();};
  $('perspective-toggle').onclick=async()=>{if(!source||locked)return;await flush();if(processedSettings!==JSON.stringify(adjustments)){status('請先完成影像處理再校正。',true);return;}endCompare();perspective.enter();};
  async function applyPerspective(correction){
    if(locked||!source)return;
    await flush();
    if(processedSettings!==JSON.stringify(adjustments))throw Error('請先完成影像處理再校正。');
    const before=snapshot();setBusy(true,'正在套用四角透視校正…');
    try{
      const output=await compute('perspective',await fullResolution(),{correction});
      push(before);cropHistory.push({type:'perspective',inputSize:{width:source.width,height:source.height},adjustments:{...adjustments},correction,outputSize:{width:output.width,height:output.height}});
      source=output;processed=output;adjustments=defaults();processedSettings=JSON.stringify(adjustments);labelState.enabled=false;
      syncAdjustments();perspective.exit();drawImage();fit();updateExtent();change();status('梯形校正已完成 · 可使用復原返回校正前');
    }finally{setBusy(false);}
  }
  updateButtons();
})();
