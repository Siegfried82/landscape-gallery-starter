'use client';
/* eslint-disable @next/next/no-img-element -- This viewer intentionally displays the original R2 file. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {parameterFields,visibleTitle,type Photo} from '@/lib/photo-metadata';
import {useLanguage} from '@/addons/hooks/useLanguage';
import {formatBilingualText} from '@/addons/locales/metadata-helpers';
import {bindViewerWheel,zoomAt} from '@/lib/viewer-zoom';
import {isLoupeImageReady} from '@/lib/loupe-image';
import {preloadOriginals,originalViewUrl} from '@/lib/preload-originals';
type Point={x:number;y:number};
const MAX_ZOOM=10;
const clamp=(n:number)=>Math.max(1,Math.min(MAX_ZOOM,n));
// Adapted from gallery-addons/features/ambient-glow, with stale-load cleanup
// and an isolated backdrop below the image and controls.
function AmbientBackdrop({src}:{src:string}){
  const [sample,setSample]=useState<{src:string;primary:string;secondary:string}|null>(null);
  useEffect(()=>{
    let cancelled=false;
    const image=new Image();
    image.onload=()=>{
      if(cancelled)return;
      try{
        const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
        const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
        context.drawImage(image,0,0,16,16);
        const pixels=context.getImageData(0,0,16,16).data;
        const color=(side:number,alpha:number)=>{
          let r=0,g=0,b=0,count=0;
          for(let y=0;y<16;y++)for(let x=side*8;x<(side+1)*8;x++){
            const i=(y*16+x)*4;if(pixels[i+3]<128)continue;
            r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];count++;
          }
          return count?`rgba(${Math.round(r/count)},${Math.round(g/count)},${Math.round(b/count)},${alpha})`:'transparent';
        };
        if(!cancelled)setSample({src,primary:color(0,.35),secondary:color(1,.25)});
      }catch{/* Keep the normal dark backdrop when sampling fails. */}
    };
    image.src=src;
    return()=>{cancelled=true;image.onload=null;image.onerror=null;image.removeAttribute('src');};
  },[src]);
  const colors=sample?.src===src?sample:null;
  return <div aria-hidden="true" style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:-1}}><div style={{position:'absolute',inset:0,filter:'blur(50px)',opacity:colors?1:0,transition:'opacity .5s ease',background:`radial-gradient(ellipse at 25% 50%,${colors?.primary??'transparent'},transparent 70%),radial-gradient(ellipse at 75% 50%,${colors?.secondary??'transparent'},transparent 70%)`}}/></div>;
}
// Pixel loupe adapted from gallery-addons/features/pixel-loupe.
// Draw from the loaded original at a gentle 1.5x display zoom, no extra fetch.
function PixelLoupe({imageSrc}:{imageSrc:string}){
  const {t}=useLanguage();
  const [active,setActive]=useState(false);
  const toggle=useRef<HTMLButtonElement>(null),lens=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    function key(e:KeyboardEvent){
      const target=e.target as HTMLElement|null;
      if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||target?.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key.toLowerCase()==='z'){e.preventDefault();setActive(value=>!value);}
    }
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[]);
  useEffect(()=>{
    if(!active)return;
    let frame=0,point:{x:number;y:number}|null=null;
    const hide=()=>{point=null;if(lens.current)lens.current.style.display='none';};
    function draw(){
      frame=0;
      const image=toggle.current?.closest('[role="dialog"]')?.querySelector<HTMLImageElement>('.viewer-stage img.viewer-original');
      const surface=canvas.current,glass=lens.current;
      if(!point||!image||!surface||!glass||!isLoupeImageReady(image,imageSrc,document.baseURI)){hide();return;}
      const rect=image.getBoundingClientRect();
      if(!rect.width||!rect.height||point.x<rect.left||point.x>rect.right||point.y<rect.top||point.y>rect.bottom){hide();return;}
      const context=surface.getContext('2d');if(!context){hide();return;}
      const x=(point.x-rect.left)/rect.width*image.naturalWidth;
      const y=(point.y-rect.top)/rect.height*image.naturalHeight;
      context.fillStyle='#0b0d0b';context.fillRect(0,0,220,220);
      const sampleWidth=220*image.naturalWidth/rect.width/1.5;
      const sampleHeight=220*image.naturalHeight/rect.height/1.5;
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(image,x-sampleWidth/2,y-sampleHeight/2,sampleWidth,sampleHeight,0,0,220,220);
      glass.style.left=point.x+'px';glass.style.top=point.y+'px';glass.style.display='block';
    }
    function move(e:MouseEvent){point={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(draw);}
    function leave(e:MouseEvent){if(!e.relatedTarget)hide();}
    window.addEventListener('mousemove',move);
    window.addEventListener('mouseout',leave);
    window.addEventListener('resize',hide);
    window.addEventListener('scroll',hide,true);
    window.addEventListener('wheel',hide);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('mousemove',move);window.removeEventListener('mouseout',leave);window.removeEventListener('resize',hide);window.removeEventListener('scroll',hide,true);window.removeEventListener('wheel',hide);};
  },[active,imageSrc]);
  return <><button ref={toggle} type="button" aria-pressed={active} title={t('1.5 倍放大镜（Z 键）','1.5× magnifier (Z key)')} onClick={()=>setActive(value=>!value)} style={{fontSize:12,whiteSpace:'nowrap',background:active?'#f1f2ed':'transparent',color:active?'#111312':'#f1f2ed'}}>{t('放大镜','Magnifier')} {active?t('开','On'):'(Z)'}</button>{active&&<div ref={lens} aria-hidden="true" style={{display:'none',position:'fixed',width:220,height:220,borderRadius:'50%',overflow:'hidden',pointerEvents:'none',zIndex:100,transform:'translate(-50%,-50%)',boxShadow:'0 10px 30px #0009,0 0 0 2px #fffd'}}><canvas ref={canvas} width={220} height={220} style={{display:'block',width:220,height:220}}/><span style={{position:'absolute',left:104,top:109,width:12,height:1,background:'#fffb'}}/><span style={{position:'absolute',left:109,top:104,width:1,height:12,background:'#fffb'}}/></div>}</>;
}
export default function PhotoLightbox({photos,index,onNavigate,onClose,opener}:{photos:Photo[];index:number;onNavigate:(id:string)=>void;onClose:()=>void;opener:HTMLElement|null}){
  const photo=photos[index];
  const {lang,t}=useLanguage();
  const title=formatBilingualText(visibleTitle(photo.title),lang);
  const [pose,setPose]=useState({scale:1,x:0,y:0}),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false),[retryKey,setRetryKey]=useState(0);
  const current=useRef(pose),points=useRef(new Map<number,Point>()),gesture=useRef<{center:Point;distance:number;pose:typeof pose}|null>(null),start=useRef<Point|null>(null),pinched=useRef(false);
  const stage=useRef<HTMLDivElement>(null),info=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!loaded||photos.length<2)return;
    const controller=new AbortController();
    const neighbours=[photos[(index+1)%photos.length].id,photos[(index+photos.length-1)%photos.length].id];
    void preloadOriginals(neighbours,new Set<string>(),controller.signal);
    return()=>controller.abort();
  },[loaded,index,photos]);
  useEffect(()=>{
    const image=stage.current?.querySelector('img');if(!image||!loaded)return;
    const update=()=>{if(info.current)info.current.style.width=image.clientWidth+'px';};
    const observer=new ResizeObserver(update);observer.observe(image);update();
    return()=>observer.disconnect();
  },[loaded,photo.id]);
  const apply=useCallback((next:typeof pose)=>{const bounds=stage.current?.getBoundingClientRect();const limitX=((bounds?.width??1000)*(next.scale-1))/2,limitY=((bounds?.height??800)*(next.scale-1))/2;const result=next.scale<=1?{scale:1,x:0,y:0}:{...next,x:Math.max(-limitX,Math.min(limitX,next.x)),y:Math.max(-limitY,Math.min(limitY,next.y))};current.current=result;setPose(result);},[]);
  const localPoint=useCallback((point?:Point)=>{
    const image=stage.current?.querySelector('img.viewer-original, img.viewer-preview');
    const bounds=image?.getBoundingClientRect();
    const viewport=stage.current?.getBoundingClientRect();
    if(!bounds||!viewport)return {x:0,y:0};
    // The transformed rectangle includes pan; subtract it to recover the base image centre.
    const origin={x:bounds.left+bounds.width/2-current.current.x,y:bounds.top+bounds.height/2-current.current.y};
    return {x:(point?.x??viewport.left+viewport.width/2)-origin.x,y:(point?.y??viewport.top+viewport.height/2)-origin.y};
  },[]);
  const zoom=useCallback((delta:number,point?:Point)=>{
    apply(zoomAt(current.current,clamp(current.current.scale+delta),localPoint(point)));
  },[apply,localPoint]);
  const attachStage=useCallback((element:HTMLDivElement|null)=>{
    stage.current=element;if(!element)return;
    const unbind=bindViewerWheel(element,zoom);
    return()=>{unbind();stage.current=null;};
  },[zoom]);
  const move=useCallback((delta:number)=>{if(photos.length>1)onNavigate(photos[(index+delta+photos.length)%photos.length].id);},[index,photos,onNavigate]);

  useEffect(()=>{function key(e:KeyboardEvent){if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.5);}if(e.key==='-'){e.preventDefault();zoom(-.5);}if(e.key==='0')apply({scale:1,x:0,y:0});}document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[apply,move,zoom]);
  function rebase(){const values=[...points.current.values()];if(!values.length){gesture.current=null;return;}const center=values.length>1?{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}:values[0];gesture.current={center,distance:values.length>1?Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y):0,pose:current.current};}
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="photo-lightbox" overlayClassName="photo-lightbox-backdrop" style={{isolation:'isolate'}} showCloseButton={false} onCloseAutoFocus={e=>{e.preventDefault();opener?.focus();}}>
    <AmbientBackdrop src={'/api/image/'+photo.id}/>
    <div className="viewer-toolbar"><span aria-live="polite">{index+1} / {photos.length}</span><div className="zoom-controls" style={{flexWrap:'wrap',justifyContent:'center'}}><a className="button viewer-download" href={originalViewUrl(photo.id)+'&download=1'} download title={t('下载不含 EXIF 和 GPS 的图片','Download image without EXIF or GPS')}>{t('下载','Download')}</a><PixelLoupe imageSrc={originalViewUrl(photo.id,retryKey)}/><button onClick={()=>zoom(-.5)} disabled={pose.scale===1} aria-label={t('缩小','Zoom out')}>−</button><button onClick={()=>apply({scale:1,x:0,y:0})} aria-label={t('重置缩放','Reset zoom')}>{Math.round(pose.scale*100)}%</button><button onClick={()=>zoom(.5)} disabled={pose.scale>=MAX_ZOOM} aria-label={t('放大','Zoom in')}>＋</button></div><DialogClose asChild><button aria-label={t('关闭预览','Close preview')}>{t('关闭','Close')} ×</button></DialogClose></div>
    <div className="viewer-stage" ref={attachStage} style={{cursor:pose.scale>1?'grab':'default'}} onDoubleClick={e=>apply(zoomAt(current.current,current.current.scale===1?2:1,localPoint({x:e.clientX,y:e.clientY})))}
      onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);const p={x:e.clientX,y:e.clientY};if(points.current.size===0){start.current=p;pinched.current=false;}points.current.set(e.pointerId,p);if(points.current.size>1)pinched.current=true;rebase();}}
      onPointerMove={e=>{if(!points.current.has(e.pointerId))return;points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const values=[...points.current.values()],g=gesture.current;if(!g)return;if(values.length>1&&g.distance){const center={x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2};const scale=clamp(g.pose.scale*Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y)/g.distance);const next=zoomAt(g.pose,scale,localPoint(g.center));apply({...next,x:next.x+center.x-g.center.x,y:next.y+center.y-g.center.y});}else if(g.pose.scale>1)apply({...g.pose,x:g.pose.x+e.clientX-g.center.x,y:g.pose.y+e.clientY-g.center.y});}}
      onPointerUp={e=>{const initial=start.current;const swipe=points.current.size===1&&!pinched.current&&current.current.scale===1&&initial;points.current.delete(e.pointerId);rebase();if(swipe){const dx=e.clientX-initial.x,dy=e.clientY-initial.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);}}}
      onPointerCancel={e=>{points.current.delete(e.pointerId);pinched.current=true;rebase();}}>
      {!loaded&&!failed&&<p className="original-loading" role="status">{t('正在读取原图…','Loading original…')}</p>}
      <img data-morph-photo={loaded?photo.id:undefined} className="viewer-original" key={`${photo.id}:${retryKey}`} src={originalViewUrl(photo.id,retryKey)} alt={photo.title} fetchPriority="high" decoding="async" draggable={false} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} style={{opacity:loaded?1:0,viewTransitionName:loaded?'gallery-open-photo':undefined,transform:`translate(${pose.x}px,${pose.y}px) scale(${pose.scale})`}}/><img data-morph-photo={loaded?undefined:photo.id} className="viewer-preview" src={'/api/image/'+photo.id} alt="" aria-hidden="true" draggable={false} style={{opacity:loaded?0:1,viewTransitionName:loaded?undefined:'gallery-open-photo',transform:`translate(${pose.x}px,${pose.y}px) scale(${pose.scale})`}}/>{failed&&<p className="viewer-load-error" role="alert">原图暂时无法读取，当前显示预览图。<button onClick={()=>{setFailed(false);setLoaded(false);setRetryKey(value=>value+1);}}>重试</button></p>}
    </div>
    <button className="viewer-prev" onClick={()=>move(-1)} disabled={photos.length<2} aria-label={t('上一张','Previous photo')}>‹</button><button className="viewer-next" onClick={()=>move(1)} disabled={photos.length<2} aria-label={t('下一张','Next photo')}>›</button>
    <div className="viewer-info" ref={info}><div className="viewer-name"><DialogTitle style={title?undefined:{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}}>{title||'照片预览'}</DialogTitle><DialogDescription>{[formatBilingualText(photo.location,lang)].filter(Boolean).join(' / ')}</DialogDescription></div><section className="viewer-exif" aria-label="EXIF 拍摄参数">{!parameterFields.some(f=>photo.exif[f.key])&&<p>这张作品尚未提供拍摄参数。</p>}<dl className="parameter-card">{parameterFields.filter(f=>photo.exif[f.key]).map(f=><div key={f.key}><dt style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}}>{f.label}</dt><dd>{photo.exif[f.key]}</dd></div>)}</dl></section></div>
  </DialogContent></Dialog>;
}
