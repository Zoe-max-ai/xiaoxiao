import { pageHeader } from "../ui/page-header.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { GIFTS } from "../data/gift-data.js";

export async function guichuInventoryView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  // 获取你拥有的礼物
  const inventoryRecords = (await db.all("inventory")).filter(i => i.ownerId === ownerId && i.count > 0);
  
  // 如果背包空空如也
  if (inventoryRecords.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="margin-top: 60px;">
        百宝阁空空如也。<br>
        <span style="font-size: 12px; color: var(--ink-dim);">去「同游」或者找 NPC 寻些宝贝吧。</span>
      </div>
    `;
    el.insertBefore(pageHeader("藏品", "#/guichu"), el.firstChild);
    return el;
  }

  el.innerHTML = `
    <div style="padding: 16px;">
      <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 12px; text-align: center;">
        你收集的奇珍异宝与心意
      </div>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;" id="gift-grid"></div>
    </div>
  `;

  el.insertBefore(pageHeader("藏品", "#/guichu"), el.firstChild);

  const grid = el.querySelector("#gift-grid");
  
  // 只渲染真正拥有的物品
  grid.innerHTML = inventoryRecords.map(record => {
    const g = GIFTS[record.giftId];
    if (!g) return ""; // 防止有废弃的礼物 ID 报错
    
    return `
      <div class="gift-item" style="
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 16px 8px; background: var(--paper); border: 1px solid var(--line-light);
        border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);
      ">
        <!-- 单字印章 -->
        <div style="
          width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--cinnabar);
          color: var(--cinnabar); font-family: var(--font-title); font-size: 20px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(163, 51, 51, 0.05);
        ">${g.char}</div>
        
        <div style="font-family:var(--font-title); font-size:13px; color:var(--ink); text-align:center;">${g.name}</div>
        <div style="font-size:11px; color:var(--cinnabar); font-weight: bold;">拥有：${record.count} 个</div>
      </div>
    `;
  }).join("");

  return el;
}