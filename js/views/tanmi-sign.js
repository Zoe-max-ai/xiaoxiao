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

  el.innerHTML = `
<div class="sign-cylinder-wrap" id="sign-cylinder">
  <div class="sign-sticks" id="sign-sticks"></div>
  <div class="sign-cylinder">
    <div class="sign-cylinder-top"></div>
    <div class="sign-cylinder-body">
      <div class="sign-cylinder-char">渡</div>
    </div>
  </div>
</div>

    <button class="sign-draw-btn" id="sign-draw-btn">凝 神 抽 签</button>

    <div class="sign-result-panel" id="sign-result">
      <div class="grade" id="r-grade"></div>
      <div class="poem" id="r-poem"></div>
      <div class="meaning" id="r-meaning"></div>
      <div class="hint">点此收起</div>
    </div>

    <div class="sign-history" id="sign-history">
      <h3>往 日 签 文</h3>
      <div id="sign-history-list"></div>
    </div>
  `;

  el.insertBefore(pageHeader("抽 签", "#/tanmi"), el.firstChild);

  // 初始化签（签筒内）
  const sticksEl = el.querySelector("#sign-sticks");
  for (let i = 0; i < 5; i++) {
    const s = document.createElement("div");
    s.className = "sign-stick-base";
    s.style.left = (50 + (i - 2) * 18) + "px";
    s.style.transform = `rotate(${(i - 2) * 4}deg)`;
    s.style.zIndex = 10 - i;
    sticksEl.appendChild(s);
  }

  const cylinderEl = el.querySelector("#sign-cylinder");
  const drawBtn = el.querySelector("#sign-draw-btn");
  const resultEl = el.querySelector("#sign-result");
  const historyEl = el.querySelector("#sign-history-list");

  let isDrawing = false;

  // 点击结果面板 → 收起
  resultEl.onclick = () => {
    resultEl.classList.remove("show");
  };

  async function doDraw() {
    if (isDrawing) return;

    // 检查今天是否已抽
    const today = new Date().toISOString().slice(0, 10);
    const history = await getSignHistory(ownerId);
    const todaySign = history.find(h => h.dateKey === today);

    if (todaySign) {
      showToast("今日已抽，请明日再来");
      // 顺便把今日结果展示出来
      showResult(todaySign);
      return;
    }

    isDrawing = true;
    drawBtn.disabled = true;
    resultEl.classList.remove("show");

    // 摇签
    cylinderEl.classList.add("shaking");
    await new Promise(r => setTimeout(r, 600));
    cylinderEl.classList.remove("shaking");

// 弹出动画（3 根飞出）—— 从签筒口飞起
const cylinderRect = cylinderEl.getBoundingClientRect();
const startX = cylinderRect.left + cylinderRect.width / 2 - 30;  // 签宽 60，居中
const startY = cylinderRect.top + 30;  // 签筒口附近

for (let i = 0; i < 3; i++) {
  const stick = document.createElement("div");
  stick.className = "sign-drawn-stick popping";
  stick.style.left = startX + "px";
  stick.style.top = startY + "px";
  stick.style.setProperty("--rot", (Math.random() * 40 - 20) + "deg");
  stick.style.setProperty("--drift", (Math.random() * 60 - 30) + "px");
  stick.innerHTML = `
    <div class="grade">${["吉", "签", "吉"][i]}</div>
    <div class="text">· · ·</div>
  `;
  document.body.appendChild(stick);
  await new Promise(r => setTimeout(r, 300));
  setTimeout(() => stick.remove(), 1200);
}

    // 定结果
    await new Promise(r => setTimeout(r, 600));
    const { record } = await drawSign(ownerId);
    showResult(record);

    // 刷新历史
    await renderHistory();

    drawBtn.disabled = false;
    isDrawing = false;
  }

  function showResult(record) {
    el.querySelector("#r-grade").textContent = record.level;
    el.querySelector("#r-poem").innerHTML = (record.poem || "").replace(/\n/g, "<br>");
    el.querySelector("#r-meaning").textContent = record.meaning || "";
    resultEl.classList.add("show");
  }

  drawBtn.onclick = (e) => {
    e.stopPropagation();
    doDraw();
  };
  cylinderEl.onclick = (e) => {
    e.stopPropagation();
    doDraw();
  };

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
        <div class="history-card" data-id="${h.id}">
          <span class="h-date">${t}</span>
          <span class="h-poem">${escapeHtml(poemFirst)}</span>
          <span class="h-grade">${h.level}</span>
          <span class="h-del" data-del="${h.id}">×</span>
        </div>
      `;
    }).join("");

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
      };
    });
  }

  // 首次渲染
  const today = new Date().toISOString().slice(0, 10);
  const history = await getSignHistory(ownerId);
  const todaySign = history.find(h => h.dateKey === today);

  if (todaySign) {
    showResult(todaySign);
  }

  await renderHistory();

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}