export const VISITOR_COOKIE='gallery_visitor';
export const SESSION_GAP=30*60*1000;
export function visitorCookieValue(cookie:string|null){
 const value=cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(VISITOR_COOKIE+'='))?.slice(VISITOR_COOKIE.length+1);
 return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:null;
}
export const RECORD_VISIT_SQL=`INSERT INTO visitors(browser_key,visits,first_seen,last_seen) VALUES(?,1,?,?)
 ON CONFLICT(browser_key) DO UPDATE SET
 visits=visitors.visits+CASE WHEN visitors.last_seen<=excluded.last_seen-${SESSION_GAP} THEN 1 ELSE 0 END,
 last_seen=MAX(visitors.last_seen,excluded.last_seen)`;
