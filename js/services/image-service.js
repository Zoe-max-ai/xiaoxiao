import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/**
 * 获取所有图片（供绘卷用）
 * 兼容旧数据：没有 name 的用兜底名
 */
export async function getAllImages() {
  const all = await db.all("images");
  return all
    .map(img => ({
      ...img,
      name: img.name || inferName(img),
      isSeed: !!img.isSeed,
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * 按分类查
 */
export async function getImagesByCategory(category) {
  const all = await getAllImages();
  if (!category || category === "all") return all;
  return all.filter(img => img.category === category);
}

/**
 * 上传新图
 */
export async function uploadImage({ blob, category, name }) {
  const id = uid("img");
  const img = await loadImage(blob);
  const thumb = await generateThumb(img, 200, 300);

  await db.put("images", {
    id,
    ownerId: null,
    category,
    theme: null,
    tags: [],
    name: (name || "").trim() || "未命名",
    seedFile: null,
    isSeed: false,
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

  return id;
}

/**
 * 重命名
 */
export async function renameImage(id, newName) {
  const img = await db.get("images", id);
  if (!img) return null;
  img.name = (newName || "").trim() || "未命名";
  await db.put("images", img);
  return img;
}

/**
 * 删除（只允许删非种子图）
 */
export async function deleteImage(id) {
  const img = await db.get("images", id);
  if (!img) return false;
  if (img.isSeed) return false;   // 种子图不能删
  await db.del("images", id);
  return true;
}

/**
 * 检查图片是否被引用
 * 被引用返回 true（不能删）
 */
export async function isImageReferenced(imageId) {
  // 1. 被角色当立绘 / 头像
  const chars = await db.all("characters");
  for (const c of chars) {
    if (c.portraitId === imageId || c.avatarId === imageId) return true;
  }

  // 2. 被用户当头像
  const users = await db.all("users");
  for (const u of users) {
    if (u.avatarId === imageId) return true;
  }

  // 3. 被主题微调引用
  const overrides = await db.all("theme_overrides");
  for (const o of overrides) {
    const v = o.values || {};
    if (v.bgChenshi === imageId || v.bgChat === imageId || v.bgLetter === imageId) {
      return true;
    }
  }

  // 4. 被游戏当封面
  const games = await db.all("games");
  for (const g of games) {
    if (g.coverImageId === imageId) return true;
  }

  return false;
}

/**
 * 兜底名称
 */
function inferName(img) {
  if (img.seedFile) {
    // "portrait/portrait-fangchengyi.jpg" → "portrait-fangchengyi"
    return img.seedFile.split("/").pop().replace(/\.[^.]+$/, "");
  }
  if (img.name) return img.name;
  return img.category || "未命名";
}

/**
 * 生成缩略图
 */
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