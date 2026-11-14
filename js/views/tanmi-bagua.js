import { drawBagua, getBaguaHistory } from "../services/divination-service.js";
import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { db } from "../core/db.js";


export async function tanmiBaguaView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;

  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  el.innerHTML = `
    <div id="bagua-input-area" style="text-align: center; padding: 20px 0;">
      <div style="
        font-family: var(--font-title);
        font-size: 15px;
        color: var(--ink-soft);
        letter-spacing: 4px;
        margin-bottom: 24px;
      ">心有所惑，问之于易</div>

      <input type="text" id="question-input" class="input" placeholder="所问之事（可不填）" style="max-width: 320px; margin: 0 auto 20px; text-align: center;">

      <button class="btn" id="btn-bagua" style="padding: 14px 40px; font-size: 16px; letter-spacing: 6px;">
        凝 神 起 卦
      </button>
    </div>

    <div id="bagua-stage" style="display: none;"></div>
    <div id="bagua-result"></div>
    <div id="bagua-history" style="margin-top: 40px;"></div>
  `;

  el.insertBefore(pageHeader("问 易", "#/tanmi"), el.firstChild);

  const inputAreaEl = el.querySelector("#bagua-input-area");
  const stageEl = el.querySelector("#bagua-stage");
  const resultEl = el.querySelector("#bagua-result");
  const historyEl = el.querySelector("#bagua-history");
  const btnEl = el.querySelector("#btn-bagua");
  const questionInput = el.querySelector("#question-input");

  // 渲染历史
  const history = await getBaguaHistory(ownerId);
  if (history.length) {
    renderHistory(historyEl, history);
  }

  // 起卦按钮
  btnEl.onclick = async () => {
    const question = questionInput.value.trim();

    // 隐藏输入区 + 按钮
    inputAreaEl.style.display = "none";
    resultEl.innerHTML = "";

    // 显示罗盘 + 铜钱动画
    stageEl.style.display = "block";
    await runCastAnimation(stageEl);

    // 隐藏动画，显示结果
    stageEl.style.display = "none";
    const record = await drawBagua(ownerId, question);
    if (!record) {
      showToast("卦象未识，请重试");
      inputAreaEl.style.display = "block";
      return;
    }
    renderResult(resultEl, record);

    // 加"再起一卦"按钮
    const againBtn = document.createElement("button");
    againBtn.className = "btn ghost";
    againBtn.textContent = "再 起 一 卦";
    againBtn.style.cssText = "width: 100%; margin-top: 20px; padding: 14px; font-size: 15px; letter-spacing: 6px;";
    againBtn.onclick = () => {
      inputAreaEl.style.display = "block";
      resultEl.innerHTML = "";
      questionInput.value = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    resultEl.appendChild(againBtn);

    // 刷新历史
    const newHistory = await getBaguaHistory(ownerId);
    renderHistory(historyEl, newHistory.slice(1));
  };

  return el;
}


/**
 * 起卦动画
 */
async function runCastAnimation(stageEl) {
  stageEl.innerHTML = `
    <div style="text-align: center; padding: 20px 0;">
      <div style="
        font-family: var(--font-title);
        font-size: 16px;
        color: var(--cinnabar);
        letter-spacing: 4px;
        margin-bottom: 8px;
      ">起 卦 中</div>
      <div style="
        font-size: 12px;
        color: var(--ink-dim);
        letter-spacing: 2px;
        margin-bottom: 24px;
      " id="cast-step">三枚铜钱，焚香摇卦……</div>

      <!-- 罗盘 -->
      <div style="
        position: relative;
        width: 220px;
        height: 220px;
        margin: 0 auto 32px;
      ">
        <svg viewBox="0 0 200 200" style="width:100%;height:100%;animation: spin 0.6s linear infinite;transform-origin:50% 50%;" id="compass-svg">
          <defs>
            <radialGradient id="ring" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stop-color="#faf6ee"/>
              <stop offset="92%" stop-color="#e8dcc0"/>
              <stop offset="100%" stop-color="#b8922e"/>
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="95" fill="url(#ring)" stroke="#b8922e" stroke-width="1.5"/>
          <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(138,43,43,.25)" stroke-width="1" stroke-dasharray="3 5"/>
          <circle cx="100" cy="100" r="48" fill="none" stroke="rgba(138,43,43,.2)" stroke-width="1"/>
          <g font-size="11" fill="#8a2b2b" text-anchor="middle" dominant-baseline="middle" id="bagua-text"></g>
          <polygon points="100,22 96,100 104,100" fill="#8a2b2b" opacity=".75"/>
          <polygon points="100,178 96,100 104,100" fill="#2b2b2b" opacity=".5"/>
        </svg>
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 64px; height: 64px;
          border-radius: 50%;
          background: radial-gradient(circle, #b8922e, #8a6f1e);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 22px;
          box-shadow: 0 0 20px rgba(184,146,46,.5);
        ">易</div>
      </div>

      <!-- 三枚铜钱 -->
      <div id="coins" style="display: flex; gap: 14px; justify-content: center; margin-bottom: 24px;"></div>

      <div style="font-size: 13px; color: var(--ink-dim); letter-spacing: 2px;" id="spin-text">天地设位，易行乎其中……</div>
    </div>

    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes coin-flip {
        0% { transform: rotateY(0deg); }
        50% { transform: rotateY(180deg); }
        100% { transform: rotateY(360deg); }
      }
    </style>
  `;

  // 八卦方位
  const baguaText = stageEl.querySelector("#bagua-text");
  const positions = [
    { name: "离", angle: -90 }, { name: "坤", angle: -135 },
    { name: "兑", angle: 180 }, { name: "乾", angle: 135 },
    { name: "坎", angle: 90 }, { name: "艮", angle: 45 },
    { name: "震", angle: 0 }, { name: "巽", angle: -45 }
  ];
  positions.forEach(p => {
    const rad = p.angle * Math.PI / 180;
    const x = 100 + 60 * Math.cos(rad);
    const y = 100 + 60 * Math.sin(rad);
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.textContent = p.name;
    baguaText.appendChild(t);
  });

  const coinsEl = stageEl.querySelector("#coins");
  const spinText = stageEl.querySelector("#spin-text");
  const step = stageEl.querySelector("#cast-step");

  // 六次摇卦
  for (let count = 1; count <= 6; count++) {
    // 更新文字
    step.textContent = `第 ${count} 爻……`;
    spinText.textContent = count <= 3 ? "云雷屯，君子以经纶……" : "卦已成，静待天机……";

    // 更新铜钱
    coinsEl.innerHTML = "";
    for (let k = 0; k < 3; k++) {
      const isHeads = Math.random() < 0.5;
      const coin = document.createElement("div");
      coin.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, ${isHeads ? "#f0e2b0,#c9a94a" : "#efe6cf,#b8a572"});
        border: 2px solid #b8922e;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        color: #6b5310;
        box-shadow: 0 3px 8px rgba(0,0,0,.12);
        animation: coin-flip 0.4s ease-out;
      `;
      coin.textContent = isHeads ? "正" : "反";
      coinsEl.appendChild(coin);
    }

    await new Promise(r => setTimeout(r, 420));
  }

  // 最后一下
  step.textContent = "卦 已 成";
  spinText.textContent = "天地定位，山泽通气……";
  await new Promise(r => setTimeout(r, 600));
}

function renderResult(container, r) {
  // 六爻图（从下往上）
  const linesHtml = [];
  for (let i = 5; i >= 0; i--) {
    const v = r.lines[i];
    const isMoving = r.movingLines.includes(i + 1);
    const pos = i + 1;
    const label = pos === 1 ? "初" : pos === 6 ? "上" : ["", "", "二", "三", "四", "五"][pos];

    // 爻的图形
    let yaoHtml;
    if (v === 1) {
      yaoHtml = `<div style="width: 100px; height: 8px; background: var(--ink); ${isMoving ? 'box-shadow: 0 0 0 2px var(--cinnabar);' : ''}"></div>`;
    } else {
      yaoHtml = `
        <div style="display: flex; gap: 12px; width: 100px; ${isMoving ? 'box-shadow: 0 0 0 2px var(--cinnabar); border-radius: 2px;' : ''}">
          <div style="flex: 1; height: 8px; background: var(--ink);"></div>
          <div style="flex: 1; height: 8px; background: var(--ink);"></div>
        </div>
      `;
    }

    linesHtml.push(`
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <span style="font-size: 12px; color: ${isMoving ? 'var(--cinnabar)' : 'var(--ink-dim)'}; width: 20px; text-align: right;">${label}</span>
        ${yaoHtml}
        ${isMoving ? `<span style="font-size: 11px; color: var(--cinnabar); margin-left: 4px;">动</span>` : ""}
      </div>
    `);
  }

  container.innerHTML = `
    <div class="card bagua-result-card" id="bagua-result-card" style="text-align: center; padding: 32px 24px; cursor: pointer;">
      <div style="
        font-family: var(--font-title);
        font-size: 28px;
        color: var(--cinnabar);
        letter-spacing: 6px;
        margin-bottom: 8px;
      ">${r.benGua}</div>
      <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 24px;">
        ${r.upper}上 ${r.lower}下
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
        ${linesHtml.join("")}
      </div>

      ${r.movingLines.length ? `
        <div style="font-size: 12px; color: var(--cinnabar); margin-bottom: 16px;">
          变爻：${r.movingLines.map(p => p === 6 ? "上" : p === 1 ? "初" : ["", "", "二", "三", "四", "五"][p]).join("、")}
        </div>
      ` : `
        <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 16px;">无变爻（静卦）</div>
      `}

      <div style="border-top: 1px solid var(--line-light); padding-top: 16px; text-align: left;">
        <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 6px;">卦 辞</div>
        <div style="font-size: 14px; line-height: 1.8; margin-bottom: 16px;">${r.guaCi}</div>

        <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 6px;">大 象</div>
        <div style="font-size: 14px; line-height: 1.8; margin-bottom: 16px;">${r.xiangCi}</div>

        <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 6px;">白 话 解</div>
        <div style="font-size: 14px; line-height: 1.8;">${r.interpretation}</div>
      </div>

      <div style="margin-top: 16px; font-size: 11px; color: var(--ink-dim); letter-spacing: 2px;">点此收起</div>
    </div>
  `;

  // ===== 点击收起 =====
  const resultCard = container.querySelector("#bagua-result-card");
  if (resultCard) {
    resultCard.onclick = () => {
      const inputArea = document.getElementById("bagua-input-area");
      if (inputArea) inputArea.style.display = "block";
      container.innerHTML = "";
      const questionInput = document.getElementById("question-input");
      if (questionInput) questionInput.value = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }
}


function renderHistory(container, history) {
  if (!history.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <div class="section-title" style="margin: 24px 0 16px; text-align: center; font-family: var(--font-title); color: var(--ink-dim); letter-spacing: 4px;">往 日 卦 册</div>
    <div style="padding: 0 20px;"> 
      ${history.map(h => {
        const t = new Date(h.createdAt).toLocaleDateString("zh-CN");
        const question = h.question ? escapeHtml(h.question) : "（未设问）";
        return `
          <div class="history-card" data-id="${h.id}">
            <span class="h-date">${t}</span>
            <span class="h-poem">${question}</span>
            <span class="h-grade">${escapeHtml(h.benGua)}</span>
            <span class="h-del" data-del="${h.id}">×</span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  // 删除事件
  container.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      const ok = await showConfirm("删除卦文", "确定删除这条卦文记录？");
      if (!ok) return;
      await db.del("divinations", id);
      showToast("已删除");
      // 重新渲染
      const ownerId = state.currentUserId;
      const history = await getBaguaHistory(ownerId);
      renderHistory(container, history);
    };
  });
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}