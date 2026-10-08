import {copyFileSync} from 'node:fs';
// Build-time rendering must succeed; never ship a silently missing homepage.
copyFileSync('dist/server/prerendered-routes/index.html','dist/client/index.html');
copyFileSync('dist/server/prerendered-routes/index.rsc','dist/client/index.rsc');

copyFileSync('dist/server/prerendered-routes/manage.html','dist/client/manage.html');
copyFileSync('dist/server/prerendered-routes/manage.rsc','dist/client/manage.rsc');

// Production serves prebuilt pages and native APIs only. Do not load React SSR
// on every new Worker isolate (including original-image requests).
const {readFileSync}=await import('node:fs');
const {resolve}=await import('node:path');
const {createRequire}=await import('node:module');
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('wrangler/package.json'))('esbuild');
const source=readFileSync('worker/index.ts','utf8')
 .replace("import handler from 'vinext/server/fetch-handler';",'')
 .replace('return handler.fetch(request,env,ctx);',"return new Response('Not found',{status:404});");
await build({stdin:{contents:source,resolveDir:resolve('worker'),loader:'ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],alias:{'next/headers':resolve('scripts/native-worker-headers.mjs')},outfile:'dist/server/index.js',minify:true});
