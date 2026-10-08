import {getOwner,sameOrigin} from '@/lib/owner';
import {storage} from '@/lib/photos';

export async function PATCH(request:Request){
  if(!await getOwner(request)||!sameOrigin(request))return new Response('Forbidden',{status:403});
  let oldName:string,newName:string;
  try{
    const input=await request.json() as {oldName?:unknown;newName?:unknown};
    if(typeof input.oldName!=='string'||typeof input.newName!=='string'||input.oldName.length>100||input.newName.length>100)throw Error('Invalid');
    oldName=input.oldName.trim();newName=input.newName.trim();if(!oldName||!newName)throw Error('Invalid');
  }catch{return Response.json({error:'系列名称不能为空，且不能超过 100 字。'},{status:400});}
  try{
    const {db}=storage();
    const current=await db.prepare('SELECT COUNT(*) AS count FROM photos WHERE series=?').bind(oldName).first<{count:number}>();
    if(!current?.count)return Response.json({error:'这个系列已不存在，请刷新后重试。'},{status:404});
    if(oldName===newName)return Response.json({ok:true,changed:0});
    const existing=await db.prepare('SELECT id FROM photos WHERE series=? LIMIT 1').bind(newName).first();
    if(existing)return Response.json({error:'已有同名系列，请使用其他名称。'},{status:409});
    const result=await db.prepare('UPDATE photos SET series=? WHERE series=?').bind(newName,oldName).run();
    return Response.json({ok:true,changed:result.meta.changes});
  }catch(e){console.error(e);return Response.json({error:'系列更名失败，请重试。'},{status:503});}
}
