import { db } from "../core/db.js";
import { uid } from "../core/uid.js";
import { getAllCards } from "./card-service.js";
import { getEffectiveCardSettings } from "./chat-settings-service.js";

/* ============================================================
 * 常量
 * ============================================================ */

const REPLY_DELAY_HOURS = 12;
const REPLY_DELAY_MS = REPLY_DELAY_HOURS * 60 * 60 * 1000;

/* ============================================================
 * 读取
 * ============================================================ */

export async function getAllLetters(ownerId) {
  const all = await db.all("letters");
  return all
    .filter(l => l.ownerId === ownerId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getSentLetters(ownerId) {
  const all = await getAllLetters(ownerId);
  return all.filter(l => l.direction === "sent");
}

export async function getReceivedLetters(ownerId) {
  const all = await getAllLetters(ownerId);
  return all.filter(l => l.direction === "received");
}

export async function getLetter(id) {
  return db.get("letters", id);
}

export async function markLetterRead(id) {
  const letter = await db.get("letters", id);
  if (!letter || letter.isRead) return letter;
  letter.isRead = true;
  letter.readAt = Date.now();
  await db.put("letters", letter);
  return letter;
}

/* ============================================================
 * 写信
 * ============================================================ */

/**
 * 用户写信
 * @param {object} data { toId, toType: "character"|"npc", content }
 */
export async function sendLetter(ownerId, data) {
  const id = uid("letter");
  const letter = {
    id,
    ownerId,
    fromId: ownerId,
    fromType: "user",
    toId: data.toId,
    toType: data.toType || "character",
    direction: "sent",
    type: "user_write",
    content: (data.content || "").trim(),
    isRead: true,
    createdAt: Date.now(),
    replyExpectedAt: Date.now() + REPLY_DELAY_MS,
  };
  await db.put("letters", letter);
  return letter;
}

/* ============================================================
 * 回信
 * ============================================================ */

export async function checkPendingReplies(ownerId) {
  const all = await getAllLetters(ownerId);
  const now = Date.now();
  const created = [];

  const pending = all.filter(l =>
    l.direction === "sent" &&
    l.replyExpectedAt &&
    l.replyExpectedAt <= now &&
    !l.replied
  );

  for (const sent of pending) {
    const reply = await generateReply(ownerId, sent);
    if (reply) {
      sent.replied = true;
      await db.put("letters", sent);
      created.push(reply);
    }
  }

  return created;
}

/**
 * 生成回信（角色 / NPC）
 */
async function generateReply(ownerId, sentLetter) {
  const toType = sentLetter.toType || "character";

  let body, senderName;

  if (toType === "npc") {
    // NPC 回信
    const npc = await db.get("npc_relations", sentLetter.toId);
    if (!npc) return null;
    body = await generateLetterFromNpcCards(ownerId, sentLetter.toId);
    senderName = npc.name;
  } else {
    // 角色回信
    body = await generateLetterFromCards(ownerId, sentLetter.toId);
    const character = await db.get("characters", sentLetter.toId);
    senderName = character?.name || "他";
  }

  if (!body) return null;

  const user = await db.get("users", ownerId);
  const salutation = user?.nickname || user?.name || "君";

  const fullContent = [
    `${salutation} 敬启：`,
    "",
    body,
    "",
    `—— ${senderName} 谨启`,
  ].join("\n");

  const id = uid("letter");
  const reply = {
    id,
    ownerId,
    fromId: sentLetter.toId,
    fromType: toType,
    toId: ownerId,
    toType: "user",
    direction: "received",
    type: "reply",
    content: fullContent,
    isRead: false,
    createdAt: Date.now(),
  };
  await db.put("letters", reply);
  return reply;
}

/* ============================================================
 * 拼字卡
 * ============================================================ */

/**
 * 角色：书信字卡
 */
export async function generateLetterFromCards(ownerId, characterId) {
  const settings = await getEffectiveCardSettings(characterId, "letter");
  if (!settings.cardsEnabled) return null;
  if (!settings.cardGroupIds || settings.cardGroupIds.length === 0) return null;

  const allCards = await getAllCards(ownerId);
  const usable = allCards.filter(c =>
    settings.cardGroupIds.includes(c.groupId) && c.enabled !== false
  );
  if (!usable.length) return null;

  const thresholdRec = await db.get("settings", "short_threshold");
  const shortThreshold = thresholdRec?.value ?? 9;

  const shortCards = usable.filter(c => c.content.length <= shortThreshold);
  const longCards = usable.filter(c => c.content.length > shortThreshold);

  const min = settings.cardMin || 5;
  const max = Math.max(min, settings.cardMax || 14);
  const count = min + Math.floor(Math.random() * (max - min + 1));

  const picked = pickByMode(settings.cardMode, count, shortCards, longCards, usable);
  if (!picked.length) return null;

  return picked.map(c => c.content).join("");
}

/**
 * NPC：从「[友人] NPC名」分组抽卡
 */
export async function generateLetterFromNpcCards(ownerId, npcId) {
  const npc = await db.get("npc_relations", npcId);
  if (!npc || !npc.cardGroupId) return null;

  const allCards = await getAllCards(ownerId);
  const usable = allCards.filter(c =>
    c.groupId === npc.cardGroupId && c.enabled !== false
  );
  if (!usable.length) return null;

  const thresholdRec = await db.get("settings", "short_threshold");
  const shortThreshold = thresholdRec?.value ?? 9;

  const shortCards = usable.filter(c => c.content.length <= shortThreshold);
  const longCards = usable.filter(c => c.content.length > shortThreshold);

  const min = npc.cardMin || 5;
  const max = Math.max(min, npc.cardMax || 14);
  const count = min + Math.floor(Math.random() * (max - min + 1));

  const picked = pickByMode(npc.cardMode || "random", count, shortCards, longCards, usable);
  if (!picked.length) return null;

  return picked.map(c => c.content).join("");
}

function pickByMode(mode, count, shortCards, longCards, allCards) {
  const shuffled = arr => [...arr].sort(() => Math.random() - 0.5);
  const take = (arr, n) => shuffled(arr).slice(0, n);

  if (mode === "short") {
    if (!shortCards.length) return [];
    return take(shortCards, count);
  }
  if (mode === "long") {
    if (!longCards.length) return [];
    return take(longCards, count);
  }
  if (mode === "shortlong") {
    if (!shortCards.length || !longCards.length) return [];
    const half = Math.max(1, Math.floor(count / 2));
    return [
      ...take(shortCards, count - half),
      ...take(longCards, half),
    ];
  }
  return take(allCards, count);
}

/* ============================================================
 * 删除 / 筛选
 * ============================================================ */

export async function deleteLetter(id) {
  await db.del("letters", id);
}

export async function filterLetters(ownerId, opts = {}) {
  let letters = await getAllLetters(ownerId);

  const tab = opts.tab || "all";
  if (tab === "sent") letters = letters.filter(l => l.direction === "sent");
  if (tab === "received") letters = letters.filter(l => l.direction === "received");

  if (opts.characterId) {
    letters = letters.filter(l =>
      l.fromId === opts.characterId || l.toId === opts.characterId
    );
  }

  const dr = opts.dateRange;
  if (dr && dr.type && dr.type !== "all") {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let from = 0, to = Infinity;

    if (dr.type === "today") from = startOfToday;
    else if (dr.type === "yesterday") { from = startOfToday - 86400000; to = startOfToday; }
    else if (dr.type === "3days") from = startOfToday - 3 * 86400000;
    else if (dr.type === "month") from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    else if (dr.type === "custom") { from = dr.from || 0; to = dr.to || Infinity; }

    letters = letters.filter(l => l.createdAt >= from && l.createdAt < to);
  }

  letters.sort((a, b) => {
    const aUnread = a.direction === "received" && !a.isRead;
    const bUnread = b.direction === "received" && !b.isRead;
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return letters;
}

/* ============================================================
 * 印章
 * ============================================================ */

const SEAL_BY_DU = {
  "霜渡": "seal-shuang",
  "风渡": "seal-feng",
  "尘渡": "seal-chen",
};

export function getSealForCharacter(character) {
  if (!character) return "assets/seed/seal/seal-yin.png";
  const name = SEAL_BY_DU[character.du] || "seal-yin";
  return `assets/seed/seal/${name}.png`;
}

export function getSentSeal() {
  return "assets/seed/seal/seal-feng2.png";
}