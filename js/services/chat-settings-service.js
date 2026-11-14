import { db } from "../core/db.js";

const DEFAULT_CHAT_SETTINGS = {
  replyMin: 1,
  replyMax: 3,
  intervalMin: 5,
  intervalMax: 30,
  proactive: false,
  proactiveMin: 30,
  proactiveMax: 120,
  recall: true,
  recallProbability: 5,
  timestamps: false,
  actionProbability: 20, 
typewriter: false,
readReceipt: false, 
};

/* ===== 拼字卡默认值（聊天 / 心绪）===== */
const DEFAULT_CARD_SETTINGS = {
  aiEnabled: false,
  cardsEnabled: true,
  cardGroupIds: [],
  cardMode: "random",      // random | short | shortlong | long
  cardMin: 2,
  cardMax: 5,
};

/* ===== 拼字卡默认值（书信，条数更多）===== */
const DEFAULT_LETTER_SETTINGS = {
  aiEnabled: false,
  cardsEnabled: true,
  cardGroupIds: [],
  cardMode: "random",
  cardMin: 5,
  cardMax: 14,
};

const DEFAULT_SHORT_THRESHOLD = 9;

/**
 * 获取全局聊天设置
 */
export async function getGlobalChatSettings() {
  const record = await db.get("settings", "chat_settings");
  return record?.value || { ...DEFAULT_CHAT_SETTINGS };
}

/**
 * 保存全局聊天设置
 */
export async function saveGlobalChatSettings(value) {
  await db.put("settings", { key: "chat_settings", value });
}

/**
 * 获取某个角色的聊天设置
 */
export async function getCharacterChatSettings(characterId) {
  const character = await db.get("characters", characterId);
  if (!character) return null;

  const chat = {
    ...DEFAULT_CARD_SETTINGS,
    ...(character.chatCards || {}),
    cardGroupIds: character.chatCards?.cardGroupIds
      || character.enabledGroupIds
      || [],
  };
  const post = {
    ...DEFAULT_CARD_SETTINGS,
    ...(character.postCards || {}),
  };
  const letter = {
    ...DEFAULT_LETTER_SETTINGS,
    ...(character.letterCards || {}),
  };

  return {
    inheritGlobal: character.inheritGlobalChat !== false,
    settings: character.chatSettings || {},
    enabledGroupIds: character.enabledGroupIds || [],
    chat,
    post,
    letter,
    shortThreshold: character.shortThreshold ?? DEFAULT_SHORT_THRESHOLD,
  };
}

/**
 * 保存某个角色的聊天设置
 */
export async function saveCharacterChatSettings(characterId, patch) {
  const character = await db.get("characters", characterId);
  if (!character) return null;

  const updated = {
    ...character,
    inheritGlobalChat: patch.inheritGlobal !== undefined ? patch.inheritGlobal : character.inheritGlobalChat,
    chatSettings: patch.settings !== undefined ? patch.settings : character.chatSettings,
    chatCards: patch.chat !== undefined ? patch.chat : character.chatCards,
    postCards: patch.post !== undefined ? patch.post : character.postCards,
    letterCards: patch.letter !== undefined ? patch.letter : character.letterCards,
    shortThreshold: patch.shortThreshold !== undefined ? patch.shortThreshold : character.shortThreshold,
    enabledGroupIds: patch.chat?.cardGroupIds
      || (patch.enabledGroupIds !== undefined ? patch.enabledGroupIds : character.enabledGroupIds),
    updatedAt: Date.now(),
  };

  await db.put("characters", updated);
  return updated;
}

/**
 * 计算最终生效的设置（合并全局 + 分角色）
 */
export async function getEffectiveChatSettings(characterId) {
  const global = await getGlobalChatSettings();
  const character = await db.get("characters", characterId);
  if (!character) return global;

  if (character.inheritGlobalChat !== false) {
    return global;
  }
  return { ...global, ...(character.chatSettings || {}) };
}

/**
 * 获取拼字卡设置（供聊天 / 心绪 / 书信共用）
 */
export async function getEffectiveCardSettings(characterId, kind = "chat") {
  const char = await db.get("characters", characterId);
  if (!char) {
    if (kind === "letter") return { ...DEFAULT_LETTER_SETTINGS };
    return { ...DEFAULT_CARD_SETTINGS };
  }

  let key, defaults;
  if (kind === "post") {
    key = "postCards";
    defaults = DEFAULT_CARD_SETTINGS;
  } else if (kind === "letter") {
    key = "letterCards";
    defaults = DEFAULT_LETTER_SETTINGS;
  } else {
    key = "chatCards";
    defaults = DEFAULT_CARD_SETTINGS;
  }

  const settings = char[key] || {};
  const merged = { ...defaults, ...settings };

  // 兼容旧的 enabledGroupIds
  if (kind === "chat" && (!merged.cardGroupIds || merged.cardGroupIds.length === 0)) {
    merged.cardGroupIds = char.enabledGroupIds || [];
  }

  return merged;
}

/**
 * 获取短句阈值（共用）
 */
export async function getShortThreshold() {
  const record = await db.get("settings", "short_threshold");
  return record?.value ?? DEFAULT_SHORT_THRESHOLD;
}

export async function saveShortThreshold(value) {
  await db.put("settings", { key: "short_threshold", value });
}