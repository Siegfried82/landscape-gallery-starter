import type { Metadata } from 'next';import './globals.css';
import '@/addons/styles/addons.css';
export const metadata:Metadata={title:'山川之间 · 摄影作品',description:'摄影作品集。'};export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}