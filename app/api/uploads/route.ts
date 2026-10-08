import {getOwner,sameOrigin} from '@/lib/owner';
import {storage} from '@/lib/photos';
export async function POST(request:Request){
 if(!await getOwner(request)||!sameOrigin(request))return new Response('Forbidden',{status:403});
 try{const {mime}=await request.json() as {mime?:string};if(!mime||!['image/jpeg','image/png','image/webp'].includes(mime))return Response.json({error:'支持 JPG、PNG 和 WebP 照片。'},{status:400});const id=crypto.randomUUID();const {bucket}=storage();const upload=await bucket.createMultipartUpload(id,{httpMetadata:{contentType:mime}});return Response.json({id,uploadId:upload.uploadId},{status:201});}catch(e){console.error(e);return Response.json({error:'无法开始上传，请重试。'},{status:503});}
}
