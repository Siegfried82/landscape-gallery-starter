'use client';
import {flushSync} from 'react-dom';
const moving=new Set<Animation>();
export function stopLayoutMotion(){for(const animation of moving)animation.cancel();moving.clear();}
export const photoRatios=new Map<string,number>();
export function reducedMotion(){return typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
/** Snapshot the current layout, commit synchronously, then animate the new layout. */
export function galleryTransition(update:()=>void,photoId?:string){
 if(typeof document==='undefined'||reducedMotion()){update();return;}
 if(photoId){stopLayoutMotion();flushSync(update);return;}
 if(!photoId&&document.querySelectorAll){
  const before=new Map<string,DOMRect>();
  for(const node of document.querySelectorAll<HTMLElement>('[data-gallery-photo]')){const id=node.dataset.galleryPhoto;if(id)before.set(id,node.getBoundingClientRect());}
  for(const animation of moving)animation.cancel();moving.clear();
  flushSync(update);
  for(const node of document.querySelectorAll<HTMLElement>('[data-gallery-photo]')){
   const old=before.get(node.dataset.galleryPhoto||''),next=node.getBoundingClientRect();
   if(!old||!old.width||!old.height||!next.width||!next.height||!node.animate)continue;
   const dx=old.left-next.left,dy=old.top-next.top,sx=old.width/next.width,sy=old.height/next.height;
   if(Math.abs(dx)+Math.abs(dy)<.5&&Math.abs(sx-1)+Math.abs(sy-1)<.005)continue;
   const animation=node.animate([{transformOrigin:'top left',transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transformOrigin:'top left',transform:'none'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)'});
   moving.add(animation);void animation.finished.catch(()=>{}).finally(()=>moving.delete(animation));
  }
  return;
 }
 update();
}
