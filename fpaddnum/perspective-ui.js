/* Four independent source-pixel handles; scene zoom never modifies their coordinates. */
function createPerspectiveTool(options) {
  const {stage,layer,viewport}=options,$=id=>document.getElementById(id);
  const names=['左上','右上','右下','左下'];
  let active=false,locked=false,selected=0,customRatio='1:1';
  const group=new Konva.Group({name:'perspective-overlay',visible:false});layer.add(group);
  const outline=new Konva.Line({closed:true,stroke:'#38bdf8',strokeWidth:1.5,strokeScaleEnabled:false,listening:false});group.add(outline);
  const guides=Array.from({length:4},()=>{const line=new Konva.Line({stroke:'#bae6fd88',strokeWidth:1,strokeScaleEnabled:false,listening:false});group.add(line);return line;});
  const handles=names.map((name,index)=>{
    const handle=new Konva.Group({name:'perspective-corner-'+index,draggable:true});
    // A 17-screen-pixel transparent hit target surrounds the 7-pixel hollow marker.
    handle.add(new Konva.Circle({radius:17,fill:'rgba(0,0,0,0)'}));
    const ring=new Konva.Circle({radius:7,stroke:'#38bdf8',strokeWidth:1.5,listening:false});
    const cross=new Konva.Line({points:[-11,0,11,0,0,0,0,-11,0,11],stroke:'#38bdf8',strokeWidth:1,listening:false});
    const text=new Konva.Text({x:13,y:-24,text:name,fontFamily:'EvidenceSans',fontSize:12,fill:'#38bdf8',shadowColor:'#020617',shadowBlur:3,listening:false});
    handle.add(ring,cross,text);group.add(handle);
    handle.on('mousedown touchstart',e=>{e.cancelBubble=true;selected=index;viewport.focus({preventScroll:true});redraw();});
    handle.on('dragstart',()=>{selected=index;viewport.focus({preventScroll:true});});
    handle.on('dragmove',()=>{clamp(handle);clearError();redraw();});
    return handle;
  });
  function points(){return handles.map(h=>({x:h.x(),y:h.y()}));}
  function clamp(handle){const image=options.getImage();handle.position({x:Math.max(0,Math.min(image.width-1,handle.x())),y:Math.max(0,Math.min(image.height-1,handle.y()))});}
  function clearError(){$('perspective-error').hidden=true;$('perspective-error').textContent='';}
  function showError(message){$('perspective-error').textContent=message;$('perspective-error').hidden=false;options.status(message,true);}
  function updateEstimate(){try{const proportion=PerspectiveMath.ratio($('perspective-ratio').value),size=PerspectiveMath.dimensions(points(),proportion);$('perspective-size').textContent='輸出 '+size.width+' × '+size.height+' px';}catch(e){$('perspective-size').textContent='請輸入有效的高:寬比例';}}
  function redraw(){if(!active)return;const p=points();outline.points(p.flatMap(v=>[v.x,v.y]));const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});[1/3,2/3].forEach((t,i)=>{let a=mix(p[0],p[1],t),b=mix(p[3],p[2],t);guides[i].points([a.x,a.y,b.x,b.y]);a=mix(p[0],p[3],t);b=mix(p[1],p[2],t);guides[i+2].points([a.x,a.y,b.x,b.y]);});
    handles.forEach((h,i)=>{h.scale({x:1/stage.scaleX(),y:1/stage.scaleY()});const color=i===selected?'#fbbf24':'#38bdf8';h.children[1].stroke(color);h.children[2].stroke(color);h.children[3].fill(color);});
    $('selected-corner').textContent='選取：'+names[selected]+'  X '+p[selected].x.toFixed(2)+' / Y '+p[selected].y.toFixed(2)+' px';updateEstimate();layer.batchDraw();}
  function reset(){const image=options.getImage(),x=(image.width-1)*.1,y=(image.height-1)*.1;[[x,y],[image.width-1-x,y],[image.width-1-x,image.height-1-y],[x,image.height-1-y]].forEach(([x,y],i)=>handles[i].position({x,y}));selected=0;clearError();redraw();}
  function enter(){if(locked||!options.getImage())return;active=true;customRatio='1:1';$('perspective-mode').value='custom';$('perspective-ratio').value='1:1';$('perspective-ratio').readOnly=false;group.show();$('perspective-panel').hidden=false;reset();options.modeChanged();viewport.focus({preventScroll:true});options.status('拖曳四角對準目標；選取角點後可用方向鍵微調。');}
  function exit(){active=false;group.hide();$('perspective-panel').hidden=true;clearError();options.modeChanged();layer.batchDraw();}
  function setLocked(value){locked=value;handles.forEach(h=>h.draggable(!value));$('perspective-panel').querySelectorAll('input,select,button').forEach(el=>el.disabled=value);}
  function key(event){if(!active||locked)return false;if(event.key==='Escape'){exit();return true;}const movement={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!movement)return false;const step=event.shiftKey?5:1,h=handles[selected];h.position({x:h.x()+movement[0]*step,y:h.y()+movement[1]*step});clamp(h);clearError();redraw();return true;}
  $('perspective-reset').onclick=reset;$('perspective-cancel').onclick=()=>{exit();options.status('已取消梯形校正，影像未變更。');};
  $('perspective-ratio').oninput=()=>{customRatio=$('perspective-ratio').value;clearError();updateEstimate();};
  $('perspective-mode').onchange=()=>{const original=$('perspective-mode').value==='original';$('perspective-ratio').readOnly=original;if(original){const image=options.getImage(),d=PerspectiveMath.gcd(image.height,image.width);$('perspective-ratio').value=(image.height/d)+':'+(image.width/d);}else $('perspective-ratio').value=customRatio;clearError();updateEstimate();};
  $('perspective-apply').onclick=async()=>{if(!active||locked)return;clearError();try{PerspectiveMath.ratio($('perspective-ratio').value);const correction={points:points(),ratio:$('perspective-ratio').value,ratioMode:$('perspective-mode').value};PerspectiveMath.dimensions(correction.points,PerspectiveMath.ratio(correction.ratio));await options.apply(correction);}catch(e){showError(e.message);}};
  return {get active(){return active;},enter,exit,redraw,setLocked,key};
}
