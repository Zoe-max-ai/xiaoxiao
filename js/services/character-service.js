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

export async function saveToGallery(blob, category) {
  const id = uid("img");
  const img = await loadImage(blob);
  const thumb = await generateThumb(img, 200, 200);

  await db.put("images", {
    id,
    ownerId: null,
    category,
    theme: null,
    tags: [],
    origin: { data: blob, mime: blob.type, width: img.width, height: img.height, size: blob.size },
    thumb: { data: thumb, width: 200, height: 200, size: thumb.size },
    createdAt: Date.now(),
  });
  return id;
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
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
}

