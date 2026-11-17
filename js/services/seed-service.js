import { db, STORES } from "../core/db.js";
import { uid } from "../core/uid.js";
const SEED_MANIFEST_URL = "assets/seed/seed-manifest.json";
const SEED_PREFIX = "/assets/seed/";
/**
 * 检查并导入素材清单（只导入元信息，不再存Blob！）
 * 首次启动：导入图片元数据到images表，图片本体仍然走静态资源
 * 非首次：跳过
 */
export async function importSeedIfNeeded() {
  const imported = await db.get("settings", "seed_imported");
  const allImages = await db.all("images");
  const seedCount = allImages.filter(r => r.isSeed).length;
  if (imported?.value && seedCount >= 42) {
    console.log("[seed] 已导入过，跳过");
    return;
  }
  console.log("[seed] 开始导入素材元信息...");
  // 清掉旧的种子图
  for (const img of allImages) {
    if (img.isSeed) {
      await db.del("images", img.id);
    }
  }
  // 1. 加载 manifest
  let manifest;
  try {
    manifest = await fetch(SEED_MANIFEST_URL).then(r => r.json());
  } catch (e) {
    console.error("[seed] 加载 manifest 失败:", e);
    return;
  }
  // 2. 导入各类素材【只存元信息，不fetch blob】
  await importGroup(manifest.seals,     "deco",       { tag: "印章" });
  await importGroup(manifest.icons,     "deco",       { tag: "探秘图标" });
  await importGroup(manifest.navIcons,  "deco",       { tag: "导航图标" });
  await importGroup(manifest.decos,     "deco",       { tag: "装饰" });
  await importGroup(manifest.frames,    "frame",      { tag: "头像框" });
  await importGroup(manifest.backgrounds, "background", { tag: "背景" });
  await importGroup(manifest.portraits, "portrait",   { tag: "立绘" });
  await importGroup(manifest.avatars,   "avatar",     { tag: "头像" });
  // 3. 标记已导入
  await db.put("settings", { key: "seed_imported", value: true });
  const total = await db.all("images");
  console.log(`[seed] 元信息导入完成，共 ${total.length} 条seed素材记录`);
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
      await importOneMeta(file, {
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
 * 【改动重点】只存元信息，不加载blob、不生成缩略图
 */
async function importOneMeta(file, meta) {
  // 去重
  const all = await db.all("images");
  const existing = all.find(img => img.isSeed && img.seedFile === file);
  if (existing) return;
  const id = "seed_" + file.replace(/[\/\.]/g, "-");
  await db.put("images", {
    id,
    seedFile: file,
    isSeed: true,
    ownerId: null,
    category: meta.category,
    theme: meta.theme,
    tags: meta.tags,
    name: meta.name,
    characterId: meta.characterId,
    route: meta.route,
    // seed素材不再存 origin / thumb 的blob！
    isStatic: true,
    createdAt: Date.now(),
  });
  console.log(`[seed] ✓ meta ${file}`);
}
/**
 * 获取素材 URL（核心修复：兼容 seed静态图 + base64 + Blob）
 */
export async function getImageUrl(imageId, useThumb = false) {
  if (!imageId) return null;
  if (imageId.startsWith("seed_")) {
    const img = await db.get("images", imageId);
    console.log("[seed] img记录", img);
    if (!img?.seedFile) {
      console.warn("[seed] 缺少seedFile字段");
      return null;
    }
    const finalUrl = SEED_PREFIX + img.seedFile;
    console.log("[seed] 最终图片地址：", finalUrl);
    return finalUrl;
  }
  // 用户上传分支：同时兼容 base64字符串 和 Blob
  const img = await db.get("images", imageId);
  if (!img) return null;
  const data = useThumb ? img.thumb?.data : img.origin?.data;

  if (typeof data === "string") {
    // base64 直接返回
    return data;
  }
  if (data instanceof Blob) {
    const blobUrl = URL.createObjectURL(data);
    console.log("[blob] blob地址：", blobUrl);
    return blobUrl;
  }
  // 既不是base64也不是Blob，才警告
  console.warn(`[image] 图片数据缺失: ${imageId}`);
  return null;
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
