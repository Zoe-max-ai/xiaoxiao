import { db } from "../core/db.js";
import { uid } from "../core/uid.js";
import { createGroup, deleteGroup } from "./card-service.js";

/* ============================================================
 * 主角之间的关系（character_relations）
 * ============================================================ */

export async function getCharacterRelations(ownerId, charId) {
  const all = await db.all("character_relations");
  return all.filter(r =>
    r.ownerId === ownerId &&
    (r.fromId === charId || r.toId === charId)
  );
}

export async function createCharacterRelation(ownerId, fromId, toId, relation, description = "") {
  const id = uid("crel");
  const rel = {
    id,
    ownerId,
    fromId,
    toId,
    relation: (relation || "").trim(),
    description: (description || "").trim(),
    createdAt: Date.now(),
  };
  await db.put("character_relations", rel);
  return rel;
}

export async function updateCharacterRelation(id, patch) {
  const rel = await db.get("character_relations", id);
  if (!rel) return null;
  const updated = { ...rel, ...patch, updatedAt: Date.now() };
  await db.put("character_relations", updated);
  return updated;
}

export async function deleteCharacterRelation(id) {
  await db.del("character_relations", id);
}

/* ============================================================
 * NPC（npc_relations）
 * ============================================================ */

export async function getNpcsByCharacter(ownerId, charId) {
  const all = await db.all("npc_relations");
  return all.filter(n =>
    n.ownerId === ownerId &&
    (n.linkedCharacterIds || []).includes(charId)
  );
}

export async function getNpc(id) {
  return db.get("npc_relations", id);
}

export async function createNpc(ownerId, data) {
  const id = uid("npc");
  const name = (data.name || "").trim() || "无名";

  // 建「[友人] NPC名」分组（名字前缀，与现有逻辑一致）
  const group = await createGroup(ownerId, `[友人] ${name}`, null);

  const npc = {
    id,
    ownerId,
    linkedCharacterIds: data.linkedCharacterIds || [],
    name,
    avatarId: data.avatarId || null,
    relation: (data.relation || "").trim(),
    description: (data.description || "").trim(),
    requiredFriendship: data.requiredFriendship ?? 40,
    isFriend: false,
    friendAt: null,
    cardGroupId: group.id,
    cardMode: "random",
    cardMin: 2,
    cardMax: 5,
    createdAt: Date.now(),
  };
  await db.put("npc_relations", npc);
  return npc;
}

export async function updateNpc(id, patch) {
  const npc = await db.get("npc_relations", id);
  if (!npc) return null;
  const updated = { ...npc, ...patch, updatedAt: Date.now() };
  await db.put("npc_relations", updated);
  return updated;
}

export async function deleteNpc(id) {
  const npc = await db.get("npc_relations", id);
  if (!npc) return;

  // 删对应的字卡分组（连带分组下的卡）
  if (npc.cardGroupId) {
    try {
      await deleteGroup(npc.cardGroupId);
    } catch (e) {
      console.warn("[npc] 删除字卡分组失败:", e);
    }
  }

  await db.del("npc_relations", id);
}

/* ============================================================
 * 加好友
 * ============================================================ */

export async function canAddFriend(npc, ownerId) {
  if (!npc.linkedCharacterIds?.length) return false;

  const states = await db.all("relation_states");
  for (const charId of npc.linkedCharacterIds) {
    const rel = states.find(s => s.ownerId === ownerId && s.characterId === charId);
    if (rel && rel.friendship >= (npc.requiredFriendship || 40)) {
      return true;
    }
  }
  return false;
}

export async function addFriend(npcId) {
  return await updateNpc(npcId, {
    isFriend: true,
    friendAt: Date.now(),
  });
}

export async function removeFriend(npcId) {
  return await updateNpc(npcId, {
    isFriend: false,
    friendAt: null,
  });
}

export async function getFriendNpcs(ownerId) {
  const all = await db.all("npc_relations");
  return all
    .filter(n => n.ownerId === ownerId && n.isFriend)
    .sort((a, b) => (b.friendAt || 0) - (a.friendAt || 0));
}

export async function getNonFriendNpcs(ownerId) {
  const all = await db.all("npc_relations");
  return all
    .filter(n => n.ownerId === ownerId && !n.isFriend)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* ============================================================
 * 默认头像
 * ============================================================ */

export function getDefaultAvatarHtml(name, size = 40) {
  const initial = (name || "?").charAt(0);
  return `<div style="
    width:${size}px;height:${size}px;
    background:#b8b0a0;
    color:#fff;
    display:flex;align-items:center;justify-content:center;
    font-family:var(--font-title);
    font-size:${Math.round(size * 0.5)}px;
    border-radius:50%;
  ">${escapeHtml(initial)}</div>`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}