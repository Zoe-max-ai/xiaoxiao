import { db, STORES } from "../core/db.js";
import { uid } from "../core/uid.js";

const SEED_MANIFEST_URL = "assets/seed/seed-manifest.json";
const SEED_PREFIX = "assets/seed/";

/**
 * 检查并导入素材
 * - 首次启动：导入所有素材到 images 表
 * - 非首次：跳过
 */
export async function importSeedIfNeeded() {
  const imported = await db.get("settings", "seed_imported");
  if (imported?.value) {
    console.log("[seed] 已导入过，跳过");
    return;
  }

  console.log("[seed] 开始导入素材...");

  // 1. 加载 manifest
  let manifest;
  try {
    manifest = await fetch(SEED_MANIFEST_URL).then(r => r.json());
  } catch (e) {
    console.error("[seed] 加载 manifest 失败:", e);
    return;
  }

  // 2. 导入各类素材
  const importTasks = [
    importGroup(manifest.seals,     "deco",       { tag: "印章" }),
    importGroup(manifest.icons,     "deco",       { tag: "探秘图标" }),
    importGroup(manifest.navIcons,  "deco",       { tag: "导航图标" }),
    importGroup(manifest.decos,     "deco",       { tag: "装饰" }),
    importGroup(manifest.frames,    "frame",      { tag: "头像框" }),
    importGroup(manifest.backgrounds, "background", { tag: "背景" }),
    importGroup(manifest.portraits, "portrait",   { tag: "立绘" }),
    importGroup(manifest.avatars,   "avatar",     { tag: "头像" }),
  ];

  await Promise.all(importTasks);

  // 3. 标记已导入
  await db.put("settings", { key: "seed_imported", value: true });

  const total = await db.all("images");
  console.log(`[seed] 导入完成，共 ${total.length} 张图`);
}

/**
 * 导入一组素材
 */
async function importGroup(list, category, meta = {}) {
  if (!list || !list.length) return;

  for (const item of list) {
    const file = item.file;
    if (!file) continue;

    try {
      await importOne(file, {
        category,
        theme: item.theme || null,
        tags: item.tags || [meta.tag].filter(Boolean),
        name: item.name || item.char || null,
        characterId: item.characterId || null,
        route: item.route || null,
        size: item.size || null,
      });
    } catch (e) {
      console.warn(`[seed] 导入失败: ${file}`, e);
    }
  }
}

/**
 * 导入单张图片
 */
async function importOne(file, meta) {
  const url = SEED_PREFIX + file;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob();
  const img = await loadImage(blob);
  const thumb = await generateThumb(img, 200, 300);

  const id = uid("img");

  await db.put("images", {
    id,
    ownerId: null,
    category: meta.category,
    theme: meta.theme,
    tags: meta.tags,
    name: meta.name,
    characterId: meta.characterId,
    route: meta.route,
    origin: {
      data: blob,
      mime: blob.type,
      width: img.width,
      height: img.height,
      size: blob.size,
    },
    thumb: {
      data: thumb,
      width: 200,
      height: 300,
      size: thumb.size,
    },
    createdAt: Date.now(),
  });

  console.log(`[seed] ✓ ${file}`);
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function generateThumb(img, maxW, maxH) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/jpeg", 0.7);
  });
}

/**
 * 获取素材 URL（供页面使用）
 */
export async function getImageUrl(imageId, useThumb = false) {
  if (!imageId) return null;
  const img = await db.get("images", imageId);
  if (!img) return null;
  const data = useThumb ? img.thumb.data : img.origin.data;
  return URL.createObjectURL(data);
}

/**
 * 按分类查询素材
 */
export async function getImagesByCategory(category) {
  const all = await db.all("images");
  return all.filter(img => img.category === category);
}

/**
 * 按主题查询背景
 */
export async function getBackgroundByTheme(theme, usage = null) {
  const all = await db.all("images");
  return all.find(img =>
    img.category === "background" &&
    img.theme === theme &&
    (!usage || img.tags?.includes(usage))
  );
}