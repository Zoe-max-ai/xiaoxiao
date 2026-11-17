import { drawBagua, getBaguaHistory } from "../services/divination-service.js";
import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { db } from "../core/db.js";
import { requestAI } from "../services/ai-service.js";

export async function tanmiBaguaView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;

  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  el.innerHTML = `
    <!-- 顶部切换 Tab -->
    <div class="bagua-tabs" style="display: flex; justify-content: center; gap: 12px; margin-bottom: 24px;">
      <div class="bagua-tab" data-type="coin" style="
        padding: 8px 24px; border-radius: 20px; font-family: var(--font-title); font-size: 14px; 
        border: 1px solid var(--line-light); background: transparent; color: var(--ink-dim); 
        cursor: pointer; transition: all 0.3s; letter-spacing: 2px;
      ">铜钱起卦</div>
      <div class="bagua-tab" data-type="bazi" style="
        padding: 8px 24px; border-radius: 20px; font-family: var(--font-title); font-size: 14px; 
        border: 1px solid var(--line-light); background: transparent; color: var(--ink-dim); 
        cursor: pointer; transition: all 0.3s; letter-spacing: 2px;
      ">生辰问命</div>
    </div>

    <!-- 模式一：铜钱起卦 -->
    <div id="bagua-coin-area">
      <div id="bagua-input-area" style="text-align: center; padding: 20px 0;">
        <div style="font-family: var(--font-title); font-size: 15px; color: var(--ink-soft); letter-spacing: 4px; margin-bottom: 24px;">心有所惑，问之于易</div>
        <input type="text" id="question-input" class="input" placeholder="所问之事（可不填）" style="max-width: 320px; margin: 0 auto 20px; text-align: center;">
        <button class="btn" id="btn-bagua" style="padding: 14px 40px; font-size: 16px; letter-spacing: 6px;">凝 神 起 卦</button>
      </div>
      <div id="bagua-stage" style="display: none;"></div>
      <div id="bagua-result"></div>
    </div>

    <!-- 模式二：生辰问命 -->
    <div id="bagua-bazi-area" style="display: none; text-align: center; padding: 20px 0;">
      <div style="font-family: var(--font-title); font-size: 15px; color: var(--ink-soft); letter-spacing: 4px; margin-bottom: 24px;">命由天定，运由己造</div>
      
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
        <select id="bazi-year" class="input" style="width: 100px; padding: 10px;"></select>
        <select id="bazi-month" class="input" style="width: 80px; padding: 10px;"></select>
        <select id="bazi-day" class="input" style="width: 80px; padding: 10px;"></select>
      </div>
      <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 24px;">
        <select id="bazi-hour" class="input" style="width: 120px; padding: 10px;">
          <option value="">时辰（未知可不选）</option>
          <option value="子">子时 (23-01)</option>
          <option value="丑">丑时 (01-03)</option>
          <option value="寅">寅时 (03-05)</option>
          <option value="卯">卯时 (05-07)</option>
          <option value="辰">辰时 (07-09)</option>
          <option value="巳">巳时 (09-11)</option>
          <option value="午">午时 (11-13)</option>
          <option value="未">未时 (13-15)</option>
          <option value="申">申时 (15-17)</option>
          <option value="酉">酉时 (17-19)</option>
          <option value="戌">戌时 (19-21)</option>
          <option value="亥">亥时 (21-23)</option>
        </select>
      </div>
      
      <input type="text" id="bazi-question" class="input" placeholder="你想问什么？（如：姻缘/事业）" style="max-width: 320px; margin: 0 auto 20px; text-align: center;">
      
      <button class="btn" id="btn-bazi" style="padding: 14px 40px; font-size: 16px; letter-spacing: 6px;">推 演 命 理</button>
    </div>

    <div id="bagua-history" style="margin-top: 40px;"></div>
  `;

  el.insertBefore(pageHeader("问 易", "#/tanmi"), el.firstChild);

  // 初始化 Tab
  const tabs = el.querySelectorAll(".bagua-tab");
  const coinArea = el.querySelector("#bagua-coin-area");
  const baziArea = el.querySelector("#bagua-bazi-area");
  let currentMode = "coin";

  // 初始化时，设置“铜钱起卦”为选中状态
  tabs[0].style.borderColor = "var(--cinnabar)";
  tabs[0].style.color = "var(--cinnabar)";
  tabs[0].style.background = "rgba(138, 43, 43, 0.05)"; // 微弱的朱砂底色

  tabs.forEach(tab => {
    tab.onclick = () => {
      // 重置所有 Tab 的样式（灰色细边框）
      tabs.forEach(t => {
        t.style.borderColor = "var(--line-light)";
        t.style.color = "var(--ink-dim)";
        t.style.background = "transparent";
      });
      
      // 设置当前选中的 Tab 样式（主题色细边框 + 浅底色）
      tab.style.borderColor = "var(--cinnabar)";
      tab.style.color = "var(--cinnabar)";
      tab.style.background = "rgba(138, 43, 43, 0.05)"; 

      currentMode = tab.dataset.type;
      if (currentMode === "coin") {
        coinArea.style.display = "block";
        baziArea.style.display = "none";
      } else {
        coinArea.style.display = "none";
        baziArea.style.display = "block";
      }
    };
  });

  // 初始化生辰下拉框（近 100 年）
  const yearSel = el.querySelector("#bazi-year");
  const monthSel = el.querySelector("#bazi-month");
  const daySel = el.querySelector("#bazi-day");
  const hourSel = el.querySelector("#bazi-hour");
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 100; y--) {
    yearSel.innerHTML += `<option value="${y}">${y}年</option>`;
  }
  for (let m = 1; m <= 12; m++) {
    monthSel.innerHTML += `<option value="${m}">${m}月</option>`;
  }
  for (let d = 1; d <= 31; d++) {
    daySel.innerHTML += `<option value="${d}">${d}日</option>`;
  }

  // 👈 新增：读取本地记忆并填入
  const savedBazi = JSON.parse(localStorage.getItem(`user_bazi_${ownerId}`) || "null");
  if (savedBazi) {
    yearSel.value = savedBazi.year || now.getFullYear();
    monthSel.value = savedBazi.month || 1;
    daySel.value = savedBazi.day || 1;
    hourSel.value = savedBazi.hour || "";
  }

  // 渲染历史
  const historyEl = el.querySelector("#bagua-history");
  const history = await getBaguaHistory(ownerId);
  if (history.length) {
    renderHistory(historyEl, history);
  }

  // ================= 铜钱起卦逻辑 =================
  const inputAreaEl = el.querySelector("#bagua-input-area");
  const stageEl = el.querySelector("#bagua-stage");
  const resultEl = el.querySelector("#bagua-result");
  const btnEl = el.querySelector("#btn-bagua");
  const questionInput = el.querySelector("#question-input");

  btnEl.onclick = async () => {
    const question = questionInput.value.trim();
    inputAreaEl.style.display = "none";
    resultEl.innerHTML = "";

    stageEl.style.display = "block";
    await runCastAnimation(stageEl);

    stageEl.style.display = "none";
    const record = await drawBagua(ownerId, question);
    if (!record) {
      showToast("卦象未识，请重试");
      inputAreaEl.style.display = "block";
      return;
    }
    renderResult(resultEl, record);

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

    const newHistory = await getBaguaHistory(ownerId);
    renderHistory(historyEl, newHistory);
  };

  // ================= AI 八字逻辑 =================
  const btnBazi = el.querySelector("#btn-bazi");
  const baziResultContainer = document.createElement("div");
  baziResultContainer.style.marginTop = "24px";
  baziArea.appendChild(baziResultContainer);

  btnBazi.onclick = async () => {
    const year = yearSel.value;
    const month = monthSel.value;
    const day = daySel.value;
    const hour = el.querySelector("#bazi-hour").value;
    const question = el.querySelector("#bazi-question").value.trim();

    // 👈 新增：保存生辰记忆
    localStorage.setItem(`user_bazi_${ownerId}`, JSON.stringify({ year, month, day, hour }));

    btnBazi.disabled = true;
    btnBazi.textContent = "推演中...";
    baziResultContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--ink-dim); font-size: 13px; letter-spacing: 2px;">天地无极，乾坤借法……<br><span style="font-size:12px;opacity:0.6;margin-top:8px;display:block;">(正在结合易经与角色性格为您推演)</span></div>`;

    // 随机挑一个有缘人（角色）来解答
    const characters = (await db.all("characters")).filter(c => c.ownerId === ownerId);
    const randomChar = characters.length ? characters[Math.floor(Math.random() * characters.length)] : null;
    const charName = randomChar ? randomChar.name : "无名道长";
    const charBio = randomChar ? (randomChar.bio || "性格高深莫测") : "云游四海";

    const prompt = `你是一位隐居江湖的易学高人，精通八字命理与易经。
现在有一位求卦者，出生于：${year}年${month}月${day}日 ${hour ? hour + "时" : "（时辰未知）"}。
求问之事：${question || "未说具体何事，只求指点迷津"}。

请结合中国传统的八字命理、《易经》的智慧，用古风文言文的白话文（半文半白，要有韵味，但能让人看懂），为他写一段 150 字左右的批语。
批语分为两部分：
1. 【命理剖析】：根据生辰推断他的性格特质或近况。
2. 【卦象指引】：结合所求之事，给出建议或预言。
语气要像一位仙风道骨的世外高人，不要像机器人在说话。直接输出批语，不要多余的格式说明。`;

    try {
      const aiText = await requestAI([{ role: "user", content: prompt }]);
      let cleanText = aiText.replace(/\*/g, "").replace(/#/g, "").trim();

      // 👈 排版优化：拆分段落
      let htmlContent = "";
      if (cleanText.includes("【命理剖析】") && cleanText.includes("【卦象指引】")) {
        const parts1 = cleanText.split("【命理剖析】");
        const parts2 = parts1[1].split("【卦象指引】");
        
        const lifeText = parts2[0].trim();
        const guideText = parts2[1].trim();

        htmlContent = `
          <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 8px;">【命理剖析】</div>
          <div style="font-size: 14px; line-height: 2; color: var(--ink); text-align: justify; text-indent: 2em; margin-bottom: 20px;">
            ${lifeText}
          </div>
          <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 8px;">【卦象指引】</div>
          <div style="font-size: 14px; line-height: 2; color: var(--ink); text-align: justify; text-indent: 2em;">
            ${guideText}
          </div>
        `;
      } else {
        // 如果 AI 没按格式输出，就按原样展示
        htmlContent = `<div style="font-size: 14px; line-height: 2; color: var(--ink); text-align: justify; white-space: pre-wrap;">${cleanText}</div>`;
      }

      // 👈 核心修改：加上“收起批语”按钮
      baziResultContainer.innerHTML = `
        <div class="card" style="padding: 24px; background: var(--paper); border: 1px solid var(--line-light); border-radius: 8px;">
          <div style="text-align: center; font-family: var(--font-title); font-size: 20px; color: var(--cinnabar); letter-spacing: 4px; margin-bottom: 24px;">
                        「 天机批语 」
          </div>
          ${htmlContent}
          <div style="text-align: center; margin-top: 24px; border-top: 1px dashed var(--line-light); padding-top: 16px;">
            <button class="btn ghost" id="btn-close-bazi" style="padding: 10px 30px; letter-spacing: 4px;">收 起 批 语</button>
          </div>
        </div>
      `;

      // 绑定收起按钮事件
      const closeBaziBtn = baziResultContainer.querySelector("#btn-close-bazi");
      if (closeBaziBtn) {
        closeBaziBtn.onclick = () => {
          baziResultContainer.innerHTML = "";
          el.querySelector("#bazi-question").value = "";
        };
      }

      // 存入历史记录
      const record = {
        id: "bazi_" + Date.now(),
        ownerId,
        type: "bagua",
        method: "bazi",
        question: question || "命理推演",
        benGua: "生辰批语",
        interpretation: cleanText,
        createdAt: Date.now(),
      };
      await db.put("divinations", record);
      
      const newHistory = await getBaguaHistory(ownerId);
      renderHistory(historyEl, newHistory);

    } catch (e) {
      console.error(e);
      baziResultContainer.innerHTML = `<div style="text-align:center; color: var(--cinnabar); font-size: 13px;">天机不可泄露，请稍后再试。</div>`;
    } finally {
      btnBazi.disabled = false;
      btnBazi.textContent = "推 演 命 理";
    }
  };

  return el;
}

/**
 * 起卦动画
 */
async function runCastAnimation(stageEl) {
  stageEl.innerHTML = `
    <div style="text-align: center; padding: 20px 0;">
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 4px; margin-bottom: 8px;">起 卦 中</div>
      <div style="font-size: 12px; color: var(--ink-dim); letter-spacing: 2px; margin-bottom: 24px;" id="cast-step">三枚铜钱，焚香摇卦……</div>
      <div style="position: relative; width: 220px; height: 220px; margin: 0 auto 32px;">
        <svg viewBox="0 0 200 200" style="width:100%;height:100%;animation: spin 0.6s linear infinite;transform-origin:50% 50%;" id="compass-svg">
          <defs>
            <radialGradient id="ring" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stop-color="#faf6ee"/><stop offset="92%" stop-color="#e8dcc0"/><stop offset="100%" stop-color="#b8922e"/>
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="95" fill="url(#ring)" stroke="#b8922e" stroke-width="1.5"/>
          <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(138,43,43,.25)" stroke-width="1" stroke-dasharray="3 5"/>
          <circle cx="100" cy="100" r="48" fill="none" stroke="rgba(138,43,43,.2)" stroke-width="1"/>
          <g font-size="11" fill="#8a2b2b" text-anchor="middle" dominant-baseline="middle" id="bagua-text"></g>
          <polygon points="100,22 96,100 104,100" fill="#8a2b2b" opacity=".75"/>
          <polygon points="100,178 96,100 104,100" fill="#2b2b2b" opacity=".5"/>
        </svg>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 50%; background: radial-gradient(circle, #b8922e, #8a6f1e); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; box-shadow: 0 0 20px rgba(184,146,46,.5);">易</div>
      </div>
      <div id="coins" style="display: flex; gap: 14px; justify-content: center; margin-bottom: 24px;"></div>
      <div style="font-size: 13px; color: var(--ink-dim); letter-spacing: 2px;" id="spin-text">天地设位，易行乎其中……</div>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes coin-flip { 0% { transform: rotateY(0deg); } 50% { transform: rotateY(180deg); } 100% { transform: rotateY(360deg); } }
    </style>
  `;

  const baguaText = stageEl.querySelector("#bagua-text");
  const positions = [
    { name: "离", angle: -90 }, { name: "坤", angle: -135 }, { name: "兑", angle: 180 }, { name: "乾", angle: 135 },
    { name: "坎", angle: 90 }, { name: "艮", angle: 45 }, { name: "震", angle: 0 }, { name: "巽", angle: -45 }
  ];
  positions.forEach(p => {
    const rad = p.angle * Math.PI / 180;
    const x = 100 + 60 * Math.cos(rad);
    const y = 100 + 60 * Math.sin(rad);
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x); t.setAttribute("y", y); t.textContent = p.name;
    baguaText.appendChild(t);
  });

  const coinsEl = stageEl.querySelector("#coins");
  const spinText = stageEl.querySelector("#spin-text");
  const step = stageEl.querySelector("#cast-step");

  for (let count = 1; count <= 6; count++) {
    step.textContent = `第 ${count} 爻……`;
    spinText.textContent = count <= 3 ? "云雷屯，君子以经纶……" : "卦已成，静待天机……";
    coinsEl.innerHTML = "";
    for (let k = 0; k < 3; k++) {
      const isHeads = Math.random() < 0.5;
      const coin = document.createElement("div");
      coin.style.cssText = `
        width: 48px; height: 48px; border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, ${isHeads ? "#f0e2b0,#c9a94a" : "#efe6cf,#b8a572"});
        border: 2px solid #b8922e; display: flex; align-items: center; justify-content: center;
        font-size: 20px; color: #6b5310; box-shadow: 0 3px 8px rgba(0,0,0,.12);
        animation: coin-flip 0.4s ease-out;
      `;
      coin.textContent = isHeads ? "正" : "反";
      coinsEl.appendChild(coin);
    }
    await new Promise(r => setTimeout(r, 420));
  }
  step.textContent = "卦 已 成";
  spinText.textContent = "天地定位，山泽通气……";
  await new Promise(r => setTimeout(r, 600));
}

function renderResult(container, r) {
  const linesHtml = [];
  for (let i = 5; i >= 0; i--) {
    const v = r.lines[i];
    const isMoving = r.movingLines.includes(i + 1);
    const pos = i + 1;
    const label = pos === 1 ? "初" : pos === 6 ? "上" : ["", "", "二", "三", "四", "五"][pos];

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
      <div style="font-family: var(--font-title); font-size: 28px; color: var(--cinnabar); letter-spacing: 6px; margin-bottom: 8px;">${r.benGua}</div>
      <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 24px;">${r.upper}上 ${r.lower}下</div>
      <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">${linesHtml.join("")}</div>
      ${r.movingLines.length ? `
        <div style="font-size: 12px; color: var(--cinnabar); margin-bottom: 16px;">变爻：${r.movingLines.map(p => p === 6 ? "上" : p === 1 ? "初" : ["", "", "二", "三", "四", "五"][p]).join("、")}</div>
      ` : `<div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 16px;">无变爻（静卦）</div>`}
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
          <div class="history-card" data-id="${h.id}" style="cursor: pointer;">
            <span class="h-date">${t}</span>
            <span class="h-poem">${question}</span>
            <span class="h-grade">${escapeHtml(h.benGua)}</span>
            <span class="h-del" data-del="${h.id}">×</span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  // 👈 点击历史记录卡片，弹出查看详情
  container.querySelectorAll(".history-card").forEach(card => {
    card.onclick = async (e) => {
      // 如果点的是删除按钮，就不触发弹窗
      if (e.target.closest(".h-del")) return;

      const id = card.dataset.id;
      const record = history.find(h => h.id === id);
      if (!record) return;

      const { showModal, closeModal } = await import("../ui/modal.js");
      
      let contentHtml = "";
      if (record.method === "bazi") {
        // AI 八字批语，直接按排版展示文本
        let cleanText = record.interpretation || "";
        contentHtml = `
          <div style="font-size: 14px; line-height: 2; color: var(--ink); text-align: justify; white-space: pre-wrap; text-indent: 2em;">
            ${escapeHtml(cleanText)}
          </div>
        `;
      } else {
        // 铜钱起卦，展示卦辞、大象和白话
        contentHtml = `
          <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 6px;">卦 辞</div>
          <div style="font-size: 14px; line-height: 1.8; margin-bottom: 16px;">${escapeHtml(record.guaCi || "")}</div>
          <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 6px;">大 象</div>
          <div style="font-size: 14px; line-height: 1.8; margin-bottom: 16px;">${escapeHtml(record.xiangCi || "")}</div>
          <div style="font-size: 13px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 6px;">白 话 解</div>
          <div style="font-size: 14px; line-height: 1.8;">${escapeHtml(record.interpretation || "")}</div>
        `;
      }

      const modal = showModal(`
        <div style="text-align: center; font-family: var(--font-title); font-size: 20px; color: var(--cinnabar); letter-spacing: 4px; margin-bottom: 16px;">
          ${escapeHtml(record.method === "bazi" ? "天机批语" : record.benGua)}
        </div>
        <div style="font-size: 12px; color: var(--ink-dim); text-align: center; margin-bottom: 20px;">
          问：${escapeHtml(record.question || "（未设问）")}
        </div>
        <div style="background: var(--paper-soft); border-radius: 8px; padding: 16px;">
          ${contentHtml}
        </div>
        <button class="btn ghost" id="history-close" style="width: 100%; margin-top: 20px; padding: 12px;">收 起</button>
      `);

      modal.querySelector("#history-close").onclick = () => closeModal(modal);
    };
  });

  // 删除事件
  container.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      const ok = await showConfirm("删除卦文", "确定删除这条卦文记录？");
      if (!ok) return;
      await db.del("divinations", id);
      showToast("已删除");
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