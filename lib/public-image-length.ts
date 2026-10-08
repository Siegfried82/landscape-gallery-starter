import {publicImage} from './public-image';
type Bucket=Pick<R2Bucket,'get'|'head'|'put'>;
/** Remember the exact sanitized size so HTTP can detect an interrupted transfer. */
export async function publicImageLength(bucket:Bucket,id:string,mime:string):Promise<number|null>{
 const source=await bucket.head(id);if(!source)return null;
 const key=`public-length/v4/${id}/${source.etag}`;
 const cached=await bucket.get(key);
 if(cached){
  try{
   if(cached.size>1024){await cached.body.cancel();}else{
    const value=JSON.parse(await cached.text()) as {length?:number;mime?:string};
    if(value.mime===mime&&typeof value.length==='number'&&Number.isSafeInteger(value.length)&&value.length>0&&value.length<=source.size)return value.length;
   }
  }catch{/* Recompute an invalid length manifest. */}
 }
 const body=await publicImage(bucket,id,mime);if(!body)return null;
 const reader=body.getReader();let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const current=await bucket.head(id);
 if(!current||current.etag!==source.etag)throw Error('Original changed during validation');
 if(!length||length>source.size)throw Error('Invalid public image size');
 // This small manifest contains no image bytes, EXIF or personal metadata.
 await bucket.put(key,JSON.stringify({length,mime}),{httpMetadata:{contentType:'application/json'}});
 return length;
}
