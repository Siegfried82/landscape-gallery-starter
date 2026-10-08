import {getOwner,sameOrigin} from '../../../lib/owner';
import {displayBytes} from '../../../lib/display';
import { storage } from '../../../lib/photos';
import {metadataFromInput,cleanParameters,displayCategory} from '../../../lib/photo-metadata';
function storedParameters(value:unknown){try{return cleanParameters(JSON.parse(String(value||'{}')));}catch{return {};}}
export async function GET(request:Request){try{const {db}=storage();const owner=await getOwner(request);const fields='id,title,location,position,featured,featured_position,curated,category,series,exif';const {results}=await db.prepare(owner?`SELECT ${fields},display_key FROM photos ORDER BY position,created DESC`:`SELECT ${fields} FROM photos WHERE display_key!='' ORDER BY position,created DESC`).all();return Response.json({photos:results.map(p=>({...p,category:displayCategory(p.category),exif:storedParameters(p.exif)}))});}catch(e){console.error(e);return Response.json({error:'照片暂时无法加载，请稍后重试。'},{status:503});}}
export async function POST(request:Request){
 const user=await getOwner(request);if(!user)return Response.json({error:'只有作品集主人可以上传照片。'},{status:403});
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});
 try{const data=await request.formData();const file=data.get('file');if(!(file instanceof File)||file.size===0)return Response.json({error:'请选择非空照片。'},{status:400});
 if(file.size>40*1024*1024)return Response.json({error:'大图请使用分块上传。'},{status:413});
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime)return Response.json({error:'支持 JPG、PNG 和 WebP 照片。'},{status:400});
 const title=String(data.get('title')||'').trim().slice(0,100);const location=String(data.get('location')||'').trim().slice(0,100);const id=crypto.randomUUID();const {db,bucket}=storage();
 let metadata;try{metadata=metadataFromInput(data.get('category')||'',data.get('series')||'',JSON.parse(String(data.get('exif')||'{}')));}catch{return Response.json({error:'分类、系列或拍摄参数格式不正确。'},{status:400});}
 const display=data.get('display');if(!(display instanceof File))return Response.json({error:'缺少展示图片，请重新上传。'},{status:400});const preview=await displayBytes(display);const key='display/'+id;
 try{await bucket.put(id,file,{httpMetadata:{contentType:mime}});await bucket.put(key,preview,{httpMetadata:{contentType:'image/jpeg'}});await db.prepare('INSERT INTO photos(id,owner,title,location,mime,position,created,display_key,featured,category,series,exif) VALUES(?,?,?,?,?,0,?,?,?,?,?,?)').bind(id,user.userId,title,location,mime,Date.now(),key,data.get('featured')==='1'?1:0,metadata.category,metadata.series,metadata.exif).run();}catch(e){await bucket.delete([id,key]);throw e;}return Response.json({id},{status:201});
 }catch(e){console.error(e);return Response.json({error:'上传失败，照片未发布，请重试。'},{status:503});}}
