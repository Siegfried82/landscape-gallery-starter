'use client';

import {reducedMotion} from '@/lib/gallery-motion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { formatBilingualText } from '../locales/metadata-helpers';
import {parameterSummary,type Parameters} from '@/lib/photo-metadata';

export interface FeaturedCarouselProps {
  photos: Array<{
    id: string;
    title: string;
    location?: string;
    series?: string;
    exif?: Parameters;
  }>;
  onViewPhoto: (id: string, opener: HTMLElement) => void;
  onReady?:()=>void;
}

export default function FeaturedCarousel({ photos, onViewPhoto,onReady }: FeaturedCarouselProps) {
  const { lang, t } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [ratios,setRatios]=useState<Record<string,number>>({});
  const total = photos.length;
  const touchStart = useRef<{x:number;y:number} | null>(null);
  const lastWheelTime = useRef<number>(0);

  const [previous,setPrevious]=useState<{index:number;src:string}|null>(null);
  const [direction,setDirection]=useState(1);
  const decoded=useRef(new Map<string,Promise<number>>());
  const retained=useRef(new Map<string,HTMLImageElement>());
  const [readyHero,setReadyHero]=useState<Record<string,boolean>>({});
  const currentRef=useRef(0),busy=useRef(false),queued=useRef(0),generation=useRef(0);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const changeRef=useRef<(delta:number)=>void>(()=>{});
  const prepare=useCallback((id:string,hero=true)=>{
    const src=(hero?'/api/hero/':'/api/image/')+id;
    const cached=decoded.current.get(src);if(cached)return cached;
    const image=new Image();image.fetchPriority='high';image.src=src;if(!hero)retained.current.set(src,image);
    const ready=image.decode().then(()=>image.naturalWidth/image.naturalHeight);
    decoded.current.set(src,ready);
    void ready.catch(()=>{decoded.current.delete(src);retained.current.delete(src);});
    return ready;
  },[]);
  const change=useCallback(async(delta:number)=>{
    if(total<2)return;
    if(busy.current){queued.current=delta;return;}
    const from=currentRef.current%total,target=(from+delta+total)%total;
    const token=generation.current;busy.current=true;
    try{
      const ratio=await prepare(photos[target].id,false);
      if(token!==generation.current)return;
      setRatios(old=>({...old,[photos[target].id]:ratio}));
      currentRef.current=target;setDirection(delta>0?1:-1);
      setPrevious(reducedMotion()?null:{index:from,src:(readyHero[photos[from].id]?'/api/hero/':'/api/image/')+photos[from].id});
      setCurrent(target);
      const finish=()=>{
        setPrevious(null);busy.current=false;timer.current=null;
        const next=queued.current;queued.current=0;if(next)changeRef.current(next);
      };
      if(reducedMotion())finish();else timer.current=setTimeout(finish,440);
    }catch{busy.current=false;queued.current=0;}
  },[photos,total,prepare,readyHero]);
  useEffect(()=>{changeRef.current=delta=>{void change(delta);};},[change]);
  const prev=useCallback(()=>{void change(-1);},[change]);
  const next=useCallback(()=>{void change(1);},[change]);
  useEffect(()=>{
    let active=true;
    // Small previews are ready for immediate navigation; hero quality fills in independently.
    for(const photo of photos){
      void prepare(photo.id,false).then(ratio=>{if(active)setRatios(old=>old[photo.id]===ratio?old:{...old,[photo.id]:ratio});}).catch(()=>{});
      void prepare(photo.id,true).then(ratio=>{if(active){setRatios(old=>old[photo.id]===ratio?old:{...old,[photo.id]:ratio});setReadyHero(old=>({...old,[photo.id]:true}));}}).catch(()=>{});
    }
    return()=>{active=false;};
  },[photos,prepare]);
  useEffect(()=>{const token=generation.current;return()=>{generation.current=token+1;if(timer.current)clearTimeout(timer.current);};},[]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]') || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next]);

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 600) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2.5 && Math.abs(e.deltaX) > 45) {
      if (e.deltaX > 0) next();
      else prev();
      lastWheelTime.current = now;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if(e.touches.length!==1){touchStart.current=null;return;}
    touchStart.current = {x:e.touches[0].clientX,y:e.touches[0].clientY};
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current.x;
    const vertical=e.changedTouches[0].clientY-touchStart.current.y;
    if (Math.abs(diff) > 40 && Math.abs(diff)>Math.abs(vertical)*2.5) {
      if (diff > 0) prev();
      else next();
    }
    touchStart.current = null;
  };

  if (!photos || total === 0) return null;

  const renderScene=(index:number)=>{
    const currentPhoto=photos[index%total];
    const title=formatBilingualText(currentPhoto.title,lang);
    const meta=formatBilingualText(currentPhoto.location,lang);
    return <div className={`hero-scene ${previous?'transitioning':''}`}  style={{'--hero-ratio':ratios[currentPhoto.id]||1.5,'--slide-direction':direction} as React.CSSProperties}>
      {total>1&&(['prev','next'] as const).map(side=>{
        const photo=photos[(index+(side==='prev'?total-1:1))%total];
        return <button key={side} tabIndex={0} type="button" className={`addon-stage-neighbor ${side}`} onClick={side==='prev'?prev:next} aria-label={t(side==='prev'?'上一张':'下一张',side==='prev'?'Previous photo':'Next photo')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={photo.id} className={previous?'hero-side-in':undefined} src={'/api/image/'+photo.id} alt="" draggable={false}/>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previous&&<img className="hero-side-out" src={'/api/image/'+photos[(previous.index+(side==='prev'?total-1:1))%total].id} alt="" draggable={false}/>}
        </button>;
      })}
      <article className="addon-stage-card" role="button" tabIndex={0} aria-label={t(`查看 ${title}`,`View ${title}`)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onViewPhoto(currentPhoto.id,e.currentTarget);}}} onClick={e=>onViewPhoto(currentPhoto.id,e.currentTarget)}>
        <div className="addon-stage-img-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previous&&<img className="hero-photo-out" src={previous.src} alt="" aria-hidden="true" draggable={false}/>}
          <div key={currentPhoto.id} className={`hero-photo-layer ${previous?'hero-photo-in':''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-morph-photo={readyHero[currentPhoto.id]?undefined:currentPhoto.id} src={'/api/image/'+currentPhoto.id} alt={title} loading="eager" fetchPriority="high" draggable={false} className="addon-stage-img" onLoad={e=>{const image=e.currentTarget,ratio=image.naturalWidth/image.naturalHeight;if(ratio>0)setRatios(old=>old[currentPhoto.id]===ratio?old:{...old,[currentPhoto.id]:ratio});}} onError={()=>onReady?.()}/>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="addon-stage-img hero-quality" data-morph-photo={readyHero[currentPhoto.id]?currentPhoto.id:undefined} src={'/api/hero/'+currentPhoto.id} alt="" aria-hidden="true" draggable={false} fetchPriority="high" style={{opacity:readyHero[currentPhoto.id]?1:0}} onLoad={()=>{onReady?.();setReadyHero(old=>old[currentPhoto.id]?old:{...old,[currentPhoto.id]:true});}} onError={()=>onReady?.()}/>
          </div>
          <div className="addon-stage-overlay" aria-hidden="true">
            <div className="addon-stage-top"><span className="addon-stage-counter">{String(index%total+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span><span className="addon-stage-action">{t('沉浸查看 ↗','View ↗')}</span></div>
            <div className="addon-stage-bottom">{meta&&<p className="addon-stage-meta">{meta}</p>}<p className="addon-stage-exif">{parameterSummary(currentPhoto.exif||{})||t('未提供拍摄参数','No camera settings')}</p></div>
          </div>
        </div>
      </article>
    </div>;
  };
  return (
    <section
      className="addon-loop-section"
      aria-label={t('精选大图展', 'Featured Works')}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="addon-loop-stage">
        {renderScene(current)}
        {total>1&&<><button type="button" className="addon-stage-nav prev" onClick={prev} aria-label={t('上一张','Previous Photo')}>‹</button><button type="button" className="addon-stage-nav next" onClick={next} aria-label={t('下一张','Next Photo')}>›</button></>}
      </div>

    </section>
  );
}
