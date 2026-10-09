import {env} from 'cloudflare:workers';
import {getOwner,sameOrigin} from './owner';

const writeMethods=new Set(['POST','PUT','PATCH','DELETE']);
/** A second boundary protects every API mutation, including future routes. */
export async function protectAdminRequest(request:Request){
 const path=new URL(request.url).pathname;
 const write=path.startsWith('/api/')&&writeMethods.has(request.method);
 const original=path.startsWith('/api/admin/original/');
 if(!write&&!original)return null;
 if(write&&(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site'))return new Response('Forbidden',{status:403});
 if(path==='/api/visits'&&request.method==='POST')return null;
 if(path==='/api/admin/login'&&request.method==='POST')return null;
 if(!await getOwner(request))return new Response('Forbidden',{status:403});
 return null;
}

/** Record completed mutations without storing cookies, passwords or query strings. */
export async function recordAdminAction(request:Request,response:Response){
 const path=new URL(request.url).pathname;
 if(path==='/api/visits'||!path.startsWith('/api/')||!writeMethods.has(request.method)||!response.ok)return;
 if(path==='/api/admin/login'&&response.headers.get('set-cookie')?.includes('Max-Age=0'))return;
 // Upload chunks can number in the thousands; record start/completion instead.
 if(request.method==='PUT'&&path.startsWith('/api/uploads/'))return;
 try{
  const db=env.DB;if(!db)throw Error('Missing DB');
  const now=Math.floor(Date.now()/1000);
  await db.batch([
   db.prepare('DELETE FROM admin_audit_events WHERE created<?').bind(now-90*86400),
   db.prepare('INSERT INTO admin_audit_events(id,created,method,path,status) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),now,request.method,path.slice(0,256),response.status),
  ]);
 }catch{console.error('Could not record admin action');}
}
