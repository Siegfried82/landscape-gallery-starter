/** Strip metadata from browser-generated JPEGs without allocating decoded pixels. */
export async function validatedPreviewBytes(file:File,maxBytes:number,maxPixels:number,maxSide:number){
 if(!file.size||file.size>maxBytes)throw Error('展示图片过大');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('展示图片必须是 JPEG');
 const chunks:Uint8Array[]=[bytes.subarray(0,2)];
 let offset=2,dimensions=false,scan=false;
 while(offset<bytes.length){
  const start=offset;
  if(bytes[offset++]!==255)throw Error('JPEG 格式无效');
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===217){chunks.push(bytes.subarray(start,offset));break;}
  const length=(bytes[offset]<<8)|bytes[offset+1];
  if(length<2||offset+length>bytes.length)throw Error('JPEG 格式无效');
  if(marker===192||marker===193||marker===194){
   if(length<8)throw Error('JPEG 尺寸无效');
   const height=(bytes[offset+3]<<8)|bytes[offset+4],width=(bytes[offset+5]<<8)|bytes[offset+6];
   if(!width||!height||width>maxSide||height>maxSide||width*height>maxPixels)throw Error('展示图片尺寸过大');
   dimensions=true;
  }
  if(!(marker>=224&&marker<=239)&&marker!==254)chunks.push(bytes.subarray(start,offset+length));
  offset+=length;
  if(marker===218){
   scan=true;const entropyStart=offset;
   while(offset<bytes.length-1){
    if(bytes[offset]!==255){offset++;continue;}
    const next=bytes[offset+1];
    if(next===0||(next>=208&&next<=215)){offset+=2;continue;}
    if(next===255){offset++;continue;}
    break;
   }
   chunks.push(bytes.subarray(entropyStart,offset));
  }
 }
 if(!dimensions||!scan||offset!==bytes.length)throw Error('JPEG 格式无效');
 const output=new Uint8Array(chunks.reduce((sum,c)=>sum+c.length,0));let position=0;
 for(const chunk of chunks){output.set(chunk,position);position+=chunk.length;}
 return output;
}

export function displayBytes(file:File){return validatedPreviewBytes(file,3*1024*1024,3_000_000,1600);}
