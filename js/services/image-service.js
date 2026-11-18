import { db } from "../core/db.js";
import { uid } from "../core/uid.js";
/**
 * 获取所有图片（供绘卷用）
 * 兼容旧数据：没有 name 的用兜底名，同时清洗脏data
 */
export async function getAllImages() {
  const all = await db.all("images");
  return all
    .map(img => {
      // 清洗：data不是字符串就置空，防止后续报错
      if (img.thumb?.data && typeof img.thumb.data !== "string") {
        img.thumb.data = "";
      }
      if (img.origin?.data && typeof img.origin.data !== "string") {
        img.origin.data = "";
      }

      // ==========================================
      // 👇 新增逻辑：给种子图开绿色通道，直接拼本地路径
      // ==========================================
      let finalBase64 = img.origin?.data || "";
      let finalThumb = img.thumb?.data || ""; // 顺手把缩略图也处理了
      
      if (img.isSeed || img.id.startsWith("seed_")) {
        let localPath = "";
        if (img.seedFile) {
          localPath = `assets/seed/${img.seedFile}`;
        } else {
          // 兜底逻辑：假设 id 是 seed_分类_文件名，比如 seed_avatar_fangchengyi
          const parts = img.id.split("_");
          const category = parts[1] || "deco";
          const filename = parts.slice(2).join("_");
          localPath = `assets/seed/${category}/${filename}`;
        }
        finalBase64 = localPath; // 覆盖原来的 Base64
        finalThumb = localPath;  // 缩略图也用本地路径，手机加载极度丝滑
      }

      return {
        ...img,
        // 用处理后的 finalBase64 替代原来的 img.origin?.data
        base64: finalBase64,
        // 如果有用到 thumb.data 的地方，也顺便覆盖
        thumb: {
          ...(img.thumb || {}),
          data: finalThumb
        },
        name: img.name || inferName(img),
        isSeed: !!img.isSeed,
      };
    })
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
 * 上传新图（现在接收 base64 字符串）
 */
export async function uploadImage({ base64, category, name }) {
  const id = uid("img");
  const img = await loadImage(base64);
  const thumbB64 = await generateThumbB64(img, 200, 300);
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
      data: base64,
      mime: getMimeFromB64(base64),
      width: img.width,
      height: img.height,
    },
    thumb: {
      data: thumbB64,
      width: 200,
      height: 300,
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
// ========== base64版本工具函数 ==========
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function generateThumbB64(img, maxW, maxH) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.7);
    resolve(b64.replace(/\s/g, ""));
  });
}
function getMimeFromB64(b64) {
  const m = b64.match(/data:(.*?);/);
  return m ? m[1] : "image/jpeg";
}
/**
 * 一键修复数据库里所有图片脏数据
 * 把 origin.data / thumb.data 不是字符串的重置为空字符串
 * 【可选调用，写个按钮调用这个函数跑一次就行】
 */
export async function repairAllImageDirtyData() {
  const list = await db.all("images");
  let fixCount = 0;
  for (const img of list) {
    let changed = false;
    if (img.thumb?.data && typeof img.thumb.data !== "string") {
      img.thumb.data = "";
      changed = true;
    }
    if (img.origin?.data && typeof img.origin.data !== "string") {
      img.origin.data = "";
      changed = true;
    }
    if (changed) {
      await db.put("images", img);
      fixCount++;
    }
  }
  console.log(`图片脏数据修复完成，一共修复 ${fixCount} 条`);
  return fixCount;
}
