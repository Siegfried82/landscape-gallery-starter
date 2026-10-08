import {env} from 'cloudflare:workers';
import {adminConfig,sameOrigin,AUTH_COOKIE_NAME,requestSession} from '@/lib/owner';
import {createSession,passwordMatches,SESSION_SECONDS,sessionHash} from '@/lib/admin-session';

export async function POST(request:Request){
  if(!sameOrigin(request))return new Response('Forbidden',{status:403});
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  const headers={'Cache-Control':'no-store'};
  try{
    const declared=Number(request.headers.get('content-length'));
    if(declared>4096)return Response.json({error:'请求过大。'},{status:413,headers});
    const reader=request.body?.getReader();let text='';let size=0;
    const decoder=new TextDecoder();
    if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>4096){await reader.cancel();return Response.json({error:'请求过大。'},{status:413,headers});}
      text+=decoder.decode(value,{stream:true});
    }text+=decoder.decode();}finally{reader.releaseLock();}}
    let body:{password?:unknown;logout?:unknown};
    try{body=JSON.parse(text);}catch{return Response.json({error:'请求格式错误。'},{status:400,headers});}
    if(!body||typeof body!=='object')return Response.json({error:'请求格式错误。'},{status:400,headers});
    if(body.logout===true){const token=requestSession(request);if(token&&token.length<=1024){if(!env.DB)throw Error('Missing DB');await env.DB.prepare('DELETE FROM admin_sessions WHERE id=?').bind(await sessionHash(token)).run();}return Response.json({ok:true},{headers:{...headers,'Set-Cookie':`${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`}});}
    const config=adminConfig();
    if(!config)return Response.json({error:'管理端尚未配置登录密钥。'},{status:503,headers});
    if(typeof body.password!=='string'||body.password.length>1024)return Response.json({error:'密码格式错误。'},{status:400,headers});
    if(!env.DB)return Response.json({error:'管理端数据库尚未配置。'},{status:503,headers});
    const now=Math.floor(Date.now()/1000);
    const identity=request.headers.get('CF-Connecting-IP')||'local';
    const ipHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE expires<?').bind(now).run();
    const attempt=await env.DB.prepare('INSERT INTO admin_login_attempts (id,attempts,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(ipHash,now+900).first<{attempts:number}>();
    if(!attempt||attempt.attempts>10)return Response.json({error:'尝试次数过多，请十五分钟后重试。'},{status:429,headers:{...headers,'Retry-After':'900'}});
    if(!await passwordMatches(body.password,config.password))return Response.json({error:'密码错误，请重新输入。'},{status:401,headers});
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE id=?').bind(ipHash).run();
    const token=await createSession(config.secret,config.password);
    await env.DB.prepare('DELETE FROM admin_sessions WHERE expires<=?').bind(now).run();
    await env.DB.prepare('INSERT INTO admin_sessions (id,expires) VALUES (?,?)').bind(await sessionHash(token),now+SESSION_SECONDS).run();
    return Response.json({ok:true},{headers:{...headers,'Set-Cookie':`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`}});
  }catch{return Response.json({error:'登录服务暂时不可用，请检查数据库迁移。'},{status:503,headers});}
}
