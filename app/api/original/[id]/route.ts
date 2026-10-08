import {storage} from '../../../../lib/photos';
import {publicOriginal} from '../../../../lib/public-original';
export async function GET(_r:Request,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const {db,bucket}=storage();const photo=await db.prepare('SELECT mime FROM photos WHERE id=?').bind(id).first<{mime:string}>();if(!photo)return new Response('Not found',{status:404});const object=await publicOriginal(bucket,id,photo.mime);if(!object)return new Response('Not found',{status:404});return new Response(object.body,{headers:{'Content-Length':String(object.size),'Content-Type':photo.mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'图片暂时无法读取，请重试。'},{status:503});}
}
