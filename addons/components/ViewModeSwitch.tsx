'use client';

import {usePreference} from '../hooks/usePreference';
import { useLanguage } from '../hooks/useLanguage';

export type ViewMode = 'classic' | 'grid' | 'cinematic';

interface ViewModeSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const STORAGE_KEY = 'gallery-view-mode';

/**
 * 浏览视角切换器 (ViewModeSwitch)
 * - 支持经典展示、通栏瀑布流和宽幅画册切换
 * - 自动记录在 localStorage，刷新不重置
 */
export default function ViewModeSwitch({ mode, onChange }: ViewModeSwitchProps) {
  const { dict,t } = useLanguage();

  return (
    <div className="addon-view-switch" role="group" aria-label={dict('viewModeLabel')}>
      <button type="button" className={`addon-switch-btn ${mode === 'classic' ? 'active' : ''}`} onClick={()=>onChange('classic')} aria-pressed={mode==='classic'} aria-label={t('经典展示','Classic')} title={t('经典展示','Classic')}>
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="12" rx="1"/><path d="M3 19h18M3 23h12"/></svg>
        <span>{t('经典展示','Classic')}</span>
      </button>
      <button
        type="button"
        className={`addon-switch-btn ${mode === 'grid' ? 'active' : ''}`}
        onClick={() => {
          onChange('grid');
          
        }}
        aria-pressed={mode === 'grid'}
        title={dict('viewGrid')} aria-label={dict('viewGrid')}
      >
        {/* 网格四宫格图标 */}
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>{dict('viewGrid')}</span>
      </button>

      <button
        type="button"
        className={`addon-switch-btn ${mode === 'cinematic' ? 'active' : ''}`}
        onClick={() => {
          onChange('cinematic');
          
        }}
        aria-pressed={mode === 'cinematic'}
        title={dict('viewCinematic')} aria-label={dict('viewCinematic')}
      >
        {/* 单列宽幅胶片图标 */}
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" strokeDasharray="1 2" />
          <line x1="3" y1="15" x2="21" y2="15" strokeDasharray="1 2" />
        </svg>
        <span>{dict('viewCinematic')}</span>
      </button>
    </div>
  );
}

/** 辅助 Hook：在主站里一句话管理视角状态 */
const validMode=(value:string):value is ViewMode=>value==='classic'||value==='grid'||value==='cinematic';
export function useViewMode(defaultMode:ViewMode='grid'){
 return usePreference(STORAGE_KEY,defaultMode,validMode);
}
