'use client';
import {useCallback,useEffect} from 'react';
import {translations,type TranslationKey} from '../locales/translations';
import {usePreference} from './usePreference';
export type Language='zh'|'en';
const valid=(value:string):value is Language=>value==='zh'||value==='en';
export function useLanguage(){
 // Chinese remains the server default; system language is read after hydration.
 const system:Language=typeof navigator==='undefined'||navigator.language.toLowerCase().startsWith('zh')?'zh':'en';
 const [lang,setLang]=usePreference('gallery-language',system,valid,'zh');
 useEffect(()=>{document.documentElement.lang=lang==='zh'?'zh-CN':'en';},[lang]);
 const toggleLanguage=useCallback(()=>setLang(lang==='zh'?'en':'zh'),[lang,setLang]);
 const t=useCallback((zh:string,en:string)=>lang==='zh'?zh:en,[lang]);
 const dict=useCallback((key:TranslationKey)=>translations[lang][key]||translations.zh[key],[lang]);
 return {lang,setLang,toggleLanguage,t,dict};
}
