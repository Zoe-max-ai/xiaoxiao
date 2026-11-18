import { db } from "../core/db.js";
import { getTheme } from "./theme-registry.js";
import { emit } from "../core/event-bus.js";
import { getImageUrl } from "../services/seed-service.js";

let currentThemeId = "qinglv";
let currentBgUrl = null;
let currentBgUsage = "chenshi"; // chenshi / chat / letter
let currentOverrides = {}; 

/**
 * 初始化主题（启动时调用）
 */
export async function initTheme() {
  const saved = await db.get("settings", "theme");
  const themeId = saved?.value || "qinglv";
  await applyTheme(themeId);
}

/**
 * 应用主题
 */
export async function applyTheme(themeId) {
  const theme = getTheme(themeId);
  currentThemeId = themeId;



  // 读该主题的微调
  const saved = await db.get("theme_overrides", `override_${themeId}`);
  currentOverrides = saved?.values || {};

  // 合并：预设为底，微调覆盖
  const merged = { ...theme.colors, ...filterColorOverrides(currentOverrides) };

  const root = document.documentElement;
  root.dataset.theme = themeId;

  // 1. 应用颜色
  const colorMap = {
    bg: "--bg",
    bgSoft: "--bg-soft",
    paper: "--paper",
    paperSoft: "--paper-soft",
    ink: "--ink",
    inkSoft: "--ink-soft",
    inkDim: "--ink-dim",
    cinnabar: "--cinnabar",
    cinnabarLight: "--cinnabar-light",
    gold: "--gold",
    green: "--green",
  };
  for (const [key, cssVar] of Object.entries(colorMap)) {
    if (merged[key]) root.style.setProperty(cssVar, merged[key]);
  }

  // 2. 应用字体
  if (currentOverrides.fontTitle) {
    root.style.setProperty("--font-title", `'${currentOverrides.fontTitle}', serif`);
  }
  if (currentOverrides.fontBody) {
    root.style.setProperty("--font-body", `'${currentOverrides.fontBody}', serif`);
  }
  if (currentOverrides.fontSize) {
    root.style.setProperty("--font-size-body", currentOverrides.fontSize + "px");
  }

  // 3. 应用遮罩透明度
  if (currentOverrides.overlayOpacity !== undefined) {
    root.style.setProperty("--bg-overlay-opacity", currentOverrides.overlayOpacity);
  }

  // 气泡样式：根据 bubbleStyle 覆盖气泡变量
  const bubbleStyle = currentOverrides.bubbleStyle || "paper";
  applyBubbleStyle(root, bubbleStyle);

  // 4. 应用气泡样式（CSS 类）
  if (currentOverrides.bubbleStyle) {
    root.dataset.bubbleStyle = currentOverrides.bubbleStyle;
  } else {
    delete root.dataset.bubbleStyle;
  }



  // 5. 背景图（异步，含微调覆盖）
  await applyBackground(themeId, currentBgUsage);

  // 6. 保存当前主题 id
  await db.put("settings", { key: "theme", value: themeId });

  // 7. 通知粒子系统
  const particle = currentOverrides.particle || theme.particle;
  emit("theme-changed", { themeId, particle });
}

/** 从微调里挑出颜色相关的字段 */
function filterColorOverrides(ov) {
  const colorKeys = ["bg","bgSoft","paper","paperSoft","ink","inkSoft","inkDim","cinnabar","cinnabarLight","gold","green"];
  const out = {};
  for (const k of colorKeys) {
    if (ov[k]) out[k] = ov[k];
  }
  return out;
}

/**
 * 应用背景图（完美兼容 Base64 和种子图路径）
 */
async function applyBackground(themeId, usage = "chenshi") {
  const bgLayer = document.getElementById("bg-layer");
  if (!bgLayer) return;

  // 1. 先看微调里有没有指定图片
  const overrideKey = { chenshi: "bgChenshi", chat: "bgChat", letter: "bgLetter" }[usage];
  const overrideImageId = currentOverrides[overrideKey];

  let bg = null;

  if (overrideImageId) {
    bg = await db.get("images", overrideImageId);
  }

  // 2. 微调没指定 / 找不到 → 从图库按主题 + 用途找
  if (!bg) {
    const usageMap = { chenshi: "尘世", chat: "聊天", letter: "信纸" };
    const usageTag = usageMap[usage] || usage;
    const all = await db.all("images");
    bg = all.find(img =>
      img.category === "background" &&
      img.theme === themeId &&
      img.tags?.includes(usageTag)
    );
  }

  // ==========================================
  // 👇 核心：彻底告别 Blob，适配 Base64 和 种子静态图
  // ==========================================
  let imageUrl = null;

  if (bg) {
    // 如果是种子图（有 seedFile 字段），直接拼本地路径
    if (bg.isSeed && bg.seedFile) {
      imageUrl = `assets/seed/${bg.seedFile}`;
    } 
    // 如果是用户上传的 Base64 字符串
    else if (bg.origin && typeof bg.origin.data === "string" && bg.origin.data.startsWith("data:image/")) {
      imageUrl = bg.origin.data;
    }
    // 如果还在用旧的 Blob 格式（作为兜底，电脑端还能用）
    else if (bg.origin && bg.origin.data instanceof Blob) {
      imageUrl = URL.createObjectURL(bg.origin.data);
    }
  }

  if (imageUrl) {
    bgLayer.style.backgroundImage = `url(${imageUrl})`;
  } else {
    bgLayer.style.backgroundImage = "none";
  }
}

/**
 * 切换背景用途（尘世/聊天/信纸）
 */
export async function setBackgroundUsage(usage) {
  currentBgUsage = usage;
  await applyBackground(currentThemeId, usage);
}

/**
 * 获取当前主题 ID
 */
export function getCurrentThemeId() {
  return currentThemeId;
}

/** 获取当前主题的微调 */
export function getOverrides() {
  return { ...currentOverrides };
}

/** 保存微调并立即生效 */
export async function updateOverrides(patch) {
  currentOverrides = { ...currentOverrides, ...patch };
  await db.put("theme_overrides", {
    id: `override_${currentThemeId}`,
    themeId: currentThemeId,
    values: currentOverrides,
    updatedAt: Date.now(),
  });
  await applyTheme(currentThemeId);
}

/** 恢复当前主题默认（清掉微调） */
export async function resetOverrides() {
  await db.del("theme_overrides", `override_${currentThemeId}`);
  currentOverrides = {};
  await applyTheme(currentThemeId);
}

function applyBubbleStyle(root, style) {
  // 先清掉之前可能设置的
  const keys = ["--bubble-me-bg","--bubble-me-text","--bubble-me-border",
                "--bubble-he-bg","--bubble-he-text","--bubble-he-border"];
  keys.forEach(k => root.style.removeProperty(k));

  if (style === "glass") {
    root.style.setProperty("--bubble-me-bg", "rgba(138, 43, 43, 0.7)");
    root.style.setProperty("--bubble-me-text", "#fff");
    root.style.setProperty("--bubble-me-border", "rgba(255,255,255,0.2)");
    root.style.setProperty("--bubble-he-bg", "rgba(255,255,255,0.4)");
    root.style.setProperty("--bubble-he-text", "#2b2b2b");
    root.style.setProperty("--bubble-he-border", "rgba(255,255,255,0.3)");
  } else if (style === "solid") {
    root.style.setProperty("--bubble-me-bg", "var(--cinnabar)");
    root.style.setProperty("--bubble-me-text", "#fff");
    root.style.setProperty("--bubble-me-border", "transparent");
    root.style.setProperty("--bubble-he-bg", "var(--paper-soft)");
    root.style.setProperty("--bubble-he-text", "var(--ink)");
    root.style.setProperty("--bubble-he-border", "transparent");
  }
  // "paper" 或空 → 用主题预设的默认变量（不设置，让 CSS 自己走预设）
}