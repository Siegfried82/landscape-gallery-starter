import {storage} from '../../../../lib/photos';
import {publicOriginal} from '../../../../lib/public-original';
export async function GET(_r:Request,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const {db,bucket}=storage();const photo=await db.prepare('SELECT mime FROM photos WHERE id=?').bind(id).first<{mime:string}>();if(!photo)return new Response('Not found',{status:404});const object=await publicOriginal(bucket,id,photo.mime);if(!object)return new Response('Not found',{status:404});return new Response(object.body,{headers:{'Content-Length':String(object.size),'Content-Type':photo.mime,'Content-Disposition':new URL(_r.url).searchParams.get('download')==='1'?`attachment; filename="photo-${id.replace(/[^a-zA-Z0-9_-]/g,'')}.${photo.mime==='image/png'?'png':photo.mime==='image/webp'?'webp':'jpg'}"`:'inline','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});}catch(error){console.error("Original preparation failed",error);return Response.json({error:'图片暂时无法读取，请重试。'},{status:503});}
}
/** Allow cache preparation and availability checks without downloading the photo. */
export async function HEAD(request:Request,context:{params:Promise<{id:string}>}){
 const response=await GET(request,context);
 await response.body?.cancel();
 return new Response(null,{status:response.status,headers:response.headers});
}
