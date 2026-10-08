'use client';
import {useCallback,useSyncExternalStore} from 'react';
const fallback=new Map<string,string>();
const eventName='gallery-preference-change';
/** Browser preferences with an SSR-safe initial value and cross-tab updates. */
export function usePreference<T extends string>(key:string,initial:T,valid:(value:string)=>value is T,serverInitial:T=initial){
 const subscribe=useCallback((listener:()=>void)=>{
  function changed(event:Event){if(event instanceof StorageEvent){if(event.key!==key&&event.key!==null)return;fallback.delete(key);}else if((event as CustomEvent<string>).detail!==key)return;listener();}
  window.addEventListener('storage',changed);window.addEventListener(eventName,changed);
  return()=>{window.removeEventListener('storage',changed);window.removeEventListener(eventName,changed);};
 },[key]);
 const snapshot=useCallback(()=>{let value=fallback.get(key);if(value===undefined){try{value=localStorage.getItem(key)??undefined;}catch{}}return value&&valid(value)?value:initial;},[key,initial,valid]);
 const server=useCallback(()=>serverInitial,[serverInitial]);
 const value=useSyncExternalStore(subscribe,snapshot,server);
 const set=useCallback((next:T,persist=true)=>{const changed=fallback.get(key)!==next;fallback.set(key,next);if(persist){try{localStorage.setItem(key,next);}catch{}}if(changed)window.dispatchEvent(new CustomEvent(eventName,{detail:key}));},[key]);
 return [value,set] as const;
}
