'use client';

import { useLanguage } from '../hooks/useLanguage';
import { formatBilingualText } from '../locales/metadata-helpers';

export interface HeroCoverProps {
  featuredPhoto?: { id: string; title: string; location?: string; series?: string };
  manage?: boolean;
  onViewPhoto?: (id: string) => void;
}

export default function HeroCover({ featuredPhoto, onViewPhoto }: HeroCoverProps) {
  const { lang, dict, t } = useLanguage();
  if (!featuredPhoto) return null;
  const title = formatBilingualText(featuredPhoto.title, lang);
  const meta = [featuredPhoto.location, featuredPhoto.series]
    .map(value => formatBilingualText(value, lang)).filter(Boolean).join(' · ');
  return <section className="addon-hero-cover" aria-label={t('首页大图','Featured photograph')}>
    <div className="addon-hero-media" role="button" tabIndex={0}
      aria-label={t(`放大查看封面作品《${title}》`, `View featured work ${title}`)}
      onClick={() => onViewPhoto?.(featuredPhoto.id)}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onViewPhoto?.(featuredPhoto.id); } }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/image/${featuredPhoto.id}`} alt={title} className="addon-hero-img" loading="eager" />
      <div className="addon-hero-gradient" aria-hidden="true" />
      <div className="addon-hero-content"><span className="addon-hero-badge">{t('首页精选 · FEATURED WORK','FEATURED WORK')}</span><h1 className="addon-hero-title">{title}</h1>{meta&&<p className="addon-hero-meta">{meta}</p>}<button type="button" className="addon-hero-btn" onClick={event=>{event.stopPropagation();onViewPhoto?.(featuredPhoto.id);}}>{dict('viewDetails')}</button></div>
    </div>
  </section>;
}
