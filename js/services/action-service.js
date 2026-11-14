import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/**
 * 获取用户的全部动作
 */
export async function getAllActions(ownerId) {
  const all = await db.all("actions");
  return all
    .filter(a => a.ownerId === ownerId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * 新建动作
 */
export async function createAction(ownerId, { name, content, scope, charId }) {
  const id = uid("act");
  const action = {
    id,
    ownerId,
    name: (name || "").trim(),
    content: (content || "").trim(),
    scope: scope || "global", // 👈 新增：记录是全局还是角色
    charId: charId || null,   // 👈 新增：记录是哪个角色的动作
    createdAt: Date.now(),
  };
  await db.put("actions", action);
  return action;
}

/**
 * 更新动作
 */
export async function updateAction(id, patch) {
  const action = await db.get("actions", id);
  if (!action) return null;
  const updated = { ...action, ...patch, updatedAt: Date.now() };
  await db.put("actions", updated);
  return updated;
}

/**
 * 删除动作
 */
export async function deleteAction(id) {
  await db.del("actions", id);
}