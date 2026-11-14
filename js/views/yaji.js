import { getCharactersByOwner, deleteCharacter } from "../services/character-service.js";
import { getImageUrl } from "../services/seed-service.js";
import { state } from "../core/state.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { getRelation, getRelationLevels, calcLevel, calcStatus } from "../services/relation-service.js";
import { getCharacterRelations, getNpcsByCharacter } from "../services/npc-service.js";
import { db } from "../core/db.js";

export async function yajiView() {
  const el = document.createElement("div");
  el.style.cssText = "position: relative; min-height: 100dvh; padding: 0; margin: -20px -20px -100px;";

  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const characters = await getCharactersByOwner(ownerId);

  if (characters.length === 0) {
    el.innerHTML = `
      <div class="section-title" style="margin-top: 20px;">雅 集</div>
      <div class="empty-state">
        还没有角色。<br>
        <a href="#/yaji/new" style="color: var(--cinnabar);">结识一位</a> 吧。
      </div>
    `;
    document.body.classList.add("yaji");
    return el;
  }

  // 加载 URL
  const charWithUrls = await Promise.all(characters.map(async c => ({
    ...c,
    portraitUrl: c.portraitId ? await getImageUrl(c.portraitId) : null,
    avatarUrl: c.avatarId ? await getImageUrl(c.avatarId, true) : null,
  })));

  el.innerHTML = `
    <!-- 立绘背景层 -->
    <div id="yaji-stage" style="
      position: relative;
      width: 100%;
      min-height: 100dvh;
      background-size: cover;
      background-position: center top;
      background-repeat: no-repeat;
      transition: background-image 0.6s;
    ">
      <!-- 遮罩，让文字清晰 -->
      <div style="
        position: absolute; inset: 0;
        background: linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.75) 100%);
        pointer-events: none;
      "></div>

      <!-- ===== 左上角：身份与羁绊 ===== -->
      <div style="position: absolute; top: 24px; left: 20px; display: flex; flex-direction: column; gap: 8px;">
        <!-- 名字短框 -->
        <div class="yaji-frame" style="padding: 8px 24px;">
          <div id="yaji-name" style="font-family: var(--font-title); font-size: 20px; letter-spacing: 4px; color: var(--ink);"></div>
        </div>
        
        <!-- 数值与等级 -->
        <div style="padding-left: 8px; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.8);">
          <div style="font-size: 13px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 6px; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">
  <!-- 👈 这里直接用 id="yaji-status" 展示关系状态，不再用 yaji-du 了 -->
  关系：<span id="yaji-status" style="font-family: var(--font-title); color: #fff; font-weight: bold;"></span>
</div>
          <div style="font-size: 12px; margin-bottom: 4px;">
            爱慕：<span id="yaji-aff-val" style="font-family: var(--font-title);"></span> 
            <span id="yaji-aff-lv" style="font-size: 11px; opacity: 0.8; margin-left: 4px;"></span>
          </div>
          <div style="font-size: 12px;">
            友善：<span id="yaji-fri-val" style="font-family: var(--font-title);"></span> 
            <span id="yaji-fri-lv" style="font-size: 11px; opacity: 0.8; margin-left: 4px;"></span>
          </div>
        </div>
      </div>

      <!-- ===== 右上角：操作菜单 ===== -->
      <div style="position: absolute; top: 24px; right: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
        <div class="yaji-frame" id="btn-profile" style="padding: 6px 18px; cursor: pointer;">
          <span style="font-family: var(--font-title); font-size: 14px; letter-spacing: 2px; color: var(--ink);">资 料</span>
        </div>
        
        <div class="yaji-frame" id="btn-interact" style="padding: 6px 18px; cursor: pointer;">
          <span style="font-family: var(--font-title); font-size: 14px; letter-spacing: 2px; color: var(--ink);">互 动</span>
        </div>

        <!-- 互动展开的二级菜单 -->
        <div id="sub-menu" style="display: none; flex-direction: column; align-items: flex-end; gap: 6px; margin-top: 4px;">
          <div class="yaji-sub-btn" data-act="chat">闲 谈</div>
          <div class="yaji-sub-btn" data-act="gift">赠 礼</div>
          <div class="yaji-sub-btn" data-act="travel">同 游</div>
          <div class="yaji-sub-btn" data-act="letter">书 信</div>
        </div>
      </div>

<!-- 互动子菜单（默认隐藏） -->
<div class="yaji-action-row" id="yaji-action-sub" style="display:none;">
  <button class="yaji-action" data-act="back">返 回</button>
  <span class="yaji-divider"></span>
  <button class="yaji-action" data-act="chat">闲 谈</button>
  <span class="yaji-divider"></span>
  <button class="yaji-action" data-act="gift">赠 礼</button>
  <span class="yaji-divider"></span>
  <button class="yaji-action" data-act="story">剧 情</button>
  <span class="yaji-divider"></span>
  <button class="yaji-action" data-act="letter">书 信</button>
</div>

      <!-- 底部角色横栏 -->
      <div id="yaji-tabs" style="
        position: absolute;
        bottom: 85px;
        left: 0; right: 0;
        display: flex;
        gap: 12px;
        padding: 0 20px;
        overflow-x: auto;
        scrollbar-width: none;
        justify-content: flex-start;
      "></div>
    </div>

    <!-- 面板（弹窗） -->
    <div id="yaji-panel" style="
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 200;
      display: none;
      align-items: flex-end;
      justify-content: center;
    ">
      <div id="yaji-panel-content" style="
        width: 100%;
        max-width: 720px;
        max-height: 80vh;
        overflow-y: auto;
        background: var(--paper);
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
        padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
        animation: slide-up 0.3s ease;
      "></div>
    </div>
  `;

  // 全局样式
  const style = document.createElement("style");
  style.textContent = `
    /* 👈 古风长条画框 */
    .yaji-frame {
      position: relative;
      background: rgba(250, 246, 238, 0.85); /* 宣纸半透明底色 */
      backdrop-filter: blur(4px);
      border: 1px solid var(--cinnabar); /* 外层朱砂红线 */
      border-radius: 20px 4px 20px 4px; /* 左上右下大圆角，右上左下小圆角，做出花边感 */
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    .yaji-frame::after {
      content: "";
      position: absolute;
      inset: 2px; /* 内层细线的间距 */
      border: 1px solid rgba(163, 51, 51, 0.4); /* 内层浅色细线 */
      border-radius: 18px 2px 18px 2px; /* 跟着外层稍微缩小 */
      pointer-events: none;
    }

    /* 互动二级菜单按钮 */
    .yaji-sub-btn {
      padding: 4px 14px;
      font-family: var(--font-title);
      font-size: 13px;
      letter-spacing: 1px;
      color: var(--ink);
      background: rgba(250, 246, 238, 0.7);
      border: 1px solid var(--line-light);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .yaji-sub-btn:hover {
      color: var(--cinnabar);
      border-color: var(--cinnabar);
      background: rgba(250, 246, 238, 1);
    }

    @keyframes slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .yaji-action-row {
      position: absolute;
      bottom: 150px;
      left: 0; right: 0;
      display: flex;
      gap: 12px;
      padding: 0 16px;
      justify-content: center;
      align-items: center;
    }

    .yaji-action {
      background: none;
      border: none;
      color: #fff;
      font-family: var(--font-title);
      font-size: 15px;
      letter-spacing: 4px;
      padding: 8px 10px;
      cursor: pointer;
      position: relative;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
    }

    .yaji-action::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 1px;
      background: #fff;
      transition: width 0.2s;
    }

    .yaji-action:active::after,
    .yaji-action:hover::after {
      width: 60%;
    }

    .yaji-divider {
      width: 1px;
      height: 14px;
      background: rgba(255, 255, 255, 0.4);
    }

    /* ===== 资料弹窗 ===== */
    #yaji-panel-content {
      padding: 0;
      background: transparent;
      box-shadow: none;
    }

    .pf-header {
      text-align: center;
      padding: 20px 0 14px;
    }
    .pf-name {
      font-family: var(--font-title);
      font-size: var(--font-size-title);
      letter-spacing: 6px;
      color: var(--cinnabar, #a33);
      font-weight: 600;
    }

    .pf-tabs {
      display: flex;
      gap: 8px;
      padding: 0 16px 12px;
    }
    .pf-tab {
      flex: 1;
      text-align: center;
      padding: 10px 0;
      font-size: 13px;
      letter-spacing: 2px;
      color: #8a7f72;
      background: rgba(0,0,0,0.04);
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .pf-tab.active {
      color: #fff;
      background: var(--cinnabar, #a33);
      font-weight: 600;
    }

    .pf-tab-panel {
      background: rgba(0,0,0,0.03);
      border-radius: 0 0 12px 12px;
      padding: 16px;
      max-height: 55vh;
      overflow-y: auto;
    }

    .pf-tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }
    .pf-tag {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(163,51,51,0.1);
      color: var(--cinnabar, #a33);
    }

    .pf-item {
      display: flex;
      align-items: stretch;
      background: #fff;
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .pf-item-label {
      flex-shrink: 0;
      width: 72px;
      padding: 10px 8px;
      text-align: center;
      font-size: 13px;
      letter-spacing: 2px;
      color: #fff;
      background: var(--cinnabar, #a33);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pf-item-value {
      flex: 1;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.7;
      color: #3a332c;
      word-break: break-word;
    }

    .pf-collapse {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 4px;
      margin-top: 8px;
      font-size: 14px;
      color: #3a332c;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .pf-collapse-hint {
      font-size: 12px;
      color: #a89e92;
    }
    .pf-collapse-body { padding: 12px 4px; }

    .pf-empty {
      font-size: 12px;
      line-height: 1.7;
      color: #a89e92;
      padding: 16px;
      background: rgba(0,0,0,0.02); /* 极浅的灰色底 */
      border-radius: 8px;
      text-align: center;
    }

    .pf-perspective {
      margin-top: 16px;
      padding: 14px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .pf-perspective-title {
      font-size: 13px;
      letter-spacing: 3px;
      color: #8a7f72;
      margin-bottom: 8px;
    }
    .pf-perspective-text {
      font-size: 14px;
      line-height: 1.8;
      color: #3a332c;
    }

    .pf-actions {
      display: flex;
      gap: 12px;
      padding: 16px;
    }
    .pf-anecdotes {
      font-size: 14px;
      line-height: 1.9;
      color: #3a332c;
      padding: 16px;
      background: #fff; /* 👈 改成纯白，显得干净 */
      border-radius: 8px; /* 圆角 */
      box-shadow: 0 1px 3px rgba(0,0,0,0.04); /* 加点淡淡的小阴影 */
    }
    .pf-memory-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      font-size: 13px;
      line-height: 1.7;
      color: #3a332c;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .pf-memory-item:last-child { border-bottom: none; }
    .pf-memory-tag {
      flex-shrink: 0;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(163,51,51,0.1);
      color: var(--cinnabar, #a33);
    }

    /* ===== 关系网 Tab ===== */
    .pf-relation-group-title {
      font-family: var(--font-title);
      font-size: 13px;
      letter-spacing: 3px;
      color: #8a7f72;
      padding: 4px 0 10px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
      margin-bottom: 10px;
    }
    .pf-relation-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .pf-relation-list:last-child { margin-bottom: 0; }

    .pf-relation-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      cursor: pointer;
      transition: all 0.15s;
    }
    .pf-relation-item:hover {
      box-shadow: 0 2px 8px rgba(163,51,51,0.12);
    }
    .pf-relation-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      background: #b8b0a0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-family: var(--font-title);
      font-size: 18px;
    }
    .pf-relation-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pf-relation-info {
      flex: 1;
      min-width: 0;
    }
    .pf-relation-name {
      font-family: var(--font-title);
      font-size: 14px;
      color: #3a332c;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .pf-relation-desc {
      font-size: 11px;
      color: #a89e92;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pf-relation-tag {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--cinnabar, #a33);
      background: rgba(163,51,51,0.08);
      padding: 2px 8px;
      border-radius: 4px;
    }
  `;
  el.appendChild(style);

  const stage = el.querySelector("#yaji-stage");
  const tabsEl = el.querySelector("#yaji-tabs");
  const panel = el.querySelector("#yaji-panel");
  const panelContent = el.querySelector("#yaji-panel-content");
  const relationEl = el.querySelector("#yaji-relation");
  const perspectiveEl = el.querySelector("#yaji-perspective");

  let currentChar = charWithUrls[0];
  let currentPerspective = "";

  // 渲染横栏
  charWithUrls.forEach(c => {
    const tab = document.createElement("div");
    tab.style.cssText = `
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(255,255,255,0.3);
      cursor: pointer;
      transition: border-color 0.2s;
      background: rgba(0,0,0,0.3);
    `;
    tab.dataset.charId = c.id;
    if (c.avatarUrl) {
      tab.innerHTML = `<img src="${c.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      tab.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">${c.name[0]}</div>`;
    }
    tab.onclick = () => selectChar(c);

    let pressTimer = null;
    const openMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCharMenu(c);
    };
    tab.addEventListener("contextmenu", openMenu);
    tab.addEventListener("touchstart", () => {
      pressTimer = setTimeout(openMenu, 600);
    }, { passive: true });
    tab.addEventListener("touchend", () => clearTimeout(pressTimer));
    tab.addEventListener("touchmove", () => clearTimeout(pressTimer));
    tab.addEventListener("mousedown", () => {
      pressTimer = setTimeout(openMenu, 600);
    });
    tab.addEventListener("mouseup", () => clearTimeout(pressTimer));
    tab.addEventListener("mouseleave", () => clearTimeout(pressTimer));

    tabsEl.appendChild(tab);
  });

  // "+" 按钮
  const addTab = document.createElement("div");
  addTab.style.cssText = `
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px dashed rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #fff;
    cursor: pointer;
    background: rgba(0,0,0,0.3);
  `;
  addTab.textContent = "＋";
  addTab.onclick = () => location.hash = "#/yaji/new";
  tabsEl.appendChild(addTab);

  // ========== 选中角色 ==========
  async function selectChar(char) {
    currentChar = char;

    // 1. 切换底部头像的高亮边框
    tabsEl.querySelectorAll("div[data-char-id]").forEach(t => {
      t.style.borderColor = t.dataset.charId === char.id ? "#fff" : "rgba(255,255,255,0.3)";
    });

    // 2. 切换背景立绘
    if (char.portraitUrl) {
      stage.style.backgroundImage = `url(${char.portraitUrl})`;
    }

    // 3. 填充左上角的名字
    el.querySelector("#yaji-name").textContent = char.name;
    
    // 4. 获取并填充好感度数据
    const relation = await getRelation(ownerId, char.id);
    const levels = await getRelationLevels(char.id);
    
    // 先算等级和状态
    const affectionLevel = calcLevel(relation.affection, levels.affectionLevels);
    const friendshipLevel = calcLevel(relation.friendship, levels.friendshipLevels);
    const status = calcStatus(relation.affection, relation.friendship, levels.statusMap);
    
    // 填入状态
    el.querySelector("#yaji-status").textContent = status;

    // 👈 核心绝杀：直接在这里赋值！不要分两段，也不要让后面的 levels.perspective 覆盖它！
    currentPerspective = generatePerspective(char.name, relation.affection);

    // 填入数值
    el.querySelector("#yaji-aff-val").textContent = Math.round(relation.affection);
    el.querySelector("#yaji-aff-lv").textContent = `(${affectionLevel.name})`;
    el.querySelector("#yaji-fri-val").textContent = Math.round(relation.friendship);
    el.querySelector("#yaji-fri-lv").textContent = `(${friendshipLevel.name})`;

    // 5. 点击立绘触发台词（带防误触，居中气泡，停留3秒）
    stage.onclick = (e) => {
      // 防误触：点到按钮或者底部头像就不触发
      if (e.target.closest('#btn-profile') || e.target.closest('#btn-interact') || e.target.closest('#sub-menu') || e.target.closest('#yaji-tabs')) return;
      
      // 1. 获取台词
      const reactionText = getPortraitReaction(char, relation.affection);
      if (!reactionText) return;

      // 2. 替换昵称
      const userName = state.currentUser?.nickname || state.currentUser?.name || "你";
      const finalText = reactionText.replace(/XX/g, userName);

      // 3. 检查有没有旧的气泡，有就先删掉
      const oldBubble = document.getElementById("portrait-bubble");
      if (oldBubble) oldBubble.remove();

      // 4. 创建全新气泡
      const bubble = document.createElement("div");
      bubble.id = "portrait-bubble";
      bubble.textContent = finalText;
      bubble.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(250, 246, 238, 0.95);
        backdrop-filter: blur(8px);
        color: var(--ink);
        font-family: var(--font-body);
        font-size: 15px;
        line-height: 2;
        letter-spacing: 2px;
        padding: 20px 28px;
        border-radius: 12px;
        border: 1px solid var(--cinnabar);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        z-index: 999;
        max-width: 80%;
        text-align: center;
        opacity: 0;
        transition: opacity 0.4s ease, top 0.4s ease;
      `;

      document.body.appendChild(bubble);

      // 触发淡入动画
      setTimeout(() => { bubble.style.opacity = "1"; }, 10);

      // 👈 停留 3500 毫秒（3.5秒）后淡出消失
      setTimeout(() => {
        bubble.style.opacity = "0";
        setTimeout(() => bubble.remove(), 400);
      }, 3500);
    };
  }

  // ========== 右上角全新菜单逻辑 ==========
  const btnProfile = el.querySelector("#btn-profile");
  const btnInteract = el.querySelector("#btn-interact");
  const subMenu = el.querySelector("#sub-menu");

  // 点击资料
  btnProfile.onclick = () => {
    openProfilePanel(currentChar, currentPerspective);
  };

  // 点击互动：展开/收起二级菜单
  btnInteract.onclick = () => {
    const isHidden = subMenu.style.display === "none" || subMenu.style.display === "";
    subMenu.style.display = isHidden ? "flex" : "none";
  };

  // 点击二级菜单（闲谈 / 赠礼 / 同游 / 书信）
  el.querySelectorAll(".yaji-sub-btn").forEach(btn => {
    btn.onclick = async () => {
      const act = btn.dataset.act;
      subMenu.style.display = "none"; // 点完自动收起菜单

      if (act === "chat") {
        location.hash = `#/chat/${currentChar.id}`;
      } else if (act === "gift") {
        openYajiGiftPicker(currentChar.id); 
      } else if (act === "travel") {
        // 👈 核心改动：调用咱们刚才写的同游地图函数
        openTravelMap(currentChar.id, currentChar.name);
      } else if (act === "letter") {
        location.hash = "#/tanmi/letters"; 
      }
    };
  });

  // ========== 角色菜单 ==========
  function openCharMenu(char) {
    panelContent.innerHTML = `
      <div style="text-align:center; font-family:var(--font-title); font-size:18px; color:var(--cinnabar); letter-spacing:4px; margin-bottom:20px;">
        ${escapeHtml(char.name)}
      </div>
      <div class="card" style="cursor:pointer;" id="menu-edit">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>编 辑 档 案</span>
          <span style="color:var(--ink-dim);">›</span>
        </div>
      </div>
      <div class="card" style="cursor:pointer;" id="menu-chat">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>与 他 闲 谈</span>
          <span style="color:var(--ink-dim);">›</span>
        </div>
      </div>
      <div class="card" style="cursor:pointer; color:var(--cinnabar);" id="menu-delete">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>删 除 角 色</span>
          <span style="color:var(--cinnabar);">›</span>
        </div>
      </div>
      <button class="btn ghost" style="width:100%; margin-top:12px;" id="menu-cancel">收 起</button>
    `;
    panel.style.display = "flex";
    panel.onclick = (e) => { if (e.target === panel) closePanel(); };

    panelContent.querySelector("#menu-edit").onclick = () => {
      closePanel();
      location.hash = `#/yaji/edit/${char.id}`;
    };
    panelContent.querySelector("#menu-chat").onclick = () => {
      closePanel();
      location.hash = `#/chat/${char.id}`;
    };
    panelContent.querySelector("#menu-delete").onclick = async () => {
      closePanel();
      const ok = await showConfirm("删除角色", `确定删除「${char.name}」？他的对话、笺语都会一并消失。`);
      if (!ok) return;
      await deleteCharacter(char.id);
      showToast("已删除");
      location.reload();
    };
    panelContent.querySelector("#menu-cancel").onclick = () => closePanel();
  }

  function closePanel() {
    panel.style.display = "none";
  }

  // ========== 默认选中 ==========
  await selectChar(charWithUrls[0]);

  return el;
}

/* ========== 资料面板（三 Tab：个人信息 / 轶事 / 关系网） ========== */
async function openProfilePanel(char, perspective) {
  const panel = document.getElementById("yaji-panel");
  const content = document.getElementById("yaji-panel-content");
  const ownerId = state.currentUserId;

  // 加载关系网数据
  const charRelations = await getCharacterRelations(ownerId, char.id);
  const npcs = await getNpcsByCharacter(ownerId, char.id);

  // 拉所有角色（用于显示主要角色名字 / 头像）
  const allChars = await getCharactersByOwner(ownerId);
  const charMap = {};
  for (const c of allChars) {
    charMap[c.id] = {
      ...c,
      avatarUrl: c.avatarId ? await getImageUrl(c.avatarId, true) : null,
    };
  }

  // 关系网数据处理
  const relationRows = [];
  for (const r of charRelations) {
    const otherId = r.fromId === char.id ? r.toId : r.fromId;
    const other = charMap[otherId];
    if (!other) continue;
    relationRows.push({
      type: "character",
      id: other.id,
      name: other.name,
      avatarUrl: other.avatarUrl,
      relation: r.relation,
      description: r.description,
    });
  }

  const npcRows = [];
  for (const n of npcs) {
    let avatarUrl = null;
    if (n.avatarId) {
      avatarUrl = await getImageUrl(n.avatarId, true);
    }
    npcRows.push({
      type: "npc",
      id: n.id,
      name: n.name,
      avatarUrl,
      relation: n.relation,
      description: n.description,
      isFriend: n.isFriend,
    });
  }
  



  const infoFields = [
    ["渡号",   char.du],
    ["渡言",   char.duMotto],
    ["称号",   char.title],
    ["昵称",   char.nickname],
    ["年龄",   char.age],
    ["性别",   char.gender],
    ["所属",   char.faction],
    ["身份",   char.rank],
    ["师父",   char.master],
    ["兵器",   char.weapon],
    ["武学",   char.martialArt],
    ["信条",   char.motto],
    ["喜",     char.likes?.join("、")],
    ["恶",     char.dislikes?.join("、")],
  ].filter(([, v]) => v);

  content.innerHTML = `
    <div class="pf-header">
      <div class="pf-name">${escapeHtml(char.name)}</div>
    </div>

    <!-- 标签切换 -->
    <div class="pf-tabs">
      <div class="pf-tab active" data-tab="info">个人信息</div>
      <div class="pf-tab" data-tab="story">轶事</div>
      <div class="pf-tab" data-tab="relation">关系网</div>
    </div>

    <!-- 个人信息 -->
    <div class="pf-tab-panel" id="pf-panel-info">
      ${char.tags?.length ? `
        <div class="pf-tag-row">
          ${char.tags.map(t => `<span class="pf-tag">${escapeHtml(t)}</span>`).join("")}
        </div>` : ""}

      ${infoFields.map(([label, value]) => `
        <div class="pf-item">
          <div class="pf-item-label">${label}</div>
          <div class="pf-item-value">${escapeHtml(String(value)).replace(/\n/g, "<br>")}</div>
        </div>
      `).join("")}

      ${char.bio ? `
        <div class="pf-item">
          <div class="pf-item-label">简介</div>
          <div class="pf-item-value">${escapeHtml(char.bio).replace(/\n/g, "<br>")}</div>
        </div>` : ""}

      <!-- 👈 回忆与事实面板 -->
      <div class="pf-collapse" data-target="memory">
        <span>TA 对你的回忆</span>
        <span class="pf-collapse-hint">展开</span>
      </div>
      <div class="pf-collapse-body" id="pf-memory" style="display:none; max-height: 300px; overflow-y: auto; background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        ${(char.memories && char.memories.length)
          ? char.memories.map(m => `
              <div class="pf-memory-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 8px 0;">
                <span style="flex:1;">${escapeHtml(m.text).replace(/\n/g, "<br>")}</span>
                ${m.source === "story" ? `
<span class="pf-memory-tag" style="flex-shrink:0; background: rgba(138, 109, 75, 0.08); padding: 2px 6px; border-radius: 4px; color: #8a6d4b; font-size: 11px; border: 1px solid rgba(138, 109, 75, 0.2);">AI总结</span>` : ""}
              </div>
            `).join("")
          : `<div class="pf-empty">暂无事，与 TA 私聊时第一条人称回忆记录，每聊一段总结一次，也可在此手动添加。</div>`}
      </div>

      <div class="pf-collapse" data-target="facts">
        <span>TA 记得的事实</span>
        <span class="pf-collapse-hint">展开</span>
      </div>
      <div class="pf-collapse-body" id="pf-facts" style="display:none; max-height: 300px; overflow-y: auto; background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        ${(char.facts && char.facts.length)
          ? char.facts.map(f => `
              <div class="pf-memory-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 8px 0;">
                <span style="flex:1;">${escapeHtml(f.text).replace(/\n/g, "<br>")}</span>
                ${f.source === "story" ? `
<span class="pf-memory-tag" style="flex-shrink:0; background: rgba(138, 109, 75, 0.08); padding: 2px 6px; border-radius: 4px; color: #8a6d4b; font-size: 11px; border: 1px solid rgba(138, 109, 75, 0.2);">AI总结</span>` : ""}
              </div>
            `).join("")
          : `<div class="pf-empty">暂无事，私聊/群聊里的关键结论会自动记下，AI 记错时也可在此手动纠正。</div>`}
      </div>

      <!-- 人物看法 -->
      <div class="pf-perspective">
        <div class="pf-perspective-title">人物看法</div>
        <div class="pf-perspective-text">
          「${escapeHtml(perspective || "他正静静看着你。")}」
        </div>
      </div>
    </div>

    <!-- 轶事 -->
    <div class="pf-tab-panel" id="pf-panel-story" style="display:none;">
      ${char.anecdotes
        ? `<div class="pf-anecdotes">${escapeHtml(char.anecdotes).replace(/\n/g, "<br>")}</div>`
        : `<div class="pf-empty">暂无轶事记录。</div>`}
    </div>

    <!-- 关系网 (重写版，确保一定渲染) -->
    <div class="pf-tab-panel" id="pf-panel-relation" style="display:none;">
      ${relationRows.length || npcRows.length ? `
        <div class="pf-relation-group-title">主要角色</div>
        <div class="pf-relation-list">
          ${relationRows.length ? relationRows.map(r => `
            <div class="pf-relation-item" data-type="character" data-id="${r.id}">
              <div class="pf-relation-avatar">
                ${r.avatarUrl ? `<img src="${r.avatarUrl}" alt="">` : escapeHtml(r.name.charAt(0))}
              </div>
              <div class="pf-relation-info">
                <div class="pf-relation-name">${escapeHtml(r.name)}</div>
                ${r.description ? `<div class="pf-relation-desc">${escapeHtml(r.description)}</div>` : ""}
              </div>
              ${r.relation ? `<span class="pf-relation-tag">${escapeHtml(r.relation)}</span>` : ""}
            </div>
          `).join("") : `<div class="pf-empty">暂无主要角色关系。</div>`}
        </div>

        <div class="pf-relation-group-title">其他人物</div>
        <div class="pf-relation-list">
          ${npcRows.length ? npcRows.map(n => `
            <div class="pf-relation-item" data-type="npc" data-id="${n.id}">
              <div class="pf-relation-avatar">
                ${n.avatarUrl ? `<img src="${n.avatarUrl}" alt="">` : escapeHtml(n.name.charAt(0))}
              </div>
              <div class="pf-relation-info">
                <div class="pf-relation-name">${escapeHtml(n.name)}</div>
                ${n.description ? `<div class="pf-relation-desc">${escapeHtml(n.description)}</div>` : ""}
              </div>
              ${n.relation ? `<span class="pf-relation-tag">${escapeHtml(n.relation)}</span>` : ""}
            </div>
          `).join("") : `<div class="pf-empty">暂无其他人物。</div>`}
        </div>
      ` : `<div class="pf-empty">暂无关系网记录。去编辑档案里添加吧。</div>`}
    </div>

    <div class="pf-actions">
      <button class="btn ghost" style="flex:1;" id="profile-edit">编 辑</button>
      <button class="btn ghost" style="flex:1;" id="profile-close">收 起</button>
    </div>
  `;

  panel.style.display = "flex";
  panel.onclick = (e) => { if (e.target === panel) closePanel(); };
  content.querySelector("#profile-close").onclick = () => closePanel();
  content.querySelector("#profile-edit").onclick = () => {
    closePanel();
    location.hash = `#/yaji/edit/${char.id}`;
  };

  // 标签切换
  content.querySelectorAll(".pf-tab").forEach(tab => {
    tab.onclick = () => {
      content.querySelectorAll(".pf-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      content.querySelector("#pf-panel-info").style.display     = target === "info"     ? "block" : "none";
      content.querySelector("#pf-panel-story").style.display    = target === "story"    ? "block" : "none";
      content.querySelector("#pf-panel-relation").style.display = target === "relation" ? "block" : "none";
    };
  });

  // 关系网点击（主要角色 → 切换到那个角色；NPC → 弹简介）
  content.querySelectorAll(".pf-relation-item").forEach(item => {
    item.onclick = () => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      if (type === "character") {
        closePanel();
        // 找到对应角色并切换
        const target = allChars.find(c => c.id === id);
        if (target) {
          const withUrl = charMap[id];
          selectCharById(id);
        }
      } else if (type === "npc") {
        // NPC 弹简介
        const npc = npcRows.find(n => n.id === id);
        if (!npc) return;
        showNpcPopup(npc);
      }
    };
  });

  // 折叠交互
  content.querySelectorAll(".pf-collapse").forEach(el => {
    el.onclick = () => {
      const body = content.querySelector(`#pf-${el.dataset.target}`);
      if (!body) return;
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "block";
      el.querySelector(".pf-collapse-hint").textContent = open ? "展开" : "收起";
    };
  });

  function closePanel() {
    panel.style.display = "none";
  }

  // 切换角色（通过 id）
  async function selectCharById(charId) {
    const target = charMap[charId];
    if (!target) return;
    // 找到 yaji.js 里的 selectChar（通过全局找到 dom 重新触发）
    const tabsEl = document.getElementById("yaji-tabs");
    const tab = tabsEl?.querySelector(`[data-char-id="${charId}"]`);
    if (tab) tab.click();
  }

  // NPC 简介弹窗
  function showNpcPopup(npc) {
    content.innerHTML = `
      <div class="pf-header">
        <div class="pf-name">${escapeHtml(npc.name)}</div>
        ${npc.relation ? `<div style="font-size:13px;color:#8a7f72;letter-spacing:2px;margin-top:6px;">${escapeHtml(npc.relation)}</div>` : ""}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;padding:0 20px 20px;">
        <div class="pf-relation-avatar" style="width:80px;height:80px;font-size:32px;">
          ${npc.avatarUrl ? `<img src="${npc.avatarUrl}" alt="">` : escapeHtml(npc.name.charAt(0))}
        </div>
      </div>
      ${npc.description ? `
        <div class="pf-item" style="margin:0 20px 16px;">
          <div class="pf-item-label">简介</div>
          <div class="pf-item-value">${escapeHtml(npc.description).replace(/\n/g, "<br>")}</div>
        </div>` : ""}
      <div class="pf-actions">
        <button class="btn ghost" style="flex:1;" id="npc-back">返 回</button>
        <button class="btn ghost" style="flex:1;" id="npc-close">收 起</button>
      </div>
    `;

    content.querySelector("#npc-back").onclick = () => {
      closePanel();
      openProfilePanel(char, perspective);
    };
    content.querySelector("#npc-close").onclick = () => closePanel();
  }
}

/* ========== 关系详情弹窗 ========== */
function openRelationPanel(char, relation, levels, affectionLevel, friendshipLevel, status) {
  const affectionTrait = levels.affectionTraits[affectionLevel.name] || {};
  const friendshipTrait = levels.friendshipTraits[friendshipLevel.name] || {};

  const panel = document.getElementById("yaji-panel");
  const content = document.getElementById("yaji-panel-content");

  content.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-family:var(--font-title); font-size:20px; color:var(--cinnabar); letter-spacing:4px;">${escapeHtml(char.name)}</div>
      <div style="font-size:12px; color:var(--ink-dim); letter-spacing:2px; margin-top:4px;">${status}</div>
    </div>

    <div class="relation-block">
      <div class="relation-block-title">
        <span>爱慕值</span>
        <span class="relation-level">${affectionLevel.name}</span>
      </div>
      <div class="relation-bar">
        <div class="relation-bar-fill affection" style="width:${relation.affection}%"></div>
      </div>
      <div class="relation-traits">
        <div><span>语气</span>${affectionTrait.tone || ""}</div>
        <div><span>行为</span>${affectionTrait.behavior || ""}</div>
        <div><span>核心</span>${affectionTrait.core || ""}</div>
      </div>
    </div>

    <div class="relation-block">
      <div class="relation-block-title">
        <span>友善值</span>
        <span class="relation-level">${friendshipLevel.name}</span>
      </div>
      <div class="relation-bar">
        <div class="relation-bar-fill friendship" style="width:${relation.friendship}%"></div>
      </div>
      <div class="relation-traits">
        <div><span>语气</span>${friendshipTrait.tone || ""}</div>
        <div><span>行为</span>${friendshipTrait.behavior || ""}</div>
        <div><span>核心</span>${friendshipTrait.core || ""}</div>
      </div>
    </div>

    <button class="btn ghost" style="width:100%; margin-top:16px;" id="relation-close">收 起</button>
  `;

  panel.style.display = "flex";
  panel.onclick = (e) => { if (e.target === panel) closePanel(); };
  content.querySelector("#relation-close").onclick = () => {
    panel.style.display = "none";
  };

  function closePanel() {
    panel.style.display = "none";
  }
}

// 👈 立绘点击台词库（逐步解锁池）
function getPortraitReaction(char, affection) {
  const name = char.name || "";
  const title = char.title || "";
  let pool = []; // 👈 用来装所有已解锁的台词

  // ===== 方承意 =====
  if (name === "方承意" || title === "神枪血剑小侯爷") {
    if (affection >= 0) pool.push("本侯衣上落了灰？再换件新的便是。", "看来你不但酒量差。酒品也不行啊。", "侯府待久了，也难免生厌，想出去走走。");
    if (affection >= 21) pool.push("没钱用的时候，才想起来找本侯？", "你这女人在老虎身上动手脚，气势还这么足。", "旁人来侯府都是求财求宝，你倒好，怎么什么破烂玩意都往我侯府里塞。", "这世上，没有本侯办不成的事情。");
    if (affection >= 41) pool.push("又没钱了？宋尧，去拿些金叶子来。", "你想要本侯的扇子？拿去，让你把玩片刻，又何妨？", "说吧，遇到了什么麻烦？明昭侯府要是连三清山的小师妹都笼不住，岂不失了身份。", "御街为始，金明池为终，你骑马若能快于本侯，府上的汗血宝马任你挑。");
    if (affection >= 61) pool.push("你方才给本侯脸上贴的是什么玩意？梅花钿？", "哦？光天化日，竟然打起了本侯的主意。", "本侯的时间向来金贵，用来等你的功夫，怕是能买下十座楼。你说说，要如何补偿本侯。", "本侯对你没什么藏着掖着的，若是不信，自己来瞧。", "若本侯不时时分出功夫来盯着你，只怕你早就给人卖了。");
    if (affection >= 81) pool.push("你明知这么做很危险，却不因危而退。不愧是本侯看中的女人。", "何须读心术？你在想什么？本侯不看也知道。", "我看你一脸认真的盯着我，即使正在气头上，我也会忽然觉得心情变好。");
    if (affection >= 100) pool.push("旁人的贺礼都在本侯的库房里生尘，独你的这份，需得日日放在跟前才好。", "本侯想要的东西，从没有拿不到的。已经握住的，更不会松开。");
  }

  // ===== 叶问舟 =====
  if (name === "叶问舟" || title === "小神仙") {
    if (affection >= 0) pool.push("心中有音，便已成曲。", "在想什么？如此高兴。", "你在找什么？又丢东西了？");
    if (affection >= 21) pool.push("真没藏什么，带回来的东西都给你了。", "想吃什么点心？莲花酥如何？", "啊，沾到东西了吗？谢谢师妹。");
    if (affection >= 41) pool.push("允诺你的事，我自然都是记在心里的。", "此夜梅香月明，师兄吹笛给你听可好？", "我不累，难为你还专门学了怎么解乏，费了不少功夫吧。");
    if (affection >= 61) pool.push("我已行过不少地方，却还有很多山水未曾入画，你要不要随我一同采风？", "有的人想平步青云，而我却想自由自在，随性而行。", "不必叹隙中驹，石中火和梦中身，我们自有一张琴，一壶酒和一溪云。");
    if (affection >= 81) pool.push("小馋猫鼻子可真灵，这栗糕是我从汴京带回来的，味道怎么样？", "还要跟我比高啊......不对，你刚才肯定踮脚了，你耍赖!", "竹外桃花，春日远山，桃溪村的风物很美，XX想替我画完吗？");
    if (affection >= 100) pool.push("这莲花酥刚刚出锅，小心烫。（宠溺笑）不急，都是你的。", "你呀，又调皮了。等我画完这幅画就陪你下山，好不好？");
  }

  // ===== 盛崖余（无情）=====
  if (name === "盛崖余" || title === "无情") {
    if (affection >= 0) pool.push("怎么了？有心事？", "你这近身的功夫，和谁学的？");
    if (affection >= 21) pool.push("要起风了，照顾好自己。", "我谁都不用防，只用防你。");
    if (affection >= 41) pool.push("那枚玉佩早已碎了，留这穗子，只是个念想。", "天寒时，难免下笔凝涩，手暖一暖，就会好许多。", "身体好些了吗？还需要什么，托银剑去买。");
    if (affection >= 61) pool.push("这次去江南查案，给你带了菱藕和桂花栗子糕，尝尝看？", "前几日受的少许风寒，已经痊愈，不必为我担心，倒是XX，眼睛有些泛红，昨夜没睡好吗？", "不擅饮酒，就少喝些，我送你回去。", "你想听的，我都可以慢慢同你说。");
    if (affection >= 81) pool.push("今日难得闲暇，想去哪儿我都陪着你。", "束发？嗯......我虽已及冠，却未尝试过。", "我没事。倒是你，急着来见我，头发都跑乱了吗？", "再找糖球么？（拍拍膝头）你不妨在它最喜欢的位置上逗留片刻，它很快便会回来了。", "（低笑）XX寻到了什么蛛丝马迹，要从我身上搜查证物？", "我怎么会生气，我......很高兴。", "再牵一会。");
    if (affection >= 100) pool.push("嗯......想要我戴猫耳朵？......可以试试。", "急着来见我，头发都跑乱了吗？我们有天长地久，不急在一时一刻。", "偶得一块璞玉，你想要的“星月交辉”我刻好了。", "牵着的人是你，我怎么可能放手？", "暗器久不联系是会生疏的，牵手想来也是一样，所以，XX的手，我想再牵一会。");
  }

  // ===== 燕无归 =====
  if (name === "燕无归") {
    if (affection >= 0) pool.push("你在找什么？", "刚才，是什么意思？");
    if (affection >= 21) pool.push("面具？一直戴着，习惯了。", "今天换个地方练剑。", "这个世界上，有些东西注定是不自由的。", "手里没东西，只是这样拔剑方便。");
    if (affection >= 41) pool.push("话越多的人，弱点越多。", "突然出现，是要试我的武功？", "想去哪儿？我带你去。", "我正要去找你。");
    if (affection >= 61) pool.push("昨晚？盯梢，杀人，很困。", "人能掌控命运，却不能左右宿命。", "晚上很危险，但有我在，不会有事。");
    if (affection >= 81) pool.push("很痒，别闹。", "我保护你，不用怕。", "我说过的话，从无反悔。", "那些过去太黑暗，你不会喜欢。", "你胆子变大了。");
    if (affection >= 100) pool.push("这个项链，和我生长的地方有关。那里的事，你了解越多，越危险。", "我明白你的痛苦，了解你的孤独。因为这是我们的宿命。", "放心去玩，我的视线不会离开你。");
  }

  // 👈 核心逻辑：如果池子里有台词，就随机抽一条
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  return ""; 
}


// 👈 雅集专属赠礼（带每日上限完整版）
async function openYajiGiftPicker(charId) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const { GIFTS, GIFT_REACTIONS } = await import("../data/gift-data.js");
  const ownerId = state.currentUserId;

  // 1. 查背包
  const inventory = (await db.all("inventory")).filter(i => i.ownerId === ownerId && i.count > 0);
  if (!inventory.length) return showToast("你的百宝阁空空如也，去藏品里弄点礼物吧~");

  // ==========================================
  // 👈 核心：检查今日送礼上限
  // ==========================================
  const today = new Date().toISOString().slice(0, 10);
  const dailyGiftKey = `daily_gift_${ownerId}_${today}`;
  let todayGiftScore = +(localStorage.getItem(dailyGiftKey) || 0);
  const MAX_DAILY_SCORE = 30;

  if (todayGiftScore >= MAX_DAILY_SCORE) {
    return showToast("今日心意已达上限，明日再来吧~", 1800, 250); // 👈 250px 足够高了
  }

  // 2. 渲染选礼物的弹窗
  let selectedGiftId = null;
  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      赠 礼
    </div>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; max-height:40vh; overflow-y:auto;" id="yaji-gift-list">
      ${inventory.map(inv => {
        const gift = GIFTS[inv.giftId];
        if (!gift) return "";
        return `
          <div class="gift-option" data-giftid="${inv.giftId}" style="
            display:flex; flex-direction:column; align-items:center; gap:6px;
            padding:12px 8px; background:var(--paper-soft); border:1px solid var(--line-light);
            border-radius:8px; cursor:pointer; transition: all 0.2s;
          ">
            <div style="
              width: 32px; height: 32px; border-radius: 4px; border: 1px solid var(--cinnabar);
              color: var(--cinnabar); font-family: var(--font-title); font-size: 16px;
              display: flex; align-items: center; justify-content: center;
            ">${gift.char}</div>
            <div style="font-size:12px; color:var(--ink);">${gift.name} × ${inv.count}</div>
          </div>
        `;
      }).join("")}
    </div>
    <div style="display:flex; gap:10px; margin-top:20px;">
      <button class="btn ghost" id="yaji-gift-cancel" style="flex:1; padding:12px;">取 消</button>
      <button class="btn" id="yaji-gift-confirm" style="flex:1; padding:12px; opacity:0.5; pointer-events:none;">确 认 赠 送</button>
    </div>
  `);

  const confirmBtn = modal.querySelector("#yaji-gift-confirm");
  const giftOptions = modal.querySelectorAll(".gift-option");

  giftOptions.forEach(opt => {
    opt.onclick = () => {
      giftOptions.forEach(o => o.style.borderColor = "var(--line-light)");
      opt.style.borderColor = "var(--cinnabar)";
      selectedGiftId = opt.dataset.giftid;
      confirmBtn.style.opacity = "1";
      confirmBtn.style.pointerEvents = "auto";
    };
  });

  modal.querySelector("#yaji-gift-cancel").onclick = () => closeModal(modal);

  // 3. 确认送出
  confirmBtn.onclick = async () => {
    if (!selectedGiftId) return;
    closeModal(modal);

    const gift = GIFTS[selectedGiftId];

    // 扣除背包
    const record = (await db.all("inventory")).find(i => i.ownerId === ownerId && i.giftId === selectedGiftId);
    if (record) {
      record.count -= 1;
      await db.put("inventory", record);
    }

    // 获取角色信息
    const character = await db.get("characters", charId);
    
    // 👈 核心：把角色名映射成 gift-data.js 里的 key
    let charKey = charId; 
    if (character.name === "盛崖余" || character.title === "无情") charKey = "shengyayu";
    if (character.name === "叶问舟" || character.title === "小神仙") charKey = "yewenzhou";
    if (character.name === "方承意" || character.title === "神枪血剑小侯爷") charKey = "fangchengyi";
    if (character.name === "燕无归") charKey = "yanwugui";

    // 获取喜好反馈（直接用你的 gift-data.js）
    let response = "（收下礼物）多谢。";
    let addAffection = 1;
    if (GIFT_REACTIONS[charKey]) {
      const reactions = GIFT_REACTIONS[charKey];
      if (reactions[selectedGiftId]) {
        response = reactions[selectedGiftId].text;
        addAffection = reactions[selectedGiftId].score;
      } else {
        response = reactions.default.text;
        addAffection = reactions.default.score;
      }
    }

    // ==========================================
    // 👈 核心：计算每日实际上限并保存
    // ==========================================
    const remainScore = MAX_DAILY_SCORE - todayGiftScore;
    const actualAdd = Math.min(addAffection, remainScore);

    // 增加好感度
    const { addRelation } = await import("../services/relation-service.js");
    await addRelation(ownerId, charId, {
      affection: actualAdd,
      friendship: 0,
      type: "gift",
      note: `赠送了 ${gift.name}`,
    });

    // 记录今日得分并保存
    todayGiftScore += actualAdd;
    localStorage.setItem(dailyGiftKey, todayGiftScore);

    // 替换昵称
    const userName = state.currentUser?.nickname || state.currentUser?.name || "你";
    const finalResponse = response.replace(/XX/g, userName);

    // 播放美美的气泡飘字
    showGiftReactionBubble(finalResponse, actualAdd);

    // 刷新左上角的好感度
    const tab = document.querySelector(`[data-char-id="${charId}"]`);
    if (tab) tab.click();
  };
}




// 👈 专门用来播放送礼反应气泡的函数（完全分离版）
function showGiftReactionBubble(text, score) {
  // 1. 移除旧的元素
  const oldBubble = document.getElementById("gift-reaction-bubble");
  const oldScore = document.getElementById("gift-reaction-score");
  if (oldBubble) oldBubble.remove();
  if (oldScore) oldScore.remove();

  // ==========================================
  // 👈 第一个元素：古风画框（只装台词）
  // ==========================================
  const bubble = document.createElement("div");
  bubble.id = "gift-reaction-bubble";
  
  bubble.style.cssText = `
    position: fixed;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    background: var(--paper);
    padding: 20px 24px;
    border-radius: 8px;
    border: 2px solid #c8b69d;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    z-index: 999;
    width: 85%;
    max-width: 400px;
    box-sizing: border-box;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  bubble.innerHTML = `
    <div style="
      border: 1px solid var(--cinnabar);
      padding: 20px 24px;
      border-radius: 4px;
      white-space: normal;
      word-break: break-word;
      font-family: var(--font-title);
      font-size: 16px;
      line-height: 1.8;
      letter-spacing: 2px;
      text-align: center;
      color: var(--ink);
    ">${text}</div>
  `;

  // ==========================================
  // 👈 第二个元素：悬浮的好感度（脱离画框！）
  // ==========================================
  const scoreEl = document.createElement("div");
  scoreEl.id = "gift-reaction-score";
  scoreEl.textContent = `好感度 +${score}`;
  
  scoreEl.style.cssText = `
    position: fixed;
    top: 62%;  
    left: 50%;
    transform: translate(-50%, 0) scale(0.8);
    color: #fff; /* 文字变纯白 */
    background: rgba(163, 51, 51, 0.9); /* 朱砂红背景 */
    padding: 6px 18px;
    border-radius: 20px; /* 胶囊形状 */
    font-family: var(--font-title);
    font-size: 14px;
    letter-spacing: 2px;
    z-index: 1000;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(scoreEl);

  // ==========================================
  // 👈 播放动画
  // ==========================================
  setTimeout(() => { 
    // 画框弹出
    bubble.style.opacity = "1"; 
    bubble.style.transform = "translate(-50%, -50%) scale(1)";
    
    // 好感度稍微延迟一点点出现，然后微微向上飘
    setTimeout(() => {
      scoreEl.style.opacity = "1";
      scoreEl.style.transform = "translate(-50%, -20px) scale(1)";
    }, 200);
  }, 10);

  // 👈 3.5秒后一起消失
  setTimeout(() => {
    bubble.style.opacity = "0";
    bubble.style.transform = "translate(-50%, -60%) scale(0.9)"; 
    
    scoreEl.style.opacity = "0";
    scoreEl.style.transform = "translate(-50%, -40px) scale(0.9)";
    
    setTimeout(() => {
      bubble.remove();
      scoreEl.remove();
    }, 400);
  }, 3500);
}
  

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

// 👈 同游地图弹窗（带好感度解锁）
async function openTravelMap(charId, charName) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const { TRAVEL_STORIES } = await import("../data/travel-data.js");
  const { getRelation } = await import("../services/relation-service.js");
  const ownerId = state.currentUserId;

  // 1. 检查今天是否已经同游过（全局限制每天1次）
  const today = new Date().toISOString().slice(0, 10);
  const travelKey = `daily_travel_${ownerId}_${today}`;
  if (localStorage.getItem(travelKey)) {
    // 👈 传第三个参数，让它飘到屏幕中间去
    return showToast("今日已同游，明日再来吧~", 1800, 250);
  }

  // 2. 获取该角色的同游数据
  let charKey = charId; 
  if (charName === "盛崖余") charKey = "shengyayu";
  if (charName === "叶问舟") charKey = "yewenzhou";
  if (charName === "方承意") charKey = "fangchengyi";
  if (charName === "燕无归") charKey = "yanwugui";

  const stories = TRAVEL_STORIES[charKey] || [];
  if (!stories.length) return showToast("这里暂时还没有同游地点~");

  // 3. 获取当前好感度
  const relation = await getRelation(ownerId, charId);
  const currentAff = relation.affection;

  // 4. 渲染地图弹窗
  const modal = showModal(`
    <!-- 顶部标题区 -->
    <div style="text-align:center; margin-bottom: 24px;">
      <!-- 👈 把英文换成了诗句 -->
      <div style="font-family:var(--font-title); font-size:12px; color:var(--ink-dim); letter-spacing:4px; margin-bottom:8px;">
        山水一程 · 三生有幸
      </div>
      
      <div style="font-family:var(--font-title); font-size:20px; color:var(--cinnabar); letter-spacing:4px;">
        「 ${escapeHtml(charName)} 」同游
      </div>
      
      <!-- 中间那条装饰线，稍微拉长了一点，更好看 -->
      <div style="width:60px; height:1px; background:var(--cinnabar); margin:12px auto 0; opacity:0.4;"></div>
    </div>

    <!-- 地图地点列表 -->
    <div style="display:flex; flex-direction:column; gap:12px; max-height:50vh; overflow-y:auto; padding:0 4px;">
      ${stories.map((s, idx) => {
        const isUnlocked = currentAff >= s.requiredAffection;
        return `
          <div class="travel-location-card" data-idx="${idx}" style="
            position: relative;
            padding: 16px 20px; border-radius: 4px; 
            background: ${isUnlocked ? 'var(--paper)' : 'rgba(0,0,0,0.03)'};
            border: 1px dashed ${isUnlocked ? 'var(--line)' : 'transparent'};
            display: flex; align-items: center; justify-content: space-between;
            cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
            opacity: ${isUnlocked ? '1' : '0.5'};
            transition: all 0.2s;
          " onmouseover="if(this.style.cursor==='pointer') this.style.borderColor='var(--cinnabar)'" onmouseout="this.style.borderColor='var(--line)'">
            
            <!-- 左侧地点名 -->
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:6px; height:6px; border-radius:50%; background:${isUnlocked ? 'var(--cinnabar)' : 'var(--line)'};"></div>
              <div style="font-family:var(--font-title); font-size:16px; color:var(--ink); letter-spacing:2px;">
                ${escapeHtml(s.title)}
              </div>
            </div>

            <!-- 右侧状态 -->
            <div style="font-size:12px; font-family:var(--font-title); letter-spacing:1px; color:${isUnlocked ? 'var(--cinnabar)' : 'var(--ink-dim)'};">
              ${isUnlocked ? '前往 →' : `🔒 好感 ${s.requiredAffection}`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
    
    <div style="text-align:center; font-size:11px; color:var(--ink-dim); margin-top:20px; letter-spacing:2px;">
      每日仅可同游一次，择一处前往吧
    </div>
  `);


  // 5. 绑定点击事件
  modal.querySelectorAll(".travel-location-card").forEach(card => {
    card.onclick = () => {
      if (card.style.cursor === "not-allowed") return;
      const idx = +card.dataset.idx;
      const story = stories[idx];
      closeModal(modal);
      
      // 记录今天已经同游过
      localStorage.setItem(travelKey, "true");
      
      // 播放同游小剧场
      playTravelStory(charId, charName, story);
    };
  });
}

// 👈 同游阅读小剧场
async function playTravelStory(charId, charName, story) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const { GIFTS } = await import("../data/gift-data.js");

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:18px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
      ${escapeHtml(story.title)}
    </div>
    <div style="
      font-size: 14px; line-height: 2.2; color: var(--ink); 
      text-align: justify; padding: 0 10px; margin-bottom: 20px;
      min-height: 200px; white-space: pre-wrap;
    " id="travel-text-box"></div>
    
    <div id="travel-reward-area" style="opacity: 0; transition: opacity 0.5s; text-align: center;">
      <div style="color: var(--ink-dim); font-size: 12px; margin-bottom: 8px;">这次同游的纪念品</div>
      <div style="font-size: 16px; font-family: var(--font-title); color: var(--cinnabar); margin-bottom: 12px;">
        获得：${GIFTS[story.rewardGiftId]?.name || "未知物品"} × 1
      </div>
      <button class="btn" id="btn-close-travel" style="width: 100%; padding: 12px; letter-spacing: 4px;">收 下 回 忆</button>
    </div>
  `);

  const textBox = modal.querySelector("#travel-text-box");
  const rewardArea = modal.querySelector("#travel-reward-area");
  
  // 1. 打字机效果
  const fullText = story.text;
  let charIdx = 0;
  textBox.innerHTML = "";

  function typeWriter() {
    if (charIdx < fullText.length) {
      // 如果遇到 \n 直接换行，不要停顿太久
      const char = fullText.charAt(charIdx);
      textBox.innerHTML += char === '\n' ? '<br>' : char;
      charIdx++;
      setTimeout(typeWriter, 35);
    } else {
      // 2. 文章读完后，浮现奖励
      rewardArea.style.opacity = "1";
      giveTravelReward(charId, story);
    }
  }
  typeWriter();

  // 3. 结算奖励（发物品、加好感）
  async function giveTravelReward(charId, story) {
    const ownerId = state.currentUserId;
    
    // 👈 核心改动：固定加 5 点好感
    const FIXED_SCORE = 5; 
    
    const { addRelation } = await import("../services/relation-service.js");
    await addRelation(ownerId, charId, {
      affection: FIXED_SCORE, // 👈 用固定值
      friendship: 0,
      type: "travel",
      note: `同游：${story.title}`,
    });

    // 发礼物（这部分保持不变）
    const { db } = await import("../core/db.js");
    const inventory = (await db.all("inventory")).filter(i => i.ownerId === ownerId && i.giftId === story.rewardGiftId);
    if (inventory.length) {
      inventory[0].count += 1;
      await db.put("inventory", inventory[0]);
    } else {
      await db.put("inventory", { id: "inv_" + Date.now(), ownerId, giftId: story.rewardGiftId, count: 1 });
    }

    // 刷新左上角好感度
    const tab = document.querySelector(`[data-char-id="${charId}"]`);
    if (tab) tab.click();
  }

  // 4. 关闭弹窗
  modal.querySelector("#btn-close-travel").onclick = () => {
    closeModal(modal);
    showToast(`好感度 +5`); // 👈 提示也固定为 +5
  };
}

// 👈 根据角色名和好感度，动态生成符合角色性格的“人物看法”
function generatePerspective(name, affection) {
  // 排除掉内置角色，给自建角色一个通用的模板
  if (name !== "盛崖余" && name !== "无情" && name !== "叶问舟" && name !== "方承意" && name !== "燕无归") {
    if (affection < 21) return "相识尚浅，他待你客气有礼，宛如寻常过客。";
    if (affection < 61) return "几番交谈下来，他觉得你心思纯善，是个可交之人。";
    if (affection < 81) return "他已将你引为知己，偶尔也会与你吐露些不为人知的往事。";
    return "对你而言，他已毫无保留；对天下而言，你是他唯一的私心。";
  }
  const isLow = affection < 21;
  const isMid = affection >= 21 && affection < 61;
  const isHigh = affection >= 61 && affection < 81;
  const isMax = affection >= 81;
  // 叶问舟
  if (name === "叶问舟" || name === "小神仙") {
    if (isLow) return "他待你一如寻常师妹，温雅有度，春风含笑，分寸恰在师友之间。";
    if (isMid) return "他渐渐习惯你的相伴，铺纸研墨作画时，总会下意识留一处空位，盼你驻足。";
    if (isHigh) return "他阅遍山河胜景，落笔万千云烟，却发觉最动人的景致，是你在身侧的模样。";
    if (isMax) return "丹青万卷，山河千里，皆不及你一声师兄。他这一生笔墨，情愿尽数用来描摹你。";
  }
  // 盛崖余（无情）
  if (name === "盛崖余" || name === "无情") {
    if (isLow) return "他素来清冷自持，待人有礼，心底却筑起高墙，与你隔着一层疏离。";
    if (isMid) return "他惯于推演世事、勘破迷局，唯独算不透自己为何总忍不住将目光落在你身上。";
    if (isHigh) return "暗器与机括是他护世的兵器，唯独对你卸下防备。一杯温茶，藏着他不肯轻言的惦念。";
    if (isMax) return "他本一心追凶持正，不问风月。轮椅困得住他的双腿，却困不住他向你奔赴的心意。";
  }
  // 方承意
  if (name === "方承意" || name === "神枪血剑小侯爷") {
    if (isLow) return "他见惯阿谀周旋，只当你是三清山来的新鲜人，闲来可解闷，尚未放在心上。";
    if (isMid) return "他口舌张扬，惯于戏谑，可每当你身陷险境，明昭侯府的援手总会最先抵达。";
    if (isHigh) return "他的光阴千金难换，却甘愿分出大半陪你胡闹。心底早已认栽，只是不肯坦然说破。";
    if (isMax) return "世间珍宝权势，他唾手可得。自握住你的那一刻起，你便是他此生最不肯放手的珍奇。";
  }
  // 燕无归
  if (name === "燕无归") {
    if (isLow) return "他如藏于暗处的刃，对周遭万物皆存戒备，这份审视，同样落于你的身上。";
    if (isMid) return "他言语寡淡，不善言辞，可只要你回头，总能撞见他静静望向你的目光。";
    if (isHigh) return "他长久活在血影与杀伐之中，直到遇见你，才贪恋这凡尘里一点温柔微光。";
    if (isMax) return "他早已习惯孤身独行，直到你伸手向他。往后你行至何处，他的剑便护你至何处。";
  }

  return "";
}