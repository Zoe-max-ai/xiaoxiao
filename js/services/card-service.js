import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/* ========== 分组 ========== */

export async function getGroups(ownerId) {
  const all = await db.all("cardGroups");
  return all
    .filter(g => g.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createGroup(ownerId, name, parentId = null) {
  const id = uid("g");
  const group = {
    id,
    ownerId,
    name,
    parentId,
    isAll: false,
    createdAt: Date.now(),
  };
  await db.put("cardGroups", group);
  return group;
}

export async function deleteGroup(groupId) {
  // 删除分组下的所有卡片
  const cards = await db.all("cards");
  const toDelete = cards.filter(c => c.groupId === groupId);
  for (const c of toDelete) {
    await db.del("cards", c.id);
  }
  // 删除分组
  await db.del("cardGroups", groupId);
}

/* ========== 笺语 ========== */

export async function getAllCards(ownerId) {
  const all = await db.all("cards");
  return all
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getCard(id) {
  return db.get("cards", id);
}

export async function createCard(ownerId, data) {
  const id = uid("card");
  const card = {
    id,
    ownerId,
    groupId: data.groupId || null,
    content: data.content || "",
    triggers: data.triggers || [],
    tags: data.tags || [],
    weight: data.weight ?? 1,
    nameBonus: data.nameBonus ?? 0,
    intimacyLevel: data.intimacyLevel ?? 1,
    source: data.source || "system",
    enabled: data.enabled !== false,
    useCount: 0,
    lastUsedAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put("cards", card);
  return card;
}

export async function updateCard(id, patch) {
  const card = await db.get("cards", id);
  if (!card) return null;
  const updated = { ...card, ...patch, updatedAt: Date.now() };
  await db.put("cards", updated);
  return updated;
}

export async function deleteCard(id) {
  await db.del("cards", id);
}

export async function batchDeleteCards(ids) {
  for (const id of ids) {
    await db.del("cards", id);
  }
}

export async function batchMoveCards(ids, groupId) {
  for (const id of ids) {
    const card = await db.get("cards", id);
    if (card) {
      card.groupId = groupId;
      card.updatedAt = Date.now();
      await db.put("cards", card);
    }
  }
}

export async function batchToggleCards(ids, enabled) {
  for (const id of ids) {
    const card = await db.get("cards", id);
    if (card) {
      card.enabled = enabled;
      card.updatedAt = Date.now();
      await db.put("cards", card);
    }
  }
}

/* ========== 导入/导出 ========== */

export async function exportCards(ownerId, groupIds) {
  const groups = (await getGroups(ownerId)).filter(g => groupIds.includes(g.id));
  const cards = (await getAllCards(ownerId)).filter(c => groupIds.includes(c.groupId));
  return { groups, cards };
}

export async function importCards(ownerId, data, mode = "append") {
  // mode: "append" | "overwrite"
  if (mode === "overwrite") {
    // 清空现有
    const oldCards = await getAllCards(ownerId);
    for (const c of oldCards) await db.del("cards", c.id);
    const oldGroups = await getGroups(ownerId);
    for (const g of oldGroups) await db.del("cardGroups", g.id);
  }

  // 按 name 复用现有分组
  const existingGroups = await getGroups(ownerId);
  const nameToId = {};
  existingGroups.forEach(g => { nameToId[g.name] = g.id; });

  // 导入分组
  const gidMap = {};
  for (const g of (data.groups || [])) {
    if (nameToId[g.name]) {
      gidMap[g.id] = nameToId[g.name];
    } else {
      const newG = await createGroup(ownerId, g.name);
      gidMap[g.id] = newG.id;
      nameToId[g.name] = newG.id;
    }
  }

  // 导入笺语（去重）
  const existingCards = await getAllCards(ownerId);
  const existingContents = new Set(existingCards.map(c => normalize(c.content)));

  let added = 0;
  let skipped = 0;

  for (const c of (data.cards || [])) {
    const key = normalize(c.content);
    if (existingContents.has(key)) {
      skipped++;
      continue;
    }
    existingContents.add(key);

    await createCard(ownerId, {
      groupId: gidMap[c.groupId] || null,
      content: c.content,
      triggers: c.triggers || [],
      tags: c.tags || [],
      weight: c.weight ?? 1,
      nameBonus: c.nameBonus ?? 0,
      intimacyLevel: c.intimacyLevel ?? 1,
      source: c.source || "import",
      enabled: c.enabled !== false,
    });
    added++;
  }

  return { added, skipped };
}

function normalize(str) {
  return (str || "").trim().toLowerCase();
}

/**
 * 拾起：把一段内容存进字卡库
 */
export async function pickToCard(ownerId, { content, groupId }) {
  if (!content || !content.trim()) return null;
  return await createCard(ownerId, {
    content: content.trim(),
    groupId: groupId || null,
    source: "picked",
    enabled: true,
  });
}