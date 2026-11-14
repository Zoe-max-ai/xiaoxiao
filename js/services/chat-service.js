import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/* ============================================================
 * 单聊（角色）
 * ============================================================ */
export async function getOrCreateChat(ownerId, characterId) {
  const chats = await db.all("chats");
  const existing = chats.find(c =>
    c.ownerId === ownerId &&
    c.type === "single" &&
    c.characterId === characterId
  );
  if (existing) return existing;

  const chat = {
    id: uid("chat"),
    ownerId,
    type: "single",
    characterId,
    npcId: null,
    lastMessageAt: Date.now(),
    lastMessageText: "",
    lastMessageFrom: null,
    createdAt: Date.now(),
  };
  await db.put("chats", chat);
  return chat;
}

/* ============================================================
 * 单聊（NPC）
 * ============================================================ */
export async function getOrCreateNpcChat(ownerId, npcId) {
  const chats = await db.all("chats");
  const existing = chats.find(c =>
    c.ownerId === ownerId &&
    c.type === "single" &&
    c.npcId === npcId
  );
  if (existing) return existing;

  const chat = {
    id: uid("chat"),
    ownerId,
    type: "single",
    characterId: null,
    npcId,
    lastMessageAt: Date.now(),
    lastMessageText: "",
    lastMessageFrom: null,
    createdAt: Date.now(),
  };
  await db.put("chats", chat);
  return chat;
}

/* ============================================================
 * 群聊
 * ============================================================ */
export async function createGroupChat(ownerId, { name, members }) {
  const id = uid("chat");
  const chat = {
    id,
    ownerId,
    type: "group",
    name: (name || "").trim() || "群聊",
    members: members || [],
    avatarId: null,
    lastMessageAt: Date.now(),
    lastMessageText: "",
    lastMessageFrom: null,
    createdAt: Date.now(),
  };
  await db.put("chats", chat);
  return chat;
}

export async function updateGroupChat(chatId, patch) {
  const chat = await db.get("chats", chatId);
  if (!chat || chat.type !== "group") return null;
  const updated = { ...chat, ...patch, updatedAt: Date.now() };
  await db.put("chats", updated);
  return updated;
}

/* ============================================================
 * 通用
 * ============================================================ */
export async function getChat(chatId) {
  return db.get("chats", chatId);
}

/**
 * 获取消息（分页）
 * @param {string} chatId
 * @param {object} opts { before, limit }
 *   before: 时间戳（只取 < before 的）——用于加载更多
 *   limit: 条数（默认 50）
 * @returns {Array} 消息列表（按时间正序）
 */
export async function getMessages(chatId, opts = {}) {
  const all = await db.all("messages");
  let list = all
    .filter(m => m.chatId === chatId)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (opts.before) {
    list = list.filter(m => m.createdAt < opts.before);
  }

  const limit = opts.limit ?? 50;
  // 取最后 limit 条
  return list.slice(-limit);
}

/**
 * 获取消息总数
 */
export async function getMessageCount(chatId) {
  const all = await db.all("messages");
  return all.filter(m => m.chatId === chatId).length;
}

export async function addMessage(chatId, ownerId, data) {
  const msg = {
    id: uid("msg"),
    chatId,
    ownerId,
    fromId: data.fromId,
    fromType: data.fromType,
    content: data.content,
    contentType: data.contentType || "text",
    imageData: data.imageData || null,  
    mode: data.mode || "card",
    quote: data.quote || null,   // 引用：{ msgId, fromName, content }
    createdAt: Date.now(),
  };
  await db.put("messages", msg);

  const chat = await db.get("chats", chatId);
  if (chat) {
    chat.lastMessageAt = msg.createdAt;
    chat.lastMessageText = msg.content;
    chat.lastMessageFrom = msg.fromId;
    await db.put("chats", chat);
  }

  return msg;
}

/**
 * 撤回消息（短时间内）
 */
export async function recallMessage(msgId) {
  const msg = await db.get("messages", msgId);
  if (!msg) return null;
  msg.revoked = true;
  msg.revokedAt = Date.now();
  await db.put("messages", msg);
  return msg;
}

/**
 * 删除消息（长时间后）
 */
export async function deleteMessage(msgId) {
  await db.del("messages", msgId);
}

/* ============================================================
 * 抽卡
 * ============================================================ */
export async function drawCard(ownerId, characterId) {
  const character = await db.get("characters", characterId);
  if (!character) return null;
  const enabledGroupIds = character.enabledGroupIds || [];
  if (!enabledGroupIds.length) return null;

  const allCards = await db.all("cards");
  const pool = allCards.filter(c =>
    c.ownerId === ownerId &&
    enabledGroupIds.includes(c.groupId) &&
    c.enabled !== false
  );
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function drawNpcCard(ownerId, npcId) {
  const npc = await db.get("npc_relations", npcId);
  if (!npc || !npc.cardGroupId) return null;

  const allCards = await db.all("cards");
  const pool = allCards.filter(c =>
    c.ownerId === ownerId &&
    c.groupId === npc.cardGroupId &&
    c.enabled !== false
  );
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function drawCardByMember(ownerId, member) {
  if (member.type === "npc") {
    return await drawNpcCard(ownerId, member.id);
  }
  return await drawCard(ownerId, member.id);
}

/* ============================================================
 * 列表 / 删除 / 清空
 * ============================================================ */
export async function getChatsByOwner(ownerId) {
  const all = await db.all("chats");
  return all
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
}

export async function deleteChat(chatId) {
  const all = await db.all("messages");
  for (const m of all) {
    if (m.chatId === chatId) await db.del("messages", m.id);
  }
  await db.del("chats", chatId);
}

export async function clearChat(chatId) {
  const all = await db.all("messages");
  for (const m of all) {
    if (m.chatId === chatId) await db.del("messages", m.id);
  }
  const chat = await db.get("chats", chatId);
  if (chat) {
    chat.lastMessageText = "";
    chat.lastMessageAt = Date.now();
    await db.put("chats", chat);
  }
}