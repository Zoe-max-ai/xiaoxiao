import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import {
  getGlobalChatSettings,
  saveGlobalChatSettings,
  getCharacterChatSettings,
  saveCharacterChatSettings,
  getShortThreshold,
  saveShortThreshold,
} from "../services/chat-settings-service.js";
import { getGroups } from "../services/card-service.js";
import {
  getAllActions, createAction, updateAction, deleteAction,
} from "../services/action-service.js";

export async function guichuChatSettingsView() {
  const el = document.createElement("div");
  const userId = state.currentUserId;

  if (!userId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  el.appendChild(pageHeader("设 置", "#/guichu"));

  // 获取初始数据
  const global = await getGlobalChatSettings();
  const shortThreshold = await getShortThreshold();
  const characters = (await db.all("characters"))
    .filter(c => c.ownerId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);

  let currentTab = "global"; // global | character
  let activeCharId = characters[0]?.id || null;

  // 整体 HTML 框架
  el.insertAdjacentHTML("beforeend", `
    <div style="display:flex; gap:0; padding: 10px 20px 20px;">
      <div id="tab-global" class="settings-tab on">全局设置</div>
      <div id="tab-char" class="settings-tab">角色设置</div>
    </div>
    <div id="settings-content"></div>
  `);

  const contentEl = el.querySelector("#settings-content");
  const tabGlobal = el.querySelector("#tab-global");
  const tabChar = el.querySelector("#tab-char");

  // 切换 Tab 样式
  // 切换 Tab 样式（改为统一方形）
  function updateTabStyle() {
    // 选中时：深绿底色，白色文字，无边框
    const onStyle = "background:var(--cinnabar);color:#fff;border:1px solid var(--cinnabar);border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.1);";
    // 未选中时：米色底色，浅色边框
    const offStyle = "background:var(--paper);color:var(--ink-dim);border:1px solid var(--line);border-radius:4px;";
    
    // 强行覆盖掉之前的胶囊样式（圆角和内边距）
    const baseStyle = "padding:10px 24px;font-family:var(--font-title);cursor:pointer;letter-spacing:2px;font-size:14px;transition:all 0.3s;flex:1;text-align:center;";
    
    tabGlobal.style.cssText = baseStyle + (currentTab === "global" ? onStyle : offStyle);
    tabChar.style.cssText = baseStyle + (currentTab === "character" ? onStyle : offStyle);
  }

  // 渲染主逻辑
  async function render() {
    updateTabStyle();
    if (currentTab === "global") {
      await renderGlobalTab(contentEl, global, shortThreshold, userId);
    } else {
      if (!characters.length) {
        contentEl.innerHTML = `<div class="empty-state" style="padding:40px;">还没有角色，无法配置。</div>`;
        return;
      }
      await renderCharTab(contentEl, characters, activeCharId, global, userId);
    }
  }

  tabGlobal.onclick = () => { currentTab = "global"; render(); };
  tabChar.onclick = () => { currentTab = "character"; render(); };

  await render();
  return el;
}

/* ============================================================
 * 全局设置 Tab
 * ============================================================ */
async function renderGlobalTab(container, global, shortThreshold, userId) {
  container.innerHTML = `
    <div class="section-title">聊天设置 全局默认</div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>回复频率（条）</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="number" id="g-reply-min" min="1" max="20" value="${global.replyMin}" class="input" style="flex:1;">
        <span style="color: var(--ink-dim);">~</span>
        <input type="number" id="g-reply-max" min="1" max="20" value="${global.replyMax}" class="input" style="flex:1;">
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>回复间隔（秒）</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="number" id="g-interval-min" min="1" max="360" value="${global.intervalMin}" class="input" style="flex:1;">
        <span style="color: var(--ink-dim);">~</span>
        <input type="number" id="g-interval-max" min="1" max="360" value="${global.intervalMax}" class="input" style="flex:1;">
      </div>
      <div style="font-size: 12px; color: var(--cinnabar); font-weight: bold; margin-top: 6px;" id="g-estimate">
        预估最长等待：${global.intervalMax * global.replyMax} 秒
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>主动回复</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <div class="sw-toggle ${global.proactive ? "on" : ""}" id="g-proactive"></div>
        <span style="font-size: 12px; color: var(--ink-dim);">开启后，角色会主动给你发消息</span>
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>主动回复间隔（分）</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="number" id="g-proactive-min" min="1" max="1440" value="${global.proactiveMin}" class="input" style="flex:1;">
        <span style="color: var(--ink-dim);">~</span>
        <input type="number" id="g-proactive-max" min="1" max="1440" value="${global.proactiveMax}" class="input" style="flex:1;">
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
      <label>撤回消息</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <div class="sw-toggle ${global.recall ? "on" : ""}" id="g-recall"></div>
        <span style="font-size: 12px; color: var(--ink-dim);">角色偶尔撤回消息</span>
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>撤回概率（%）</label>
      <input type="number" id="g-recall-p" min="0" max="100" value="${global.recallProbability}" class="input">
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>动作触发概率（%）</label>
      <input type="number" id="g-action-p" min="0" max="100" value="${global.actionProbability ?? 20}" class="input">
      <div style="font-size: 11px; color: var(--ink-dim); margin-top: 6px;">聊天时自动附带「拂袖」动作的概率</div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">

      <label>时间戳</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <div class="sw-toggle ${global.timestamps ? "on" : ""}" id="g-timestamps"></div>
        <span style="font-size: 12px; color: var(--ink-dim);">消息旁显示时间</span>
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
      <label>打字机效果</label>
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
        <!-- 👈 确保有 id="g-typewriter" 并且有 cursor: pointer; -->
        <div class="sw-toggle ${global.typewriter ? "on" : ""}" id="g-typewriter" style="cursor: pointer;"></div>
        <span style="font-size: 12px; color: var(--ink-dim);">角色回复逐字显示</span>
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
      <label>已读回执</label>
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
        <!-- 👈 确保有 id="g-read-receipt" 并且有 cursor: pointer; -->
        <div class="sw-toggle ${global.readReceipt ? "on" : ""}" id="g-read-receipt" style="cursor: pointer;"></div>
        <span style="font-size: 12px; color: var(--ink-dim);">显示“对方正在输入…”</span>
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
      <label>短句阈值（字）</label>
      <input type="number" id="g-short-threshold" min="1" max="50" value="${shortThreshold}" class="input">
    </div>

    <button class="btn" id="btn-save-global" style="width: 100%; padding: 14px; letter-spacing: 4px; margin-bottom: 24px;">
      保 存 全 局 设 置
    </button>

    <!-- 全局动作库 -->
    <div class="section-title" style="margin-top: 20px;">全局 动作库</div>
    <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 12px;">通用动作。</div>
    <div id="global-action-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
    <button class="btn ghost" id="btn-add-global-action" style="width: 100%; padding: 12px; margin-top: 12px; letter-spacing: 4px;">＋ 添加全局动作</button>
  `;

  // 全局事件绑定
  const updateEstimate = () => {
    const intervalMax = +container.querySelector("#g-interval-max").value || 0;
    const replyMax = +container.querySelector("#g-reply-max").value || 0;
    container.querySelector("#g-estimate").textContent = `预估最长等待：${intervalMax * replyMax} 秒`;
  };
  container.querySelector("#g-interval-max").addEventListener("input", updateEstimate);
  container.querySelector("#g-reply-max").addEventListener("input", updateEstimate);

  ["g-proactive", "g-recall", "g-timestamps"].forEach(id => {
    container.querySelector(`#${id}`).addEventListener("click", (e) => e.target.classList.toggle("on"));
  });

  const toggleTypewriter = container.querySelector("#g-typewriter");
  if (toggleTypewriter) {
    toggleTypewriter.onclick = function() {
      this.classList.toggle("on");
    };
  }

  const toggleReadReceipt = container.querySelector("#g-read-receipt");
  if (toggleReadReceipt) {
    toggleReadReceipt.onclick = function() {
      this.classList.toggle("on");
    };
  }

  container.querySelector("#btn-save-global").onclick = async () => {
    await saveGlobalChatSettings({
      replyMin: +container.querySelector("#g-reply-min").value || 1,
      replyMax: +container.querySelector("#g-reply-max").value || 1,
      intervalMin: +container.querySelector("#g-interval-min").value || 1,
      intervalMax: +container.querySelector("#g-interval-max").value || 1,
      proactive: container.querySelector("#g-proactive").classList.contains("on"),
      proactiveMin: +container.querySelector("#g-proactive-min").value || 1,
      proactiveMax: +container.querySelector("#g-proactive-max").value || 1,
      recall: container.querySelector("#g-recall").classList.contains("on"),
      recallProbability: +container.querySelector("#g-recall-p").value || 0,
      actionProbability: +container.querySelector("#g-action-p").value ?? 20,
      timestamps: container.querySelector("#g-timestamps").classList.contains("on"),
      typewriter: container.querySelector("#g-typewriter").classList.contains("on"),
      readReceipt: container.querySelector("#g-read-receipt").classList.contains("on"),
    });
    await saveShortThreshold(+container.querySelector("#g-short-threshold").value || 9);
    showToast("全局设置已保存");
  };

  // 渲染全局动作
  await renderActionSection(container.querySelector("#global-action-list"), userId, "global");
}

/* ============================================================
 * 角色设置 Tab
 * ============================================================ */
async function renderCharTab(container, characters, activeCharId, global, userId) {
  const activeChar = characters.find(c => c.id === activeCharId);
  const charSettings = await getCharacterChatSettings(activeCharId);
  const groups = await getGroups(userId);
  
  // 👈 核心过滤逻辑：只保留通用分组和当前角色的分组
  const userGroups = groups.filter(g => {
    if (g.isAll) return false; // 过滤掉系统全选组
    
    // 1. 过滤掉所有 [友人] 分组（NPC 的）
    if (g.name.startsWith("[友人]") || g.name.startsWith("【友人】")) return false;
    
    // 2. 过滤掉带有其他角色名字的分组
    // 假设其他角色的分组名字里包含他们的名字（比如“方承意 - 聊天”）
    for (const c of characters) {
      if (c.id === activeCharId) continue; // 如果是当前角色，跳过
      if (g.name.includes(c.name)) return false; // 如果包含别的角色的名字，过滤掉
    }
    
    // 3. 如果包含当前角色的名字，或者不包含任何角色名字（纯通用），就保留
    return true;
  });

  container.innerHTML = `
    <div style="display: flex; gap: 12px; overflow-x: auto; padding: 8px 0 16px; margin-bottom: 8px;">
      ${characters.map(c => `
        <div class="char-tab ${c.id === activeCharId ? "on" : ""}" data-cid="${c.id}" style="
          flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; overflow: hidden;
          border: 2px solid ${c.id === activeCharId ? "var(--cinnabar)" : "transparent"};
          cursor: pointer; background: var(--paper-soft);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; color: var(--ink-dim);
        ">${c.name[0]}</div>
      `).join("")}
    </div>

    <div style="font-size: 14px; color: var(--cinnabar); letter-spacing: 2px; margin-bottom: 16px;">
      ${activeChar.name}
    </div>

    <div class="form-field" style="display: flex; align-items: center; gap: 10px;">
      <div class="sw-toggle ${charSettings.inheritGlobal ? "on" : ""}" id="c-inherit"></div>
      <span style="font-size: 13px;">继承全局设置</span>
    </div>

    <div id="char-custom" style="display: ${charSettings.inheritGlobal ? "none" : "block"};">
      <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
        <label>回复频率（条）</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="number" id="c-reply-min" min="1" max="20" value="${charSettings.settings.replyMin ?? global.replyMin}" class="input" style="flex:1;">
          <span style="color: var(--ink-dim);">~</span>
          <input type="number" id="c-reply-max" min="1" max="20" value="${charSettings.settings.replyMax ?? global.replyMax}" class="input" style="flex:1;">
        </div>
      </div>
      <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
        <label>回复间隔（秒）</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="number" id="c-interval-min" min="1" max="360" value="${charSettings.settings.intervalMin ?? global.intervalMin}" class="input" style="flex:1;">
          <span style="color: var(--ink-dim);">~</span>
          <input type="number" id="c-interval-max" min="1" max="360" value="${charSettings.settings.intervalMax ?? global.intervalMax}" class="input" style="flex:1;">
        </div>
      </div>
      <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
        <label>动作触发概率（%）</label>
        <input type="number" id="c-action-p" min="0" max="100" value="${charSettings.settings.actionProbability ?? global.actionProbability ?? 20}" class="input">
      </div>
    </div>

    <div class="section-title" style="margin-top: 24px;">聊天 字卡</div>
    ${renderCardBlock("chat", charSettings.chat, userGroups)}

    <div class="section-title" style="margin-top: 24px;">心绪 字卡</div>
    ${renderCardBlock("post", charSettings.post, userGroups)}

    <div class="section-title" style="margin-top: 24px;">书信 字卡</div>
    ${renderCardBlock("letter", charSettings.letter, userGroups)}

    <button class="btn" id="btn-save-char" style="width: 100%; padding: 14px; letter-spacing: 4px; margin-top: 24px;">
      保 存 角 色 设 置
    </button>

    <!-- 角色专属动作库 -->
    <div class="section-title" style="margin-top: 40px;">${activeChar.name} 的专属动作</div>
    <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 12px;">只有和 ${activeChar.name} 聊天时才可用。</div>
    <div id="char-action-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
    <button class="btn ghost" id="btn-add-char-action" style="width: 100%; padding: 12px; margin-top: 12px; letter-spacing: 4px;">＋ 添加专属动作</button>
  `;

  /* ===== 渲染字卡分组的网格 ===== */
  container.querySelectorAll(".group-grid").forEach(gridEl => {
    const kind = gridEl.dataset.kind;
    let cur;
    if (kind === "post") cur = charSettings.post;
    else if (kind === "letter") cur = charSettings.letter;
    else cur = charSettings.chat;
    const enabled = new Set(cur.cardGroupIds || []);

    if (!userGroups.length) {
      gridEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;font-size:12px;color:var(--ink-dim);padding:16px 0;">还没有笺语分组。</div>`;
      return;
    }

    gridEl.innerHTML = userGroups.map(g => `
      <div class="group-item ${enabled.has(g.id) ? "on" : ""}" data-gid="${g.id}">
        ${escapeHtml(g.name)}
      </div>
    `).join("");

    gridEl.querySelectorAll(".group-item").forEach(item => {
      item.onclick = () => {
        item.classList.toggle("on");
        const onCount = gridEl.querySelectorAll(".group-item.on").length;
        const countEl = container.querySelector(`.group-count-on[data-kind="${kind}"]`);
        if (countEl) countEl.textContent = onCount;
      };
    });

    const onCount = gridEl.querySelectorAll(".group-item.on").length;
    const countEl = container.querySelector(`.group-count-on[data-kind="${kind}"]`);
    if (countEl) countEl.textContent = onCount;
  });

  /* ===== 全选 / 全不选 ===== */
  container.querySelectorAll(".group-select-all").forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.kind;
      const gridEl = container.querySelector(`.group-grid[data-kind="${kind}"]`);
      const items = gridEl.querySelectorAll(".group-item");
      const allOn = [...items].every(i => i.classList.contains("on"));
      items.forEach(i => i.classList.toggle("on", !allOn));
      
      const onCount = gridEl.querySelectorAll(".group-item.on").length;
      const countEl = container.querySelector(`.group-count-on[data-kind="${kind}"]`);
      if (countEl) countEl.textContent = onCount;
    };
  });

  /* ===== 拼字卡开关展开/收起 ===== */
  container.querySelectorAll(".cards-enabled-toggle").forEach(toggle => {
    toggle.onclick = () => {
      const on = toggle.classList.toggle("on");
      const kind = toggle.dataset.kind;
      const extra = container.querySelector(`#extra-${kind}`);
      if (extra) extra.style.display = on ? "block" : "none";
    };
  });

  /* ===== 继承全局开关 ===== */
  container.querySelector("#c-inherit").onclick = (e) => {
    const isOn = e.target.classList.toggle("on");
    container.querySelector("#char-custom").style.display = isOn ? "none" : "block";
  };

  /* ===== 切换角色 ===== */
  container.querySelectorAll(".char-tab").forEach(tab => {
    tab.onclick = () => {
      renderCharTab(container, characters, tab.dataset.cid, global, userId);
    };
  });

  /* ===== 保存配置 ===== */
  container.querySelector("#btn-save-char").onclick = async () => {
    const inheritGlobal = container.querySelector("#c-inherit").classList.contains("on");

    const chat = collectCardBlock(container, "chat");
    const post = collectCardBlock(container, "post");
    const letter = collectCardBlock(container, "letter");

    let settings = {};
    if (!inheritGlobal) {
      settings = {
        replyMin: +container.querySelector("#c-reply-min")?.value || global.replyMin,
        replyMax: +container.querySelector("#c-reply-max")?.value || global.replyMax,
        intervalMin: +container.querySelector("#c-interval-min")?.value || global.intervalMin,
        intervalMax: +container.querySelector("#c-interval-max")?.value || global.intervalMax,
        actionProbability: +container.querySelector("#c-action-p")?.value ?? global.actionProbability,
      };
    }

    await saveCharacterChatSettings(activeCharId, {
      inheritGlobal,
      settings,
      chat,
      post,
      letter,
    });

    showToast("分角色设置已保存");
  };

  // 渲染专属动作库
  await renderActionSection(container.querySelector("#char-action-list"), userId, "char", activeCharId);
}

/* ============================================================
 * 拼字卡区块 HTML
 * ============================================================ */
function renderCardBlock(kind, cfg, groups) {
  return `
    <div class="form-field" style="display: flex; align-items: center; gap: 10px;">
      <div class="sw-toggle ${cfg.cardsEnabled ? "on" : ""} cards-enabled-toggle" data-kind="${kind}"></div>
      <span style="font-size: 13px;">启用拼字卡</span>
    </div>

    <div id="extra-${kind}" style="display: ${cfg.cardsEnabled ? "block" : "none"};">
      <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
        <label>拼字卡模式</label>
        <select class="input mode-select" data-kind="${kind}">
          <option value="random"     ${cfg.cardMode === "random"     ? "selected" : ""}>随机</option>
          <option value="short"      ${cfg.cardMode === "short"      ? "selected" : ""}>短 + 短</option>
          <option value="shortlong"  ${cfg.cardMode === "shortlong"  ? "selected" : ""}>短 + 长</option>
          <option value="long"       ${cfg.cardMode === "long"       ? "selected" : ""}>长 + 长</option>
        </select>
      </div>

      <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
        <label>拼字卡条数</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="number" class="input count-min" data-kind="${kind}" min="1" max="20" value="${cfg.cardMin}" style="flex:1;">
          <span style="color: var(--ink-dim);">~</span>
          <input type="number" class="input count-max" data-kind="${kind}" min="1" max="20" value="${cfg.cardMax}" style="flex:1;">
        </div>
      </div>
    </div>

    <div class="form-field" style="background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line-light); margin-bottom: 12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <label style="margin:0;">字卡分组</label>
        <div style="font-size:11px;color:var(--ink-dim);">
          已启用 <span class="group-count-on" data-kind="${kind}">0</span>/${groups.length} 组
          <a class="group-select-all" data-kind="${kind}" style="color:var(--cinnabar);cursor:pointer;margin-left:8px;">全选</a>
        </div>
      </div>
      <div class="group-grid" data-kind="${kind}"></div>
    </div>
  `;
}

/* ============================================================
 * 收集拼字卡区配置
 * ============================================================ */
function collectCardBlock(section, kind) {
  const enabled = section.querySelector(`.cards-enabled-toggle[data-kind="${kind}"]`).classList.contains("on");
  const mode = section.querySelector(`.mode-select[data-kind="${kind}"]`).value;
  const min = +section.querySelector(`.count-min[data-kind="${kind}"]`).value || 2;
  const max = +section.querySelector(`.count-max[data-kind="${kind}"]`).value || 5;
  const groupIds = [];
  section.querySelectorAll(`.group-grid[data-kind="${kind}"] .group-item`).forEach(item => {
    if (item.classList.contains("on")) {
      groupIds.push(item.dataset.gid);
    }
  });

  return {
    aiEnabled: false,
    cardsEnabled: enabled,
    cardMode: mode,
    cardMin: min,
    cardMax: max,
    cardGroupIds: groupIds,
  };
}

/* ============================================================
 * 动作库通用渲染组件 (支持全局和专属)
 * ============================================================ */
async function renderActionSection(listEl, userId, scope, charId = null) {
  if (!listEl) return; // 防止 DOM 没找到报错

  const allActions = await getAllActions(userId);
  const actions = allActions.filter(a => {
    if (scope === "global") {
      return a.scope === "global" || !a.scope || !a.charId; 
    } else {
      return a.scope === "char" && a.charId === charId;
    }
  });

  if (!actions.length) {
    listEl.innerHTML = `<div class="empty-state" style="padding: 20px 0;">暂无动作。</div>`;
  } else {
    listEl.innerHTML = actions.map(a => `
      <div class="action-item" data-id="${a.id}" style="
        display: flex; gap: 8px; align-items: center; padding: 10px 12px;
        background: var(--paper); border: 1px solid var(--line-light);
        border-radius: var(--radius-sm);
      ">
        <input type="text" class="input action-name" value="${escapeHtml(a.name)}" placeholder="名称" style="flex:1;">
        <input type="text" class="input action-content" value="${escapeHtml(a.content)}" placeholder="内容" style="flex:2;">
        <button class="btn ghost action-del" style="padding: 6px 10px; color: var(--cinnabar);">×</button>
      </div>
    `).join("");

    listEl.querySelectorAll(".action-item").forEach(item => {
      const id = item.dataset.id;
      const nameEl = item.querySelector(".action-name");
      const contentEl = item.querySelector(".action-content");
      const delBtn = item.querySelector(".action-del");

      const save = async () => await updateAction(id, { name: nameEl.value, content: contentEl.value });
      nameEl.onblur = save;
      contentEl.onblur = save;

      delBtn.onclick = async () => {
        await deleteAction(id);
        showToast("已删除");
        await renderActionSection(listEl, userId, scope, charId);
      };
    });
  }

  // 找到对应的添加按钮
  const addBtnId = scope === "global" ? "#btn-add-global-action" : "#btn-add-char-action";
  const parentContainer = listEl.closest("#settings-content") || listEl.parentNode;
  const addBtn = parentContainer.querySelector(addBtnId);
  
  if (addBtn) {
    addBtn.onclick = async () => {
      const payload = { 
        name: "新动作", 
        content: "", 
        scope: scope === "global" ? "global" : "char",
        charId: scope === "global" ? null : charId
      };
      
      const a = await createAction(userId, payload);
      await renderActionSection(listEl, userId, scope, charId);
      const row = listEl.querySelector(`.action-item[data-id="${a.id}"]`);
      if (row) row.querySelector(".action-name").focus();
    };
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

