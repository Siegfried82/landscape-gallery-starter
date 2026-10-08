// Upload one photo at a time; large originals use R2 multipart requests.
export async function uploadPhoto(file:File,metadata:FormData,onProgress:(percent:number)=>void){
 const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const mime=signature[0]===255&&signature[1]===216?'image/jpeg':signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71?'image/png':String.fromCharCode(...signature.slice(0,4))==='RIFF'&&String.fromCharCode(...signature.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime)throw Error('支持 JPG、PNG 和 WebP 照片');
 async function result<T=unknown>(response:Response):Promise<T>{const data=await response.json().catch(()=>({error:response.status===413?'托管平台拒绝了本次请求，请重试':'上传失败，请重试'}));if(!response.ok)throw Error((data as {error?:string}).error||'上传失败');return data as T;}
 // Compressed uploads up to 40 MiB use one request, avoiding multipart image assembly.
 if(file.size<=40*1024*1024){metadata.set('file',file);await result(await fetch('/api/photos',{method:'POST',body:metadata}));onProgress(100);return;}
 const {id,uploadId}=await result<{id:string;uploadId:string}>(await fetch('/api/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime})}));
 const url='/api/uploads/'+id+'?uploadId='+encodeURIComponent(uploadId),parts:{partNumber:number;etag:string}[]=[];
 // Keep every non-final part at least 5 MiB, within R2's 10,000-part limit.
 const chunk=Math.max(8*1024*1024,Math.ceil(file.size/10000));
 try{
  for(let offset=0;offset<file.size;offset+=chunk){const partNumber=parts.length+1,blob=file.slice(offset,offset+chunk);let uploaded:{partNumber:number;etag:string}|undefined;
   for(let attempt=0;attempt<3;attempt++){try{uploaded=await result<{partNumber:number;etag:string}>(await fetch(url+'&part='+partNumber,{method:'PUT',body:blob}));break;}catch(e){if(attempt===2)throw e;}}
   if(!uploaded)throw Error('分块上传失败');parts.push(uploaded);onProgress(Math.round(Math.min(file.size,offset+chunk)/file.size*99));
  }
  metadata.delete('file');metadata.set('parts',JSON.stringify(parts));await result(await fetch(url,{method:'POST',body:metadata}));onProgress(100);
 }catch(e){await fetch(url,{method:'DELETE'}).catch(()=>{});throw e;}
}
