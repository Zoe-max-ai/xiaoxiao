import { pageHeader } from "../ui/page-header.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";

export async function guichuGamesView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) return el;


  const games = [
    { id: "duiyi", name: "对弈", desc: "黑白交错，棋局如人生。", icon: "弈" },
    { id: "touhu", name: "投壶", desc: "宴饮雅戏，箭矢入壶。", icon: "投" }
  ];

  // 注意：这里去掉了 el.innerHTML 里的 <div class="section-title">闲 事 阁</div>
  // 因为 pageHeader 已经包含了标题
  el.innerHTML = `
    <div style="font-size:12px; color:var(--ink-dim); margin: 16px 0 16px 20px; letter-spacing: 1px;">
      与君同乐，共度闲暇时光。
    </div>
    
    <div style="display:flex; flex-direction:column; gap:12px; padding: 0 20px;">
      ${games.map(g => `
        <div class="game-card" data-id="${g.id}" style="
          background: var(--paper); border: 1px solid var(--line-light);
          border-radius: 12px; padding: 16px; cursor: pointer;
          display: flex; align-items: center; gap: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          
          <!-- 👈 用古风印章替代现代图标 -->
          <div style="
            width: 44px; height: 44px; border-radius: 8px;
            background: rgba(163, 51, 51, 0.08); border: 1px solid var(--cinnabar);
            color: var(--cinnabar); font-family: var(--font-title); font-size: 20px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          ">${g.icon}</div>
          
          <div style="flex: 1;">
            <div style="font-family: var(--font-title); font-size: 16px; color: var(--ink); margin-bottom: 4px; letter-spacing: 2px;">${g.name}</div>
            <div style="font-size: 12px; color: var(--ink-dim);">${g.desc}</div>
          </div>
          <span style="color: var(--ink-dim); font-size: 16px;">›</span>
        </div>
      `).join("")}
    </div>
  `;
  
  // 把原来的 闲事阁 标题换成 闲时雅戏
  el.insertBefore(pageHeader("闲 时 雅 戏", "#/guichu"), el.firstChild);

  el.querySelectorAll(".game-card").forEach(card => {
    card.onclick = () => {
      location.hash = `#/guichu/games/play/solo/${card.dataset.id}`;
    };
  });

  el.querySelectorAll(".game-card").forEach(card => {
    card.onclick = () => {
      location.hash = `#/guichu/games/play/solo/${card.dataset.id}`;
    };
  });

  return el;
}