import {getOwner} from '@/lib/owner';
import {storage} from '@/lib/photos';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await getOwner(request))return new Response('Forbidden',{status:403});
 try{const {id}=await params;const {db,bucket}=storage();if(!await db.prepare('SELECT id FROM photos WHERE id=?').bind(id).first())return new Response('Not found',{status:404});const image=await bucket.get(id);if(!image)return new Response('Not found',{status:404});return new Response(image.body,{headers:{'Content-Type':image.httpMetadata?.contentType||'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Unavailable',{status:503});}
}
