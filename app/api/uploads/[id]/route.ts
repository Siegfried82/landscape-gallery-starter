import {getOwner,sameOrigin} from '@/lib/owner';
import {storage} from '@/lib/photos';
import {displayBytes} from '@/lib/display';
import {metadataFromInput} from '@/lib/photo-metadata';
type Context={params:Promise<{id:string}>};
async function session(request:Request,context:Context){
 const owner=await getOwner(request);if(!owner||!sameOrigin(request))return null;
 const {id}=await context.params,uploadId=new URL(request.url).searchParams.get('uploadId');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!uploadId)throw Error('Invalid upload');
 const {db,bucket}=storage();if(await db.prepare('SELECT id FROM photos WHERE id=?').bind(id).first())throw Error('Photo already published');
 return {id,owner,db,bucket,upload:bucket.resumeMultipartUpload(id,uploadId)};
}
export async function PUT(request:Request,context:Context){
 try{const s=await session(request,context);if(!s)return new Response('Forbidden',{status:403});const part=Number(new URL(request.url).searchParams.get('part'));if(!Number.isInteger(part)||part<1||part>10000||!request.body)return Response.json({error:'上传分块无效。'},{status:400});const result=await s.upload.uploadPart(part,request.body);return Response.json(result);}catch(e){console.error(e);return Response.json({error:'分块上传失败，请重试。'},{status:503});}
}
export async function DELETE(request:Request,context:Context){
 try{const s=await session(request,context);if(!s)return new Response('Forbidden',{status:403});await s.upload.abort();await s.bucket.delete([s.id,'display/'+s.id]);return Response.json({ok:true});}catch(e){console.error(e);return Response.json({error:'取消上传失败。'},{status:503});}
}
export async function POST(request:Request,context:Context){
 let s:Awaited<ReturnType<typeof session>>=null,completed=false;
 try{
  s=await session(request,context);if(!s)return new Response('Forbidden',{status:403});
  const data=await request.formData();const display=data.get('display');if(!(display instanceof File))return Response.json({error:'缺少展示图片。'},{status:400});
  let parts:R2UploadedPart[],metadata:ReturnType<typeof metadataFromInput>;
  try{parts=JSON.parse(String(data.get('parts')));if(!Array.isArray(parts)||!parts.length||parts.length>10000||parts.some((p,i)=>p.partNumber!==i+1||typeof p.etag!=='string'))throw Error('Invalid parts');metadata=metadataFromInput(data.get('category')||'',data.get('series')||'',JSON.parse(String(data.get('exif')||'{}')));}catch{return Response.json({error:'上传信息格式不正确。'},{status:400});}
  const preview=await displayBytes(display);
  await s.upload.complete(parts);completed=true;
  const original=await s.bucket.get(s.id,{range:{offset:0,length:12}});if(!original)throw Error('Missing original');
  if(original.size>512*1024*1024)throw Error('Original exceeds 512 MiB');
  const bytes=new Uint8Array(await original.arrayBuffer());const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
  if(!mime||mime!==original.httpMetadata?.contentType)throw Error('Invalid image format');
  const title=String(data.get('title')||'').trim().slice(0,100),location=String(data.get('location')||'').trim().slice(0,100),key='display/'+s.id;
  await s.bucket.put(key,preview,{httpMetadata:{contentType:'image/jpeg'}});
  await s.db.prepare('INSERT INTO photos(id,owner,title,location,mime,position,created,display_key,featured,category,series,exif) VALUES(?,?,?,?,?,0,?,?,?,?,?,?)').bind(s.id,s.owner.userId,title,location,mime,Date.now(),key,data.get('featured')==='1'?1:0,metadata.category,metadata.series,metadata.exif).run();
  return Response.json({id:s.id},{status:201});
 }catch(e){console.error(e);if(s&&completed){try{await s.bucket.delete([s.id,'display/'+s.id]);}catch(cleanup){console.error(cleanup);}}return Response.json({error:'上传未完成，请重试。'},{status:503});}
}
