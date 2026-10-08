'use client';

import type { MouseEvent, ReactNode,CSSProperties } from 'react';
import {photoRatios} from '@/lib/gallery-motion';
import { useLanguage } from '../hooks/useLanguage';
import { formatBilingualText } from '../locales/metadata-helpers';

export interface PhotoCardProps {
  photo: {
    id: string;
    title: string;
    location?: string;
  };
  index: number;
  /** 拍摄参数摘要，例如主站的 parameterSummary(p.exif)，空字符串则不显示 */
  exifText?: string;
  /** 图片地址，默认使用主站的 /api/image/:id */
  src?: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  /** 管理模式下的编辑表单等内容 */
  children?: ReactNode;
  manage?: boolean;
}

export default function PhotoCard({
  photo,
  index,
  exifText,
  src,
  onClick,
  children,
  manage=false,
}: PhotoCardProps) {
  const { lang, t } = useLanguage();

  // 标题智能双语解析
  const displayTitle = formatBilingualText(photo.title, lang);

  // 地点智能双语解析（支持 "冰岛 / Iceland" 等格式自动切换）
  const displayLocation = formatBilingualText(photo.location, lang);

  // 拼接副标题
  const subtitle =
    [displayLocation].filter(Boolean).join(' · ');

  return (
    <article className="addon-card" data-gallery-photo={photo.id} style={{viewTransitionName:'gallery-photo-'+photo.id.replace(/[^a-zA-Z0-9_-]/g,''),'--photo-ratio':photoRatios.get(photo.id)||1.5} as CSSProperties}>
      <button
        type="button"
        className="addon-card-photo"
        onClick={onClick}
        aria-label={manage?t(`编辑 ${displayTitle}`, `Edit ${displayTitle}`):t(`放大查看 ${displayTitle}`, `View ${displayTitle}`)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          style={{aspectRatio:photoRatios.get(photo.id)}}
          src={src ?? `/api/image/${photo.id}`}
          data-morph-photo={photo.id}
          alt={displayTitle}
          loading={index < 4 ? 'eager' : 'lazy'}
          onLoad={e=>{const img=e.currentTarget;const ratio=img.naturalWidth/img.naturalHeight;if(Number.isFinite(ratio)&&ratio>0){photoRatios.set(photo.id,ratio);img.closest<HTMLElement>('.addon-card')?.style.setProperty('--photo-ratio',String(ratio));}}}
        />
        <span className="addon-card-overlay" aria-hidden="true">
          <span className="addon-view-action">{manage?t('编辑信息 ↗','Edit ↗'):t('查看大图 ↗', 'View ↗')}</span>
          {exifText && <span className="addon-overlay-exif">{exifText}</span>}
        </span>
      </button>

      {(manage || subtitle) && <div className="addon-caption">
        <div>
          {manage && <h3 className="addon-photo-title">{displayTitle}</h3>}
          {subtitle && <p className="addon-photo-sub">{subtitle}</p>}
        </div>
        {manage && <span className="addon-index">{String(index + 1).padStart(2, '0')}</span>}
      </div>}


      {children}
    </article>
  );
}
