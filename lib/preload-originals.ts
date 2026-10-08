/** Warm the browser's HTTP cache without decoding or retaining every original. */
export function originalViewUrl(id:string,retry=0){return `/api/view/${encodeURIComponent(id)}?v=6${retry?`&retry=${retry}`:''}`;}
export async function preloadOriginals(ids:string[],completed:Set<string>,signal:AbortSignal){
 const queue=[...new Set(ids)].filter(id=>!completed.has(id));let cursor=0;
 async function worker(){
  while(!signal.aborted&&cursor<queue.length){
   const id=queue[cursor++];
   try{
    const response=await fetch(originalViewUrl(id),{cache:'force-cache',priority:'low'});
    if(!response.ok){await response.body?.cancel();continue;}
    // Drain the stream so the browser can finish caching it. Avoid a huge Blob
    // or decoded Image for each photo, especially on phones.
    const reader=response.body?.getReader();
    // Pausing the queue must not abort a response also being used by the viewer.
    // Finish the two in-flight transfers; the loop will stop scheduling new work.
    if(reader)try{while(!(await reader.read()).done){/* Drain the current transfer. */}}finally{reader.releaseLock();}
    completed.add(id);
   }catch{/* Failed preloads don't prevent normal viewing or future retries. */}
  }
 }
 await Promise.all([worker(),worker()]);
}
