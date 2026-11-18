import { db, STORES } from "../core/db.js";
/* ========== 表分组 ========== */
export const DATA_GROUPS = [
  // ================= 归处 =================
  { id: "users",       name: "身份与档案",     tables: ["users", "profiles"],                                hasBlob: false },
  { id: "settings",    name: "系统与主题设置",  tables: ["settings", "theme_configs", "theme_overrides"],  hasBlob: false },
  { id: "worldBook",   name: "世界书设定",     tables: ["world_book"],                                    hasBlob: false },
  
  // ================= 雅集 =================
  { id: "characters",  name: "雅集（角色档案）", tables: ["characters"],                                     hasBlob: false },
  { id: "relations",   name: "雅集（羁绊与关系）",tables: ["relation_states", "relation_levels", "character_relations", "npc_relations"], hasBlob: false },
  { id: "inventory",   name: "藏品与礼物背包",  tables: ["inventory"],                                     hasBlob: false },
  // ================= 往事 =================
  { id: "stories",     name: "往事（文游全数据）", tables: ["games", "game_chapters", "game_nodes", "game_saves", "game_favorites"], hasBlob: false },
  // ================= 尘世 =================
  { id: "chats",       name: "尘世（聊天记录）", tables: ["chats", "messages"],                               hasBlob: false },
  { id: "actions",     name: "尘世（动作库）",   tables: ["actions"],                                         hasBlob: false },
  // ================= 探秘 =================
  { id: "cards",       name: "笺语（字卡）", tables: ["cards", "cardGroups"],                             hasBlob: false },
  { id: "posts",       name: "心绪（论坛）", tables: ["posts", "post_comments"],                          hasBlob: false },
  { id: "letters",     name: "尘世（书信往来）", tables: ["letters"],                                         hasBlob: false },
  { id: "audios",      name: "音律（音乐）", tables: ["audios", "audio_files"],                           hasBlob: true  },
  { id: "divinations", name: "抽签与问易",tables: ["divinations"],                                    hasBlob: false },
  { id: "books",       name: "书卷（图鉴文本）", tables: ["book_books", "book_categories", "book_chapters"], hasBlob: false },
  // ================= 全局资产 =================
  { id: "images",      name: "绘卷（全站图库）", tables: ["images"],                                          hasBlob: true  },
];
/* ========== 图片筛选 ========== */
const IMAGE_CATEGORIES_TO_SYNC = ["portrait", "avatar", "background", "game_cover", "illustration", "qavatar"];
function isImageToSync(record) {
  return IMAGE_CATEGORIES_TO_SYNC.includes(record.category);
}
/* ========== Blob ↔ Base64 ========== */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      resolve({ base64: dataUrl.split(",")[1], mime: blob.type, size: blob.size });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(base64, mime) {
  try {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mime });
  } catch (err) {
    console.error("[base64ToBlob] 解析失败", err);
    return null;
  }
}
/* ========== 序列化/反序列化 ========== */
async function serializeRecord(storeName, record) {
  const result = { ...record };
  if (storeName === "images") {
    if (record.origin?.data instanceof Blob) {
      const { base64, mime } = await blobToBase64(record.origin.data);
      result.origin = { ...record.origin, data: { __blob: true, base64, mime } };
    }
    if (record.thumb?.data instanceof Blob) {
      const { base64, mime } = await blobToBase64(record.thumb.data);
      result.thumb = { ...record.thumb, data: { __blob: true, base64, mime } };
    }
  }
  if (storeName === "audio_files") {
    if (record.blob instanceof Blob) {
      const { base64, mime } = await blobToBase64(record.blob);
      result.blob = { __blob: true, base64, mime };
    }
  }
  return result;
}
function deserializeRecord(storeName, record) {
  const result = { ...record };
  if (storeName === "images") {
    if (record.origin?.data?.__blob) {
      const { base64, mime } = record.origin.data;
      const blob = base64ToBlob(base64, mime);
      if (blob) result.origin = { ...record.origin, data: blob };
    }
    if (record.thumb?.data?.__blob) {
      const { base64, mime } = record.thumb.data;
      const blob = base64ToBlob(base64, mime);
      if (blob) result.thumb = { ...record.thumb, data: blob };
    }
  }
  if (storeName === "audio_files") {
    if (record.blob?.__blob) {
      const { base64, mime } = record.blob;
      const blob = base64ToBlob(base64, mime);
      if (blob) result.blob = blob;
    }
  }
  return result;
}
/* ========== 导出 ========== */
export async function exportData(groupIds, includeBlob = false) {
  const groups = DATA_GROUPS.filter(g => groupIds.includes(g.id));
  const result = {
    version: 1,
    exportedAt: Date.now(),
    includeBlob,
    groups: {},
    localStorageData: {},
  };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key.includes("chenshi_daily") ||
      key.includes("wangshi_cover") ||
      key.includes("tanmi_cover") ||
      key.startsWith("book_img_") ||
      key.startsWith("solo_qavatar") ||
      key.startsWith("forum_") ||
      key.startsWith("daily_gift_")
    ) {
      result.localStorageData[key] = localStorage.getItem(key);
    }
  }
  for (const group of groups) {
    const groupData = {};
    for (const table of group.tables) {
      if (!STORES[table]) continue;
      try {
        let records = await db.all(table);
        if (table === "images") {
          records = records.filter(isImageToSync);
        }
        if (group.hasBlob && includeBlob) {
          const serialized = [];
          for (const r of records) {
            serialized.push(await serializeRecord(table, r));
          }
          groupData[table] = serialized;
        } else if (group.hasBlob && !includeBlob) {
          const stripped = records.map(r => {
            const copy = { ...r };
            if (table === "images") {
              if (copy.origin) copy.origin = { ...copy.origin, data: null };
              if (copy.thumb) copy.thumb = { ...copy.thumb, data: null };
            }
            if (table === "audio_files") {
              copy.blob = null;
            }
            return copy;
          });
          groupData[table] = stripped;
        } else {
          groupData[table] = records;
        }
      } catch (err) {
        console.warn(`[导出] 忽略读取失败的表: ${table}`, err);
      }
    }
    result.groups[group.id] = groupData;
  }
  return result;
}
/* ========== 导入【修复主键判断、rename、异常捕获】 ========== */
export async function importData(data, groupIds, conflictMode = "skip") {
  const groups = DATA_GROUPS.filter(g => groupIds.includes(g.id));
  const stats = { imported: 0, skipped: 0, overwritten: 0 };
  // 标记localStorage是否导入，这里先不自动覆盖，后面UI再加开关
  const importLocalStorage = !!data.localStorageData;

  for (const group of groups) {
    const groupData = data.groups?.[group.id];
    if (!groupData) continue;
    for (const table of group.tables) {
      if (!STORES[table]) continue;
      const records = groupData[table];
      if (!Array.isArray(records)) continue;
      for (const rawRecord of records) {
        try {
          const record = deserializeRecord(table, rawRecord);
          if (table === "images" && !isImageToSync(record)) continue;

          // 兼容两种主键：id / key
          const primaryKey = record.id !== undefined ? record.id : record.key;
          const existing = primaryKey != null ? await db.get(table, primaryKey) : null;

          if (existing) {
            if (conflictMode === "skip") {
              stats.skipped++;
              continue;
            } else if (conflictMode === "overwrite") {
              await db.put(table, record);
              stats.overwritten++;
            } else if (conflictMode === "rename") {
              // 修复undefined id，增加随机串防止重复
              const rand = Math.random().toString(36).slice(2, 6);
              if (record.id !== undefined) {
                record.id = `${record.id}_imported_${Date.now().toString(36)}_${rand}`;
              } else if (record.key !== undefined) {
                record.key = `${record.key}_imported_${Date.now().toString(36)}_${rand}`;
              } else {
                // 没有主键，直接新增，不冲突
                await db.put(table, record);
                stats.imported++;
                continue;
              }
              await db.put(table, record);
              stats.imported++;
            }
          } else {
            await db.put(table, record);
            stats.imported++;
          }
        } catch (err) {
          console.error(`[导入] 单条记录失败 table=${table}`, err);
          // 单条失败不阻断整个导入流程
        }
      }
    }
  }
  // 如果你想要自动恢复localStorage，解开下面注释；推荐后面UI加开关控制
  /*
  if (importLocalStorage) {
    for (const [key, value] of Object.entries(data.localStorageData)) {
      localStorage.setItem(key, value);
    }
  }
  */
  return stats;
}
/* ========== 清除 ========== */
export async function clearData(groupIds) {
  const groups = DATA_GROUPS.filter(g => groupIds.includes(g.id));
  let cleared = 0;
  const { STORES } = await import("../core/db.js");
  const validTables = Object.keys(STORES);
  for (const group of groups) {
    for (const table of group.tables) {
      if (!validTables.includes(table)) continue;
      if (table === "settings") {
        const all = await db.all("settings");
        for (const r of all) {
          if (["init", "theme", "font_settings", "chat_settings", "seed_imported", "short_threshold", "ai_config"].includes(r.key)) {
            continue;
          }
          await db.del("settings", r.key);
          cleared++;
        }
      } else {
        const all = await db.all(table);
        for (const r of all) {
          const key = r.id !== undefined ? r.id : r.key;
          await db.del(table, key);
          cleared++;
        }
      }
    }
  }
  return cleared;
}
/* ========== 存储空间估算【修复字节统计】 ========== */
export async function estimateStorage() {
  const stats = [];
  const encoder = new TextEncoder();
  for (const group of DATA_GROUPS) {
    let count = 0;
    let bytes = 0;
    for (const table of group.tables) {
      let records = [];
      try {
        records = await db.all(table);
      } catch (e) {
        continue;
      }
      count += records.length;
      for (const r of records) {
        try {
          // 单独提取Blob大小
          let blobSize = 0;
          const replacer = (k, v) => {
            if (v instanceof Blob) {
              blobSize += v.size;
              return `__blob__`;
            }
            return v;
          };
          const jsonStr = JSON.stringify(r, replacer);
          // TextEncoder 得到真实UTF-8字节数，不再是UTF16字符长度
          const strBytes = encoder.encode(jsonStr).byteLength;
          bytes += strBytes + blobSize;
        } catch (e) {
          console.warn("[estimateStorage] 序列化单条记录失败", e);
        }
      }
    }
    stats.push({ id: group.id, name: group.name, count, bytes });
  }
  return stats;
}
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    return navigator.storage.estimate();
  }
  return { usage: 0, quota: 0 };
}
