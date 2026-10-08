export async function downloadViewerImage(url:string,signal:AbortSignal,onProgress:(bytes:number)=>void):Promise<Blob>{
 const response=await fetch(url,{signal,cache:'force-cache',priority:'high'});
 if(!response.ok)throw new Error(`Image request failed: ${response.status}`);
 if(!response.body)throw new Error('Image response has no body');
 const reader=response.body.getReader(),chunks:BlobPart[]=[];let bytes=0;
 try{
  while(true){
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
   const {done,value}=await reader.read();if(done)break;
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
   // Retain only the current original, not decoded images for the whole album.
   chunks.push(value.slice());bytes+=value.byteLength;onProgress(bytes);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 if(!bytes)throw new Error('Empty image');
 return new Blob(chunks,{type:response.headers.get('content-type')||'image/jpeg'});
}
