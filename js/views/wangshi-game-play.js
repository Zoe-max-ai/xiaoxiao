import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { uid } from "../core/uid.js";
import {
  getGame, updateGame, getNode, getNodesByGame, getChaptersByGame,
  getSaveByGame, saveGame, deleteSaveByGame,
  addFavorite, removeFavorite, isFavorite,
} from "../services/game-service.js";
import { addRelation } from "../services/relation-service.js";

export async function wangshiGamePlayView({ params }) {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  // 👈 核心修复：切掉问号后面的参数，拿到纯净的游戏 ID
  const rawId = params?.[0] || "";
  const gameId = rawId.split('?')[0];

  if (!gameId) {
    el.innerHTML = `<div class="empty-state">未指定游戏。</div>`;
    return el;
  }

  const game = await getGame(gameId);
  if (!game) {
    el.innerHTML = `<div class="empty-state">游戏不存在。</div>`;
    return el;
  }

  // 👈 核心修复：直接从整个哈希里正则抓取 node 参数
  const hashMatch = window.location.hash.match(/node=([^&]+)/);
  const targetNodeId = hashMatch ? hashMatch[1] : null;

  const chapters = await getChaptersByGame(game.id);
  const allNodes = await getNodesByGame(game.id);

  let currentNode = null;
  let save = await getSaveByGame(ownerId, game.id);

  /* ===== 开始 / 继续 选择 ===== */
  // 👈 加一个判断：如果是点击收藏跳过来的，就直接跳过弹窗
  if (save && save.currentNodeId && !targetNodeId) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
        ${escapeHtml(game.title)}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn" id="play-continue" style="padding:14px;letter-spacing:4px;">继 续 游 戏</button>
        <button class="btn ghost" id="play-restart" style="padding:14px;letter-spacing:4px;">重 新 开 始</button>
      </div>
    `);

    const choice = await new Promise(resolve => {
      modal.querySelector("#play-continue").onclick = () => { closeModal(modal); resolve("continue"); };
      modal.querySelector("#play-restart").onclick = () => { closeModal(modal); resolve("restart"); };
    });

    if (choice === "restart") {
      await deleteSaveByGame(ownerId, game.id);
      save = null;
    }
  }

  /* ===== 初始化存档 ===== */
  if (targetNodeId) {
    // 👈 核心逻辑：如果 URL 里指定了节点，强制把存档改成那个节点
    save = await saveGame(ownerId, game.id, {
      currentNodeId: targetNodeId,
      visitedNodeIds: save?.visitedNodeIds || [targetNodeId],
      choiceHistory: save?.choiceHistory || [],
      relationChanges: save?.relationChanges || {},
      manualSave: save?.manualSave || null,
    });
    // 顺便把 URL 里的 ?node= 擦掉，防止用户刷新页面卡在这个节点
    history.replaceState(null, "", `#/wangshi/game/play/${game.id}`);
  } else if (!save || !save.currentNodeId) {
    // 原版的初始化逻辑
    const startNodeId = game.startNodeId || allNodes[0]?.id;
    if (!startNodeId) {
      el.innerHTML = `<div class="empty-state">游戏没有开始节点。</div>`;
      return el;
    }
    save = await saveGame(ownerId, game.id, {
      currentNodeId: startNodeId,
      visitedNodeIds: [startNodeId],
      choiceHistory: [],
      relationChanges: {},
      manualSave: null,
    });
  }

  currentNode = await getNode(save.currentNodeId);

  /* ===== HTML 框架 ===== */
  el.innerHTML = `
    <div class="gameplay-topbar">
      <button class="gameplay-back" id="btn-back">←</button>
      <div class="gameplay-title">${escapeHtml(game.title)}</div>
      <button class="gameplay-more" id="btn-more" title="更多">⋯</button>
    </div>

    <div class="gameplay-content" id="play-content"></div>
  `;

  el.querySelector("#btn-back").onclick = () => { location.hash = "#/wangshi"; };
  el.querySelector("#btn-more").onclick = () => openMoreMenu();

  /* ===== 渲染当前节点 ===== */
  async function renderNode() {
    if (!currentNode) {
      el.querySelector("#play-content").innerHTML = `<div class="empty-state">节点不存在。</div>`;
      return;
    }

    const isEnding = !currentNode.choices || currentNode.choices.length === 0;
    const contentEl = el.querySelector("#play-content");

    // 进入结局节点时，触发「进入时效果」——触发一次
    if (isEnding && currentNode.enterEffects) {
      const enterKey = `enter_${currentNode.id}`;
      const triggered = game.triggeredChoices || {};
      if (!triggered[enterKey]) {
        await triggerEnterEffects(currentNode.enterEffects);
        if (!game.triggeredChoices) game.triggeredChoices = {};
        game.triggeredChoices[enterKey] = true;
        await updateGame(game.id, { triggeredChoices: game.triggeredChoices });
      }
    }

    contentEl.innerHTML = `
      <div class="gameplay-paper">
        <div class="gameplay-text" id="typewriter-text"></div>
      </div>

      ${isEnding ? `
        <div class="gameplay-ending" id="ending-wrap" style="opacity: 0; transition: opacity 0.8s ease; margin-top: 20px;">
          <div class="gameplay-ending-mark">—— 完 ——</div>
          ${currentNode.endingText ? `<div class="gameplay-ending-text">${escapeHtml(currentNode.endingText)}</div>` : ""}
          <div class="gameplay-ending-actions" style="display: flex; gap: 12px;">
            <button class="btn ghost" id="btn-rewind-ending" style="flex:1;padding:12px;letter-spacing:3px;white-space:nowrap;">重 刷</button>
            <button class="btn" id="btn-home" style="flex:1;padding:12px;letter-spacing:3px;white-space:nowrap;">回 到 往 事</button>
          </div>
        </div>
      ` : `
        <div class="gameplay-choices">
          ${currentNode.choices.map((c, i) => `
            <button class="gameplay-choice" data-idx="${i}">
              <span class="gameplay-choice-arrow">›</span>
              <span class="gameplay-choice-text">${escapeHtml(c.text || "……")}</span>
            </button>
          `).join("")}
        </div>
      `}
    `;

    // 👈 打字机效果
    const textEl = contentEl.querySelector("#typewriter-text");
    const choicesEl = contentEl.querySelector(".gameplay-choices");
    const endingWrap = contentEl.querySelector("#ending-wrap");

    if (choicesEl) {
      choicesEl.style.opacity = "0";
      choicesEl.style.transition = "opacity 0.5s ease";
    }

    const fullText = currentNode.content.replace(/\n/g, "<br>");
    let charIdx = 0;
    textEl.innerHTML = "";

    function typeWriter() {
      if (charIdx < fullText.length) {
        if (fullText.charAt(charIdx) === '<') {
          const endTag = fullText.indexOf('>', charIdx);
          textEl.innerHTML += fullText.slice(charIdx, endTag + 1);
          charIdx = endTag + 1;
        } else {
          textEl.innerHTML += fullText.charAt(charIdx);
          charIdx++;
        }
        setTimeout(typeWriter, 35);
      } else {
        // 👈 核心：打完后浮现
        if (choicesEl) choicesEl.style.opacity = "1";
        if (endingWrap) endingWrap.style.opacity = "1"; // 结局的完和按钮浮现
      }
    }
    typeWriter();


    contentEl.querySelectorAll(".gameplay-choice").forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        handleChoice(i);
      };
    });

    const homeBtn = contentEl.querySelector("#btn-home");
    if (homeBtn) homeBtn.onclick = () => { location.hash = "#/wangshi"; };

    const rewindBtn = contentEl.querySelector("#btn-rewind-ending");
    if (rewindBtn) {
      rewindBtn.onclick = async () => {
        const ok = await showConfirm("重刷游戏", "清空所有进度，从头开始？");
        if (!ok) return;
        await deleteSaveByGame(ownerId, game.id);
        location.reload();
      };
    }

    window.scrollTo(0, 0);
  }

  /* ===== 进入节点时效果 ===== */
  async function triggerEnterEffects(eff) {
    if (!eff) return;

    // 数值
    if (eff.targetCharacterId && ((eff.affection || 0) !== 0 || (eff.friendship || 0) !== 0)) {
      await addRelation(ownerId, eff.targetCharacterId, {
        affection: eff.affection || 0,
        friendship: eff.friendship || 0,
        type: "story",
        note: `文游「${game.title}」结局`,
      });

      const character = await db.get("characters", eff.targetCharacterId);
      const parts = [];
      if (eff.affection) parts.push(`爱慕 +${eff.affection}`);
      if (eff.friendship) parts.push(`友善 +${eff.friendship}`);
      if (parts.length) {
        showToast(`${character?.name || ""} ${parts.join(" · ")}`);
      }
    }

    // 副作用
    if (eff.targetCharacterId) {
      await triggerEffects({
        letter: eff.letter,
        post: eff.post,
        chat: eff.chat,
      }, eff.targetCharacterId);
    }
  }

  /* ===== 处理选项 ===== */
  async function handleChoice(idx) {
    const choice = currentNode.choices[idx];
    if (!choice) return;

    // 触发一次判断
    const triggerKey = `${currentNode.id}_${idx}`;
    if (!game.triggeredChoices) game.triggeredChoices = {};
    const hasTriggered = game.triggeredChoices[triggerKey];

    // 1. 数值变化（只加一次）
    if (!hasTriggered && choice.targetCharacterId && ((choice.affection || 0) !== 0 || (choice.friendship || 0) !== 0)) {
      await addRelation(ownerId, choice.targetCharacterId, {
        affection: choice.affection || 0,
        friendship: choice.friendship || 0,
        type: "story",
        note: `文游「${game.title}」`,
      });

      const character = await db.get("characters", choice.targetCharacterId);
      const parts = [];
      if (choice.affection) parts.push(`爱慕 +${choice.affection}`);
      if (choice.friendship) parts.push(`友善 +${choice.friendship}`);
      if (parts.length) {
        showToast(`${character?.name || ""} ${parts.join(" · ")}`);
      }

      if (!save.relationChanges) save.relationChanges = {};
      if (!save.relationChanges[choice.targetCharacterId]) {
        save.relationChanges[choice.targetCharacterId] = { affection: 0, friendship: 0 };
      }
      save.relationChanges[choice.targetCharacterId].affection += choice.affection || 0;
      save.relationChanges[choice.targetCharacterId].friendship += choice.friendship || 0;
    }

    // 2. 副作用（只触发一次）
    if (!hasTriggered && choice.effects) {
      await triggerEffects(choice.effects, choice.targetCharacterId);
    }

    // 3. 标记已触发
    if (!hasTriggered) {
      game.triggeredChoices[triggerKey] = true;
      await updateGame(game.id, { triggeredChoices: game.triggeredChoices });
    }

    // 4. 跳转 / 结局
    if (choice.nextNodeId) {
      const nextNode = await getNode(choice.nextNodeId);
      if (!nextNode) {
        showToast("目标节点不存在");
        return;
      }
      currentNode = nextNode;
      save.currentNodeId = nextNode.id;
      if (!save.visitedNodeIds) save.visitedNodeIds = [];
      if (!save.visitedNodeIds.includes(nextNode.id)) {
        save.visitedNodeIds.push(nextNode.id);
      }
      save.choiceHistory = save.choiceHistory || [];
      save.choiceHistory.push({
        nodeId: currentNode.id,
        choiceIdx: idx,
        at: Date.now(),
      });
      await saveGame(ownerId, game.id, save);
      await renderNode();
    } else {
      // 结局
      save.currentNodeId = null;
      await saveGame(ownerId, game.id, save);
      await renderEnding(choice);
    }
  }

  /* ===== 结局 ===== */
  async function renderEnding(choice) {
    const contentEl = el.querySelector("#play-content");
    const endingText = choice.endingText || currentNode.endingText || "";

    // 这里给外层加个 flex 布局，防止按钮被挤变形
    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; min-height: 70vh; justify-content: flex-start;">
        <div class="gameplay-paper">
          <div class="gameplay-text" id="ending-typewriter-text"></div>
        </div>
        
        <div class="gameplay-ending" id="ending-wrap" style="opacity: 0; transition: opacity 0.8s ease; margin-top: auto; padding-bottom: 20px;">
          <div class="gameplay-ending-mark">—— 完 ——</div>
          <div class="gameplay-ending-actions" style="display: flex; gap: 12px;">
            <button class="btn ghost" id="btn-rewind-ending" style="flex:1;padding:12px;letter-spacing:3px;white-space:nowrap;">重 刷</button>
            <button class="btn" id="btn-home" style="flex:1;padding:12px;letter-spacing:3px;white-space:nowrap;">回 到 往 事</button>
          </div>
        </div>
      </div>
    `;

    // 👈 结局的打字机效果
    const textEl = contentEl.querySelector("#ending-typewriter-text");
    const endingWrap = contentEl.querySelector("#ending-wrap");
    // 如果 choice 有 endingText 就优先用它，没有就用当前节点的正文
    const fullText = (endingText || currentNode.content).replace(/\n/g, "<br>");
    let charIdx = 0;
    textEl.innerHTML = "";

    function typeEnding() {
      if (charIdx < fullText.length) {
        if (fullText.charAt(charIdx) === '<') {
          const endTag = fullText.indexOf('>', charIdx);
          textEl.innerHTML += fullText.slice(charIdx, endTag + 1);
          charIdx = endTag + 1;
        } else {
          textEl.innerHTML += fullText.charAt(charIdx);
          charIdx++;
        }
        setTimeout(typeEnding, 35);
      } else {
        // 👈 核心：打完后，把“完”和按钮优雅地浮现出来
        if (endingWrap) {
          endingWrap.style.opacity = "1";
        }
      }
    }
    typeEnding();

    contentEl.querySelector("#btn-home").onclick = () => { location.hash = "#/wangshi"; };
    contentEl.querySelector("#btn-rewind-ending").onclick = async () => {
      const ok = await showConfirm("重刷游戏", "清空所有进度，从头开始？");
      if (!ok) return;
      await deleteSaveByGame(ownerId, game.id);
      location.reload();
    };

    window.scrollTo(0, 0);
  }


  /* ===== 副作用触发（立即） ===== */
  async function triggerEffects(effects, charId) {
    if (!charId) return;
    const character = await db.get("characters", charId);
    if (!character) return;

    const user = state.currentUser;
    const salutation = user?.nickname || user?.name || "君";

    // 信
    if (effects.letter?.enabled && effects.letter.content) {
      const fullContent = [
        `${salutation} 敬启：`,
        "",
        effects.letter.content,
        "",
        `—— ${character.name} 谨启`,
      ].join("\n");

      await db.put("letters", {
        id: uid("letter"),
        ownerId,
        fromId: charId,
        toId: ownerId,
        direction: "received",
        type: "story_trigger",
        content: fullContent,
        isRead: false,
        createdAt: Date.now(),
      });
      showToast(`${character.name} 给你写了一封信`);
    }

    // 心绪
    if (effects.post?.enabled && effects.post.content) {
      await db.put("posts", {
        id: uid("post"),
        ownerId,
        authorId: charId,
        authorType: "character",
        title: effects.post.title || "",
        content: effects.post.content,
        likedBy: [],
        likes: 0,
        isFavorite: false,
        commentCount: 0,
        createdAt: Date.now(),
      });
      showToast(`${character.name} 发表了一篇心绪`);
    }

    // 聊天
    if (effects.chat?.enabled && effects.chat.content) {
      const chats = await db.all("chats");
      let chat = chats.find(c => c.ownerId === ownerId && c.characterId === charId);
      if (!chat) {
        chat = {
          id: uid("chat"),
          ownerId,
          type: "single",
          characterId: charId,
          lastMessageAt: Date.now(),
          lastMessageText: effects.chat.content,
          lastMessageFrom: charId,
          createdAt: Date.now(),
        };
        await db.put("chats", chat);
      }
      await db.put("messages", {
        id: uid("msg"),
        chatId: chat.id,
        ownerId,
        fromId: charId,
        fromType: "character",
        content: effects.chat.content,
        contentType: "text",
        mode: "card",
        isRead: false,
        createdAt: Date.now(),
      });
      chat.lastMessageAt = Date.now();
      chat.lastMessageText = effects.chat.content;
      chat.lastMessageFrom = charId;
      await db.put("chats", chat);

      showToast(`${character.name} 给你发了一条消息`);
    }
  }

  /* ===== 「⋯」菜单 ===== */
  async function openMoreMenu() {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const fav = await isFavorite(ownerId, game.id, currentNode?.id);
    const hasManualSave = !!save.manualSave;

    const modal = showModal(`
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="menu-item" data-act="save">手 动 存 档</button>
        ${hasManualSave ? `<button class="menu-item" data-act="load">读 取 手 动 存 档</button>` : ""}
        <button class="menu-item" data-act="rewind">回 溯 上 一 章</button>
        <button class="menu-item" data-act="fav">${fav ? "取消收藏当前剧情" : "收藏当前剧情"}</button>
        <button class="menu-item" data-act="reset">重 刷 剧 情</button>
        <button class="menu-item danger" data-act="exit">退 出</button>
      </div>
      <style>
        .menu-item {
          padding: 14px;
          background: var(--paper-soft);
          border: 1px solid var(--line-light);
          border-radius: var(--radius-sm);
          font-family: var(--font-title);
          font-size: 14px;
          letter-spacing: 2px;
          color: var(--ink);
          cursor: pointer;
          text-align: center;
        }
        .menu-item.danger { color: var(--cinnabar); }
      </style>
    `);

    modal.querySelector("[data-act='save']").onclick = async () => {
      closeModal(modal);
      await saveGame(ownerId, game.id, {
        manualSave: {
          currentNodeId: save.currentNodeId,
          visitedNodeIds: JSON.parse(JSON.stringify(save.visitedNodeIds || [])),
          choiceHistory: JSON.parse(JSON.stringify(save.choiceHistory || [])),
          relationChanges: JSON.parse(JSON.stringify(save.relationChanges || {})),
          savedAt: Date.now(),
        },
      });
      // 重新拉 save（保证本地 save 也更新）
      save = await getSaveByGame(ownerId, game.id);
      showToast("已手动存档");
    };

    const loadBtn = modal.querySelector("[data-act='load']");
    if (loadBtn) {
      loadBtn.onclick = async () => {
        closeModal(modal);
        if (!save.manualSave) return;
        await saveGame(ownerId, game.id, {
          currentNodeId: save.manualSave.currentNodeId,
          visitedNodeIds: JSON.parse(JSON.stringify(save.manualSave.visitedNodeIds || [])),
          choiceHistory: JSON.parse(JSON.stringify(save.manualSave.choiceHistory || [])),
          relationChanges: JSON.parse(JSON.stringify(save.manualSave.relationChanges || {})),
        });
        save = await getSaveByGame(ownerId, game.id);
        currentNode = await getNode(save.currentNodeId);
        showToast("已读取手动存档");
        await renderNode();
      };
    }

    modal.querySelector("[data-act='rewind']").onclick = async () => {
      closeModal(modal);
      await rewindChapter();
    };

    modal.querySelector("[data-act='fav']").onclick = async () => {
      closeModal(modal);
      if (!currentNode) return;
      if (fav) {
        await removeFavorite(ownerId, game.id, currentNode.id);
        showToast("已取消收藏");
      } else {
        await addFavorite(ownerId, game.id, currentNode.id);
        showToast("已收藏");
      }
    };

    modal.querySelector("[data-act='reset']").onclick = async () => {
      closeModal(modal);
      const ok = await showConfirm("重刷剧情", "清空进度，从头开始？");
      if (!ok) return;
      await deleteSaveByGame(ownerId, game.id);
      location.reload();
    };

    modal.querySelector("[data-act='exit']").onclick = () => {
      closeModal(modal);
      location.hash = "#/wangshi";
    };
  }

  /* ===== 回溯上一章 ===== */
  async function rewindChapter() {
    if (!currentNode) return;
    const curChapterId = currentNode.chapterId;
    const idx = chapters.findIndex(c => c.id === curChapterId);
    if (idx <= 0) {
      showToast("已是第一章");
      return;
    }
    const prevChapter = chapters[idx - 1];
    const prevChapterNodes = allNodes
      .filter(n => n.chapterId === prevChapter.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!prevChapterNodes.length) {
      showToast("上一章没有节点");
      return;
    }

    const targetNode = prevChapterNodes[0];

    save.visitedNodeIds = (save.visitedNodeIds || []).filter(id => {
      const n = allNodes.find(x => x.id === id);
      return n && n.chapterId !== curChapterId;
    });

    currentNode = targetNode;
    save.currentNodeId = targetNode.id;
    await saveGame(ownerId, game.id, save);

    showToast(`已回溯到「${prevChapter.title}」`);
    await renderNode();
  }

  /* ===== 启动 ===== */
  if (currentNode) {
    await renderNode();
  } else {
    el.querySelector("#play-content").innerHTML = `
      <div class="gameplay-ending">
        <div class="gameplay-ending-mark">—— 完 ——</div>
        <div class="gameplay-ending-actions">
          <button class="btn ghost" id="btn-rewind-ending" style="flex:1;padding:12px;">重 刷</button>
          <button class="btn" id="btn-home" style="flex:1;padding:12px;">回 到 往 事</button>
        </div>
      </div>
    `;
    el.querySelector("#btn-home").onclick = () => { location.hash = "#/wangshi"; };
    el.querySelector("#btn-rewind-ending").onclick = async () => {
      await deleteSaveByGame(ownerId, game.id);
      location.reload();
    };
  }

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}