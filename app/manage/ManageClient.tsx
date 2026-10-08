'use client';

import {useEffect,useState} from 'react';
import Gallery from '../gallery';
import AdminLoginForm from './AdminLoginForm';

export default function ManageClient({initialAuthed}: {initialAuthed: boolean}) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [checking,setChecking]=useState(true);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{const controller=new AbortController();
   fetch('/api/admin/session',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Session unavailable');const data=await r.json() as {authenticated?:boolean};setAuthed(data.authenticated===true);setChecking(false);}).catch(()=>{if(!controller.signal.aborted){setFailed(true);setChecking(false);}});
   return()=>controller.abort();
  },[]);
  if(checking)return <main><p role="status">正在检查登录状态…</p></main>;
  if(failed)return <main><p role="alert">登录状态暂时无法读取。</p><button onClick={()=>window.location.reload()}>重试</button></main>;

  if (!authed) {
    return <AdminLoginForm onSuccess={() => setAuthed(true)} />;
  }

  return <Gallery manage={true} />;
}

