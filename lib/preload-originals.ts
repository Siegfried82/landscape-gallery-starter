/** Warm the browser's HTTP cache without decoding or retaining every original. */
export function originalViewUrl(id:string,retry=0){return `/api/view/${encodeURIComponent(id)}?v=3${retry?`&retry=${retry}`:''}`;}
export async function preloadOriginals(ids:string[],completed:Set<string>,signal:AbortSignal){
 const queue=[...new Set(ids)].filter(id=>!completed.has(id));let cursor=0;
 async function worker(){
  while(!signal.aborted&&cursor<queue.length){
   const id=queue[cursor++];
   try{
    const response=await fetch(originalViewUrl(id),{cache:'force-cache',priority:'low',signal});
    if(!response.ok){await response.body?.cancel();continue;}
    // Drain the stream so the browser can finish caching it. Avoid a huge Blob
    // or decoded Image for each photo, especially on phones.
    const reader=response.body?.getReader();
    if(reader)try{while(!(await reader.read()).done){if(signal.aborted){await reader.cancel();break;}}}finally{reader.releaseLock();}
    if(!signal.aborted)completed.add(id);
   }catch{/* Failed preloads don't prevent normal viewing or future retries. */}
  }
 }
 await Promise.all([worker(),worker()]);
}
