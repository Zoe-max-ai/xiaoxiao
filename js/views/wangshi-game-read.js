import { pageHeader } from "../ui/page-header.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import {
  getGame, getChaptersByGame, getNodesByGame
} from "../services/game-service.js";

export async function wangshiGameReadView({ params }) {
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
  if (!game) {
    el.innerHTML = `<div class="empty-state">游戏不存在。</div>`;
    return el;
  }

  // 1. 拉取所有章节和节点
  const chapters = await getChaptersByGame(game.id);
  const allNodes = await getNodesByGame(game.id);

  // 2. 按章节排序，把节点按顺序摊平成一个“单线小说”列表
  let flatNodes = [];
  chapters.forEach(ch => {
    const chapterNodes = allNodes
      .filter(n => n.chapterId === ch.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    flatNodes = flatNodes.concat(chapterNodes);
  });

  if (!flatNodes.length) {
    el.innerHTML = `<div class="empty-state">这本剧本还没有内容。</div>`;
    return el;
  }

  // 3. 初始化阅读进度
  let currentIndex = 0; 

  /* ===== HTML 框架 ===== */
  el.innerHTML = `
    <div class="gameplay-topbar">
      <button class="gameplay-back" id="btn-back">←</button>
      <div class="gameplay-title">${escapeHtml(game.title)} · 阅读</div>
      <div style="width:32px;"></div> <!-- 占位，保持标题居中 -->
    </div>

    <div class="gameplay-content" id="play-content"></div>
  `;

  el.querySelector("#btn-back").onclick = () => { location.hash = "#/wangshi"; };

  /* ===== 渲染当前页 ===== */
  async function renderPage() {
    const node = flatNodes[currentIndex];
    const contentEl = el.querySelector("#play-content");

    // 找到当前节点属于哪一章，用于顶部显示
    const currentChapter = chapters.find(ch => ch.id === node.chapterId);
    const chapterTitle = currentChapter ? currentChapter.title : "";

    contentEl.innerHTML = `
      <div style="text-align:center; font-family:var(--font-title); font-size:12px; color:var(--ink-dim); letter-spacing:4px; margin-bottom:8px;">
        ${escapeHtml(chapterTitle)}
      </div>
      
      <div class="gameplay-paper">
        <div class="gameplay-text" id="typewriter-text"></div>
      </div>

      <div class="gameplay-reader-nav" id="reader-nav" style="opacity: 0; transition: opacity 0.5s ease;">
        <button class="btn ghost" id="btn-prev" ${currentIndex === 0 ? 'style="visibility:hidden;"' : ''}>← 上一页</button>
        <button class="btn" id="btn-next" ${currentIndex === flatNodes.length - 1 ? 'style="visibility:hidden;"' : ''}>下一页 →</button>
      </div>
      
      ${currentIndex === flatNodes.length - 1 ? `
        <div style="text-align:center; margin-top: 30px;">
          <button class="btn" id="btn-exit-read" style="padding:12px 30px; letter-spacing:2px;">读完，回到往事</button>
        </div>
      ` : ""}
    `;

    // 👈 打字机效果
    const textEl = contentEl.querySelector("#typewriter-text");
    const navWrap = contentEl.querySelector("#reader-nav");
    const fullText = (node.content || "").replace(/\n/g, "<br>");
    let charIdx = 0;
    textEl.innerHTML = "";

    // 👈 取消打字机，直接显示全文
    textEl.innerHTML = fullText;
    
    // 直接让导航按钮浮现
    if (navWrap) navWrap.style.opacity = "1";

    // 👈 按钮事件
    const prevBtn = contentEl.querySelector("#btn-prev");
    const nextBtn = contentEl.querySelector("#btn-next");
    const exitBtn = contentEl.querySelector("#btn-exit-read");

    if (prevBtn && currentIndex > 0) {
      prevBtn.onclick = () => { currentIndex--; renderPage(); };
    }
    if (nextBtn && currentIndex < flatNodes.length - 1) {
      nextBtn.onclick = () => { currentIndex++; renderPage(); };
    }
    if (exitBtn) {
      exitBtn.onclick = () => { location.hash = "#/wangshi"; };
    }

    window.scrollTo(0, 0);
  }

  await renderPage();
  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}