import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/* ========== 曲库 ========== */

/**
 * 获取用户所有曲目
 */
export async function getAllTracks(ownerId) {
  const all = await db.all("audios");
  return all
    .filter(t => t.ownerId === ownerId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * 获取一首曲目
 */
export async function getTrack(id) {
  return db.get("audios", id);
}

/**
 * 添加曲目
 */
export async function addTrack(ownerId, data) {
  const id = uid("audio");
  const track = {
    id,
    ownerId,
    name: data.name || "未命名",
    artist: data.artist || "未知",
    source: data.source || "url",   // "builtin" | "url" | "upload"
    src: data.src || null,
    blobId: data.blobId || null,
    neteaseId: data.neteaseId || null,
    duration: data.duration || 0,
    collectedBy: data.collectedBy || null,
    createdAt: Date.now(),
  };
  await db.put("audios", track);
  return track;
}

/**
 * 更新曲目
 */
export async function updateTrack(id, patch) {
  const track = await db.get("audios", id);
  if (!track) return null;
  const updated = { ...track, ...patch, updatedAt: Date.now() };
  await db.put("audios", updated);
  return updated;
}

/**
 * 删除曲目
 */
export async function deleteTrack(id) {
  const track = await db.get("audios", id);
  if (!track) return;
  // 如果是上传的，删对应文件
  if (track.source === "upload" && track.blobId) {
    await db.del("audio_files", track.blobId);
  }
  await db.del("audios", id);
}

/**
 * 去重检查
 */
export function isDuplicateTrack(newTrack, list) {
  return list.some(t => {
    if (newTrack.src && t.src && newTrack.src === t.src) return true;
    if (
      newTrack.name && t.name &&
      newTrack.name === t.name &&
      (newTrack.artist || "") === (t.artist || "")
    ) return true;
    return false;
  });
}

/* ========== 收藏 ========== */

/**
 * 获取我收藏的
 */
export async function getFavorites(ownerId) {
  const all = await db.all("audios");
  return all
    .filter(t => t.ownerId === ownerId && t.collectedBy === "me")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * 切换收藏
 */
export async function toggleFavorite(id) {
  const track = await db.get("audios", id);
  if (!track) return null;
  track.collectedBy = track.collectedBy === "me" ? null : "me";
  await db.put("audios", track);
  return track;
}

/* ========== 上传 ========== */

/**
 * 保存上传的音频 Blob
 */
export async function saveUploadedFile(blob, name, size) {
  const id = uid("file");
  await db.put("audio_files", { id, blob, name, size });
  return id;
}

/**
 * 读取上传的音频 Blob
 */
export async function getUploadedFile(blobId) {
  return db.get("audio_files", blobId);
}

/* ========== 播放 URL ========== */

/**
 * 获取可播放的 URL（外链直接用，上传的用 Blob URL）
 */
export async function getPlayableUrl(track) {
  if (!track) return "";
  if (track.source === "builtin" || track.source === "url") {
    return track.src || "";
  }
  if (track.source === "upload") {
    const file = await getUploadedFile(track.blobId);
    if (!file || !file.blob) return "";
    return URL.createObjectURL(file.blob);
  }
  return "";
}

/* ========== 外链解析 ========== */

/**
 * 解析外链行
 */
export function parseLinkLine(line, name, artist) {
  // 网易云 ID：纯数字 或 带 id= 的链接
  let neteaseId = "";
  if (/^\d+$/.test(line)) {
    neteaseId = line;
  } else {
    const m = line.match(/[?&]id=(\d+)/);
    if (m) neteaseId = m[1];
  }

  if (neteaseId) {
    return {
      name: name || `网易云 ${neteaseId}`,
      artist: artist || "未知",
      source: "url",
      neteaseId,
      src: `https://music.163.com/song/media/outer/url?id=${neteaseId}.mp3`,
    };
  }

  if (/^https?:\/\//i.test(line)) {
    const fallbackName = name || line.split("/").pop().split("?")[0] || "未命名";
    return {
      name: fallbackName,
      artist: artist || "未知",
      source: "url",
      src: line,
    };
  }
  return null;
}

/* ========== 内置曲目（首次导入） ========== */

export const BUILTIN_TRACKS = [
  {
    name: "碧海问舟",
    artist: "黄诗扶",
    src: "assets/seed/audio/builtin-01.mp3",
    source: "builtin",
  },
];
/**
 * 首次启动时导入内置曲目
 */
export async function importBuiltinTracks(ownerId) {
  const existing = await getAllTracks(ownerId);
  if (existing.length) return;

  for (const t of BUILTIN_TRACKS) {
    await addTrack(ownerId, t);
  }
}