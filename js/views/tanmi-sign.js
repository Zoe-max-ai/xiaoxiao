import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { db } from "../core/db.js";
import { drawSign, getSignHistory } from "../services/divination-service.js";

export async function tanmiSignView() {
  const el = document.createElement("div");
  el.className = "sign-page";

  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const categories = ["感情", "事业", "平安"];
  let currentCategory = "感情";

  el.innerHTML = `
    <div class="sign-main-wrap" style="position: relative; display: flex; flex-direction: column; align-items: center; width: 100%;">
      
      <!-- 签筒和素材的整体容器 -->
      <div style="position: relative; width: 100%; height: 380px; display: flex; justify-content: center; align-items: flex-end; margin-top: 20px;">
        
        <!-- 签筒本体 -->
        <div class="sign-cylinder-wrap" id="sign-cylinder" style="position: relative; bottom: 0;">
          <div class="sign-sticks" id="sign-sticks"></div>
          <div class="sign-cylinder">
            <div class="sign-cylinder-top"></div>
            <!-- 👈 把素材塞进筒身内部，作为花纹 -->
            <div class="sign-cylinder-body">
              <img src="assets/seed/deco/deco-bamboo-01.png" class="pattern-bamboo" alt="">
              <img src="assets/seed/deco/deco-crane.png" class="pattern-crane" alt="">
            </div>
          </div>
        </div>
      </div>

      <!-- 分类标签 -->
      <div class="sign-categories" style="margin-top: 10px; margin-bottom: 16px;">
        ${categories.map(c => `
          <div class="sign-category-tab ${c === currentCategory ? "active" : ""}" data-cat="${c}">${c}</div>
        `).join("")}
      </div>

      <!-- 抽签按钮 -->
      <button class="sign-draw-btn" id="sign-draw-btn" style="margin: 0 auto;">凝 神 抽 签</button>
    </div>


    <!-- 抽签结果面板 -->
    <div class="sign-result-panel" id="sign-result">
      <div id="r-category" style="font-size: 12px; color: var(--ink-dim); letter-spacing: 4px; margin-bottom: 12px;"></div>
      <div class="grade" id="r-grade"></div>
      <div class="poem" id="r-poem"></div>
      <div class="meaning" id="r-meaning"></div>
      <div class="hint">点此收起</div>
    </div>

    <!-- 历史记录 -->
    <div class="sign-history" id="sign-history">
      <h3>往 日 签 文</h3>
      <div id="sign-history-list"></div>
    </div>
  `;

  el.insertBefore(pageHeader("抽 签", "#/tanmi"), el.firstChild);

  // 初始化签筒内的签
  const sticksEl = el.querySelector("#sign-sticks");
  
  // 重新设计的位置参数：高度、角度、水平偏移量(x)
  const stickConfigs = [
    { height: 95,  rot: -8,  x: -20 },
    { height: 115, rot: -4,  x: -12 },
    { height: 85,  rot: -1,  x: -4 },
    { height: 105, rot: 2,   x: 4 },
    { height: 90,  rot: 6,   x: 12 },
    { height: 110, rot: 10,  x: 20 }
  ];

  stickConfigs.forEach((cfg, i) => {
    const s = document.createElement("div");
    s.className = "sign-stick-base";
    // 此时直接用 left 控制位置，左偏移量在 -20 到 20 之间，非常紧凑
    s.style.left = `calc(50% + ${cfg.x}px)`;
    // 旋转角度控制在 -8 到 10 度，不容易出界
    s.style.transform = `translateX(-50%) rotate(${cfg.rot}deg)`;
    s.style.zIndex = 10 - i;
    s.style.height = `${cfg.height}px`;
    sticksEl.appendChild(s);
  });

  const cylinderEl = el.querySelector("#sign-cylinder");
  const drawBtn = el.querySelector("#sign-draw-btn");
  const resultEl = el.querySelector("#sign-result");
  const historyEl = el.querySelector("#sign-history-list");

  let isDrawing = false;

  // 分类切换逻辑
  el.querySelectorAll(".sign-category-tab").forEach(tab => {
    tab.onclick = async () => {
      if (isDrawing) return;
      el.querySelectorAll(".sign-category-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.cat;
      await checkTodayStatus();
    };
  });

  // 检查今日抽签状态
  async function checkTodayStatus() {
    const today = new Date().toISOString().slice(0, 10);
    const history = await getSignHistory(ownerId);
    const todaySign = history.find(h => h.dateKey === today && h.category === currentCategory);

    if (todaySign) {
      drawBtn.textContent = `今日【${currentCategory}】已抽`;
      drawBtn.disabled = true;
      drawBtn.style.opacity = "0.6";

    } else {
      drawBtn.textContent = "凝 神 抽 签";
      drawBtn.disabled = false;
      drawBtn.style.opacity = "1";
    }
  }

  resultEl.onclick = () => {
    resultEl.classList.remove("show");
  };

  async function doDraw() {
    if (isDrawing) return;

    const today = new Date().toISOString().slice(0, 10);
    const history = await getSignHistory(ownerId);
    const todaySign = history.find(h => h.dateKey === today && h.category === currentCategory);

    if (todaySign) {
      showToast(`今日【${currentCategory}】已抽，请明日再来或切换其他类别`);
      showResult(todaySign);
      return;
    }

    isDrawing = true;
    drawBtn.disabled = true;
    resultEl.classList.remove("show");

    // 摇签动画
    cylinderEl.classList.add("shaking");
    await new Promise(r => setTimeout(r, 800));
    cylinderEl.classList.remove("shaking");

    // 弹出动画（3 根细竹签飞出）
    const cylinderRect = cylinderEl.getBoundingClientRect();
    const startX = cylinderRect.left + cylinderRect.width / 2 - 30;
    const startY = cylinderRect.top + 30;

    for (let i = 0; i < 3; i++) {
      const stick = document.createElement("div");
      // 改用细签样式类
      stick.className = "sign-flying-stick popping"; 
      stick.style.left = startX + "px";
      stick.style.top = startY + "px";
      stick.style.setProperty("--rot", (Math.random() * 40 - 20) + "deg");
      stick.style.setProperty("--drift", (Math.random() * 60 - 30) + "px");
      // 里面只放红点，不放字，因为太细了
      stick.innerHTML = `<div class="stick-head"></div>`;
      
      document.body.appendChild(stick);
      await new Promise(r => setTimeout(r, 300));
      setTimeout(() => stick.remove(), 1200);
    }

    // 获取并展示结果
    await new Promise(r => setTimeout(r, 600));
    const res = await drawSign(ownerId, currentCategory);
    
    isDrawing = false; // 👈 先重置状态，防止卡死

    if (res && res.record) {
      showResult(res.record);
    }

    await renderHistory();
    await checkTodayStatus();
  }

  function showResult(record) {
    el.querySelector("#r-category").textContent = `所求 · ${record.category || currentCategory}`;
    el.querySelector("#r-grade").textContent = record.level;
    el.querySelector("#r-poem").innerHTML = (record.poem || "").replace(/\n/g, "<br>");
    el.querySelector("#r-meaning").textContent = record.meaning || "";
    resultEl.classList.add("show");
  }

  drawBtn.onclick = (e) => { e.stopPropagation(); doDraw(); };
  cylinderEl.onclick = (e) => { e.stopPropagation(); doDraw(); };

  async function renderHistory() {
    const history = await getSignHistory(ownerId);
    if (!history.length) {
      historyEl.innerHTML = `<div class="sign-history-empty">尚无记录</div>`;
      return;
    }
    historyEl.innerHTML = history.map(h => {
      const t = new Date(h.createdAt).toLocaleDateString("zh-CN");
      const poemFirst = (h.poem || "").split("\n")[0].slice(0, 12);
      return `
        <div class="history-card" data-id="${h.id}" style="cursor: pointer;">
          <span class="h-date">${t} · ${h.category || "感情"}</span>
          <span class="h-poem">${escapeHtml(poemFirst)}</span>
          <span class="h-grade">${h.level}</span>
          <span class="h-del" data-del="${h.id}">×</span>
        </div>
      `;
    }).join("");

    // 👈 新增：点击历史卡片查看完整签文
    historyEl.querySelectorAll(".history-card").forEach(card => {
      card.onclick = async (e) => {
        // 如果点的是删除按钮，就不触发弹窗
        if (e.target.closest(".h-del")) return;

        const id = card.dataset.id;
        const record = history.find(h => h.id === id);
        if (!record) return;

        const { showModal, closeModal } = await import("../ui/modal.js");
        
        // 借用你现有的 showResult 逻辑思路，做个弹窗
        const modal = showModal(`
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 12px; color: var(--ink-dim); letter-spacing: 4px; margin-bottom: 12px;">所求 · ${record.category || "感情"}</div>
            <div style="font-family: var(--font-title); font-size: 36px; color: var(--cinnabar); letter-spacing: 12px;">${record.level}</div>
          </div>
          
          <div style="background: var(--paper-soft); border-radius: 8px; padding: 20px; text-align: center;">
            <div style="font-family: var(--font-title); font-size: 16px; line-height: 2; color: var(--ink); margin-bottom: 16px;">
              ${escapeHtml(record.poem || "").replace(/\n/g, "<br>")}
            </div>
            <div style="font-size: 13px; color: var(--ink-soft); line-height: 1.8; border-top: 1px dashed var(--line-light); padding-top: 16px;">
              ${escapeHtml(record.meaning || "")}
            </div>
          </div>

          <button class="btn ghost" id="history-sign-close" style="width: 100%; margin-top: 20px; padding: 12px; letter-spacing: 2px;">收 起</button>
        `);

        modal.querySelector("#history-sign-close").onclick = () => closeModal(modal);
      };
    });

    // 删除事件
    historyEl.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.del;
        const ok = await showConfirm("删除签文", "确定删除这条签文记录？");
        if (!ok) return;
        await db.del("divinations", id);
        showToast("已删除");
        await renderHistory();
        await checkTodayStatus(); // 删除了今天的，按钮要恢复
      };
    });
  }

  await checkTodayStatus();
  await renderHistory();

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}