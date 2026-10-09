'use client';
import {useEffect} from 'react';
export default function VisitorTracker(){
 useEffect(()=>{
  let dirty=true,lastSent=0,busy=false;
  const send=async()=>{
   if(busy||!dirty||document.visibilityState!=='visible')return;
   busy=true;dirty=false;lastSent=Date.now();
   try{const response=await fetch('/api/visits',{method:'POST',credentials:'same-origin',cache:'no-store'});if(!response.ok)dirty=true;}catch{dirty=true;}finally{busy=false;}
  };
  const activity=()=>{dirty=true;if(Date.now()-lastSent>=60000)void send();};
  const visible=()=>{if(document.visibilityState==='visible')activity();};
  void send();const timer=setInterval(()=>{void send();},60000);
  const events=['pointerdown','keydown','scroll'] as const;
  for(const event of events)window.addEventListener(event,activity,{passive:true});
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);for(const event of events)window.removeEventListener(event,activity);document.removeEventListener('visibilitychange',visible);};
 },[]);
 return null;
}
