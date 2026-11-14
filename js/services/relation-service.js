import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

const LEVELS_VERSION = 2;      // ← 就是这一行

/**
 * 获取某用户对某角色的关系状态
 */
export async function getRelation(ownerId, characterId) {
  const id = `rel_${ownerId}_${characterId}`;
  let rel = await db.get("relation_states", id);

  if (!rel) {
    rel = createDefaultRelation(id, ownerId, characterId);
    await db.put("relation_states", rel);
    return rel;
  }

  // 补全缺失字段（兼容旧数据）
  let changed = false;
  const defaults = createDefaultRelation(id, ownerId, characterId);
  for (const k of Object.keys(defaults)) {
    if (rel[k] === undefined) {
      rel[k] = defaults[k];
      changed = true;
    }
  }
  if (changed) await db.put("relation_states", rel);

  return rel;
}

function createDefaultRelation(id, ownerId, characterId) {
  return {
    id,
    ownerId,
    characterId,
    affection: 0,
    friendship: 0,
    affectionLevel: 0,
    friendshipLevel: 0,
    status: "陌路人",
    history: [],
    lastGiftAt: null,
    lastStoryAt: null,
    dailyChatCount: 0,
    chatDate: new Date().toISOString().slice(0, 10),
    lastChatAt: null,
    updatedAt: Date.now(),
  };
}

/**
 * 获取某角色的档位定义
 * 若版本号不匹配，自动重建
 */
export async function getRelationLevels(characterId) {
  const id = `level_${characterId}`;
  let levels = await db.get("relation_levels", id);

  // 不存在、结构不完整、版本过期 → 重建
  if (
    !levels ||
    !Array.isArray(levels.affectionLevels) ||
    levels.version !== LEVELS_VERSION
  ) {
    levels = createDefaultLevels(characterId);
    await db.put("relation_levels", levels);
  }
  return levels;
}

/**
 * 默认档位
 */
function createDefaultLevels(characterId) {
  return {
    id: `level_${characterId}`,
    characterId,
    version: LEVELS_VERSION,

    affectionLevels: [
      { level: 0, range: [0, 20],   name: "初见", subtitle: "陌上人如玉" },
      { level: 1, range: [21, 40],  name: "留意", subtitle: "偶尔入心" },
      { level: 2, range: [41, 60],  name: "动心", subtitle: "不觉心动" },
      { level: 3, range: [61, 80],  name: "情重", subtitle: "情深意重" },
      { level: 4, range: [81, 100], name: "唯一", subtitle: "此生唯一" },
    ],

    friendshipLevels: [
      { level: 0, range: [0, 20],   name: "萍水", subtitle: "萍水相逢" },
      { level: 1, range: [21, 40],  name: "熟识", subtitle: "略知一二" },
      { level: 2, range: [41, 60],  name: "交好", subtitle: "交情渐笃" },
      { level: 3, range: [61, 80],  name: "知交", subtitle: "知心之友" },
      { level: 4, range: [81, 100], name: "莫逆", subtitle: "生死莫逆" },
    ],

    statusMap: [
      { affectionMin: 0,  friendshipMin: 0,  status: "陌路人" },
      { affectionMin: 0,  friendshipMin: 40, status: "泛泛之交" },
      { affectionMin: 0,  friendshipMin: 80, status: "知己之交" },
      { affectionMin: 40, friendshipMin: 0,  status: "一厢情愿" },
      { affectionMin: 40, friendshipMin: 40, status: "情愫暗生" },
      { affectionMin: 80, friendshipMin: 80, status: "两心相许" },
    ],

    affectionTraits: {
      "初见": { tone: "客气疏离",       behavior: "保持分寸",     core: "他与你初识，尚在观望" },
      "留意": { tone: "语气微暖",       behavior: "愿意搭理",     core: "开始留意你" },
      "动心": { tone: "清冷中透着温柔", behavior: "记挂你",       core: "藏不住的心动" },
      "情重": { tone: "温柔克制",       behavior: "为你周全",     core: "把你放在心尖" },
      "唯一": { tone: "温柔缱绻",       behavior: "此生唯一",     core: "此生唯你一人" },
    },

    friendshipTraits: {
      "萍水": { tone: "客气疏离", behavior: "公事公办",     core: "点头之交" },
      "熟识": { tone: "平和",     behavior: "愿意聊两句",   core: "认得你" },
      "交好": { tone: "随意",     behavior: "主动搭话",     core: "有些交情" },
      "知交": { tone: "恳切",     behavior: "愿意交心",     core: "交心之友" },
      "莫逆": { tone: "赤诚",     behavior: "共进退",       core: "生死可托" },
    },

    perspective: "（他对你还没有特别的看法。）",
    updatedAt: Date.now(),
  };
}

/**
 * 计算档位
 */
export function calcLevel(value, levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    console.warn("[calcLevel] levels 无效:", levels);
    return { level: 0, name: "未知", range: [0, 0] };
  }
  for (const l of levels) {
    if (value >= l.range[0] && value <= l.range[1]) return l;
  }
  return levels[levels.length - 1];
}

/**
 * 计算关系状态
 */
export function calcStatus(affection, friendship, statusMap) {
  if (!Array.isArray(statusMap) || statusMap.length === 0) return "陌路人";
  let best = statusMap[0];
  for (const s of statusMap) {
    if (affection >= s.affectionMin && friendship >= s.friendshipMin) {
      best = s;
    }
  }
  return best.status;
}

/**
 * 更新关系状态（内部：重新算档位）
 */
async function refreshRelation(rel) {
  const levels = await getRelationLevels(rel.characterId);

  rel.affectionLevel = calcLevel(rel.affection, levels.affectionLevels).level;
  rel.friendshipLevel = calcLevel(rel.friendship, levels.friendshipLevels).level;
  rel.status = calcStatus(rel.affection, rel.friendship, levels.statusMap);
  rel.updatedAt = Date.now();

  await db.put("relation_states", rel);
  return rel;
}

/**
 * 增加好感度
 * @param {object} deltas { affection, friendship, type, note }
 */
export async function addRelation(ownerId, characterId, deltas) {
  const rel = await getRelation(ownerId, characterId);

  rel.affection = Math.min(100, Math.max(0, rel.affection + (deltas.affection || 0)));
  rel.friendship = Math.min(100, Math.max(0, rel.friendship + (deltas.friendship || 0)));

  rel.history.push({
    type: deltas.type || "manual",
    affectionDelta: deltas.affection || 0,
    friendshipDelta: deltas.friendship || 0,
    at: Date.now(),
    note: deltas.note || "",
  });

  if (rel.history.length > 200) {
    rel.history = rel.history.slice(-200);
  }

  return await refreshRelation(rel);
}

/**
 * 检查今日聊天次数
 */
export async function checkDailyChat(ownerId, characterId) {
  const rel = await getRelation(ownerId, characterId);
  const today = new Date().toISOString().slice(0, 10);

  if (rel.chatDate !== today) {
    rel.chatDate = today;
    rel.dailyChatCount = 0;
    await db.put("relation_states", rel);
  }

  return rel.dailyChatCount;
}

/**
 * 增加今日聊天次数
 */
export async function incDailyChat(ownerId, characterId) {
  const rel = await getRelation(ownerId, characterId);
  const today = new Date().toISOString().slice(0, 10);
  if (rel.chatDate !== today) {
    rel.chatDate = today;
    rel.dailyChatCount = 0;
  }
  rel.dailyChatCount += 1;
  rel.lastChatAt = Date.now();
  await db.put("relation_states", rel);
  return rel.dailyChatCount;
}

/**
 * 设置初始关系值（用于导入预设角色时）
 */
export async function setInitialRelation(ownerId, characterId, affection, friendship) {
  const rel = await getRelation(ownerId, characterId);

  rel.affection = Math.max(0, Math.min(100, affection));
  rel.friendship = Math.max(0, Math.min(100, friendship));

  return await refreshRelation(rel);
}