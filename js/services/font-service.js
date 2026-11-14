import { db } from "../core/db.js";

/**
 * 字体候选
 */
export const FONT_OPTIONS = {
  body: [
    { id: "lxgw", name: "霞鹜文楷", css: "'LXGW WenKai', 'Kaiti', serif" },
    { id: "noto", name: "思源宋体", css: "'Noto Serif SC', serif" },
    { id: "kai",  name: "楷体",     css: "'Kaiti', 'STKaiti', serif" },
    { id: "system", name: "系统默认", css: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  ],
  title: [
    { id: "zcool", name: "站酷小薇", css: "'ZCOOL XiaoWei', serif" },
    { id: "noto",  name: "思源宋体", css: "'Noto Serif SC', serif" },
    { id: "kai",   name: "楷体",     css: "'Kaiti', 'STKaiti', serif" },
  ],
};

/**
 * 默认字体设置
 */
export const DEFAULT_FONT_SETTINGS = {
  body: "lxgw",
  title: "zcool",
  bodySize: 15,
  titleSize: 24,      // ← 新增：标题字号默认 24px
};

/**
 * 获取字体设置（自动补全缺失字段）
 */
export async function getFontSettings() {
  const record = await db.get("settings", "font_settings");
  const saved = record?.value || {};
  // 合并默认值，兼容旧数据
  return { ...DEFAULT_FONT_SETTINGS, ...saved };
}

/**
 * 保存字体设置
 */
export async function saveFontSettings(value) {
  await db.put("settings", { key: "font_settings", value });
  await applyFontSettings(value);
}

/**
 * 应用字体设置（改 CSS 变量）
 */
export async function applyFontSettings(value) {
  const root = document.documentElement;
  const settings = { ...DEFAULT_FONT_SETTINGS, ...value };

  const bodyFont = FONT_OPTIONS.body.find(f => f.id === settings.body);
  const titleFont = FONT_OPTIONS.title.find(f => f.id === settings.title);

  if (bodyFont) root.style.setProperty("--font-body", bodyFont.css);
  if (titleFont) root.style.setProperty("--font-title", titleFont.css);

  if (settings.bodySize)  root.style.setProperty("--font-size-base", settings.bodySize + "px");
  if (settings.titleSize) root.style.setProperty("--font-size-title", settings.titleSize + "px");
}

/**
 * 初始化时应用字体
 */
export async function initFontSettings() {
  const settings = await getFontSettings();
  await applyFontSettings(settings);
}