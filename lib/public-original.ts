import {publicImage} from './public-image';
import {publicImageLength} from './public-image-length';
type Bucket=Pick<R2Bucket,'get'|'head'|'put'>;
/** Preserve pixels and color profiles, but prepare metadata removal only once. */
export async function publicOriginal(bucket:Bucket,id:string,mime:string){
 const source=await bucket.head(id);if(!source)return null;
 const key=`public-original/v2/${id}/${source.etag}`;
 const cached=await bucket.get(key);if(cached)return cached;
 const body=await publicImage(bucket,id,mime);if(!body)return null;
 const length=await publicImageLength(bucket,id,mime);if(length===null)return null;
 const fixed=new FixedLengthStream(length);
 await Promise.all([body.pipeTo(fixed.writable),bucket.put(key,fixed.readable,{httpMetadata:{contentType:mime}})]);
 const current=await bucket.head(id);
 if(!current||current.etag!==source.etag)throw Error('Original changed during preparation');
 return bucket.get(key);
}
