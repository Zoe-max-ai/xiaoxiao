import { db } from "../core/db.js";
import { uid } from "../core/uid.js";
import { PRESET_CHARACTERS } from "../data/preset-characters.js";
import { setInitialRelation } from "./relation-service.js";

/**
 * 创建角色
 */
export async function createCharacter(ownerId, data) {
  const id = uid("char");
  const character = {
    id,
    ownerId,
    name: data.name,
    nickname: data.nickname || null,
    title: data.title || null,
    du: data.du || null,
    duMotto: data.duMotto || null,
    age: data.age || null,
    birthday: data.birthday || null,
    gender: data.gender || null,
    faction: data.faction || null,
    rank: data.rank || null,
    master: data.master || null,
    weapon: data.weapon || null,
    martialArt: data.martialArt || null,
    motto: data.motto || null,
    tags: data.tags || [],
    likes: data.likes || [],
    dislikes: data.dislikes || [],
    appearance: data.appearance || {},
    condition: data.condition || {},
    bio: data.bio || "",
    portraitId: data.portraitId || null,
    inheritGlobalChat: true,
    chatSettings: {},
    enabledGroupIds: [],
    avatarId: data.avatarId || null,
    createdAt: Date.now(),
  };
  await db.put("characters", character);
  return character;
}

/**
 * 获取用户的所有角色
 */
export async function getCharactersByOwner(ownerId) {
  const all = await db.all("characters");
  return all
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 获取单个角色
 */
export async function getCharacter(id) {
  return db.get("characters", id);
}

/**
 * 更新角色
 */
export async function updateCharacter(id, patch) {
  const character = await db.get("characters", id);
  if (!character) return null;
  const updated = { ...character, ...patch, updatedAt: Date.now() };
  await db.put("characters", updated);
  return updated;
}

/**
 * 删除角色
 */
export async function deleteCharacter(id) {
  await db.del("characters", id);
}

/**
 * 首次启动时，导入预设角色
 */
export async function importPresetCharacters(ownerId) {
  const existing = await getCharactersByOwner(ownerId);
  if (existing.length > 0) {
    console.log("[preset] 已有角色，跳过预设");
    return;
  }

  console.log("[preset] 开始导入三主角...");

  // 从图库查找立绘和头像
  const allImages = await db.all("images");

  for (const preset of PRESET_CHARACTERS) {
    // 找立绘
    const portraitImg = allImages.find(img =>
      img.category === "portrait" &&
      img.seedFile === preset.portraitFile
    );
    // 找头像
    const avatarImg = allImages.find(img =>
      img.category === "avatar" &&
      img.seedFile === preset.avatarFile
    );

    // 创建角色
    const created = await createCharacter(ownerId, {
      ...preset,
      portraitId: portraitImg?.id || null,
      avatarId: avatarImg?.id || null,
    });

    // 写初始好感
    await setInitialRelation(
      ownerId,
      created.id,
      preset.initAffection || 0,
      preset.initFriendship || 0
    );

    console.log(`[preset] ✓ ${preset.name}`);
  }

  console.log("[preset] 导入完成");
}

/* ========== 图片处理（改为 Base64 版本，对齐手机端） ========== */
export async function saveToGallery(blobOrBase64, category) {
  const id = uid("img");
  
  // 兼容传入的是 Blob 还是 Base64
  const base64Str = (typeof blobOrBase64 === "string") 
    ? blobOrBase64 
    : await blobToBase64(blobOrBase64);

  const img = await loadImage(base64Str);
  const thumbB64 = await generateThumbB64(img, 200, 200);

  await db.put("images", {
    id,
    ownerId: null,
    category,
    theme: null,
    tags: [],
    origin: { 
      data: base64Str, 
      mime: getMimeFromB64(base64Str), 
      width: img.width, 
      height: img.height 
    },
    thumb: { 
      data: thumbB64, 
      width: 200, 
      height: 200 
    },
    createdAt: Date.now(),
  });
  return id;
}

// 辅助：把 Blob 转成 Base64 字符串（防止旧数据报错）
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 加载图片
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 生成缩略图（Base64）
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

// 提取图片类型
function getMimeFromB64(b64) {
  const m = b64.match(/data:(.*?);/);
  return m ? m[1] : "image/jpeg";
}