import {getOwner} from '@/lib/owner';
import {storage} from '@/lib/photos';
export async function GET(request:Request){
 if(!await getOwner(request))return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
 try{
  const {db}=storage();const page=Math.max(1,Math.min(1000000,Number(new URL(request.url).searchParams.get('page'))||1));
  const {results}=await db.prepare('SELECT id,visits,first_seen,last_seen FROM visitors ORDER BY last_seen DESC,id DESC LIMIT 50 OFFSET ?').bind((Math.floor(page)-1)*50).all();
  const totals=await db.prepare('SELECT COUNT(*) AS users,COALESCE(SUM(visits),0) AS visits FROM visitors').first();
  return Response.json({visitors:results,totals,page:Math.floor(page)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'访客统计暂时无法读取。'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
