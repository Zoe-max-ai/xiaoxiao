import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/* ============================================================
 * 游戏 CRUD
 * ============================================================ */

export async function getAllGames(ownerId) {
  const all = await db.all("games");
  return all
    .filter(g => g.ownerId === ownerId)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getGame(id) {
  return db.get("games", id);
}

export async function createGame(ownerId, data) {
  const id = uid("game");
  const game = {
    id,
    ownerId,
    title: (data.title || "").trim() || "未命名",
    description: (data.description || "").trim(),
    coverImageId: data.coverImageId || null,
    source: data.source || "manual",
    aiPrompt: data.aiPrompt || "",
    startNodeId: null,
    nodeCount: 0,
    chapterCount: 0,
    isCompleted: false,
    isFavorite: false,
    playCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put("games", game);

  // 自动创建「第一章」
  const firstChapter = await createChapter(id, "第一章");
  // 第一章下创建「开始」节点
  const startNode = await createNode(id, firstChapter.id, {
    title: "开始",
    content: "",
    choices: [],
  });

  game.startNodeId = startNode.id;
  game.chapterCount = 1;
  game.nodeCount = 1;
  await db.put("games", game);

  return game;
}

export async function updateGame(id, patch) {
  const game = await db.get("games", id);
  if (!game) return null;
  const updated = { ...game, ...patch, updatedAt: Date.now() };
  await db.put("games", updated);
  return updated;
}

export async function deleteGame(id) {
  // 删节点
  const nodes = await db.all("game_nodes");
  for (const n of nodes) {
    if (n.gameId === id) await db.del("game_nodes", n.id);
  }
  // 删章
  const chapters = await db.all("game_chapters");
  for (const c of chapters) {
    if (c.gameId === id) await db.del("game_chapters", c.id);
  }
  // 删存档
  const saves = await db.all("game_saves");
  for (const s of saves) {
    if (s.gameId === id) await db.del("game_saves", s.id);
  }
  // 删收藏
  const favs = await db.all("game_favorites");
  for (const f of favs) {
    if (f.gameId === id) await db.del("game_favorites", f.id);
  }
  await db.del("games", id);
}


/* ============================================================
 * 章节 CRUD
 * ============================================================ */

export async function getChaptersByGame(gameId) {
  const all = await db.all("game_chapters");
  return all
    .filter(c => c.gameId === gameId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getChapter(id) {
  return db.get("game_chapters", id);
}

export async function createChapter(gameId, title) {
  const chapters = await getChaptersByGame(gameId);
  const maxOrder = chapters.reduce((max, c) => Math.max(max, c.order || 0), 0);

  const id = uid("chp");
  const chapter = {
    id,
    gameId,
    title: title || `第${toCnNum(chapters.length + 1)}章`,
    order: maxOrder + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put("game_chapters", chapter);

  // 更新游戏 chapterCount
  const game = await db.get("games", gameId);
  if (game) {
    game.chapterCount = (game.chapterCount || 0) + 1;
    game.updatedAt = Date.now();
    await db.put("games", game);
  }

  return chapter;
}

export async function updateChapter(id, patch) {
  const chapter = await db.get("game_chapters", id);
  if (!chapter) return null;
  const updated = { ...chapter, ...patch, updatedAt: Date.now() };
  await db.put("game_chapters", updated);
  return updated;
}

export async function deleteChapter(id) {
  const chapter = await db.get("game_chapters", id);
  if (!chapter) return;

  // 检查是否是唯一章
  const chapters = await getChaptersByGame(chapter.gameId);
  if (chapters.length <= 1) return false;   // 至少保留一章

  // 删章节下的节点
  const nodes = await getNodesByGame(chapter.gameId);
  for (const n of nodes) {
    if (n.chapterId === id) {
      await deleteNode(n.id);
    }
  }

  await db.del("game_chapters", id);

  // 更新游戏 chapterCount
  const game = await db.get("games", chapter.gameId);
  if (game) {
    game.chapterCount = Math.max(1, (game.chapterCount || 1) - 1);
    game.updatedAt = Date.now();
    await db.put("games", game);
  }

  return true;
}

/* ============================================================
 * 节点 CRUD
 * ============================================================ */

export async function getNodesByGame(gameId) {
  const all = await db.all("game_nodes");
  return all
    .filter(n => n.gameId === gameId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getNodesByChapter(gameId, chapterId) {
  const all = await getNodesByGame(gameId);
  return all.filter(n => n.chapterId === chapterId);
}

export async function getNode(id) {
  return db.get("game_nodes", id);
}

export async function createNode(gameId, chapterId, data) {
  const nodes = await getNodesByChapter(gameId, chapterId);
  const maxOrder = nodes.reduce((max, n) => Math.max(max, n.order || 0), 0);

  const id = uid("node");
  const node = {
    id,
    gameId,
    chapterId,
    title: (data.title || "").trim() || "新节点",
    content: data.content || "",
    choices: data.choices || [],
    isEnding: data.isEnding || false,
    order: maxOrder + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put("game_nodes", node);

  const game = await db.get("games", gameId);
  if (game) {
    game.nodeCount = (game.nodeCount || 0) + 1;
    game.updatedAt = Date.now();
    await db.put("games", game);
  }

  return node;
}

export async function updateNode(id, patch) {
  const node = await db.get("game_nodes", id);
  if (!node) return null;
  const updated = { ...node, ...patch, updatedAt: Date.now() };
  await db.put("game_nodes", updated);

  const game = await db.get("games", node.gameId);
  if (game) {
    game.updatedAt = Date.now();
    await db.put("games", game);
  }

  return updated;
}

export async function deleteNode(id) {
  const node = await db.get("game_nodes", id);
  if (!node) return;

  const gameId = node.gameId;

  // 检查引用
  const nodes = await getNodesByGame(gameId);
  for (const n of nodes) {
    if (n.id === id) continue;
    let changed = false;
    for (const c of n.choices || []) {
      if (c.nextNodeId === id) {
        c.nextNodeId = null;
        changed = true;
      }
    }
    if (changed) await db.put("game_nodes", n);
  }

  await db.del("game_nodes", id);

  const game = await db.get("games", gameId);
  if (game) {
    game.nodeCount = Math.max(0, (game.nodeCount || 1) - 1);
    if (game.startNodeId === id) {
      game.startNodeId = null;
    }
    game.updatedAt = Date.now();
    await db.put("games", game);
  }
}

/* ============================================================
 * 完成 / 收藏
 * ============================================================ */

export async function completeGame(id) {
  return await updateGame(id, { isCompleted: true });
}

export async function uncompleteGame(id) {
  return await updateGame(id, { isCompleted: false });
}

export async function toggleFavorite(id) {
  const game = await db.get("games", id);
  if (!game) return null;
  game.isFavorite = !game.isFavorite;
  game.updatedAt = Date.now();
  await db.put("games", game);
  return game;
}

/* ============================================================
 * 存档
 * ============================================================ */


export async function getSave(id) {
  return db.get("game_saves", id);
}



/* ============================================================
 * 已完成游戏（供「游玩」Tab）
 * ============================================================ */

export async function getCompletedGames(ownerId) {
  const all = await db.all("games");
  return all
    .filter(g => g.ownerId === ownerId && g.isCompleted)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/* ============================================================
 * 收藏剧情
 * ============================================================ */

export async function addFavorite(ownerId, gameId, nodeId) {
  const id = `${ownerId}_${gameId}_${nodeId}`;
  const existing = await db.get("game_favorites", id);
  if (existing) return existing;

  const fav = {
    id,
    ownerId,
    gameId,
    nodeId,
    createdAt: Date.now(),
  };
  await db.put("game_favorites", fav);
  return fav;
}

export async function removeFavorite(ownerId, gameId, nodeId) {
  const id = `${ownerId}_${gameId}_${nodeId}`;
  await db.del("game_favorites", id);
}

export async function isFavorite(ownerId, gameId, nodeId) {
  const id = `${ownerId}_${gameId}_${nodeId}`;
  const fav = await db.get("game_favorites", id);
  return !!fav;
}

export async function getFavoritesByGame(ownerId, gameId) {
  const all = await db.all("game_favorites");
  return all
    .filter(f => f.ownerId === ownerId && f.gameId === gameId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* ============================================================
 * 存档（单槽：一个游戏一条）
 * ============================================================ */

export async function getSaveByGame(ownerId, gameId) {
  const all = await db.all("game_saves");
  return all.find(s => s.ownerId === ownerId && s.gameId === gameId) || null;
}

export async function saveGame(ownerId, gameId, data) {
  let save = await getSaveByGame(ownerId, gameId);

  if (save) {
    Object.assign(save, data, { updatedAt: Date.now() });
  } else {
    save = {
      id: uid("save"),
      ownerId,
      gameId,
      ...data,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  await db.put("game_saves", save);
  return save;
}

export async function deleteSaveByGame(ownerId, gameId) {
  const save = await getSaveByGame(ownerId, gameId);
  if (save) await db.del("game_saves", save.id);
}

function toCnNum(n) {
  const cn = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return cn[n];
  if (n < 20) return "十" + cn[n - 10];
  if (n === 20) return "二十";
  if (n < 30) return "二十" + cn[n - 20];
  if (n === 30) return "三十";
  return "三十" + cn[n - 30];
}