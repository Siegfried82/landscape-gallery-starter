import {readFileSync} from 'node:fs';

// Check the configuration that will actually be deployed before touching D1.
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const database = config.d1_databases?.find(binding => binding.binding === 'DB');
const bucket = config.r2_buckets?.find(binding => binding.binding === 'BUCKET');
if (!database?.database_id || database.database_id === '00000000-0000-0000-0000-000000000000') {
  throw new Error('D1 has not been provisioned. Complete the Deploy to Cloudflare setup or replace database_id in wrangler.jsonc with your own D1 ID, then rebuild.');
}
if (!bucket?.bucket_name || !config.name) {
  throw new Error('Missing Worker name or BUCKET binding. Complete the deployment resource configuration and rebuild.');
}
console.log('Deployment resource configuration is ready.');
