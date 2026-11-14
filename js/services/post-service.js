import { db } from "../core/db.js";
import { uid } from "../core/uid.js";
import { getAllCards } from "./card-service.js";
import { getRelationLevels, getRelation } from "./relation-service.js";
import { getEffectiveCardSettings } from "./chat-settings-service.js";

/* ============================================================
 * 帖子 CRUD
 * ============================================================ */

export async function getAllPosts(ownerId) {
  const all = await db.all("posts");
  return all
    .filter(p => p.ownerId === ownerId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getMyPosts(ownerId) {
  const all = await getAllPosts(ownerId);
  return all.filter(p => p.authorType === "user" && p.authorId === ownerId);
}

export async function getFavoritePosts(ownerId) {
  const all = await getAllPosts(ownerId);
  return all.filter(p => p.isFavorite);
}

export async function getPost(id) {
  return db.get("posts", id);
}

export async function createPost(ownerId, data) {
  const id = uid("post");
  const post = {
    id,
    ownerId,
    authorId: data.authorId,
    authorType: data.authorType || "user",
    title: (data.title || "").trim(),
    content: (data.content || "").trim(),
    likedBy: [],
    likes: 0,
    isFavorite: false,
    commentCount: 0,
    createdAt: Date.now(),
    isAnonymous: data.isAnonymous || false, // 👈 新增：是否匿名
  };
  await db.put("posts", post);
  return post;
}

export async function updatePost(id, patch) {
  const post = await db.get("posts", id);
  if (!post) return null;
  const updated = { ...post, ...patch, updatedAt: Date.now() };
  await db.put("posts", updated);
  return updated;
}

export async function deletePost(id) {
  const comments = await db.all("post_comments");
  for (const c of comments) {
    if (c.postId === id) await db.del("post_comments", c.id);
  }
  await db.del("posts", id);
}

/* ============================================================
 * 点赞
 * ============================================================ */

export async function toggleLike(postId, userId) {
  const post = await db.get("posts", postId);
  if (!post) return null;

  const likedBy = post.likedBy || [];
  const idx = likedBy.indexOf(userId);
  if (idx >= 0) {
    likedBy.splice(idx, 1);
  } else {
    likedBy.push(userId);
  }

  post.likedBy = likedBy;
  post.likes = likedBy.length;
  await db.put("posts", post);
  return post;
}

/* ============================================================
 * 评论
 * ============================================================ */

export async function getComments(postId) {
  const all = await db.all("post_comments");
  return all
    .filter(c => c.postId === postId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function addComment(postId, ownerId, data) {
  const id = uid("cmt");
  const comment = {
    id,
    postId,
    ownerId,
    authorId: data.authorId,
    authorType: data.authorType || "user",
    content: (data.content || "").trim(),
    createdAt: Date.now(),
    replyTo: data.replyTo || null, // 👈 新增：回复哪条评论的ID
  };
  await db.put("post_comments", comment);

  const post = await db.get("posts", postId);
  if (post) {
    post.commentCount = (post.commentCount || 0) + 1;
    await db.put("posts", post);
  }

  return comment;
}

/* ============================================================
 * 江湖热帖
 * ============================================================ */

export async function getHotPosts(ownerId, limit = 3) {
  const all = await getAllPosts(ownerId);
  const candidates = all.filter(p => (p.commentCount || 0) > 0 || (p.likes || 0) > 0);
  candidates.sort((a, b) => {
    const scoreA = (a.commentCount || 0) * 2 + (a.likes || 0);
    const scoreB = (b.commentCount || 0) * 2 + (b.likes || 0);
    return scoreB - scoreA;
  });
  return candidates.slice(0, limit);
}


/* ============================================================
 * 角色 / NPC 自动发帖
 * ============================================================ */

const AUTO_POST_INTERVAL_DAYS = 3;

/**
 * 检查并触发「角色 + NPC」自动发帖
 */
export async function checkAutoPosts(ownerId) {
  const created = [];

  // (如果是原版CD逻辑，不需要加这句。但为了保险起见)
  // 其实这里不需要拦截，因为只要拦截了上面第四步的互动，发帖本身不影响。
  // 如果想要关闭 AI 时刷新也不主动发帖，加上这句：
  if (localStorage.getItem(`forum_ai_${ownerId}`) === "false") {
    return created;
  }

  // 1. 角色
  const characters = (await db.all("characters")).filter(c => c.ownerId === ownerId);
  const allPosts = await getAllPosts(ownerId);
  const now = Date.now();
  const THREE_DAYS = AUTO_POST_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

  for (const char of characters) {
    const charPosts = allPosts
      .filter(p => p.authorType === "character" && p.authorId === char.id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (charPosts.length > 0) {
      const last = charPosts[0];
      if (now - last.createdAt < THREE_DAYS) continue;
    }

    // 30% 概率诈尸
    if (Math.random() > 0.3) continue;

    const post = await generateCharacterPost(ownerId, char);
    if (post) created.push(post);
  }

  // 2. NPC（已加好友的）
  const npcs = (await db.all("npc_relations")).filter(n => n.ownerId === ownerId && n.isFriend);

  for (const npc of npcs) {
    const npcPosts = allPosts
      .filter(p => p.authorType === "npc" && p.authorId === npc.id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (npcPosts.length > 0) {
      const last = npcPosts[0];
      if (now - last.createdAt < THREE_DAYS) continue;
    }
    if (Math.random() > 0.3) continue;

    const post = await generateNpcPost(ownerId, npc);
    if (post) created.push(post);
  }

  return created;
}

/* ============================================================
 * 辅助：精准加载世界书设定
 * ============================================================ */
async function getWorldBookContext(ownerId, characterName) {
  const all = await db.all("world_book");
  const entries = all.filter(w => w.ownerId === ownerId && w.enabled);
  
  let charContext = "";
  let worldContext = "";

  for (const entry of entries) {
    // 1. 如果这条词条是该角色的专属设定（比如标题叫“方承意”）
    if (entry.category === "character" && (entry.title === characterName || (entry.keywords || []).includes(characterName))) {
      charContext += `【你的绝对人设档案 - ${entry.title}】：\n${entry.content}\n`;
    }
    // 2. 如果这条词条是世界、地点或物品设定（比如“江湖规矩”、“明昭侯府”）
    else if (entry.category === "world" || entry.category === "place" || entry.category === "item") {
      worldContext += `【世界与背景设定 - ${entry.title}】：\n${entry.content}\n`;
    }
  }

  return `${worldContext}\n${charContext}`;
}

/* ============================================================
 * 角色主动发帖（深度绑定专属人设）
 * ============================================================ */
async function generateCharacterPost(ownerId, character) {
  let content = "";
  
  // 👈 核心判断：如果开关没有被设置为 "false"，说明 AI 是开启的
  const useAI = localStorage.getItem(`forum_ai_${ownerId}`) !== "false";

  if (useAI) {
    try {
      const { requestAI } = await import("./ai-service.js");
      const rel = await getRelation(ownerId, character.id);
      const affection = Math.round(rel?.affection || 0);
      
      // 抓取该角色的专属档案 + 世界观
      const wbContext = await getWorldBookContext(ownerId, character.name);

      const systemPrompt = `你现在正在扮演武侠角色「${character.name}」。这是一个架空的古代武侠世界（大宋）。
【世界书设定】：
${wbContext}

【你的当前状态】：
你对玩家的好感度为：${affection}（如果是低好感，发言会高冷傲娇；如果高好感，会流露温柔和占有欲）。

你正在发布一条江湖论坛（古代版朋友圈）的动态。
【绝对要求】：
1. 严禁出现任何现代词汇（如：工地、霓虹、露台、武馆等）。
2. 必须符合你的【绝对人设档案】，不要OOC。比如你如果是侯爷，说话就该傲慢带权谋；如果是刺客，就该字数少且冷峻。
3. 字数 15-45 字，直接输出正文，不要加任何前缀和引号。`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请发布一条动态。" }
      ];
      content = await requestAI(messages);
    } catch (err) {
      console.warn("AI 发帖失败", err);
    }
  }

  // 如果 AI 关闭了，或者 AI 报错了，这里就会自动往下走，去抽字卡！

  if (!content) content = await generateContentFromCards(ownerId, character.id, "post");
  if (!content) content = "今日天色甚好，不知故人可曾安好。";
  
  content = content.replace(/^["'“【]|["'”】]$/g, '').trim();

  const title = content.slice(0, 12) + (content.length > 12 ? "…" : "");
const isPrivacyOn = localStorage.getItem(`forum_privacy_${ownerId}`) === "true"; 
  const post = await createPost(ownerId, {
    authorId: character.id,
    authorType: "character",
    title,
    content,
    isAnonymous: isPrivacyOn,
  });

  triggerCharacterInteractions(ownerId, post.id);
  return post;
}

/**
 * 生成 NPC 帖子（读取绑定角色的背景 + NPC 身份）
 */
async function generateNpcPost(ownerId, npc) {
  let content = "";
  
  // 👈 检查 AI 开关
  const useAI = localStorage.getItem(`forum_ai_${ownerId}`) !== "false";

  if (useAI) {
    try {
      const { requestAI } = await import("./ai-service.js");
      
      // 1. 查找这个 NPC 绑定的主角色（比如宋尧绑定的是方承意）
      let linkedContext = "";
      if (npc.linkedCharacterIds && npc.linkedCharacterIds.length > 0) {
        const mainChar = await db.get("characters", npc.linkedCharacterIds[0]);
        if (mainChar) {
          // 把这个主角色的专属词条也拉出来喂给 AI，让他知道自己的主子是谁
          const mainWb = await getWorldBookContext(ownerId, mainChar.name);
          linkedContext = `【你所属的主子/势力背景】：\n${mainWb}`;
        }
      }

      // 2. 查找 NPC 自己的基础设定（如果有的话）
      const npcWb = await getWorldBookContext(ownerId, npc.name);

      const systemPrompt = `你现在正在扮演江湖论坛上的一个配角（NPC）。
你的名字：${npc.name}
你与玩家的关系：${npc.relation || "朋友"}
你的简介：${npc.description || "无"}

【你的背景与主子】：
${linkedContext || "无"}
${npcWb}

这是一个架空的古代武侠世界（大宋）。
请以第一人称，发一条江湖论坛（类似古代版朋友圈）的短动态。
【绝对要求】：
1. 严禁出现任何现代词汇。
2. 必须符合你的身份（比如随从就要维护主子的面子，或者偶尔吐槽主子）。
3. 字数 15-40 字，直接输出正文，不要带引号和前缀。`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请发一条动态。" }
      ];
      content = await requestAI(messages);
    } catch (err) {
      console.warn("AI NPC发帖失败", err);
    }
  }

  // 如果 AI 关闭了，或者 AI 报错了，这里就会自动往下走，去抽字卡！

  if (!content) content = await generateContentFromNpcCards(ownerId, npc.id);
  if (!content) content = "听闻近日城中出了不少新鲜事。";

  content = content.replace(/^["'“【]|["'”】]$/g, '').trim();
  const title = content.slice(0, 12) + (content.length > 12 ? "…" : "");

  const isPrivacyOn = localStorage.getItem(`forum_privacy_${ownerId}`) === "true"; 
  const post = await createPost(ownerId, {
    authorId: npc.id,
    authorType: "npc",
    title,
    content,
    isAnonymous: isPrivacyOn,
  });

  // 触发其他人来围观
  triggerCharacterInteractions(ownerId, post.id);

  return post;
}


/* ============================================================
 * 拼字卡 → 生成内容 (原样保留)
 * ============================================================ */

export async function generateContentFromCards(ownerId, characterId, kind = "post") {
  const settings = await getEffectiveCardSettings(characterId, kind);
  if (!settings.cardsEnabled || !settings.cardGroupIds || settings.cardGroupIds.length === 0) return null;

  const allCards = await getAllCards(ownerId);
  const usable = allCards.filter(c => settings.cardGroupIds.includes(c.groupId) && c.enabled !== false);
  if (!usable.length) return null;

  const thresholdRec = await db.get("settings", "short_threshold");
  const shortThreshold = thresholdRec?.value ?? 9;

  const shortCards = usable.filter(c => c.content.length <= shortThreshold);
  const longCards = usable.filter(c => c.content.length > shortThreshold);

  const min = settings.cardMin || 2;
  const max = Math.max(min, settings.cardMax || 5);
  const count = min + Math.floor(Math.random() * (max - min + 1));

  const picked = pickByMode(settings.cardMode, count, shortCards, longCards, usable);
  if (!picked.length) return null;
  return picked.map(c => c.content).join("");
}

export async function generateContentFromNpcCards(ownerId, npcId) {
  const npc = await db.get("npc_relations", npcId);
  if (!npc || !npc.cardGroupId) return null;

  const allCards = await getAllCards(ownerId);
  const usable = allCards.filter(c => c.groupId === npc.cardGroupId && c.enabled !== false);
  if (!usable.length) return null;

  const thresholdRec = await db.get("settings", "short_threshold");
  const shortThreshold = thresholdRec?.value ?? 9;

  const shortCards = usable.filter(c => c.content.length <= shortThreshold);
  const longCards = usable.filter(c => c.content.length > shortThreshold);

  const min = npc.cardMin || 2;
  const max = Math.max(min, npc.cardMax || 5);
  const count = min + Math.floor(Math.random() * (max - min + 1));

  const picked = pickByMode(npc.cardMode || "random", count, shortCards, longCards, usable);
  if (!picked.length) return null;
  return picked.map(c => c.content).join("");
}

function pickByMode(mode, count, shortCards, longCards, allCards) {
  const shuffled = arr => [...arr].sort(() => Math.random() - 0.5);
  const take = (arr, n) => shuffled(arr).slice(0, n);
  if (mode === "short") return shortCards.length ? take(shortCards, count) : [];
  if (mode === "long") return longCards.length ? take(longCards, count) : [];
  if (mode === "shortlong") {
    if (!shortCards.length || !longCards.length) return [];
    const half = Math.max(1, Math.floor(count / 2));
    return [...take(shortCards, count - half), ...take(longCards, half)];
  }
  return take(allCards, count);
}

/* ============================================================
 * 角色 / NPC 互动：点赞 + 评论
 * ============================================================ */

function getInteractProbabilities(status) {
  if (status === "一厢情愿") status = "泛泛之交";
  if (status === "两心相许") status = "唯一";
  switch (status) {
    case "陌路人": return { like: 0.20, comment: 0.15 };
    case "泛泛之交":
    case "知己之交": return { like: 0.40, comment: 0.30 };
    case "情愫暗生": return { like: 0.60, comment: 0.60 };
    case "情重":
    case "知交": return { like: 0.80, comment: 0.80 };
    case "唯一":
    case "莫逆": return { like: 1.00, comment: 1.00 };
    default: return { like: 0.20, comment: 0.15 };
  }
}

async function getNpcInteractProbabilities(ownerId, npc) {
  const linkedCharId = npc.linkedCharacterIds?.[0];
  if (!linkedCharId) return { like: 0.20, comment: 0.15 };
  const rel = await getRelation(ownerId, linkedCharId);
  return getInteractProbabilities(rel.status);
}

/**
 * 触发互动（用户发帖后，最多随机挑选5人互动）
 */
export async function triggerCharacterInteractions(ownerId, postId) {
  const post = await db.get("posts", postId);
  if (!post) return;

  // 👈 核心锁：如果这个帖子已经有角色互动过了，直接退出，防止重复评论！
  if (post.hasTriggeredInteractions) return;

  // 打个标记，存进数据库，以后再也不触发了
  post.hasTriggeredInteractions = true;
  await db.put("posts", post);

  // 1. 收集所有非发帖人的角色
  const characters = (await db.all("characters")).filter(c => c.ownerId === ownerId);
  const availableChars = characters.filter(c => !(post.authorType === "character" && post.authorId === c.id));
  
  // 2. 收集所有非发帖人的好友NPC
  const npcs = (await db.all("npc_relations")).filter(n => n.ownerId === ownerId && n.isFriend);
  const availableNpcs = npcs.filter(n => !(post.authorType === "npc" && post.authorId === n.id));

  // 3. 把角色和NPC混在一个池子里，然后打乱顺序
  const pool = [
    ...availableChars.map(c => ({ type: "char", data: c })),
    ...availableNpcs.map(n => ({ type: "npc", data: n }))
  ].sort(() => Math.random() - 0.5);

  // 👈 核心：整个池子里，最多只挑出 5 个人来互动
  const selectedInteractors = pool.slice(0, 5);

  for (const person of selectedInteractors) {
    const isChar = person.type === "char";
    const item = person.data;

    // 获取该人物的互动概率
    let prob = { like: 0.2, comment: 0.15 };
    if (isChar) {
      const rel = await getRelation(ownerId, item.id);
      prob = getInteractProbabilities(rel.status);
    } else {
      prob = await getNpcInteractProbabilities(ownerId, item);
    }

    // 根据概率决定是否点赞
    if (Math.random() < prob.like) {
      const delay = 15000 + Math.random() * 30000; // 15-45秒后
      if (isChar) scheduleCharacterLike(ownerId, postId, item.id, delay);
      else scheduleNpcLike(ownerId, postId, item.id, delay);
    }

    // 根据概率决定是否评论
    if (Math.random() < prob.comment) {
      const delay = 20000 + Math.random() * 30000; // 20-50秒后
      if (isChar) scheduleCharacterComment(ownerId, item.id, postId, delay);
      else scheduleNpcComment(ownerId, item.id, postId, delay);
    }
  }
}

/* ============================================================
 * 定时器
 * ============================================================ */

const timers = [];

function scheduleCharacterLike(ownerId, postId, charId, delay) {
  const t = setTimeout(async () => {
    const post = await db.get("posts", postId);
    if (!post) return;
    const likedBy = post.likedBy || [];
    if (!likedBy.includes(charId)) {
      likedBy.push(charId);
      post.likedBy = likedBy;
      post.likes = likedBy.length;
      await db.put("posts", post);
      window.dispatchEvent(new CustomEvent("post-updated", { detail: { postId } }));
    }
  }, delay);
  timers.push(t);
}

/* ============================================================
 * 角色评论（防 OOC 终极版）
 * ============================================================ */
function scheduleCharacterComment(ownerId, charId, postId, delay) {
  const t = setTimeout(async () => {
    let content = "";
    
    // 👈 检查 AI 开关
    const useAI = localStorage.getItem(`forum_ai_${ownerId}`) !== "false";

    if (useAI) {
      try {
        const { requestAI } = await import("./ai-service.js");
        const char = await db.get("characters", charId);
        const post = await db.get("posts", postId);
        const rel = await getRelation(ownerId, charId);

        // 查出原帖是谁发的
        let authorName = "玩家";
        if (post.isAnonymous) {
          authorName = "匿名侠客"; 
        } else if (post.authorType === "character") {
          const author = await db.get("characters", post.authorId);
          authorName = author ? author.name : "某人";
        } else if (post.authorType === "npc") {
          const author = await db.get("npc_relations", post.authorId);
          authorName = author ? author.name : "某人";
        }

        // 抓取该评论者的专属档案 + 世界观
        const wbContext = await getWorldBookContext(ownerId, char.name);

        const systemPrompt = `你现在正在扮演武侠角色「${char.name}」。这是一个架空的古代武侠世界（大宋）。
【世界书设定】：
${wbContext}

【你的当前状态】：
你对玩家的好感度为：${Math.round(rel.affection)}。

发帖人是：【${authorName}】。
${post.isAnonymous ? "🚨注意：这是一个【匿名】帖子！你不知道发帖人是谁，你不能称呼对方为玩家，只能用生疏的称呼（如：这位兄台、阁下、发帖之人）。即使你觉得对方的语气像熟人，也不能直接叫破！" : ""}

原帖内容：“${post.content}”。

请以你的身份，给这条帖子写一条评论。

【🚨 角色防 OOC 强制警告 🚨】：
1. 严禁出现任何现代词汇。
2. 严禁使用轻浮、油腻的称呼（如：小娘子、小妖精、女人）。
3. 如果角色是「盛崖余（无情）」：他清冷克制、不善言辞、身有残疾，极度内敛。哪怕好感度满了，他的表达也必须隐忍、简短（比如关心冷暖、提及暗器或机巧、或者用清冷的动作描述）。绝不能像浪荡子一样轻佻调情！
4. 如果角色是「方承意」：他傲娇腹黑，可以霸道，但话里要带权谋或居高临下。
5. 如果角色是「叶问舟」：温润如玉，像邻家师兄一样照顾人。
6. 如果角色是「燕无归」：孤僻冷酷，字数极少。

【要求】：
用 5-30 个字回复，符合上述人物性格，直接输出评论，不要带引号。`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: "请发表你的评论。" }
        ];
        
        content = await requestAI(messages);
      } catch (err) {
        console.warn("AI 评论失败", err);
      }
    }

    // 如果 AI 关闭了或者失败了，自动去抽字卡
    if (!content) content = await generateContentFromCards(ownerId, charId, "post");
    
    // 兜底
    if (!content) {
      const char = await db.get("characters", charId);
      const name = char?.name || "";
      if (name === "方承意") content = "哦？这帖子倒是有些意思，本侯准了。";
      else if (name === "叶问舟") content = "山水有相逢，师妹若去，记得唤我同游。";
      else if (name === "盛崖余" || name === "无情") content = "天寒露重，多添件衣裳。";
      else if (name === "燕无归") content = "若有危险，唤我。";
      else content = "所言极是。";
    }

    content = content.replace(/^["'“【]|["'”】]$/g, '').trim();

    await addComment(postId, ownerId, { authorId: charId, authorType: "character", content });
    window.dispatchEvent(new CustomEvent("post-updated", { detail: { postId } }));
  }, delay);
  timers.push(t);
}

function scheduleNpcLike(ownerId, postId, npcId, delay) {
  const t = setTimeout(async () => {
    const post = await db.get("posts", postId);
    if (!post) return;
    const likedBy = post.likedBy || [];
    if (!likedBy.includes(npcId)) {
      likedBy.push(npcId);
      post.likedBy = likedBy;
      post.likes = likedBy.length;
      await db.put("posts", post);
      window.dispatchEvent(new CustomEvent("post-updated", { detail: { postId } }));
    }
  }, delay);
  timers.push(t);
}

function scheduleNpcComment(ownerId, npcId, postId, delay) {
  const t = setTimeout(async () => {
    let content = "";
    
    // 👈 检查 AI 开关
    const useAI = localStorage.getItem(`forum_ai_${ownerId}`) !== "false";

    if (useAI) {
      try {
        const { requestAI } = await import("./ai-service.js");
        const npc = await db.get("npc_relations", npcId);
        const post = await db.get("posts", postId);
        
        // 查出原帖是谁发的
        let authorName = "玩家";
        if (post.isAnonymous) {
          authorName = "匿名侠客"; 
        } else if (post.authorType === "character") {
          const author = await db.get("characters", post.authorId);
          authorName = author ? author.name : "某人";
        } else if (post.authorType === "npc") {
          const author = await db.get("npc_relations", post.authorId);
          authorName = author ? author.name : "某人";
        }

        // 拉取它主子的设定
        let linkedContext = "";
        if (npc.linkedCharacterIds && npc.linkedCharacterIds.length > 0) {
          const mainChar = await db.get("characters", npc.linkedCharacterIds[0]);
          if (mainChar) {
            linkedContext = `你的主子/势力是：${mainChar.name}（背景：${mainChar.bio || "无"}）。`;
          }
        }

        const systemPrompt = `你现在正在扮演配角「${npc.name}」（与玩家关系：${npc.relation || "朋友"}）。
${linkedContext}

发帖人是：【${authorName}】。
${post.isAnonymous ? "🚨注意：这是一个【匿名】帖子！你不知道发帖人是谁，即使语气像你认识的人，你也绝不能叫破对方的真实姓名（如：叶公子、侯爷、盛大人）。只能用生疏的称呼（如：这位兄台、阁下、发帖之人）。" : ""}

帖子内容：“${post.content}”。

请写一条评论。
【要求】：
1. 严禁使用现代词汇。
2. 如果发帖人是你的主子，你要恭顺/护卫；如果是玩家，你要客气或熟络；如果是其他江湖人，请符合你的阵营立场。
3. 字数 5-20 字，直接输出内容，不要带引号。`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: "请发表你的评论。" }
        ];
        content = await requestAI(messages);
      } catch (err) {
        console.warn("AI NPC评论失败", err);
      }
    }

    // 如果 AI 关闭了或者失败了，自动去抽字卡
    if (!content) content = await generateContentFromNpcCards(ownerId, npcId);
    if (!content) content = "所言极是。";
    
    content = content.replace(/^["'“【]|["'”】]$/g, '').trim();

    await addComment(postId, ownerId, { authorId: npcId, authorType: "npc", content });
    window.dispatchEvent(new CustomEvent("post-updated", { detail: { postId } }));
  }, delay);
  timers.push(t);
}




export function clearAllTimers() {
  timers.forEach(t => clearTimeout(t));
  timers.length = 0;
}