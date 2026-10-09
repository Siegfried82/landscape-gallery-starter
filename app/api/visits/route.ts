import {storage} from '@/lib/photos';
import {getOwner,sameOrigin,AUTH_COOKIE_NAME} from '@/lib/owner';
import {VISITOR_COOKIE,visitorCookieValue,RECORD_VISIT_SQL} from '@/lib/visitors';
export async function POST(request:Request){
 if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return new Response('Forbidden',{status:403});
 const cookies=request.headers.get('cookie');
 if(cookies?.includes(AUTH_COOKIE_NAME+'=')&&await getOwner(request))return new Response(null,{status:204});
 try{
  const previous=visitorCookieValue(cookies),value=previous||crypto.randomUUID();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const now=Date.now(),{db}=storage();await db.prepare(RECORD_VISIT_SQL).bind(hash,now,now).run();
  const headers=new Headers({'Cache-Control':'no-store'});
  if(!previous)headers.set('Set-Cookie',`${VISITOR_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`);
  return new Response(null,{status:204,headers});
 }catch{return new Response(null,{status:503});}
}
