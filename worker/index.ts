import handler from 'vinext/server/fetch-handler';
/** Keep storage APIs out of the React server rendering pipeline. */
const routes = {
 '/api/order': () => import('../app/api/order/route'),
 '/api/photos': () => import('../app/api/photos/route'),
 '/api/photos/:id': () => import('../app/api/photos/[id]/route'),
 '/api/series': () => import('../app/api/series/route'),
 '/api/uploads': () => import('../app/api/uploads/route'),
 '/api/uploads/:id': () => import('../app/api/uploads/[id]/route'),
 '/api/display/:id': () => import('../app/api/display/[id]/route'),
 '/api/hero/:id': () => import('../app/api/hero/[id]/route'),
 '/api/image/:id': () => import('../app/api/image/[id]/route'),
 '/api/view/:id': () => import('../app/api/view/[id]/route'),
 '/api/original/:id': () => import('../app/api/original/[id]/route'),
 '/api/admin/original/:id': () => import('../app/api/admin/original/[id]/route'),
 '/api/admin/session': () => import('../app/api/admin/session/route'),
 '/api/admin/login': () => import('../app/api/admin/login/route'),
};
const worker = {
 async handle(request:Request, env:{ASSETS:Fetcher}, ctx:unknown) {
  const pathname=new URL(request.url).pathname;
  if(env?.ASSETS && (pathname==='/'||pathname==='/manage'||pathname==='/manage/') && (request.method==='GET'||request.method==='HEAD')){
   const url=new URL(request.url);const page=pathname==='/'?'index':'manage';url.pathname='/'+page+(request.headers.get('rsc')==='1'?'.rsc':'.html');
   const shell=await env.ASSETS.fetch(new Request(url,request));
   if(shell.status!==404)return shell;
  }
  if(pathname.startsWith('/api/')) {
   const key=Object.hasOwn(routes,pathname) ? pathname : pathname.replace(/\/[^/]+$/, '/:id');
   const loader=Object.hasOwn(routes,key)?routes[key as keyof typeof routes]:undefined;
   if(!loader)return new Response('Not found',{status:404});
   const route=await loader();
   const handlers=route as Record<string,(r:Request,c:{params:Promise<{id:string}>})=>Promise<Response>>;
   const method=Object.hasOwn(handlers,request.method)?handlers[request.method]:undefined;
   if(!method)return new Response('Method not allowed',{status:405,headers:{Allow:Object.keys(route).join(', ')}});
   let id='';try{id=decodeURIComponent(pathname.split('/').at(-1)||'');}catch{return new Response('Invalid URL',{status:400});}
   return method(request,{params:Promise.resolve({id})});
  }
  return handler.fetch(request,env,ctx);
 }
};

const securedWorker = {
 async fetch(request:Request,env:{ASSETS:Fetcher},ctx:unknown){
  const path=new URL(request.url).pathname;
  const adminRequest=path.startsWith('/api/')&&(!['GET','HEAD'].includes(request.method)||path.startsWith('/api/admin/original/'));
  const protection=adminRequest?await import('../lib/admin-protection'):null;
  const denied=protection?await protection.protectAdminRequest(request):null;
  if(!denied&&request.body){
   const path=new URL(request.url).pathname;
   const maxBytes=path==='/api/photos'?48*1024*1024:path.startsWith('/api/display/')?20*1024*1024:path.startsWith('/api/uploads/')&&request.method==='PUT'?12*1024*1024:path.startsWith('/api/uploads/')?4*1024*1024:512*1024;
   if(Number(request.headers.get('content-length'))>maxBytes)return new Response('Request too large',{status:413});
   const reader=request.body.getReader();let size=0;
   const body=new ReadableStream<Uint8Array>({
    async pull(controller){try{const {done,value}=await reader.read();if(done){controller.close();reader.releaseLock();return;}
     size+=value.byteLength;if(size>maxBytes){await reader.cancel();controller.error(new Error('Request too large'));return;}controller.enqueue(value);
    }catch(error){controller.error(error);}},
    cancel(reason){return reader.cancel(reason);}
   });
   request=new Request(request,{body,duplex:'half'} as RequestInit);
  }
  const response=denied??await worker.handle(request,env,ctx);
  if(!denied&&protection){
   const audit=protection.recordAdminAction(request,response);
   const execution=ctx as {waitUntil?:(promise:Promise<void>)=>void};
   if(execution?.waitUntil)execution.waitUntil(audit);else await audit;
  }
  const headers=new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('X-Frame-Options','DENY');
  headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  headers.set('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(path.startsWith('/api/admin/')||path==='/api/photos'||(env?.ASSETS&&path.startsWith('/manage'))||!['GET','HEAD'].includes(request.method))headers.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};

export default securedWorker;
