import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { getImageUrl } from "../services/seed-service.js";
import { deleteGame, getAllGames, getCompletedGames, getSaveByGame } from "../services/game-service.js";
import { showCropModal } from "../ui/image-cropper.js";
import { uid } from "../core/uid.js"; // 👈 新增这个，导入的时候要用它生成新 ID
import { openImagePicker } from "../ui/image-picker.js";

export async function wangshiView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;

  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  let currentTab = "play";

  // 读取本地缓存的往事封面
  const savedWangshiCover = localStorage.getItem("wangshi_cover_url");
  const defaultWangshiBg = savedWangshiCover 
    ? `url('${savedWangshiCover}')` 
    : 'linear-gradient(135deg, #e8f0ec 0%, #b4cac1 100%)'; // 默认高级青绿纯色

  el.innerHTML = `
    <!-- 1. 顶部沉浸式大卡片 (可点击换图) -->
    <div id="wangshi-hero-card" style="
      position: relative;
      width: 100vw;
      height: 220px;
      margin: 0 0 16px 0;
      background-image: ${defaultWangshiBg};
      background-size: cover;
      background-position: center;
      cursor: pointer;
    ">
      <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 40%);"></div>
      
      <div style="position: absolute; bottom: 20px; left: 24px; right: 24px; color: #fff;">
        <h2 style="font-family: var(--font-title); font-size: 26px; letter-spacing: 6px; margin: 0 0 6px; font-weight: normal; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">往 事</h2>
        <p style="font-size: 12px; opacity: 0.9; margin: 0; letter-spacing: 2px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 1px; background: var(--gold, #d4af37);"></span>
          回首向来萧瑟处，也无风雨也无晴
        </p>
      </div>
      
      <input type="file" id="wangshi-upload" accept="image/*" style="display: none;">
    </div>

    <!-- 2. 分类 Tab -->
    <div class="wangshi-tabs" style="display:flex; gap:8px; padding: 0 20px 16px; justify-content: center;">
      <div class="wangshi-tab ${currentTab === "play" ? "on" : ""}" data-tab="play">游 玩</div>
      <div class="wangshi-tab ${currentTab === "read" ? "on" : ""}" data-tab="read">阅 读</div>
      <div class="wangshi-tab ${currentTab === "create" ? "on" : ""}" data-tab="create">创 作</div>
      <div class="wangshi-tab ${currentTab === "favorite" ? "on" : ""}" data-tab="favorite">收 藏</div>
    </div>

    <!-- 3. 内容区 -->
    <div id="wangshi-content" style="padding: 0 20px;"></div>
  `;

// 👈 绑定卡片点击换图逻辑
const wangshiHero = el.querySelector("#wangshi-hero-card");
const wangshiUpload = el.querySelector("#wangshi-upload");
wangshiHero.onclick = () => {
  openImagePicker("illustration", async (imgId) => {
    const img = await db.get("images", imgId);
    if (img && img.origin && img.origin.data) {
      const base64Url = img.origin.data;
      showCropModal(base64Url, (croppedBase64) => {
        wangshiHero.style.backgroundImage = `url('${croppedBase64}')`;
        localStorage.setItem("wangshi_cover_url", croppedBase64);
        showToast("往事画卷已裁剪并更换");
      });
    }
  });
};
wangshiUpload.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64Url = event.target.result;
    
    // 👈 调用裁剪工具
    showCropModal(base64Url, async (croppedBase64) => {
      try {
        // 1. 立刻更新 UI
        wangshiHero.style.backgroundImage = `url('${croppedBase64}')`;
        
        // 2. 存进本地缓存（下次刷新秒开）
        localStorage.setItem("wangshi_cover_url", croppedBase64);
        // 3. 👈 核心：把裁剪后的图转成 Blob 并存入数据库，以便备份
        const { db } = await import("../core/db.js");
        const res = await fetch(croppedBase64);
        const blob = await res.blob();
        // 生成一张小的缩略图用于备份，防止数据库爆炸
        const img = new Image();
        img.src = croppedBase64;
        await new Promise(r => img.onload = r);
        const canvas = document.createElement("canvas");
        canvas.width = 400; 
        canvas.height = 220;
        canvas.getContext("2d").drawImage(img, 0, 0, 400, 220);
        const thumbBlob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.7));
        const id = "img_wangshi_cover_" + Date.now();
        await db.put("images", {
          id: id,
          category: "game_cover", // 👈 分类标识
          name: "往事封面_" + new Date().toLocaleDateString(),
          origin: { data: blob, mime: blob.type },
          thumb: { data: thumbBlob, mime: "image/jpeg" },
          createdAt: Date.now()
        });
        // 把生成的 id 也存下来，方便以后“从绘卷选图”时回显
        localStorage.setItem("wangshi_cover_id", id);
        
        showToast("画卷已更新并备份");
      } catch (err) {
        console.error(err);
        showToast("图片保存失败");
      }
    });
    reader.readAsDataURL(file);
  };
};


  // ====== 下面是你的 Tab 绑定和渲染逻辑（没动） ======
  const contentEl = el.querySelector("#wangshi-content");

  el.querySelectorAll(".wangshi-tab").forEach(tab => {
    tab.onclick = () => {
      currentTab = tab.dataset.tab;
      el.querySelectorAll(".wangshi-tab").forEach(t => t.classList.toggle("on", t.dataset.tab === currentTab));
      render();
    };
  });

  async function render() {
    if (currentTab === "play") await renderPlay(contentEl, ownerId);
    else if (currentTab === "read") await renderRead(contentEl, ownerId);
    else if (currentTab === "create") await renderCreate(contentEl, ownerId);
    else if (currentTab === "favorite") await renderFavorite(contentEl, ownerId);
  }

  await render();
  return el;
}

/* ============================================================
 * 游玩 —— 已完成的游戏（网格）
 * ============================================================ */
async function renderPlay(container, ownerId) {
  const games = await getCompletedGames(ownerId);

  if (!games.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        还没有可玩的游戏。<br>
        去「创作」写一个，然后标记完成吧。
      </div>
    `;
    return;
  }

  const gamesWithCovers = await Promise.all(games.map(async g => {
    const save = await getSaveByGame(ownerId, g.id);
    // 获取这本游戏所有的节点，算总进度
    const allNodes = await db.all("game_nodes");
    const gameNodes = allNodes.filter(n => n.gameId === g.id);
    
    const totalNodes = gameNodes.length;
    const playedNodes = save?.visitedNodeIds?.length || 0;

    return {
      ...g,
      coverUrl: g.coverImageId ? await getImageUrl(g.coverImageId, true) : null,
      hasSave: !!save,
      progress: `${playedNodes} / ${totalNodes} 幕`
    };
  }));

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${gamesWithCovers.map(g => `
        <div class="game-list-card" data-id="${g.id}" style="
          display: flex; gap: 16px; padding: 12px; 
          background: var(--paper); border: 1px solid var(--line-light);
          border-radius: 12px; cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        ">
          <!-- 左侧封面 -->
          <div style="
            width: 80px; height: 106px; border-radius: 8px; flex-shrink: 0;
            background: var(--paper-soft) url('${g.coverUrl || ''}') center/cover;
            position: relative;
          ">
            <div style="
              position: absolute; bottom: 0; left: 0; right: 0;
              background: rgba(0, 0, 0, 0.6); color: #fff;
              font-size: 10px; text-align: center; padding: 3px 0;
              border-radius: 0 0 8px 8px;
            ">
              ${g.progress}
            </div>
          </div>
          
          <!-- 右侧信息 -->
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-family:var(--font-title); font-size:16px; color:var(--ink); letter-spacing:1px; margin-bottom:4px;">
              ${escapeHtml(g.title)}
            </div>
            <div style="font-size:12px; color:var(--ink-dim); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(g.description || "无简介")}
            </div>

            
            <div style="display: flex; gap: 10px;">
              <button class="btn" id="btn-play-${g.id}" style="flex: 1; padding: 8px; font-size: 12px;">继续游玩</button>
              <button class="btn ghost" id="btn-read-${g.id}" style="flex: 1; padding: 8px; font-size: 12px;">阅读全书</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  // 绑定点击事件
  gamesWithCovers.forEach(g => {
    // 点击卡片游玩
    container.querySelector(`[data-id="${g.id}"]`).onclick = (e) => {
      // 如果点的是阅读按钮，不触发游玩
      if (e.target.id === `btn-read-${g.id}`) return;
      location.hash = `#/wangshi/game/play/${g.id}`;
    };
    
    // 点阅读按钮
    const readBtn = container.querySelector(`#btn-read-${g.id}`);
    readBtn.onclick = (e) => {
      e.stopPropagation();
      location.hash = `#/wangshi/game/read/${g.id}`;
    };
  });
}

/* ============================================================
 * 阅读
 * ============================================================ */
async function renderRead(container, ownerId) {
  // 1. 获取所有已完成的游戏
  const games = await getCompletedGames(ownerId);

  // 2. 如果没游戏，显示空状态并退出
  if (!games.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        还没有可阅读的剧本。<br>
        去「创作」写一个，或者用 AI 生成一本吧。
      </div>
    `;
    return;
  }

  // 3. 预加载封面
  const gamesWithCovers = await Promise.all(games.map(async g => ({
    ...g,
    coverUrl: g.coverImageId ? await getImageUrl(g.coverImageId, true) : null,
  })));

  // 4. 渲染成网格，像两本书并列
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 4px;">
      ${gamesWithCovers.map(g => `
        <div class="game-book-card" data-id="${g.id}" style="
          display: flex; flex-direction: column; cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
          
          <!-- 封面图 -->
          <div style="
            width: 100%; aspect-ratio: 3/4; border-radius: 8px;
            background: var(--paper-soft) url('${g.coverUrl || ''}') center/cover;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-bottom: 8px;
          "></div>
          
          <!-- 书名 -->
          <div style="font-family:var(--font-title); font-size:14px; color:var(--ink); text-align:center; letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(g.title)}
          </div>
        </div>
      `).join("")}
    </div>
  `;

  // 5. 绑定点击事件，直接跳去阅读页（只需要这一处绑定！）
  gamesWithCovers.forEach(g => {
    const card = container.querySelector(`[data-id="${g.id}"]`);
    if (card) {
      card.onclick = () => {
        location.hash = `#/wangshi/game/read/${g.id}`;
      };
    }
  });
}

/* ============================================================
 * 创作 —— 用户创建的游戏（列表）
 * ============================================================ */
async function renderCreate(container, ownerId) {
  const all = await db.all("games");
  const myGames = all
    .filter(g => g.ownerId === ownerId)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  container.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:16px;">
      <button class="btn ghost" id="btn-new-ai" style="flex:1; padding:10px 0; letter-spacing:1px; font-size:13px;">AI 生成</button>
      <button class="btn" id="btn-new-game" style="flex:1; padding:10px 0; letter-spacing:1px; font-size:13px;">新建文游</button>
      <button class="btn ghost" id="btn-import-game" style="flex:1; padding:10px 0; letter-spacing:1px; font-size:13px; border-style:dashed;">导入文游</button>
    </div>
    <div id="game-list"></div>
  `;

  const listEl = container.querySelector("#game-list");

  if (!myGames.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        还没有创作。<br>
        <button class="btn" id="btn-first-create" style="margin-top:20px;padding:10px 24px;">开始创作</button>
      </div>
    `;
    listEl.querySelector("#btn-first-create").onclick = () => {
      location.hash = "#/wangshi/game/new";
    };
  } else {
    listEl.innerHTML = myGames.map(g => `
      <div class="game-card" data-id="${g.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div class="game-card-title">${escapeHtml(g.title)}</div>
            <div class="game-card-meta">${g.nodeCount || 0} 幕 · ${g.isCompleted ? "已完成" : "草稿"} · ${formatTime(g.updatedAt)}</div>
          </div>
          <button class="game-del" data-id="${g.id}" style="
            background:none;border:none;
            color:var(--cinnabar);
            font-size:16px;
            padding:4px 8px;
            cursor:pointer;
            flex-shrink:0;
          ">×</button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".game-card").forEach(card => {
      card.onclick = (e) => {
        if (e.target.classList.contains("game-del")) return;
        location.hash = `#/wangshi/game/edit/${card.dataset.id}`;
      };
    });

    listEl.querySelectorAll(".game-del").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const gameId = e.target.dataset.id;
        const game = myGames.find(g => g.id === gameId);
        const ok = await showConfirm("删除游戏", `确定删除「${game.title}」？所有节点和存档会一起删除。`);
        if (!ok) return;
        await deleteGame(gameId);
        showToast("已删除");
        renderCreate(container, ownerId);
      };
    });
  }

  container.querySelector("#btn-new-game").onclick = () => {
    location.hash = "#/wangshi/game/new";
  };

  // 👈 加上导入功能
  container.querySelector("#btn-import-game").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.game || !data.chapters || !data.nodes) {
          return showToast("文件格式错误，不是有效的文游文件");
        }

        showToast("正在导入…");

        // 1. 生成新的 ID，防止覆盖原有数据
        const newGameId = uid("game");
        
        // 2. 写入游戏本体
        await db.put("games", {
          ...data.game,
          id: newGameId,
          ownerId: ownerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          coverImageId: null, // 导入的暂时不带封面（或者你用 Base64 传封面也行）
        });

        // 3. 写入章节，并替换对应的 gameId
        const chapterIdMap = {}; // 记录新旧章节 ID 的映射
        for (const ch of data.chapters) {
          const newChId = uid("chapter");
          chapterIdMap[ch.id] = newChId;
          await db.put("game_chapters", {
            ...ch,
            id: newChId,
            gameId: newGameId,
          });
        }

        // 4. 写入节点，替换 gameId 和 章节 ID
        const nodeIdMap = {};
        for (const node of data.nodes) {
          const newNodeId = uid("node");
          nodeIdMap[node.id] = newNodeId;
        }

        // 因为选项里引用了 nextNodeId，需要二次遍历替换
        for (const node of data.nodes) {
          const newChoices = (node.choices || []).map(c => ({
            ...c,
            nextNodeId: nodeIdMap[c.nextNodeId] || null
          }));

          await db.put("game_nodes", {
            ...node,
            id: nodeIdMap[node.id],
            gameId: newGameId,
            chapterId: chapterIdMap[node.chapterId],
            choices: newChoices,
          });
        }

        // 5. 更新游戏的 startNodeId 指向新的节点 ID
        const newStartNodeId = nodeIdMap[data.game.startNodeId];
        if (newStartNodeId) {
          const gameRecord = await db.get("games", newGameId);
          gameRecord.startNodeId = newStartNodeId;
          await db.put("games", gameRecord);
        }

        showToast("导入成功！");
        await renderCreate(container, ownerId);

      } catch (err) {
        console.error(err);
        showToast("导入失败，文件可能损坏");
      }
    };
    input.click();
  };

  container.querySelector("#btn-new-ai").onclick = () => {
    location.hash = "#/wangshi/game/new-ai";
  };
}

/* ============================================================
 * 收藏
 * ============================================================ */
async function renderFavorite(container, ownerId) {
  const favs = (await db.all("game_favorites"))
    .filter(f => f.ownerId === ownerId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!favs.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        还没有收藏的剧情。<br>
        去游玩时，遇到喜欢的分支记得点「收藏」哦。
      </div>
    `;
    return;
  }

  // 1. 预先查出所有关联的节点和游戏信息
  const items = [];
  for (const f of favs) {
    const node = await db.get("game_nodes", f.nodeId);
    const game = await db.get("games", f.gameId);
    if (node && game) {
      items.push({ node, game, fav: f });
    }
  }

  // 2. 给每个游戏卡片加载封面
  const itemsWithCovers = await Promise.all(items.map(async (it) => ({
    ...it,
    coverUrl: it.game.coverImageId ? await getImageUrl(it.game.coverImageId, true) : null,
  })));

  // 3. 渲染两列网格
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 4px;">
      ${itemsWithCovers.map(it => `
        <div class="fav-card" data-game="${it.game.id}" data-node="${it.node.id}" style="
          display: flex; flex-direction: column;
          background: var(--paper); border: 1px solid var(--line-light);
          border-radius: 10px; overflow: hidden; cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
          
          <!-- 顶部封面半隐层 -->
          <div style="
            height: 60px;
            background: var(--paper-soft) url('${it.coverUrl || ''}') center 30%/cover;
            position: relative;
          ">
            <div style="
              position: absolute; inset: 0;
              background: linear-gradient(to top, var(--paper) 0%, transparent 100%);
            "></div>
          </div>

          <!-- 内容区 -->
          <div style="padding: 0 12px 12px; margin-top: -20px; position: relative; z-index: 2;">
            <!-- 节点名 -->
            <div style="font-family:var(--font-title); font-size:15px; color:var(--cinnabar); letter-spacing:1px; margin-bottom: 4px; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
              ${escapeHtml(it.node.title || "无题")}
            </div>
            
            <!-- 游戏名 -->
            <div style="font-size:11px; color:var(--ink-dim); margin-bottom: 8px;">
              《${escapeHtml(it.game.title)}》
            </div>
            
            <!-- 正文预览（截取前35个字） -->
            <div style="font-size:12px; color:var(--ink-soft); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px;">
              ${escapeHtml((it.node.content || "").slice(0, 35))}...
            </div>
            

            <!-- 底部：取消收藏 + 时间 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <!-- 取消收藏小按钮 -->
              <span class="btn-cancel-fav" data-id="${it.fav.id}" style="
                font-size: 10px; color: var(--ink-dim); 
                cursor: pointer; padding: 2px 4px; border-radius: 4px;
                border: 1px dashed var(--line-light);
                transition: all 0.2s;
              " onmouseover="this.style.color='var(--cinnabar)'; this.style.borderColor='var(--cinnabar)'" onmouseout="this.style.color='var(--ink-dim)'; this.style.borderColor='var(--line-light)'">
                取消收藏
              </span>
              
              <!-- 收藏时间 -->
              <div style="font-size:10px; color: var(--ink-dim);">
                ${formatTime(it.fav.createdAt)}
              </div>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  // 4. 绑定点击事件，直接跳到那个节点继续游玩
  container.querySelectorAll(".fav-card").forEach(card => {
    card.onclick = () => {
      const gameId = card.dataset.game;
      const nodeId = card.dataset.node;
      // 跳转到游玩页，并带上当前节点参数（如果你的游戏支持直接跳到指定节点的话）
      location.hash = `#/wangshi/game/play/${gameId}?node=${nodeId}`;
    };
  });

 // 👈 新增：绑定取消收藏事件
  container.querySelectorAll(".btn-cancel-fav").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation(); // 👈 关键！阻止触发外层卡片的跳转
      
      const favId = btn.dataset.id;
      const ok = await showConfirm("取消收藏", "确定要取消收藏这段剧情吗？");
      if (!ok) return;

      // 删除数据库里的收藏记录
      await db.del("game_favorites", favId);
      showToast("已取消收藏");
      
      // 重新渲染当前页面
      await renderFavorite(container, ownerId);
    };
  });

}

/* ============================================================
 * 工具
 * ============================================================ */
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}