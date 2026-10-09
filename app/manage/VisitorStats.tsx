'use client';
import {useEffect,useState} from 'react';
import {useLanguage} from '@/addons/hooks/useLanguage';
type Stats={visitors:{id:number;visits:number;first_seen:number;last_seen:number}[];totals:{users:number;visits:number};page:number};
export default function VisitorStats(){
 const {t,lang}=useLanguage();const [data,setData]=useState<Stats|null>(null),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(true),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`/api/admin/visitors?page=${page}`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Stats unavailable');const value=await r.json() as Stats;if(!controller.signal.aborted)setData(value);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[page,refresh]);
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible'){setBusy(true);setFailed(false);setRefresh(n=>n+1);}},60000);return()=>clearInterval(timer);},[]);
 return <details className="visitor-stats" open><summary>{t('访客统计','Visitor statistics')}</summary>
  <div className="visitor-stats-heading"><p>{data?t(`访客 ${data.totals.users} · 累计访问 ${data.totals.visits} 次`,`${data.totals.users} visitors · ${data.totals.visits} visits`):t('访问记录','Visit records')}</p><button disabled={busy} onClick={()=>{setBusy(true);setFailed(false);setRefresh(n=>n+1);}}>{t('刷新','Refresh')}</button></div>
  <p className="visitor-stats-note">{t('同一浏览器连续浏览算一次，闲置 30 分钟后再次浏览算新一次。清除网站数据或换浏览器会算新用户。','Continuous browsing counts as one visit; returning after 30 minutes of inactivity counts again. Clearing site data or switching browsers creates a new visitor.')}</p>
  {failed&&<p role="alert">{t('统计暂时无法读取，请点击刷新重试。','Statistics are unavailable. Refresh to retry.')}</p>}
  {busy&&<span role="status">{t('正在更新…','Updating…')}</span>}
  {data&&<><div className="visitor-stats-table"><table><thead><tr><th>{t('用户','Visitor')}</th><th>{t('访问次数','Visits')}</th><th>{t('最近访问','Last visit')}</th></tr></thead><tbody>{data.visitors.map(v=><tr key={v.id}><td>{t(`用户 ${v.id}`,`User ${v.id}`)}</td><td>{v.visits}</td><td><time dateTime={new Date(v.last_seen).toISOString()}>{new Date(v.last_seen).toLocaleString(lang==='zh'?'zh-CN':'en-GB')}</time></td></tr>)}</tbody></table></div>{!data.visitors.length&&<p>{t('还没有访客记录。从上线后开始统计。','No visitors yet. Tracking starts after deployment.')}</p>}<div className="visitor-stats-pagination"><button disabled={busy||page<=1} onClick={()=>{setBusy(true);setFailed(false);setPage(n=>n-1);}}>{t('上一页','Previous')}</button><span>{t(`第 ${page} 页`,`Page ${page}`)}</span><button disabled={busy||page*50>=data.totals.users} onClick={()=>{setBusy(true);setFailed(false);setPage(n=>n+1);}}>{t('下一页','Next')}</button></div></>}
 </details>;
}
