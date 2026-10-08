const encoder=new TextEncoder();
export const SESSION_SECONDS=2*60*60;
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
async function key(secret:string,password:string){
  if(secret.length<32)throw Error('Session secret is not configured');
  return crypto.subtle.importKey('raw',encoder.encode(JSON.stringify([secret,password])),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function passwordMatches(input:string,expected:string){
  const hashes=await Promise.all([input,expected].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const [a,b]=hashes.map(value=>new Uint8Array(value));let difference=0;
  for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  return difference===0;
}
export async function createSession(secret:string,password:string,now=Date.now()){
  // Bind signing to both secrets without exposing a password verifier in the cookie.
  const payload=encode(encoder.encode(JSON.stringify({sub:'admin',exp:Math.floor(now/1000)+SESSION_SECONDS,v:2,nonce:crypto.randomUUID()})));
  const signature=await crypto.subtle.sign('HMAC',await key(secret,password),encoder.encode(payload));
  return payload+'.'+encode(new Uint8Array(signature));
}
export async function verifySession(token:string,secret:string,password:string,now=Date.now()){
  try{
    if(token.length>1024)return false;
    const parts=token.split('.');if(parts.length!==2)return false;
    if(!await crypto.subtle.verify('HMAC',await key(secret,password),decode(parts[1]),encoder.encode(parts[0])))return false;
    const data=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const seconds=Math.floor(now/1000);
    return data.sub==='admin'&&Number.isSafeInteger(data.exp)&&data.exp>seconds&&data.exp<=seconds+SESSION_SECONDS&&data.v===2;
  }catch{return false;}
}

export async function sessionHash(token:string){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token)))).map(value=>value.toString(16).padStart(2,'0')).join('');
}
