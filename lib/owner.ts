import {env} from 'cloudflare:workers';
import {verifySession,sessionHash} from './admin-session';
export const AUTH_COOKIE_NAME='gallery_admin_session';
export function adminConfig(){
  const {ADMIN_PASSWORD,SESSION_SECRET}=env;
  return ADMIN_PASSWORD&&ADMIN_PASSWORD.length>=8&&SESSION_SECRET&&SESSION_SECRET.length>=32
    ?{password:ADMIN_PASSWORD,secret:SESSION_SECRET}:null;
}
export async function isOwnerAuthenticated(request?:Request){
  const config=adminConfig();if(!config)return false;
  const token=request ? request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(AUTH_COOKIE_NAME+'='))?.slice(AUTH_COOKIE_NAME.length+1) : (await import('next/headers')).cookies().then(c=>c.get(AUTH_COOKIE_NAME)?.value);
  const value=await token;
  if(!value||!env.DB||!await verifySession(value,config.secret,config.password))return false;
  try{return !!await env.DB.prepare('SELECT id FROM admin_sessions WHERE id=? AND expires>?').bind(await sessionHash(value),Math.floor(Date.now()/1000)).first();}catch{return false;}
}
export async function getOwner(request?:Request){
  return await isOwnerAuthenticated(request)?{userId:'admin',displayName:'Gallery Owner',email:'owner@gallery.local',fullName:'Owner'}:null;
}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}

export function requestSession(request:Request){return request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(AUTH_COOKIE_NAME+'='))?.slice(AUTH_COOKIE_NAME.length+1);}
