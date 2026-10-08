/** Strip embedded metadata without decoding or recompressing image pixels. */
class Input {
 private reader:ReadableStreamDefaultReader<Uint8Array>;
 buffer:Uint8Array=new Uint8Array(0);offset=0;
 constructor(body:ReadableStream<Uint8Array>){this.reader=body.getReader();}
 async fill(){if(this.offset<this.buffer.length)return true;const r=await this.reader.read();this.buffer=r.value??new Uint8Array(0);this.offset=0;return !r.done;}
 async take(n:number){const result=new Uint8Array(n);let at=0;while(at<n){if(!await this.fill())throw Error('Truncated image');const count=Math.min(n-at,this.buffer.length-this.offset);result.set(this.buffer.subarray(this.offset,this.offset+count),at);this.offset+=count;at+=count;}return result;}
 async *copy(n:number){while(n){if(!await this.fill())throw Error('Truncated image');const count=Math.min(n,this.buffer.length-this.offset);yield this.buffer.subarray(this.offset,this.offset+count);this.offset+=count;n-=count;}}
 async skip(n:number){for await(const chunk of this.copy(n))void chunk;}
 async *entropy():AsyncGenerator<Uint8Array,number>{while(await this.fill()){
  const start=this.offset;let cursor=start;
  // Scan a whole storage chunk synchronously. Escaped FF bytes are common in
  // JPEG pixels; awaiting and yielding for each one exhausts Worker CPU limits.
  while(cursor<this.buffer.length){
   const end=this.buffer.indexOf(255,cursor);
   if(end<0){this.offset=this.buffer.length;yield this.buffer.subarray(start);break;}
   const code=this.buffer[end+1];
   if(code===0||(code>=208&&code<=215)){cursor=end+2;continue;}
   if(end>start)yield this.buffer.subarray(start,end);
   this.offset=end+1;
   let marker=(await this.take(1))[0];while(marker===255)marker=(await this.take(1))[0];
   if(marker===0||(marker>=208&&marker<=215)){yield new Uint8Array([255,marker]);cursor=-1;break;}
   return marker;
  }
  if(cursor===this.buffer.length){this.offset=cursor;yield this.buffer.subarray(start);}
 }throw Error('Missing JPEG end');}
 cancel(){return this.reader.cancel();}
}
async function* jpeg(input:Input){
 const signature=await input.take(2);if(signature[0]!==255||signature[1]!==216)throw Error('Invalid JPEG');yield signature;
 let pending:number|undefined;
 while(true){let marker=pending;pending=undefined;if(marker===undefined){if((await input.take(1))[0]!==255)throw Error('Invalid JPEG');marker=(await input.take(1))[0];while(marker===255)marker=(await input.take(1))[0];}
  if(marker===217){yield new Uint8Array([255,217]);return;}
  if(marker===216||marker===0||marker===1||(marker>=208&&marker<=215))throw Error('Invalid JPEG marker');
  const length=await input.take(2),size=(length[0]<<8|length[1])-2;if(size<0)throw Error('Invalid JPEG segment');
  const segment=await input.take(size);
  // Only retain JFIF and ICC color profiles from APP segments, never EXIF/XMP/IPTC/comments.
  const prefix=new TextDecoder().decode(segment.subarray(0,12));
  const app=marker>=224&&marker<=239;
  if(marker!==254&&(!app||(marker===224&&prefix.startsWith('JFIF\0'))||(marker===226&&prefix==='ICC_PROFILE\0'))){yield new Uint8Array([255,marker,...length]);yield segment;}
  if(marker===218){const scan=input.entropy();while(true){const r=await scan.next();if(r.done){pending=r.value;break;}yield r.value;}}
 }
}
async function* png(input:Input){
 const signature=await input.take(8);if(signature.some((v,i)=>v!==[137,80,78,71,13,10,26,10][i]))throw Error('Invalid PNG');yield signature;
 const keep=new Set(['IHDR','PLTE','IDAT','IEND','tRNS','sRGB','gAMA','cHRM','iCCP','acTL','fcTL','fdAT']);
 while(true){const header=await input.take(8);const size=new DataView(header.buffer).getUint32(0);const type=new TextDecoder().decode(header.subarray(4));if(size>512*1024*1024)throw Error('Invalid PNG chunk');
  if(keep.has(type)){yield header;yield* input.copy(size+4);}else await input.skip(size+4);
  if(type==='IEND')return;
 }
}
export type ImageBucket=Pick<R2Bucket,'get'>;
async function range(bucket:ImageBucket,id:string,offset:number,length:number){const object=await bucket.get(id,{range:{offset,length}});if(!object)throw Error('Missing image');const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==length)throw Error('Truncated image');return bytes;}
async function* webp(bucket:ImageBucket,id:string,input:Input){
 const header=await range(bucket,id,0,12);const text=new TextDecoder();if(text.decode(header.subarray(0,4))!=='RIFF'||text.decode(header.subarray(8))!=='WEBP')throw Error('Invalid WebP');
 const total=new DataView(header.buffer).getUint32(4,true)+8;let offset=12,cleanSize=4;
 const chunks:{type:string;size:number;keep:boolean}[]=[];const keep=new Set(['VP8X','VP8 ','VP8L','ALPH','ICCP','ANIM','ANMF']);
 while(offset<total){const h=await range(bucket,id,offset,8);const type=text.decode(h.subarray(0,4)),size=new DataView(h.buffer).getUint32(4,true);const length=8+size+(size%2);if(offset+length>total)throw Error('Invalid WebP chunk');const retain=keep.has(type);chunks.push({type,size,keep:retain});if(chunks.length>10000)throw Error('Too many WebP chunks');if(retain)cleanSize+=length;offset+=length;}
 new DataView(header.buffer).setUint32(4,cleanSize,true);yield header;await input.skip(12);
 for(const chunk of chunks){const n=8+chunk.size+(chunk.size%2);if(!chunk.keep){await input.skip(n);continue;}
  if(chunk.type==='VP8X'){if(chunk.size!==10)throw Error('Invalid VP8X');const data=await input.take(n);data[8]&=~(0x08|0x04);yield data;}else yield* input.copy(n);
 }
}
export async function publicImage(bucket:ImageBucket,id:string,mime:string){
 const object=await bucket.get(id);if(!object) return null;
 const input=new Input(object.body);const iterator=mime==='image/jpeg'?jpeg(input):mime==='image/png'?png(input):mime==='image/webp'?webp(bucket,id,input):null;
 if(!iterator){await input.cancel();throw Error('Unsupported image');}
 // Validate the signature before returning a successful image response.
 let first:IteratorResult<Uint8Array>;try{first=await iterator.next();}catch(error){await input.cancel();throw error;}
 let next=first;
 return new ReadableStream<Uint8Array>({async pull(controller){try{
  if(next.done){controller.close();await input.cancel();return;}
  controller.enqueue(next.value);
  next=await iterator.next();
 }catch(error){await input.cancel();controller.error(error);}},async cancel(){await input.cancel();}});
}
