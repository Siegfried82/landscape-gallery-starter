'use client';

import Link from 'next/link';
import { useLanguage } from '../hooks/useLanguage';

interface HeaderProps {
  manage?: boolean;
  dark: boolean;
  onToggleTheme: () => void;
}

export default function GalleryHeader({ dark, onToggleTheme }: HeaderProps) {
  const { toggleLanguage, dict } = useLanguage();

  return (
    <header className="addon-header">
      <div className="addon-header-inner">
        <Link className="addon-brand" href="/">
          {dict('siteTitle')}
          <span>{dict('siteSub')}</span>
        </Link>

        <nav className="addon-nav">
          <button
            type="button"
            className="addon-btn-pill"
            onClick={toggleLanguage}
            aria-label={dict('languageLabel')}
          >
            {dict('langToggle')}
          </button>
          <button
            type="button"
            className="addon-btn-pill"
            onClick={onToggleTheme}
            aria-label={dark?dict('themeLight'):dict('themeDark')}
          >
            {dark ? dict('themeLight') : dict('themeDark')}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function GalleryIntro({ manage = false }: { manage?: boolean }) {
  const { dict } = useLanguage();

  return (
    <section className="addon-intro">
      <h1 className="addon-title">{manage?dict('introTitleManage'):dict('introTitle')}</h1>
      {manage&&<p className="addon-desc">{dict('introDescManage')}</p>}
    </section>
  );
}
