import {storage} from '@/lib/photos';
type Context={params:Promise<{id:string}>};
export async function HEAD(_request:Request,{params}:Context){
 try{const {id}=await params;const {db,bucket}=storage();
  if(!await db.prepare("SELECT id FROM photos WHERE id=? AND display_key!=''").bind(id).first())return new Response(null,{status:404});
  const preview=await bucket.head('hero/'+id);
  return new Response(null,{status:preview?200:404,headers:{'Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:503});}
}
export async function GET(_request:Request,{params}:Context){
 try{const {id}=await params;const {db,bucket}=storage();
  const row=await db.prepare('SELECT display_key FROM photos WHERE id=?').bind(id).first<{display_key:string}>();
  if(!row?.display_key)return new Response('Not found',{status:404});
  const hero=await bucket.get('hero/'+id);
  const preview=hero??await bucket.get(row.display_key);
  if(!preview)return new Response('Not found',{status:404});
  return new Response(preview.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':hero?'private, max-age=3600':'private, max-age=60','ETag':preview.httpEtag,'X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('预览暂时无法加载',{status:503});}
}
