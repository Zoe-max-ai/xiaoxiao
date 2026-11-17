import { db } from "../core/db.js";
/**
 * 获取用户档案
 */
export async function getUserProfile(userId) {
  return db.get("users", userId);
}
/**
 * 更新用户档案
 */
export async function updateUserProfile(userId, patch) {
  const user = await db.get("users", userId);
  if (!user) return null;
  const updated = { ...user, ...patch, updatedAt: Date.now() };
  await db.put("users", updated);
  return updated;
}
/**
 * 更新用户头像（入参：base64字符串）
 */
export async function updateUserAvatar(userId, base64Str) {
  const { uid } = await import("../core/uid.js");
  const id = uid("img");
  const blob = await base64ToBlob(base64Str);
  const img = await loadImage(base64Str);
  const thumbB64 = await generateThumbB64(img, 200, 200);
  await db.put("images", {
    id,
    ownerId: null,
    category: "avatar",
    theme: null,
    tags: ["用户头像"],
    origin: {
      data: base64Str,
      mime: getMimeFromB64(base64Str),
      width: img.width,
      height: img.height,
    },
    thumb: {
      data: thumbB64,
      width: 200,
      height: 200,
    },
    createdAt: Date.now(),
  });
  await updateUserProfile(userId, { avatarId: id });
  return id;
}
/**
 * 更新用户立绘（入参：base64字符串）
 */
export async function updateUserPortrait(userId, base64Str) {
  const { uid } = await import("../core/uid.js");
  const id = uid("img");
  const blob = await base64ToBlob(base64Str);
  const img = await loadImage(base64Str);
  const thumbB64 = await generateThumbB64(img, 200, 300);
  await db.put("images", {
    id,
    ownerId: null,
    category: "portrait",
    theme: null,
    tags: ["用户立绘"],
    origin: {
      data: base64Str,
      mime: getMimeFromB64(base64Str),
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
  await updateUserProfile(userId, { portraitId: id });
  return id;
}
/**
 * 读取用户头像 URL，直接返回base64
 */
export async function getAvatarUrl(avatarId) {
  if (!avatarId) return null;
  const img = await db.get("images", avatarId);
  // 多加一层：必须是字符串才执行replace
  if (!img?.thumb?.data || typeof img.thumb.data !== "string") return null;
  return img.thumb.data.replace(/\s/g, "");
}

/**
 * 读取用户立绘 URL，直接返回base64
 */
export async function getPortraitUrl(portraitId) {
  if (!portraitId) return null;
  const img = await db.get("images", portraitId);
  // 多加一层：必须是字符串才执行replace
  if (!img?.origin?.data || typeof img.origin.data !== "string") return null;
  return img.origin.data.replace(/\s/g, "");
}


/* ========== 工具（改造后，适配base64） ========== */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
// 生成缩略图，输出base64
function generateThumbB64(img, maxW, maxH) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.9);
    resolve(b64.replace(/\s/g, ""));
  });
}
// base64转Blob（仅内部临时生成缩略图使用，不入库）
function base64ToBlob(b64) {
  return new Promise((resolve) => {
    const arr = b64.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    resolve(new Blob([u8arr], { type: mime }));
  });
}
// 从base64头部提取mime
function getMimeFromB64(b64) {
  const m = b64.match(/data:(.*?);/);
  return m ? m[1] : "image/jpeg";
}
