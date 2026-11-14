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
 * 更新用户头像（存图库，返回 avatarId）
 */
export async function updateUserAvatar(userId, blob) {
  const { uid } = await import("../core/uid.js");

  const id = uid("img");
  const img = await loadImage(blob);
  const thumb = await generateThumb(img, 200, 200);

  await db.put("images", {
    id,
    ownerId: null,
    category: "avatar",
    theme: null,
    tags: ["用户头像"],
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
      height: 200,
      size: thumb.size,
    },
    createdAt: Date.now(),
  });

  await updateUserProfile(userId, { avatarId: id });
  return id;
}

/**
 * 更新用户立绘（可选）
 */
export async function updateUserPortrait(userId, blob) {
  const { uid } = await import("../core/uid.js");

  const id = uid("img");
  const img = await loadImage(blob);
  const thumb = await generateThumb(img, 200, 300);

  await db.put("images", {
    id,
    ownerId: null,
    category: "portrait",
    theme: null,
    tags: ["用户立绘"],
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

  await updateUserProfile(userId, { portraitId: id });
  return id;
}

/**
 * 读取用户头像 URL
 */
export async function getAvatarUrl(avatarId) {
  if (!avatarId) return null;
  const img = await db.get("images", avatarId);
  if (!img) return null;
  return URL.createObjectURL(img.thumb.data);
}

/**
 * 读取用户立绘 URL
 */
export async function getPortraitUrl(portraitId) {
  if (!portraitId) return null;
  const img = await db.get("images", portraitId);
  if (!img) return null;
  return URL.createObjectURL(img.origin.data);
}

/* ========== 工具 ========== */

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
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
}