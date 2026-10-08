import type { Language } from '../hooks/useLanguage';

// Exact place-name matches only; explicit bilingual text takes precedence.
const placeNames:Record<string,string>={
  '乞力马扎罗':'Mount Kilimanjaro',
  '乞力马扎罗山':'Mount Kilimanjaro',
  '坦桑尼亚':'Tanzania',
};

/**
 * 内置官方摄影分类双语映射
 */
export const defaultCategoryMap: Record<string, { zh: string; en: string }> = {
  landscape: { zh: '风光', en: 'Landscape' },
  street: { zh: '街头', en: 'Street' },
  portrait: { zh: '人像', en: 'Portrait' },
  monochrome: { zh: '黑白', en: 'Monochromatic' },
};

/**
 * 智能双语文本提取器 (bilingualText)
 * 
 * 支持场景：
 * 1. 斜杠格式："坦桑尼亚 / Tanzania" -> zh 返回 "坦桑尼亚"，en 返回 "Tanzania"
 * 2. 竖线格式："乞力马扎罗 | Mt. Kilimanjaro" -> zh 返回 "乞力马扎罗"，en 返回 "Mt. Kilimanjaro"
 * 3. 单一语言："川西秘境" -> 优雅降级，无论中英文均返回 "川西秘境"
 */
export function formatBilingualText(input: string | undefined | null, lang: Language): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // 检查是否包含双语分隔符 " / " 或 " | "
  const separatorRegex = /\s+[/|]\s+/;
  if (separatorRegex.test(trimmed)) {
    const parts = trimmed.split(separatorRegex).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return lang === 'zh' ? parts[0] : parts[1];
    }
  }

  // 没有分隔符时直接返回原内容
  return lang==='en'?(placeNames[trimmed]??trimmed):trimmed;
}

/**
 * 解析照片分类名称（自动适配当前语言）
 */
export function formatCategoryName(
  categoryId: string | undefined | null,
  lang: Language,
  customLabel?: string,
): string {
  if (customLabel) return formatBilingualText(customLabel, lang);
  if (!categoryId) return '';
  
  // 1. 优先查内置分类表
  const found = defaultCategoryMap[categoryId.toLowerCase()];
  if (found) {
    return lang === 'zh' ? found.zh : found.en;
  }

  // 2. 如果是自定义分类且传入了双语文本
  if (customLabel) {
    return formatBilingualText(customLabel, lang);
  }

  return formatBilingualText(categoryId, lang);
}
