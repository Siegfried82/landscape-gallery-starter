'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {preload} from 'react-dom';
import {galleryTransition} from '@/lib/gallery-motion';
import {parameterFields,parameterSummary,type Photo,type Parameters} from '@/lib/photo-metadata';
import {readParameters} from '@/lib/read-parameters';
import {uploadPhoto} from '@/lib/upload-photo';
import {preloadOriginals,originalViewUrl} from '@/lib/preload-originals';
import GalleryHeader,{GalleryIntro} from '@/addons/components/GalleryHeader';
import PhotoCard from '@/addons/components/PhotoCard';
import ViewModeSwitch,{useViewMode} from '@/addons/components/ViewModeSwitch';
import FeaturedCarousel from '@/addons/bug-fixes/FeaturedCarousel';
import JustifiedGallery,{ThumbnailSizeControl} from "@/addons/features/justified-layout/JustifiedGallery";
import BatchManager from '@/addons/components/BatchManager';
import {useLanguage} from '@/addons/hooks/useLanguage';
import {usePreference} from '@/addons/hooks/usePreference';
import {formatBilingualText} from '@/addons/locales/metadata-helpers';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import PhotoLightbox from './photo-lightbox';
async function previewBlob(file:Blob,hero=false){const bitmap=await createImageBitmap(file);try{const scale=hero?Math.min(1,Math.sqrt(12_000_000/(bitmap.width*bitmap.height))):Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法处理图片');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('无法处理图片')),'image/jpeg',.76));}finally{bitmap.close();}}
const MAX_UPLOAD_BYTES=40*1024*1024;
async function compressUpload(file:File){
  if(file.size<=MAX_UPLOAD_BYTES)return file;
  const bitmap=await createImageBitmap(file);try{
    let scale=1,quality=.9,blob:Blob|null=null;
    for(let pass=0;pass<8;pass++){
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法压缩照片');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=MAX_UPLOAD_BYTES)break;
      if(quality>.55)quality-=.08;else scale*=.8;
    }
    if(!blob||blob.size>MAX_UPLOAD_BYTES)throw Error('照片无法压缩到 40 MB 以内');
    return new File([blob],file.name.replace(/\.[^.]+$/i,'.jpg'),{type:'image/jpeg',lastModified:file.lastModified});
  }finally{bitmap.close();}
}
function formParameters(data:FormData):Parameters{return Object.fromEntries(parameterFields.map(f=>[f.key,String(data.get(f.key)||'').trim()]));}
function parameterInputs(form:HTMLFormElement,p:Parameters){for(const field of parameterFields){const input=form.elements.namedItem(field.key) as HTMLInputElement|null;if(input)input.value=p[field.key]||'';}}
function MetadataFields({photo,busy}:{photo?:Photo;busy:boolean}){return <><fieldset className="metadata-fields"><legend>EXIF 拍摄参数</legend><p>{photo?'可从原图读取，也可直接修改下方参数；保存后公开展示。':'选择照片时自动读取，也可手动填写。以下参数会公开展示。'}</p><div>{parameterFields.map(f=><label key={f.key}>{f.label}<input name={f.key} defaultValue={photo?.exif[f.key]||''} placeholder={f.placeholder} maxLength={120} disabled={busy}/></label>)}</div></fieldset></>;}
const isTheme=(value:string):value is 'light'|'dark'=>value==='light'||value==='dark';
export default function Gallery({manage}:{manage:boolean}){
  const [photos,setPhotos]=useState<Photo[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[active,setActive]=useState<string|null>(null),[notice,setNotice]=useState('');
  const [location,setLocation]=useState('all'),[reading,setReading]=useState(false),[parameterNotice,setParameterNotice]=useState('');
  const [viewMode,setViewMode]=useViewMode('grid');
  const [orientations,setOrientations]=useState<Record<string,boolean>>({});
  useEffect(()=>{
   if(viewMode!=='cinematic')return;let cancelled=false,cursor=0;const images=new Set<HTMLImageElement>();
   async function worker(){while(!cancelled&&cursor<photos.length){const p=photos[cursor++];await new Promise<void>(resolve=>{const image=new Image();images.add(image);const done=()=>{images.delete(image);resolve();};image.onload=()=>{if(!cancelled)setOrientations(old=>({...old,[p.id]:image.naturalWidth>=image.naturalHeight}));done();};image.onerror=()=>{if(!cancelled)setOrientations(old=>({...old,[p.id]:false}));done();};image.src='/api/image/'+p.id;});}}
   void Promise.all([worker(),worker(),worker(),worker()]);
   return()=>{cancelled=true;for(const image of images){image.onload=null;image.onerror=null;image.src='';}};
  },[viewMode,photos]);
  const [themeMode,setThemeMode]=usePreference('gallery-theme','light',isTheme);
  const dark=themeMode==='dark';
  const {lang,t,dict}=useLanguage();
  const [opener,setOpener]=useState<HTMLElement|null>(null),[editing,setEditing]=useState<Photo|null>(null);
  const selection=useRef(0);
  const preloadedOriginals=useRef(new Set<string>());
  const [heroReady,setHeroReady]=useState(false);
  const [files,setFiles]=useState<File[]>([]),[uploadProgress,setUploadProgress]=useState(''),[batchSelection,setBatchSelection]=useState(false);
  const visible=photos.filter(p=>(location==='all'||p.location===location.slice(9)));
  // Until the owner marks photos as 首页大图, show the first three works as a useful hero set.
  // Explicit selections always replace this fallback.
  const heroPhotos=useMemo(()=>{const featured=manage?[]:photos.filter(p=>p.featured===1).sort((a,b)=>(a.featured_position??0)-(b.featured_position??0));return featured.length?featured:photos.slice(0,3);},[photos,manage]);
  const collectionPhotos=manage||location!=='all'?visible:visible.filter(p=>!heroPhotos.some(f=>f.id===p.id));
  const allowedInAlbum=(p:Photo)=>viewMode!=='cinematic'||orientations[p.id]===true;
  const curated=collectionPhotos.filter(p=>p.curated===1&&allowedInAlbum(p));
  const regular=collectionPhotos.filter(p=>p.curated!==1&&allowedInAlbum(p));
  const previewPhotos=location==='all'?photos:visible;
  const locationList=[...new Set(photos.map(p=>p.location).filter(Boolean))];
  const activeIndex=previewPhotos.findIndex(p=>p.id===active);
  useEffect(()=>{
    if(manage||active||viewMode==='cinematic'||!photos.length||!heroReady)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{void preloadOriginals(photos.map(photo=>photo.id),preloadedOriginals.current,controller.signal);},600);
    return()=>{clearTimeout(timer);controller.abort();};
  },[manage,active,viewMode,photos,heroReady]);
  useEffect(()=>{document.documentElement.dataset.galleryTheme=dark?'dark':'light';},[dark]);
  function theme(){setThemeMode(dark?'light':'dark');}
  const load=useCallback(async(preparePreviews=true)=>{try{const r=await fetch('/api/photos');const d=await r.json() as {error:string;photos:Photo[]};if(!r.ok)throw Error(d.error);if(!manage){const selected=d.photos.filter(photo=>photo.featured===1);for(const photo of selected.length?selected:d.photos.slice(0,3))preload('/api/hero/'+photo.id,{as:'image',fetchPriority:'high'});}galleryTransition(()=>setPhotos(d.photos));if(manage&&preparePreviews){for(const p of d.photos.filter(p=>!p.display_key)){const r=await fetch('/api/admin/original/'+p.id);if(!r.ok)throw Error('旧作品读取失败');const blob=await previewBlob(await r.blob());const fd=new FormData();fd.set('display',blob,'display.jpg');const saved=await fetch('/api/display/'+p.id,{method:'POST',body:fd});if(!saved.ok)throw Error('展示图片生成失败，请重新加载。');}const selected=d.photos.filter(p=>p.featured===1);for(const p of selected.length?selected:d.photos.slice(0,3)){const existing=await fetch('/api/hero/'+p.id,{method:'HEAD'});if(existing.ok)continue;if(existing.status!==404)throw Error('首页预览检查失败');const original=await fetch('/api/admin/original/'+p.id);if(!original.ok)throw Error('首页原图读取失败');const fd=new FormData();fd.set('hero',await previewBlob(await original.blob(),true),'hero.jpg');const saved=await fetch('/api/display/'+p.id,{method:'POST',body:fd});if(!saved.ok)throw Error('首页预览生成失败，请重新加载。');}}galleryTransition(()=>setPhotos(d.photos));setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[manage]);
  useEffect(()=>{let cancelled=false;void Promise.resolve().then(()=>{if(!cancelled)return load();});return()=>{cancelled=true;};},[load]);
  async function choose(e:React.ChangeEvent<HTMLInputElement>){
    const form=e.currentTarget.form,chosen=Array.from(e.currentTarget.files||[]),revision=++selection.current;
    if(!form)return;setFiles(chosen);setBatchSelection(chosen.length>1);parameterInputs(form,{});setParameterNotice('');setError('');setUploadProgress('');
    if(!chosen.length){setReading(false);return;}
    if(chosen.length>1){setReading(false);setParameterNotice('已选择 '+chosen.length+' 张照片；每张分别读取 EXIF，标题留空时不显示名称。');return;}
    const file=chosen[0];
    setReading(true);const p=await readParameters(file);if(revision!==selection.current)return;parameterInputs(form,p);setParameterNotice(parameterSummary(p)?'已读取 EXIF，下方可查看或修改。':'未检测到拍摄参数，可手动填写。');setReading(false);
  }
  async function upload(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget,shared=new FormData(form),pending=[...files],batch=batchSelection;
    if(!pending.length){setError('请选择照片。');return;}
    setBusy(true);setNotice('');setError('');const failed:File[]=[],messages:string[]=[];let completed=0;
    try{
      for(let i=0;i<pending.length;i++){
        const file=pending[i];setUploadProgress('正在准备 '+(i+1)+' / '+pending.length+'：'+file.name);
        try{
          if(file.size===0)throw Error('照片不能为空');
          const uploadFile=await compressUpload(file);const fd=new FormData();fd.set('file',uploadFile);for(const key of ['location'])fd.set(key,String(shared.get(key)||''));
          const title=String(shared.get('title')||'').trim(),filename=file.name.replace(/\.[^.]+$/,'');
          fd.set('title',!batch?title:(title?title+' · '+filename:''));
          fd.set('exif',JSON.stringify(!batch?formParameters(shared):await readParameters(file)));
          fd.set('display',await previewBlob(uploadFile),'display.jpg');

          await uploadPhoto(uploadFile,fd,percent=>setUploadProgress('正在上传 '+(i+1)+' / '+pending.length+'：'+file.name+' · '+percent+'%'));completed++;
        }catch(e){failed.push(file);messages.push(file.name+'：'+(e as Error).message);}
      }
      setFiles(failed);if(!failed.length){setBatchSelection(false);form.reset();setParameterNotice('');}
      else setParameterNotice('保留 '+failed.length+' 张失败照片，点击上传仅重试这些照片。');
      await load();setNotice('成功上传 '+completed+' / '+pending.length+' 张照片。');
      if(messages.length)setError(messages.join('；'));
    }finally{setBusy(false);setUploadProgress('');}
  }
  async function edit(e:React.FormEvent<HTMLFormElement>,p:Photo){e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setError('');try{const r=await fetch('/api/photos/'+p.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:data.get('title'),location:data.get('location'),position:Number(data.get('position')),featured:data.get('featured')==='on',curated:data.get('curated')==='on',featured_position:Number(data.get('featured_position')),exif:formParameters(data)})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'保存失败，请重试。');await load();setNotice('作品信息和 EXIF 已保存。');setEditing(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function readOriginal(p:Photo,form:HTMLFormElement){const entered=formParameters(new FormData(form));setBusy(true);setError('');try{const r=await fetch('/api/admin/original/'+p.id);if(!r.ok)throw Error('原图读取失败');const params=await readParameters(await r.blob());if(!parameterSummary(params)){setNotice('原图中没有可读取的拍摄参数，可手动填写。');return;}for(const f of parameterFields)if(entered[f.key])params[f.key]=entered[f.key];parameterInputs(form,params);setNotice('已读取拍摄参数，点击这张作品的“保存”后公开展示。');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function reorder(from:string,to:string){
   if(busy)return;const ids=photos.map(p=>p.id),source=ids.indexOf(from),target=ids.indexOf(to);if(source<0||target<0)return;
   ids.splice(source,1);ids.splice(target,0,from);setBusy(true);setError('');
   try{const r=await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(!r.ok)throw Error('排序保存失败，请刷新后重试。');await load(false);setNotice('照片顺序已保存。');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function remove(p:Photo){if(!confirm('删除《'+p.title+'》？此操作无法撤销。'))return;setBusy(true);setError('');try{const r=await fetch('/api/photos/'+p.id,{method:'DELETE'});if(!r.ok)throw Error('删除失败，请重试。');await load();setEditing(null);setNotice('照片已删除。');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <><GalleryHeader manage={manage} dark={dark} onToggleTheme={theme}/><main className={viewMode==='grid'?'gallery-seamless':undefined}>{manage&&<GalleryIntro manage/>}

  {manage&&<form className="upload" onSubmit={upload}><div><h2>上传作品</h2><p>JPG、PNG 或 WebP，可一次选择多张照片</p></div><label>选择照片<input type="file" name="file" accept="image/jpeg,image/png,image/webp" multiple required disabled={busy} onChange={choose}/></label><label>作品标题<input name="title" placeholder={files.length>1?"留空不显示；填写则作为标题前缀":"留空不显示名称"} maxLength={100} disabled={busy}/></label><label>拍摄地点<input name="location" placeholder="例如：坦桑尼亚" maxLength={100} disabled={busy}/></label><MetadataFields busy={busy||reading}/>{files.length>1&&<p className="parameter-notice">地点应用于本批照片；EXIF 分别从每张原图读取，下方 EXIF 输入仅用于单张上传。</p>}{(reading||parameterNotice)&&<p className="parameter-notice" role="status">{reading?'正在读取拍摄参数…':parameterNotice}</p>}<button disabled={busy||reading}>{busy?'正在处理…':files.length>1?'上传 '+files.length+' 张照片':'上传照片'}</button></form>}
  {uploadProgress&&<p className="message" role="status">{uploadProgress}</p>}
  {error&&<div role="alert" className="message error">{error}<button onClick={()=>void load()} disabled={busy}>重新加载</button></div>}{notice&&<p className="message" role="status">{notice}</p>}
  {manage&&<BatchManager photos={photos} onRefresh={preparePreviews=>load(preparePreviews??false)}/>}
  {!manage&&loading&&<div className="hero-loading-placeholder" aria-label={dict('loading')}/>}{!manage&&heroPhotos.length>0&&<FeaturedCarousel key={heroPhotos.map(p=>p.id).join(':')} photos={heroPhotos} onReady={()=>setHeroReady(true)} onViewPhoto={(id,element)=>{setOpener(element);setLocation('all');galleryTransition(()=>setActive(id),id);}}/>}
  <section className="collection"><div className="filters"><div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><label className="series-filter"><select aria-label={t('按地点筛选','Filter by location')} value={location} onChange={e=>{const value=e.target.value;galleryTransition(()=>{setLocation(value);setActive(null);});}}><option value="all">{t('全部地点','All locations')}</option>{locationList.map(s=><option key={s} value={'location:'+s}>{formatBilingualText(s,lang)}</option>)}</select></label></div>{<div className="gallery-view-controls"><ViewModeSwitch mode={viewMode} onChange={mode=>galleryTransition(()=>setViewMode(mode))}/>{viewMode!=='cinematic'&&<ThumbnailSizeControl/>}</div>}</div>
  {manage&&<p className="sort-hint">拖动照片到另一张照片的位置即可保存顺序。</p>}
  {curated.length>0&&<>{!manage&&viewMode==='cinematic'?<div className="grid view-cinematic">{curated.map((p,i)=><PhotoCard key={p.id} photo={p} index={i} src={originalViewUrl(p.id)} exifText={parameterSummary(p.exif)||t('未提供拍摄参数','No camera settings')} onClick={e=>{setOpener(e.currentTarget);galleryTransition(()=>setActive(p.id),p.id);}}/>)}</div>:<JustifiedGallery photos={curated} classic={viewMode==='classic'} manage={manage} disabled={busy} onReorder={manage?reorder:undefined} onViewPhoto={(id,element)=>{setOpener(element);if(manage){const photo=photos.find(p=>p.id===id);if(photo){setError('');setNotice('');setEditing(photo);}}else galleryTransition(()=>setActive(id),id);}}/>}<hr className="curated-divider"/></>}
  {loading||(viewMode==='cinematic'&&collectionPhotos.some(p=>orientations[p.id]===undefined)&&!regular.length&&!curated.length)||(!manage&&!heroReady&&heroPhotos.length>0)?<div className="empty">{dict('loading')}</div>:!photos.length&&!error?<div className="empty">{manage&&<span className="empty-mark">＋</span>}<h3>{dict('emptyTitle')}</h3><p>{manage?'上传你的第一张照片。':dict('emptyDesc')}</p></div>:!regular.length&&!curated.length&&!error?<div className="empty"><h3>{location==='all'&&heroPhotos.length?t('暂无其他作品','No other photographs'):t('这个地点暂无作品','No photographs at this location')}</h3><button onClick={()=>{setLocation('all');}}>{dict('emptyCategoryAction')}</button></div>:(manage||viewMode!=='cinematic')?<JustifiedGallery classic={viewMode==='classic'} manage={manage} disabled={busy} onReorder={manage?reorder:undefined} photos={regular} onViewPhoto={(id,element)=>{setOpener(element);if(manage){const photo=photos.find(p=>p.id===id);if(photo){setError('');setNotice('');setEditing(photo);}}else galleryTransition(()=>setActive(id),id);}}/>:<div className={`grid view-${viewMode}`}
>{regular.map((p,i)=><PhotoCard src={viewMode==='cinematic'?originalViewUrl(p.id):undefined} manage={manage} key={p.id} photo={p} index={i}  exifText={parameterSummary(p.exif)||t('未提供拍摄参数','No camera settings')} onClick={e=>{setOpener(e.currentTarget);if(manage){setError('');setNotice('');setEditing(p);}else galleryTransition(()=>setActive(p.id),p.id);}}>

</PhotoCard>)}</div>}</section></main>
  <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!busy)setEditing(null);}}><DialogContent className="photo-editor" onPointerDownOutside={e=>{if(busy)e.preventDefault();}} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}><DialogTitle>{t('编辑作品','Edit photograph')}</DialogTitle><DialogDescription>{t('修改信息后点击保存。','Save after editing the details.')}</DialogDescription>
  {error&&<p role="alert" className="message error">{error}</p>}{notice&&<p role="status" className="message">{notice}</p>}{editing&&<form key={editing.id} className="edit" onSubmit={e=>edit(e,editing)}><label>标题<input name="title" defaultValue={editing.title} maxLength={100} disabled={busy}/></label><label>地点<input name="location" defaultValue={editing.location} maxLength={100} disabled={busy}/></label><label>展示顺序<input name="position" type="number" defaultValue={editing.position} required step="1" disabled={busy}/></label><label className="featured-check"><input type="checkbox" name="featured" defaultChecked={editing.featured===1} disabled={busy}/>首页大图</label><label className="featured-check"><input type="checkbox" name="curated" defaultChecked={editing.curated===1} disabled={busy}/>精选作品</label><label>首页大图顺序（数字越小越靠前）<input name="featured_position" type="number" defaultValue={editing.featured_position??0} required step="1" disabled={busy}/></label><MetadataFields photo={editing} busy={busy}/><button type="button" className="read-exif" disabled={busy} onClick={e=>{if(e.currentTarget.form)readOriginal(editing,e.currentTarget.form);}}>从原图读取 EXIF</button><div className="actions"><button disabled={busy}>保存</button><button type="button" className="delete" onClick={()=>remove(editing)} disabled={busy}>删除</button></div></form>}</DialogContent></Dialog>
  {activeIndex>=0&&<PhotoLightbox key={active} photos={previewPhotos} index={activeIndex} onNavigate={setActive} onClose={()=>galleryTransition(()=>setActive(null),active??undefined)} opener={opener}/>}</>;
}
