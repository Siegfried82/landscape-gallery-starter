import {getOwner,sameOrigin} from '@/lib/owner';
import {storage} from '@/lib/photos';
export async function POST(request:Request){
 if(!sameOrigin(request)||!await getOwner(request))return new Response('Forbidden',{status:403});
 try{
  const {ids,scope,flag,enabled}=await request.json() as {ids:unknown;scope?:string;flag?:string;enabled?:boolean};
  if(!Array.isArray(ids)||ids.length>10000||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return new Response('Invalid order',{status:400});
  const {db}=storage();
  if(flag!==undefined){
   if((flag!=='curated'&&flag!=='featured')||typeof enabled!=='boolean'||!ids.length)return new Response('Invalid flags',{status:400});
   const {results}=await db.prepare('SELECT id,featured_position FROM photos').all<{id:string;featured_position:number}>();const known=new Set(results.map(p=>p.id));
   if(ids.some(id=>!known.has(id)))return new Response('Stale selection',{status:409});
   const start=Math.max(-1,...results.map(p=>p.featured_position))+1;
   await db.batch(ids.map((id,i)=>flag==='featured'&&enabled?db.prepare('UPDATE photos SET featured=1,featured_position=? WHERE id=?').bind(start+i,id):db.prepare(flag==='curated'?'UPDATE photos SET curated=? WHERE id=?':'UPDATE photos SET featured=? WHERE id=?').bind(enabled?1:0,id)));
   return Response.json({ok:true});
  }
  if(scope!==undefined&&scope!=='featured')return new Response('Invalid scope',{status:400});
  const {results}=await db.prepare(scope==='featured'?'SELECT id FROM photos WHERE featured=1':'SELECT id FROM photos').all<{id:string}>();
  const existing=new Set(results.map(p=>p.id));
  if(ids.length!==existing.size||ids.some(id=>!existing.has(id)))return Response.json({error:'照片列表已变化，请刷新后重新排序。'},{status:409});
  if(ids.length)await db.batch(ids.map((id,index)=>db.prepare(scope==='featured'?'UPDATE photos SET featured_position=? WHERE id=?':'UPDATE photos SET position=? WHERE id=?').bind(index,id)));
  return Response.json({ok:true});
 }catch{return Response.json({error:'保存排序失败，请重试。'},{status:503});}
}
