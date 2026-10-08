/**
 * 语言文本字典 (Bilingual Translation Dictionary)
 * GPT 可以直接编辑此文件扩充或润色英文文本，无需改动任何组件逻辑。
 */

export const translations = {
  zh: {
    // 网站与品牌
    siteTitle: '山川之间',
    siteSub: 'PHOTOGRAPHY',
    worksNav: '作品',
    manageNav: '管理',
    langToggle: 'EN',
    themeLight: '纯白',
    themeDark: '暗黑',

    // 导言区
    eyebrow: '风光摄影 · 个人影集',
    eyebrowManage: '后台作品管理',
    introTitle: '摄影作品',
    introTitleManage: '管理作品',
    introDesc: '拍山、拍水、等天晴。记录自然的秩序与瞬间。',
    introDescManage: '上传照片，记录拍摄地点与参数。',

    // 视角切换与画廊
    viewModeLabel: '切换展示模式',
    languageLabel: '切换语言',
    viewGrid: '瀑布流',
    viewCinematic: '宽幅画册',
    allWorks: '全部作品',
    photosCountSuffix: '张',
    allCategories: '全部',
    allSeries: '全部系列',
    seriesLabel: '系列',
    viewDetails: '查看大图 ↗',

    // 状态提示
    loading: '正在加载作品…',
    emptyTitle: '暂无作品',
    emptyDesc: '照片陆续更新。',
    emptyCategory: '这个分类或系列还没有作品',
    emptyCategoryAction: '查看全部作品',
  },
  en: {
    // Brand & Navigation
    siteTitle: '山川之间',
    siteSub: 'PHOTOGRAPHY',
    worksNav: 'Works',
    manageNav: 'Manage',
    langToggle: '中文',
    themeLight: 'Light',
    themeDark: 'Dark',

    // Intro Section
    eyebrow: 'PHOTOGRAPHY JOURNAL',
    eyebrowManage: 'COLLECTION MANAGEMENT',
    introTitle: 'Photography',
    introTitleManage: 'Organize Your Works',
    introDesc: 'Mountains, waters, and fleeting light.',
    introDescManage: 'Upload photos and keep their details.',

    // View Modes & Gallery
    viewModeLabel: 'Display mode',
    languageLabel: 'Switch language',
    viewGrid: 'Masonry',
    viewCinematic: 'Cinematic',
    allWorks: 'Works',
    photosCountSuffix: 'photos',
    allCategories: 'All',
    allSeries: 'All Series',
    seriesLabel: 'Series',
    viewDetails: 'View ↗',

    // Status Messages
    loading: 'Loading gallery…',
    emptyTitle: 'No photographs yet',
    emptyDesc: 'More photographs coming soon.',
    emptyCategory: 'No works found in this section',
    emptyCategoryAction: 'Show All Works',
  },
} as const;

export type TranslationKey = keyof typeof translations['zh'];

