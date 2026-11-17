import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { showInputModal } from "../ui/input-modal.js";
import {
  getGame, updateGame,
  getChaptersByGame, createChapter, updateChapter, deleteChapter,
  getNodesByGame, getNodesByChapter, getNode, createNode, updateNode, deleteNode,
  completeGame,
} from "../services/game-service.js";
import { openImagePicker } from "../ui/image-picker.js";

export async function wangshiGameEditView({ params }) {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const gameId = params?.[0];
  if (!gameId) {
    el.innerHTML = `<div class="empty-state">未指定游戏。</div>`;
    return el;
  }

  const game = await getGame(gameId);
  if (!game || game.ownerId !== ownerId) {
    el.innerHTML = `<div class="empty-state">此游戏已不知所踪。</div>`;
    return el;
  }

  // 加载当前用户的所有角色
  const characters = (await db.all("characters"))
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);

  let chapters = [];
  let currentChapterId = null;
  let nodes = [];
  let allNodes = [];
  let currentNodeId = null;
  let currentNode = null;

  let editing = {
    title: "",
    content: "",
    choices: [],
    endingText: "",
    enterEffects: null,
  };

  /* ===== HTML 框架 ===== */
  el.innerHTML = `
    <div class="gamedit-topbar">
      <button class="gamedit-back" id="btn-back">←</button>
      <div class="gamedit-title" id="game-title" title="点击改名">${escapeHtml(game.title)}</div>
      <button class="gamedit-save" id="btn-save">保 存</button>
      <button class="gamedit-more" id="btn-more" title="更多">⋯</button>
    </div>

    <div class="gamedit-chapters" id="chapters-bar"></div>
    <div class="gamedit-nodes" id="nodes-bar"></div>

    <div class="gamedit-body" id="edit-body"></div>

    <div class="gamedit-bottom">
      <button class="btn" id="btn-complete">标 记 完 成</button>
    </div>
  `;

  /* ===== 顶栏事件 ===== */
  el.querySelector("#btn-back").onclick = () => {
    location.hash = "#/wangshi";
  };

  el.querySelector("#game-title").onclick = async () => {
    const newTitle = await showInputModal({
      title: "修改游戏标题",
      defaultValue: game.title,
      maxLength: 30,
    });
    if (!newTitle) return;
    await updateGame(game.id, { title: newTitle });
    game.title = newTitle;
    el.querySelector("#game-title").textContent = newTitle;
    showToast("已改名");
  };

  el.querySelector("#btn-save").onclick = async () => {
    if (!currentNode) return;
    await saveCurrentNode();
    showToast("已保存");
  };

  el.querySelector("#btn-more").onclick = async () => {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const modal = showModal(`
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="edit-menu-item" data-act="cover">更 换 封 面</button>
        <button class="edit-menu-item" data-act="export">导 出 文 游</button>
        <button class="edit-menu-item danger" data-act="del">删 除 游 戏</button>
      </div>
      <style>
        .edit-menu-item {
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
        .edit-menu-item.danger { color: var(--cinnabar); }
      </style>
    `);

    modal.querySelector("[data-act='cover']").onclick = async () => {
      closeModal(modal);
      await changeCover();
    };

    // 👈 加上导出功能
    modal.querySelector("[data-act='export']").onclick = async () => {
      closeModal(modal);
      
      // 1. 把游戏本体、章节、节点全查出来
      const gameData = await getGame(game.id);
      const chaptersData = await getChaptersByGame(game.id);
      const nodesData = await getNodesByGame(game.id);

      const exportData = {
        version: 1,
        game: gameData,
        chapters: chaptersData,
        nodes: nodesData
      };

      // 2. 打包成 JSON 下载
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `文游_${game.title}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("已导出");
    };

    modal.querySelector("[data-act='del']").onclick = async () => {
      closeModal(modal);
      const ok = await showConfirm("删除游戏", "所有节点和存档会一起删除。确定？");
      if (!ok) return;
      const { deleteGame } = await import("../services/game-service.js");
      await deleteGame(game.id);
      showToast("已删除");
      location.hash = "#/wangshi";
    };
  };

  el.querySelector("#btn-complete").onclick = async () => {
    if (currentNode) await saveCurrentNode();
    const ok = await showConfirm("完成游戏", "标记为完成后，游戏会出现在「游玩」列表里。确定吗？");
    if (!ok) return;
    await completeGame(game.id);
    showToast("已完成");
    location.hash = "#/wangshi";
  };

/* ===== 更换封面 ===== */
async function changeCover() {
  try {
    openImagePicker("game_cover", async (imgId) => {
      try {
        if (!imgId) return;
        const img = await db.get("images", imgId);
        if (!img) {
          showToast("图片记录不存在");
          return;
        }
        const useData = img.thumb?.data ?? img.origin?.data;
        if (!useData) {
          showToast("图片数据异常");
          return;
        }
        await updateGame(game.id, { coverImageId: imgId });
        game.coverImageId = imgId;
        showToast("封面已更新");
      } catch (err) {
        console.error("更新封面出错：", err);
        showToast("封面更新失败，请重试");
      }
    });
  } catch (err) {
    console.error("唤起选图组件出错：", err);
  }
}








  /* ===== 保存当前节点 ===== */
  async function saveCurrentNode() {
    if (!currentNode) return;
    await updateNode(currentNode.id, {
      title: editing.title,
      content: editing.content,
      choices: editing.choices,
      endingText: editing.endingText,
      enterEffects: editing.enterEffects,
    });
  }

  /* ===== 加载章节（含兼容旧数据） ===== */
  async function loadChapters() {
    chapters = await getChaptersByGame(game.id);

    if (!chapters.length) {
      const firstChapter = await createChapter(game.id, "第一章");

      const allNodesRaw = await getNodesByGame(game.id);
      for (const n of allNodesRaw) {
        if (!n.chapterId) {
          n.chapterId = firstChapter.id;
          await db.put("game_nodes", n);
        }
      }

      if (!allNodesRaw.length) {
        const startNode = await createNode(game.id, firstChapter.id, {
          title: "开始",
          content: "",
          choices: [],
        });
        await updateGame(game.id, {
          startNodeId: startNode.id,
          chapterCount: 1,
          nodeCount: 1,
        });
        game.startNodeId = startNode.id;
      } else {
        await updateGame(game.id, {
          startNodeId: game.startNodeId || allNodesRaw[0].id,
          chapterCount: 1,
          nodeCount: allNodesRaw.length,
        });
        if (!game.startNodeId) game.startNodeId = allNodesRaw[0].id;
      }

      chapters = await getChaptersByGame(game.id);
    }

    if (!currentChapterId || !chapters.find(c => c.id === currentChapterId)) {
      currentChapterId = chapters[0]?.id || null;
    }
  }

  /* ===== 加载节点 ===== */
  async function loadNodes() {
    allNodes = await getNodesByGame(game.id);
    nodes = allNodes.filter(n => n.chapterId === currentChapterId);
    if (!currentNodeId || !nodes.find(n => n.id === currentNodeId)) {
      currentNodeId = nodes[0]?.id || null;
    }
    currentNode = nodes.find(n => n.id === currentNodeId) || null;
    if (currentNode) {
      editing.title = currentNode.title || "";
      editing.content = currentNode.content || "";
      editing.choices = JSON.parse(JSON.stringify(currentNode.choices || []));
      editing.endingText = currentNode.endingText || "";
      editing.enterEffects = currentNode.enterEffects ? JSON.parse(JSON.stringify(currentNode.enterEffects)) : null;
    }
  }

  /* ===== 渲染章选择器 ===== */
  function renderChaptersBar() {
    const bar = el.querySelector("#chapters-bar");
    bar.innerHTML = `
      ${chapters.map(c => `
        <div class="chapter-chip ${c.id === currentChapterId ? "on" : ""}" data-id="${c.id}">
          ${escapeHtml(c.title)}
          ${chapters.length > 1 ? `<span class="chapter-del" data-id="${c.id}">×</span>` : ""}
        </div>
      `).join("")}
      <div class="chapter-chip chapter-chip-add" id="chapter-add">＋ 章</div>
    `;

    bar.querySelectorAll(".chapter-chip").forEach(chip => {
      if (chip.id === "chapter-add") return;

      chip.onclick = async (e) => {
        if (e.target.classList.contains("chapter-del")) return;
        if (chip.dataset.id === currentChapterId) return;
        if (currentNode) await saveCurrentNode();
        currentChapterId = chip.dataset.id;
        currentNodeId = null;
        await loadNodes();
        renderChaptersBar();
        renderNodesBar();
        renderBody();
      };

      const renameChapter = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const chapter = chapters.find(c => c.id === chip.dataset.id);
        if (!chapter) return;
        const newName = await showInputModal({
          title: "重命名章节",
          defaultValue: chapter.title,
          maxLength: 10,
        });
        if (!newName) return;
        await updateChapter(chapter.id, { title: newName });
        chapter.title = newName;
        renderChaptersBar();
        showToast("已改名");
      };

      let pressTimer = null;
      chip.addEventListener("touchstart", () => {
        pressTimer = setTimeout(() => renameChapter(), 600);
      }, { passive: true });
      chip.addEventListener("touchend", () => clearTimeout(pressTimer));
      chip.addEventListener("touchmove", () => clearTimeout(pressTimer));
      chip.addEventListener("contextmenu", renameChapter);

      const delBtn = chip.querySelector(".chapter-del");
      if (delBtn) {
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          const ok = await showConfirm("删除章节", "章节下所有节点会一起删除。确定？");
          if (!ok) return;
          await deleteChapter(chip.dataset.id);
          currentChapterId = null;
          await loadChapters();
          await loadNodes();
          renderChaptersBar();
          renderNodesBar();
          renderBody();
          showToast("已删除");
        };
      }
    });

    bar.querySelector("#chapter-add").onclick = async () => {
      if (currentNode) await saveCurrentNode();
      const newChapter = await createChapter(game.id, `第${toCnNum(chapters.length + 1)}章`);
      currentChapterId = newChapter.id;
      currentNodeId = null;

      const startNode = await createNode(game.id, newChapter.id, {
        title: "开始",
        content: "",
        choices: [],
      });
      currentNodeId = startNode.id;

      await loadChapters();
      await loadNodes();
      renderChaptersBar();
      renderNodesBar();
      renderBody();
      showToast("已新建章");
    };
  }

  /* ===== 渲染节点列表 ===== */
  function renderNodesBar() {
    const bar = el.querySelector("#nodes-bar");
    bar.innerHTML = `
      ${nodes.map(n => `
        <div class="node-chip ${n.id === currentNodeId ? "on" : ""}" data-id="${n.id}">
          ${escapeHtml(n.title || "未命名")}
        </div>
      `).join("")}
      <div class="node-chip node-chip-add" id="node-add">＋ 节点</div>
    `;

    bar.querySelectorAll(".node-chip").forEach(chip => {
      if (chip.id === "node-add") return;
      chip.onclick = async () => {
        if (chip.dataset.id === currentNodeId) return;
        if (currentNode) await saveCurrentNode();
        currentNodeId = chip.dataset.id;
        await loadNodes();
        renderNodesBar();
        renderBody();
      };
    });

    bar.querySelector("#node-add").onclick = async () => {
      if (currentNode) await saveCurrentNode();
      const newNode = await createNode(game.id, currentChapterId, {
        title: `节点 ${nodes.length + 1}`,
        content: "",
        choices: [],
      });
      currentNodeId = newNode.id;
      await loadNodes();
      renderNodesBar();
      renderBody();
      showToast("已新建节点");
    };
  }

  /* ===== 渲染编辑区 ===== */
  function renderBody() {
    const body = el.querySelector("#edit-body");
    if (!currentNode) {
      body.innerHTML = `<div class="empty-state">没有节点。</div>`;
      return;
    }

    const isStart = currentNode.id === game.startNodeId;
    const isEnding = editing.choices.length === 0;

    body.innerHTML = `
      <div class="form-field">
        <label>小标题</label>
        <input type="text" class="input" id="node-title" value="${escapeHtml(editing.title)}" maxlength="30">
      </div>

      <div class="form-field">
        <label>正文</label>
        <textarea class="input" id="node-content" style="min-height:180px;resize:vertical;line-height:1.8;">${escapeHtml(editing.content)}</textarea>
        <button class="btn ghost" id="btn-ai-polish" style="width:100%;margin-top:8px;padding:10px;color:var(--cinnabar);border-color:var(--cinnabar);">
          ✨ AI 一键润色（扩写细节）
        </button>
      </div>

      <div class="form-field">
        <label>选项${isEnding ? ` <span style="font-size:11px;color:var(--cinnabar);">（无选项 = 结局）</span>` : ""}</label>
        <div id="choices-list"></div>
        <button class="btn ghost" id="choice-add" style="width:100%;padding:10px;margin-top:8px;">＋ 添加选项</button>
      </div>

      ${isEnding ? `
        <div class="form-field">
          <label>彩蛋文字（可选，结局时显示）</label>
          <input type="text" class="input" id="node-ending" value="${escapeHtml(editing.endingText)}" maxlength="60" placeholder="如：愿你所愿，皆能实现。">
        </div>

        <div class="form-field" style="border-top:1px solid var(--line-light);padding-top:16px;margin-top:8px;">
          <label style="color:var(--cinnabar);letter-spacing:3px;">—— 进 入 节 点 时 效 果 ——</label>
          <div style="font-size:11px;color:var(--ink-dim);margin-bottom:12px;">进入此结局节点时，自动触发以下效果</div>
          <div id="enter-effects-wrap"></div>
        </div>
      ` : ""}

      <div class="form-field" style="display:flex;gap:12px;margin-top:8px;">
        ${!isStart ? `<button class="btn ghost" id="btn-del-node" style="flex:1;padding:12px;color:var(--cinnabar);border-color:var(--cinnabar);">删 除 节 点</button>` : `<div style="flex:1;font-size:12px;color:var(--ink-dim);display:flex;align-items:center;justify-content:center;">开始节点不能删</div>`}
      </div>
    `;

    body.querySelector("#node-title").oninput = (e) => {
      editing.title = e.target.value;
    };
    body.querySelector("#node-content").oninput = (e) => {
    // 👈 加上 AI 润色逻辑
    const aiBtn = body.querySelector("#btn-ai-polish");
    if (aiBtn) {
      aiBtn.onclick = async () => {
        const currentText = body.querySelector("#node-content").value.trim();
        if (!currentText) return showToast("请先写一点正文再润色");

        aiBtn.disabled = true;
        aiBtn.textContent = "AI 正在打磨中…";

        try {
          const { requestAI } = await import("../services/ai-service.js");
          const messages = [
            { role: "system", content: "你是一个古风小说家。请对用户提供的这段剧情进行润色和扩写，增加环境描写、人物神态和动作细节，使其更符合宋代古风小说的质感。字数控制在 150-250 字之间。直接输出润色后的正文，不要任何废话和解释。" },
            { role: "user", content: currentText }
          ];
          
          const polished = await requestAI(messages);
          body.querySelector("#node-content").value = polished;
          editing.content = polished;
          showToast("润色完成");
        } catch (err) {
          showToast("润色失败：" + err.message);
        } finally {
          aiBtn.disabled = false;
          aiBtn.textContent = "✨ AI 一键润色（扩写细节）";
        }
      };
    }
      editing.content = e.target.value;
    };

    const endingInput = body.querySelector("#node-ending");
    if (endingInput) {
      endingInput.oninput = (e) => {
        editing.endingText = e.target.value;
      };
    }

    renderChoices(body.querySelector("#choices-list"));

    if (isEnding) {
      renderEnterEffects(body.querySelector("#enter-effects-wrap"));
    }

    body.querySelector("#choice-add").onclick = () => {
      editing.choices.push({
        text: "",
        nextNodeId: null,
        targetCharacterId: null,
        affection: 0,
        friendship: 0,
        effects: {},
      });
      renderChoices(body.querySelector("#choices-list"));
      // 有选项后「进入时效果」区域消失
      if (editing.choices.length > 0 && editing.enterEffects) {
        // 不清空，只隐藏
      }
      renderBody();
    };

    const delBtn = body.querySelector("#btn-del-node");
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = await showConfirm("删除节点", "引用了这个节点的选项会变成「目标丢失」。确定？");
        if (!ok) return;
        await deleteNode(currentNode.id);
        currentNodeId = null;
        await loadNodes();
        renderNodesBar();
        renderBody();
        showToast("已删除");
      };
    }
  }

  /* ===== 渲染「进入节点时效果」 ===== */
  function renderEnterEffects(container) {
    if (!editing.enterEffects) {
      editing.enterEffects = {
        targetCharacterId: null,
        affection: 0,
        friendship: 0,
        letter: { enabled: false, content: "" },
        post: { enabled: false, title: "", content: "" },
        chat: { enabled: false, content: "" },
      };
    }
    const eff = editing.enterEffects;

    container.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <span style="font-size:12px;color:var(--ink-dim);width:60px;flex-shrink:0;">触发角色</span>
        <select class="input" id="enter-char" style="flex:1;">
          <option value="">（不指定）</option>
          ${characters.map(c2 => `
            <option value="${c2.id}" ${eff.targetCharacterId === c2.id ? "selected" : ""}>${escapeHtml(c2.name)}</option>
          `).join("")}
        </select>
      </div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <span style="font-size:12px;color:var(--ink-dim);width:60px;flex-shrink:0;">爱慕</span>
        <input type="number" class="input" id="enter-aff" value="${eff.affection || 0}" style="width:70px;">
        <span style="font-size:12px;color:var(--ink-dim);width:40px;flex-shrink:0;">友善</span>
        <input type="number" class="input" id="enter-fri" value="${eff.friendship || 0}" style="width:70px;">
      </div>

      <div class="fx-block" style="margin-top:12px;">
        <div class="fx-title">副作用（可选）</div>
        <div class="fx-checks">
          <label class="fx-check">
            <input type="checkbox" id="enter-fx-letter" ${eff.letter?.enabled ? "checked" : ""}>
            <span>写信</span>
          </label>
          <label class="fx-check">
            <input type="checkbox" id="enter-fx-post" ${eff.post?.enabled ? "checked" : ""}>
            <span>心绪</span>
          </label>
          <label class="fx-check">
            <input type="checkbox" id="enter-fx-chat" ${eff.chat?.enabled ? "checked" : ""}>
            <span>聊天</span>
          </label>
        </div>

        ${eff.letter?.enabled ? `
          <textarea class="input" id="enter-fx-letter-content" style="min-height:60px;font-size:12px;margin-top:6px;" placeholder="信的内容……">${escapeHtml(eff.letter?.content || "")}</textarea>
        ` : ""}

        ${eff.post?.enabled ? `
          <input type="text" class="input" id="enter-fx-post-title" value="${escapeHtml(eff.post?.title || "")}" placeholder="帖子标题" style="font-size:12px;margin-top:6px;">
          <textarea class="input" id="enter-fx-post-content" style="min-height:60px;font-size:12px;margin-top:6px;" placeholder="帖子内容……">${escapeHtml(eff.post?.content || "")}</textarea>
        ` : ""}

        ${eff.chat?.enabled ? `
          <input type="text" class="input" id="enter-fx-chat-content" value="${escapeHtml(eff.chat?.content || "")}" placeholder="消息内容……" style="font-size:12px;margin-top:6px;">
        ` : ""}
      </div>
    `;

    const $ = id => container.querySelector("#" + id);


    $("enter-char").onchange = (e) => {
      editing.enterEffects.targetCharacterId = e.target.value || null;
    };
    $("enter-aff").oninput = (e) => {
      editing.enterEffects.affection = +e.target.value || 0;
    };
    $("enter-fri").oninput = (e) => {
      editing.enterEffects.friendship = +e.target.value || 0;
    };

    $("enter-fx-letter").onchange = (e) => {
      if (!editing.enterEffects.letter) editing.enterEffects.letter = {};
      editing.enterEffects.letter.enabled = e.target.checked;
      renderEnterEffects(container);
    };
    const letterContent = $("enter-fx-letter-content");
    if (letterContent) {
      letterContent.oninput = (e) => {
        editing.enterEffects.letter.content = e.target.value;
      };
    }

    $("enter-fx-post").onchange = (e) => {
      if (!editing.enterEffects.post) editing.enterEffects.post = {};
      editing.enterEffects.post.enabled = e.target.checked;
      renderEnterEffects(container);
    };
    const postTitle = $("enter-fx-post-title");
    if (postTitle) {
      postTitle.oninput = (e) => {
        editing.enterEffects.post.title = e.target.value;
      };
    }
    const postContent = $("enter-fx-post-content");
    if (postContent) {
      postContent.oninput = (e) => {
        editing.enterEffects.post.content = e.target.value;
      };
    }

    $("enter-fx-chat").onchange = (e) => {
      if (!editing.enterEffects.chat) editing.enterEffects.chat = {};
      editing.enterEffects.chat.enabled = e.target.checked;
      renderEnterEffects(container);
    };
    const chatContent = $("enter-fx-chat-content");
    if (chatContent) {
      chatContent.oninput = (e) => {
        editing.enterEffects.chat.content = e.target.value;
      };
    }
  }

  /* ===== 渲染选项 ===== */
  function renderChoices(container) {
    const nodesByChapter = {};
    for (const ch of chapters) {
      nodesByChapter[ch.id] = allNodes.filter(n => n.chapterId === ch.id);
    }

    container.innerHTML = editing.choices.map((c, i) => `
      <div class="choice-block" data-idx="${i}">
        <div class="choice-row">
          <input type="text" class="input choice-text" value="${escapeHtml(c.text)}" placeholder="选项文字" data-idx="${i}">
          <button class="btn ghost choice-del" data-idx="${i}" style="padding:6px 10px;color:var(--cinnabar);">×</button>
        </div>
        <div class="choice-row">
          <span class="choice-label">跳转到</span>
          <select class="input choice-target" data-idx="${i}">
            <option value="">（结局）</option>
            ${chapters.map(ch => `
              <optgroup label="${escapeHtml(ch.title)}">
                ${(nodesByChapter[ch.id] || []).map(n => `
                  <option value="${n.id}" ${c.nextNodeId === n.id ? "selected" : ""}>${escapeHtml(n.title || "未命名")}</option>
                `).join("")}
              </optgroup>
            `).join("")}
          </select>
        </div>
        <div class="choice-row">
          <span class="choice-label">角色</span>
          <select class="input choice-char" data-idx="${i}">
            <option value="">（不指定）</option>
            ${characters.map(c2 => `
              <option value="${c2.id}" ${c.targetCharacterId === c2.id ? "selected" : ""}>${escapeHtml(c2.name)}</option>
            `).join("")}
          </select>
        </div>
        <div class="choice-row choice-nums">
          <span class="choice-label">爱慕</span>
          <input type="number" class="input choice-aff" value="${c.affection || 0}" data-idx="${i}" style="width:60px;">
          <span class="choice-label">友善</span>
          <input type="number" class="input choice-fri" value="${c.friendship || 0}" data-idx="${i}" style="width:60px;">
        </div>

    <div class="fx-block">
      <div class="fx-title">副作用（可选）</div>
      <div class="fx-checks">
        <label class="fx-check">
          <input type="checkbox" class="choice-fx-letter" data-idx="${i}" ${c.effects?.letter?.enabled ? "checked" : ""}>
          <span>写信</span>
        </label>
        <label class="fx-check">
          <input type="checkbox" class="choice-fx-post" data-idx="${i}" ${c.effects?.post?.enabled ? "checked" : ""}>
          <span>心绪</span>
        </label>
        <label class="fx-check">
          <input type="checkbox" class="choice-fx-chat" data-idx="${i}" ${c.effects?.chat?.enabled ? "checked" : ""}>
          <span>聊天</span>
        </label>
      </div>

      ${c.effects?.letter?.enabled ? `
        <textarea class="input choice-fx-letter-content" data-idx="${i}" style="min-height:60px;font-size:12px;margin-top:6px;" placeholder="信的内容……">${escapeHtml(c.effects?.letter?.content || "")}</textarea>
      ` : ""}

      ${c.effects?.post?.enabled ? `
        <input type="text" class="input choice-fx-post-title" data-idx="${i}" value="${escapeHtml(c.effects?.post?.title || "")}" placeholder="帖子标题" style="font-size:12px;margin-top:6px;">
        <textarea class="input choice-fx-post-content" data-idx="${i}" style="min-height:60px;font-size:12px;margin-top:6px;" placeholder="帖子内容……">${escapeHtml(c.effects?.post?.content || "")}</textarea>
      ` : ""}

      ${c.effects?.chat?.enabled ? `
        <input type="text" class="input choice-fx-chat-content" data-idx="${i}" value="${escapeHtml(c.effects?.chat?.content || "")}" placeholder="消息内容……" style="font-size:12px;margin-top:6px;">
      ` : ""}
    </div>

        ${!c.nextNodeId ? `
          <div class="choice-row" style="flex-direction:column;align-items:stretch;gap:6px;margin-top:6px;">
            <div style="font-size:11px;color:var(--ink-dim);letter-spacing:2px;">结局文字（可选）</div>
            <input type="text" class="input choice-ending" data-idx="${i}" value="${escapeHtml(c.endingText || "")}" placeholder="如：此去经年，山高水长。" maxlength="60" style="font-size:12px;">
          </div>
        ` : ""}
      </div>
    `).join("");

    // 绑定
    container.querySelectorAll(".choice-text").forEach(input => {
      input.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].text = e.target.value;
      };
    });

    container.querySelectorAll(".choice-target").forEach(sel => {
      sel.onchange = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].nextNodeId = e.target.value || null;
        renderChoices(container);
      };
    });

    container.querySelectorAll(".choice-char").forEach(sel => {
      sel.onchange = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].targetCharacterId = e.target.value || null;
      };
    });

    container.querySelectorAll(".choice-aff").forEach(input => {
      input.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].affection = +e.target.value || 0;
      };
    });

    container.querySelectorAll(".choice-fri").forEach(input => {
      input.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].friendship = +e.target.value || 0;
      };
    });

    container.querySelectorAll(".choice-ending").forEach(input => {
      input.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].endingText = e.target.value;
      };
    });

    // 副作用：信
    container.querySelectorAll(".choice-fx-letter").forEach(cb => {
      cb.onchange = (e) => {
        const i = +e.target.dataset.idx;
        if (!editing.choices[i].effects) editing.choices[i].effects = {};
        if (!editing.choices[i].effects.letter) editing.choices[i].effects.letter = {};
        editing.choices[i].effects.letter.enabled = e.target.checked;
        renderChoices(container);
      };
    });
    container.querySelectorAll(".choice-fx-letter-content").forEach(ta => {
      ta.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].effects.letter.content = e.target.value;
      };
    });

    // 副作用：心绪
    container.querySelectorAll(".choice-fx-post").forEach(cb => {
      cb.onchange = (e) => {
        const i = +e.target.dataset.idx;
        if (!editing.choices[i].effects) editing.choices[i].effects = {};
        if (!editing.choices[i].effects.post) editing.choices[i].effects.post = {};
        editing.choices[i].effects.post.enabled = e.target.checked;
        renderChoices(container);
      };
    });
    container.querySelectorAll(".choice-fx-post-title").forEach(inp => {
      inp.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].effects.post.title = e.target.value;
      };
    });
    container.querySelectorAll(".choice-fx-post-content").forEach(ta => {
      ta.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].effects.post.content = e.target.value;
      };
    });

    // 副作用：聊天
    container.querySelectorAll(".choice-fx-chat").forEach(cb => {
      cb.onchange = (e) => {
        const i = +e.target.dataset.idx;
        if (!editing.choices[i].effects) editing.choices[i].effects = {};
        if (!editing.choices[i].effects.chat) editing.choices[i].effects.chat = {};
        editing.choices[i].effects.chat.enabled = e.target.checked;
        renderChoices(container);
      };
    });
    container.querySelectorAll(".choice-fx-chat-content").forEach(inp => {
      inp.oninput = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices[i].effects.chat.content = e.target.value;
      };
    });

    container.querySelectorAll(".choice-del").forEach(btn => {
      btn.onclick = (e) => {
        const i = +e.target.dataset.idx;
        editing.choices.splice(i, 1);
        renderChoices(container);
        if (editing.choices.length === 0) renderBody();
      };
    });
  }

  /* ===== 启动 ===== */
  await loadChapters();
  await loadNodes();
  renderChaptersBar();
  renderNodesBar();
  renderBody();

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
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

