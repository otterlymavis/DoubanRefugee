"use client";

import { createContext, createElement, useContext, useEffect, useState, ReactNode } from "react";

type Language = "en" | "zh";

export const translations = {
  en: {
    appTitle: "DoubanRefugee",
    readyUpload: "Ready. Upload JSON from the extension to get started.",
    films: "films",
    books: "books",
    music: "music",
    itemsCount: "$1 items",
    enrichMissing: "Enrich $1",
    enrichRunning: "Enriching...",
    clearLibrary: "Clear library",
    step1Import: "1 — Import",
    scrapeDouban: "Scrape from Douban",
    scrapeDoubanDesc: "Enter a user ID and we fetch their history automatically",
    doubanUserId: "Douban User ID",
    userIdHint: "Find your ID in your Douban profile URL: douban.com/people/your-id/",
    mediaType: "Media type",
    movie: "Movies",
    book: "Books",
    include: "Include",
    watched: "✓ Watched",
    wishlist: "🔖 Wishlist",
    sessionCookie: "Session Cookie",
    cookieRequired: "(required for books & music)",
    cookiePlaceholder: "Paste your Douban cookie string here…",
    howToCookie: "How to get your cookie ›",
    step1: "Open Chrome and sign in to douban.com",
    step2: "Press F12 to open DevTools",
    step3: "Click the Network tab, then reload the page",
    step4: "Click any request to douban.com in the list",
    step5: "Under Request Headers, find the Cookie row",
    step6: "Copy the entire value and paste it above",
    startScraping: "Start Scraping",
    scraping: "Scraping…",
    uploadJson: "Upload JSON",
    tryDemo: "Try Demo",
    pasteJson: "Paste JSON",
    pasteHtml: "Paste HTML",
    importJson: "Import JSON",
    importHtml: "Import HTML",
    step2Export: "2 — Export to",
    ratingsOnly: "⭐ Ratings only",
    ratingsReviews: "⭐📝 Ratings + Reviews",
    importDataFirst: "Import data first to unlock exports",
    tableTitle: "Title",
    tableType: "Type",
    tableYear: "Year",
    tableRating: "Rating",
    tableStatus: "Status",
    tableDate: "Date",
    statusBackup: "Account Backup",
    importStatusLabel: "Import",
    markdown: "Markdown",
    notionCsv: "Notion CSV",
    json: "JSON",
    moreStatuses: "+$1 more entries",
    noItemsImported: "No items found in $1.",
    importedItems: "Imported $1 item(s) from $2. Library: $3.",
    importedStatuses: "Imported $1 account entry/entries. Total: $2.",
    downloadedFile: "Downloaded $1.",
    openingImportPage: "Downloaded $1 — opening $2 import page…",
    scrapeError: "Scrape error: $1",
    enterUserIdFirst: "Enter a Douban user ID first.",
    selectOneWatchedWishlist: "Select at least one of Watched or Wishlist.",
    allItemsHaveTitles: "All items already have original titles.",
    libraryCleared: "Library cleared.",
    statusCleared: "Account backup cleared.",
    enrichedItems: "Enriched $1/$2 items with original titles."
  },
  zh: {
    appTitle: "DoubanRefugee (豆瓣难民)",
    readyUpload: "准备就绪。请从浏览器扩展中上传 JSON 开始。",
    films: "电影",
    books: "图书",
    music: "音乐",
    itemsCount: "$1 条记录",
    enrichMissing: "补全 $1 项",
    enrichRunning: "补全中...",
    clearLibrary: "清空数据",
    step1Import: "第一步 — 导入数据",
    scrapeDouban: "从豆瓣直接抓取",
    scrapeDoubanDesc: "输入豆瓣用户 ID，我们将自动抓取您的记录",
    doubanUserId: "豆瓣用户 ID",
    userIdHint: "在您的豆瓣个人主页 URL 中找到 ID：douban.com/people/your-id/",
    mediaType: "媒体类型",
    movie: "电影",
    book: "图书",
    include: "包含内容",
    watched: "✓ 看过",
    wishlist: "🔖 想看",
    sessionCookie: "Session Cookie",
    cookieRequired: "(抓取图书和音乐必需)",
    cookiePlaceholder: "请粘贴您的豆瓣 Cookie 字符串…",
    howToCookie: "如何获取 Cookie ›",
    step1: "打开 Chrome 浏览器并登录 douban.com",
    step2: "按 F12 打开开发者工具 (DevTools)",
    step3: "点击 Network (网络) 标签，然后刷新页面",
    step4: "在列表中点击任何发送到 douban.com 的请求",
    step5: "在 Request Headers (请求标头) 下找到 Cookie 行",
    step6: "复制整行内容并粘贴到上面的输入框中",
    startScraping: "开始抓取",
    scraping: "抓取中…",
    uploadJson: "上传 JSON",
    tryDemo: "体验 Demo",
    pasteJson: "粘贴 JSON",
    pasteHtml: "粘贴 HTML",
    importJson: "导入 JSON",
    importHtml: "导入 HTML",
    step2Export: "第二步 — 导出到",
    ratingsOnly: "⭐ 仅评分",
    ratingsReviews: "⭐📝 评分与短评",
    importDataFirst: "请先导入数据以解锁导出功能",
    tableTitle: "标题",
    tableType: "类型",
    tableYear: "年份",
    tableRating: "评分",
    tableStatus: "状态",
    tableDate: "日期",
    statusBackup: "账号备份",
    importStatusLabel: "导入",
    markdown: "Markdown",
    notionCsv: "Notion CSV",
    json: "JSON",
    moreStatuses: "还有 $1 条账号记录",
    noItemsImported: "在 $1 中没有找到记录。",
    importedItems: "已从 $1 导入 $2 条记录。总数: $3。",
    importedStatuses: "已导入 $1 条账号记录。总数: $2。",
    downloadedFile: "已下载 $1。",
    openingImportPage: "已下载 $1 — 正在打开 $2 导入页面…",
    scrapeError: "抓取错误: $1",
    enterUserIdFirst: "请先输入豆瓣用户 ID。",
    selectOneWatchedWishlist: "请至少选择“看过”或“想看”。",
    allItemsHaveTitles: "所有条目都已经包含原名。",
    libraryCleared: "数据已清空。",
    statusCleared: "账号备份已清空。",
    enrichedItems: "已补全 $1/$2 条记录的原名。"
  }
};

type TransKey = keyof typeof translations.en;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TransKey, ...args: string[]) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations.en[key]
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("douban_refugee_lang");
    if (saved === "zh" || saved === "en") {
      setLangState(saved);
    } else if (navigator.language.startsWith("zh")) {
      setLangState("zh");
    }
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("douban_refugee_lang", l);
  };

  const t = (key: TransKey, ...args: string[]) => {
    let text = translations[lang][key] || translations.en[key];
    args.forEach((arg, i) => {
      text = text.replace(`$${i + 1}`, arg);
    });
    return text;
  };

  return createElement(I18nContext.Provider, { value: { lang, setLang, t } }, children);
}

export function useTranslation() {
  return useContext(I18nContext);
}
