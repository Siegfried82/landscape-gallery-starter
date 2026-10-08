'use client';

import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import {readParameters} from '@/lib/read-parameters';
import {moveSelection} from '@/lib/selection-order';
import type {Photo} from '@/lib/photo-metadata';
import JustifiedGallery,{ThumbnailSizeControl} from '../features/justified-layout/JustifiedGallery';

export interface BatchManagerProps {
  photos: Photo[];
  onRefresh: (preparePreviews?:boolean) => Promise<void> | void;
}

/**
 * 批量管理模块 (BatchManager)
 * 支持：
 * 1. 批量选择与全选/反选
 * 2. 批量一键安全删除
 * 3. 批量统一修改地点
 */
export default function BatchManager({ photos, onRefresh }: BatchManagerProps) {
  const { t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [exifStatus,setExifStatus]=useState('');

  const [scope,setScope]=useState<'all'|'featured'>('all');
  const [allSelected,setAllSelected]=useState(false);
  const shown=scope==='featured'?photos.filter(p=>p.featured===1).sort((a,b)=>(a.featured_position??0)-(b.featured_position??0)):photos;
  const saveBatch=async(payload:unknown,message:string)=>{
   if(busy)return;setBusy(true);
   try{const r=await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error(t('保存失败，请刷新后重试。','Save failed; refresh and retry.'));await onRefresh(false);setExifStatus(message);}catch(e){setExifStatus((e as Error).message);}finally{setBusy(false);}
  };
  const handleBatchFeatured=(enabled:boolean)=>saveBatch({ids:selectedIds,flag:'featured',enabled},t('首页大图设置已保存。','Homepage selection saved.'));
  const handleBatchCurated=(enabled:boolean)=>saveBatch({ids:selectedIds,flag:'curated',enabled},t('精选设置已保存。','Curated selection saved.'));
  const reorder=(dragged:string,target:string)=>{
   const ids=moveSelection(shown.map(p=>p.id),selectedIds,dragged,target);
   if(ids.every((id,i)=>id===shown[i]?.id))return;
   void saveBatch({ids,scope:scope==='featured'?'featured':undefined},t('已按选择顺序保存排序。','Order saved in selection order.'));
  };

  const handleBatchExif=async()=>{
    if(busy||!selectedIds.length)return;
    const ids=[...selectedIds];let saved=0,skipped=0,failed=0;
    const completed=new Set<string>();
    setBusy(true);
    try{
      for(let i=0;i<ids.length;i++){
        const photo=photos.find(p=>p.id===ids[i]);
        setExifStatus(t(`正在识别 EXIF：${i+1} / ${ids.length}`,`Reading EXIF: ${i+1} / ${ids.length}`));
        try{
          if(!photo)throw Error('照片已不存在');
          const original=await fetch('/api/original/'+photo.id);
          if(!original.ok)throw Error('原图读取失败');
          const values=await readParameters(await original.blob());
          const detected=Object.fromEntries(Object.entries(values).filter(([,value])=>value?.trim()));
          if(!Object.keys(detected).length){skipped++;continue;}
          const response=await fetch('/api/photos/'+photo.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:photo.title,position:photo.position,location:photo.location||'',exif:{...photo.exif,...detected}})});
          if(!response.ok)throw Error('保存失败');
          saved++;completed.add(photo.id);
        }catch{failed++;}
      }
      setSelectedIds(ids=>ids.filter(id=>!completed.has(id)));
      setExifStatus(t(`EXIF 识别完成：已保存 ${saved} 张，未识别到参数 ${skipped} 张，失败 ${failed} 张。`,`EXIF complete: ${saved} saved, ${skipped} without readable metadata, ${failed} failed.`));
      if(saved)try{await onRefresh();}catch{setExifStatus(text=>text+t(' 刷新失败，请重新加载页面。',' Refresh failed; reload the page.'));}
    }finally{setBusy(false);}
  };

  // 批量修改的表单状态
  const [batchLocation, setBatchLocation] = useState('');

  const toggleSelect = (id: string) => {
    setAllSelected(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (allSelected) {
      setSelectedIds([]);setAllSelected(false);
    } else {
      setSelectedIds(shown.map((p) => p.id));setAllSelected(true);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    const count = selectedIds.length;
    if (count === 0) return;

    const confirmed = confirm(
      t(
        `确定要永久删除选中的 ${count} 张照片吗？此操作无法撤销。`,
        `Delete ${count} selected photos permanently? This action cannot be undone.`
      )
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      for (const id of selectedIds) {
        const response=await fetch(`/api/photos/${id}`, { method: 'DELETE' });
        if(!response.ok)throw Error('删除失败');
        setSelectedIds(ids=>ids.filter(value=>value!==id));
      }
      setSelectedIds([]);
      setActive(false);
      await onRefresh();
      alert(t('已成功删除选中的照片。', 'Selected photos have been deleted.'));
    } catch {
      await onRefresh();
      alert(t('批量删除过程中出现错误，请重试。', 'Error during batch deletion.'));
    } finally {
      setBusy(false);
    }
  };

  // 批量修改信息
  const handleBatchUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = selectedIds.length;
    if (count === 0) return;

    setBusy(true);
    try {
      for (const id of selectedIds) {
        const photo=photos.find(p=>p.id===id);if(!photo)continue;
        const payload: Record<string, unknown> = {title:photo.title,position:photo.position,location:photo.location||''};
        if (batchLocation.trim()) payload.location = batchLocation.trim();

        if (Object.keys(payload).length > 0) {
          const response=await fetch(`/api/photos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if(!response.ok)throw Error('保存失败');
          setSelectedIds(ids=>ids.filter(value=>value!==id));
        }
      }
      setShowEditModal(false);
      setSelectedIds([]);
      setActive(false);
      setBatchLocation('');
      await onRefresh();
      alert(t('已成功更新选中的作品信息。', 'Selected photos have been updated.'));
    } catch {
      await onRefresh();
      alert(t('批量更新时出错，请重试。', 'Error updating photos.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="addon-batch-wrapper">
      {/* 顶部批量开关按钮 */}
      <div className="addon-batch-header">
        <button
          type="button"
          className={`addon-batch-toggle-btn ${active ? 'active' : ''}`}
          disabled={busy}
          onClick={() => {
            setActive(!active);
            if (active) {
              setSelectedIds([]);
              setShowEditModal(false);
            }
          }}
        >
          {active ? t('退出批量管理', 'Exit Batch Mode') : t('批量管理照片', 'Batch Selection')}
        </button>

        {active && (
          <button type="button" className="addon-batch-btn-subtle" onClick={selectAll} disabled={busy}>
            {allSelected
              ? t('取消全选', 'Deselect All')
              : t('全选所有作品', 'Select All')}
          </button>
        )}
      </div>

      {active&&<label>{t('排序范围','Ordering scope')}<select value={scope} disabled={busy} onChange={e=>{setScope(e.target.value as 'all'|'featured');setSelectedIds([]);setAllSelected(false);}}><option value="all">{t('全部照片','All photographs')}</option><option value="featured">{t('首页大图','Homepage photos')}</option></select></label>}
      {exifStatus&&<p role="status" aria-live="polite">{exifStatus}</p>}

      {/* 批量操作卡片上的勾选圈（通过通知父级或覆盖样式实现） */}
      {active && (
        <div className="addon-batch-indicator-note">
          <p>
            {t(
              '💡 批量模式已开启：在下方卡片中点击勾选照片后，即可在底部批量操作。',
              '💡 Batch mode active: Select photos below to edit or delete in bulk.'
            )}
          </p>
        </div>
      )}
      {active&&<div className="batch-selection-gallery" style={{pointerEvents:busy?'none':undefined}}><ThumbnailSizeControl/>{scope==='featured'?<JustifiedGallery manage disabled={busy} photos={shown} selectedIds={selectedIds} showSelectionOrder={!(allSelected&&selectedIds.length===shown.length)} onReorder={reorder} onViewPhoto={id=>{if(!busy)toggleSelect(id);}}/>:<>{shown.some(p=>p.curated===1)&&<><JustifiedGallery manage disabled={busy} photos={shown.filter(p=>p.curated===1)} selectedIds={selectedIds} showSelectionOrder={!(allSelected&&selectedIds.length===shown.length)} onReorder={reorder} onViewPhoto={id=>{if(!busy)toggleSelect(id);}}/><hr className="curated-divider"/></>}<JustifiedGallery manage disabled={busy} photos={shown.filter(p=>p.curated!==1)} selectedIds={selectedIds} showSelectionOrder={!(allSelected&&selectedIds.length===shown.length)} onReorder={reorder} onViewPhoto={id=>{if(!busy)toggleSelect(id);}}/></>}</div>}

      {/* 底部悬浮批量操作条 */}
      {active && selectedIds.length > 0 && (
        <div className="addon-batch-floating-bar" role="toolbar">
          <span className="addon-batch-count">
            {t(`已选择 ${selectedIds.length} 张作品`, `${selectedIds.length} photos selected`)}
          </span>

          <div className="addon-batch-actions">
            <button type="button" className="addon-batch-edit-btn" onClick={()=>handleBatchCurated(true)} disabled={busy}>{t('设为精选','Set as curated')}</button>
            <button type="button" className="addon-batch-edit-btn" onClick={()=>handleBatchCurated(false)} disabled={busy}>{t('取消精选','Remove from curated')}</button>
            <button type="button" className="addon-batch-edit-btn" onClick={()=>handleBatchFeatured(true)} disabled={busy}>
              {t('设为首页大图','Set as homepage photos')}
            </button>
            <button type="button" className="addon-batch-edit-btn" onClick={()=>handleBatchFeatured(false)} disabled={busy}>
              {t('取消首页大图','Remove from homepage photos')}
            </button>
            <button type="button" className="addon-batch-edit-btn" onClick={handleBatchExif} disabled={busy}>
              {t('批量识别 EXIF','Read EXIF')}
            </button>
            <button
              type="button"
              className="addon-batch-edit-btn"
              onClick={() => setShowEditModal(true)}
              disabled={busy}
            >
              {t('批量修改属性', 'Batch Edit')}
            </button>
            <button
              type="button"
              className="addon-batch-cancel"
              onClick={() => {setSelectedIds([]);setAllSelected(false);}}
              disabled={busy}
            >
              {t('清空', 'Clear')}
            </button>
            <button
              type="button"
              className="addon-batch-delete"
              onClick={handleBatchDelete}
              disabled={busy}
            >
              {busy ? t('处理中…', 'Working…') : t(`批量删除 (${selectedIds.length})`, `Delete (${selectedIds.length})`)}
            </button>
          </div>
        </div>
      )}

      {/* 批量修改弹窗 */}
      {showEditModal && (
        <div className="addon-batch-modal-overlay">
          <div className="addon-batch-modal">
            <div className="addon-batch-modal-head">
              <h3>{t(`批量修改属性 (${selectedIds.length} 张)`, `Batch Edit (${selectedIds.length} Photos)`)}</h3>
              <p>{t('留空的项将保持原样不变；填写的项将统一应用到选中的所有照片。', 'Leave blank to keep existing values.')}</p>
            </div>

            <form onSubmit={handleBatchUpdate} className="addon-batch-form">
              <label>
                <span>{t('统一地点', 'Location')}</span>
                <input
                  type="text"
                  placeholder={t('例如：坦桑尼亚（留空不改）', 'e.g., Tanzania')}
                  value={batchLocation}
                  onChange={(e) => setBatchLocation(e.target.value)}
                  disabled={busy}
                />
              </label>





              <div className="addon-batch-modal-actions">
                <button
                  type="button"
                  className="addon-batch-btn-subtle"
                  onClick={() => setShowEditModal(false)}
                  disabled={busy}
                >
                  {t('取消', 'Cancel')}
                </button>
                <button type="submit" className="addon-batch-btn-save" disabled={busy}>
                  {busy ? t('正在保存…', 'Saving…') : t('确定应用更改', 'Apply Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
