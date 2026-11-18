import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { getChatsByOwner, createGroupChat } from "../services/chat-service.js";
import { getImageUrl } from "../services/seed-service.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { GIFTS } from "../data/gift-data.js";
import { drawSign } from "../services/divination-service.js"; 
import { showCropModal } from "../ui/image-cropper.js"; // 👈 引入你的裁剪工具
import {
  getFriendNpcs, getNonFriendNpcs, canAddFriend, addFriend, removeFriend,
} from "../services/npc-service.js";
import { getTheme } from "../theme/theme-registry.js";
import { getLunarDate } from "../core/date-utils.js";
import { openImagePicker } from "../ui/image-picker.js";


export async function chenshiView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;

  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  let currentTab = "chat";

  // 占位诗
  const WAITING_POEMS = [
    { level: "未决", poem: "云烟原无凭，心期寄灵明。\n签前寻意趣，顺物自安宁。" },
    { level: "待定", poem: "世事如浮舟，忧欢莫锁头。\n不问荣枯事，清风伴客悠。" },
    { level: "悬机", poem: "尘缘自悠悠，休苦探天机。\n灵签聊寄意，缓步度春秋。" }
  ];
  const randomWaiting = WAITING_POEMS[Math.floor(Math.random() * WAITING_POEMS.length)];

  // 获取古风农历和时辰
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  
  
const lunarStr = getLunarDate(now);

  const h = now.getHours();
  let timeStr = "夜半";
  if (h < 6) timeStr = "夜半";
  else if (h < 9) timeStr = "清晨";
  else if (h < 12) timeStr = "日间";
  else if (h < 18) timeStr = "午后";
  else timeStr = "暮色";

  // 读取用户自己裁剪的画卷
  const savedCover = localStorage.getItem("chenshi_daily_cover");

  // ==========================================
  // 👈 全新排版：左字右图（无图时居中提示）
  // ==========================================
  el.innerHTML = `
    <!-- 顶部画报区（普通块级元素，老老实实占位置） -->
    <div id="daily-header" style="
      position: relative;
      width: 100%;
      margin: 0;
      padding-top: 20px;
      height: 320px; /* 高度固定 */
      background: var(--paper);
      overflow: hidden;
      border-radius: 0 0 12px 12px;
    ">
      <!-- 1. 背景图（绝对定位在最底层） -->
      <div id="daily-bg" style="
        position: absolute; inset: 0; z-index: 1;
        background-size: cover; background-position: center;
        background-color: #f4efe6; 
      "></div>
      
      <!-- 2. 渐隐遮罩（盖在图上，保证左边文字清晰） -->
      <div style="position: absolute; inset: 0; z-index: 2; background: linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 40%, transparent 70%); pointer-events: none;"></div>

      <!-- 3. 内容层（绝对定位，放在遮罩上面） -->
      <div style="position: absolute; inset: 0; z-index: 3;">
        <!-- 顶部日期 -->
        <div style="position: absolute; top: 20px; left: 20px; font-size: 12px; color: var(--ink-dim); line-height: 1.4; letter-spacing: 1px;">
          <div>${y}年 / ${m}月</div>
          <!-- 👈 直接用 getLunarDate 算好的字符串 -->
          <div>${lunarStr} · ${timeStr}</div> 
        </div>

        <!-- 大号日期 -->
        <div style="position: absolute; top: 12px; left: 130px; font-family: var(--font-title); font-size: 46px; color: var(--ink); font-weight: bold; line-height: 1;">
          ${String(d).padStart(2, '0')}
        </div>

        <!-- 左侧文字区：吉凶 与 诗句 -->
        <div style="position: absolute; top: 80px; left: 15px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px;">
          
          <!-- 吉凶 -->
          <div id="draw-level" style="font-family: var(--font-title); font-size: 20px; color: var(--ink); writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 6px; font-weight: bold;">
            ${randomWaiting.level}
          </div>

          <!-- 诗句（强行两列） -->
          <div id="draw-poem" style="display: flex; flex-direction: row-reverse; gap: 0px;">
            ${(() => {
              const sentences = randomWaiting.poem.replace(/\n/g, '').split(/[，。]/).filter(s => s.trim());
              if (sentences.length < 4) {
                return `<div style="writing-mode: vertical-rl; text-orientation: upright; font-size: 13px; color: var(--ink-soft); line-height: 2.2; letter-spacing: 2px;">${randomWaiting.poem.replace(/\n/g, '')}</div>`;
              }
              const col1 = sentences[0] + "，" + sentences[1] + "。";
              const col2 = sentences[2] + "，" + sentences[3] + "。";
              return `
                <div style="writing-mode: vertical-rl; text-orientation: upright; font-size: 13px; color: var(--ink-soft); line-height: 1.8; letter-spacing: 2px;">${col1}</div>
                <div style="writing-mode: vertical-rl; text-orientation: upright; font-size: 13px; color: var(--ink-soft); line-height: 1.8; letter-spacing: 2px;">${col2}</div>
              `;
            })()}
          </div>
        </div>

        <!-- 传图触发器（铺满，但只有 z-index 4，不能挡住下面的按钮） -->
        <input type="file" id="daily-bg-upload" accept="image/*" style="display: none;">
        <div id="daily-upload-trigger" style="position: absolute; inset: 0; z-index: 4; cursor: pointer;" title="点击更换画卷背景"></div>

        <!-- 每日一抽按钮（最顶层 z-index 5） -->
        <button class="btn" id="btn-do-draw" style="
          position: absolute; bottom: 20px; right: 20px; z-index: 5;
          padding: 8px 24px; border-radius: 20px;
          background: rgba(250, 246, 238, 0.9);
          color: var(--cinnabar); border: 1px solid var(--cinnabar);
          font-family: var(--font-title); letter-spacing: 2px; font-size: 13px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(6px);
          cursor: pointer;
        ">每日一抽</button>
      </div>
    </div>

    <!-- 闲谈/友人 切换栏 -->
    <div class="chenshi-tabs" style="position: relative; z-index: 2; margin-top: 10px;">
      <div class="chenshi-tab ${currentTab === "chat" ? "on" : ""}" data-tab="chat">闲 谈</div>
      <div class="chenshi-tab ${currentTab === "friend" ? "on" : ""}" data-tab="friend">友 人</div>
    </div>
    
    <!-- 聊天列表容器 -->
    <div id="chenshi-content" style="position: relative; z-index: 2;"></div>
    <!-- 👈 根据当前主题动态读取船只 -->
    <div style="position: absolute; top: 16px; right: max(16px, calc(50% - 360px + 16px)); z-index: 9999;">     
 <button id="btn-add" style="
        background: transparent; border: none; padding: 0;
        width: 48px; height: 48px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <img src="${getTheme(document.documentElement.getAttribute("data-theme") || "qinglv").deco.boat}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));">
      </button>
    </div>
  `;

  const contentEl = el.querySelector("#chenshi-content");
  const drawBtn = el.querySelector("#btn-do-draw");
  const levelEl = el.querySelector("#draw-level");
  const poemEl = el.querySelector("#draw-poem");
  const bgEl = el.querySelector("#daily-bg");
  const uploadTrigger = el.querySelector("#daily-upload-trigger");
  const fileInput = el.querySelector("#daily-bg-upload");

  // ==========================================
  // 👈 点击背景，从绘卷选择图片 (带裁剪 + 多图轮播) - 修复版
  // ==========================================
  uploadTrigger.onclick = () => {
    // 1. 调起公共图库，选“插画”
    openImagePicker("illustration", async (imgId) => {
      const img = await db.get("images", imgId);
      if (!img) return;

      let imageSrc = null;
      // 👈 完美兼容：支持用户上传的 Base64 字符串，也支持种子图的本地路径
      if (typeof img.origin?.data === "string" && img.origin.data.startsWith("data:image/")) {
        imageSrc = img.origin.data;
      } else if (img.base64 && img.base64.startsWith("data:image/")) {
        imageSrc = img.base64;
      } else if (img.base64 && img.base64.startsWith("assets/")) {
        // 如果选的是种子图，直接拿来用（其实种子图没必要裁剪，但为了统一逻辑）
        imageSrc = img.base64;
      }

      if (imageSrc) {
        // 2. 调起裁剪框
        showCropModal(imageSrc, async (croppedBase64) => {
          // 3. 因为 showCropModal 内部已经调用过 compressImage 压缩过了，我们就不重复压缩了
          // 直接把裁剪好的 Base64 存起来即可，防止内存溢出
          
          // 4. 存入轮播数组（最多保留 3 张图）
          let coverList = JSON.parse(localStorage.getItem("chenshi_daily_covers") || "[]");
          if (!coverList.includes(croppedBase64)) {
            coverList.unshift(croppedBase64); // 把最新的放在最前面
            if (coverList.length > 3) coverList.pop(); // 超过 3 张就删掉最旧的
            
            // 存进 localStorage 防止刷新丢失
            try {
              localStorage.setItem("chenshi_daily_covers", JSON.stringify(coverList));
            } catch (e) {
              showToast("本地存储空间不足，图片可能太大");
            }
          }

          // 5. 立即显示这张新图
          bgEl.style.backgroundImage = `url('${croppedBase64}')`;
          showToast("画卷已更新");
        });
      } else {
        showToast("这张图片格式不支持");
      }
    });
  };

  // 👈 绑定新建聊天的点击事件
  const addBtn = el.querySelector("#btn-add");
  if (addBtn) {
    addBtn.onclick = () => {
      openTopAddMenu(ownerId, el); 
    };
  }

  // ==========================================
  // 👈 抽签逻辑
  // ==========================================
  const today = new Date().toISOString().slice(0, 10);
  const drawKey = `daily_draw_${ownerId}_${today}`;

  // 把长诗句处理成竖排两列的通用函数
  function formatPoemHtml(poemStr) {
    const sentences = poemStr.replace(/\n/g, '').split(/[，。]/).filter(s => s.trim());
    let columnsHtml = "";
    // 每两句拼成一列
    for (let i = 0; i < sentences.length; i += 2) {
      // 判断是加逗号还是句号
      const punct = (i + 1 >= sentences.length - 1) ? "。" : "，";
      const text = sentences[i] + (sentences[i + 1] ? "，" + sentences[i + 1] : "") + punct;
      
      columnsHtml += `
        <div style="writing-mode: vertical-rl; text-orientation: upright; font-size: 13px; color: var(--ink-soft); line-height: 1.8; letter-spacing: 1px;">
          ${text}
        </div>
      `;
    }
    return columnsHtml;
  }

  const savedData = localStorage.getItem(drawKey);
  if (savedData) {
    const parsed = JSON.parse(savedData);
    
    // 👈 显示抽过的结果
    levelEl.textContent = parsed.level;
    levelEl.style.fontSize = parsed.level.length > 2 ? "16px" : "20px";
    poemEl.innerHTML = formatPoemHtml(parsed.poem);

    // 👈 把按钮变成已抽签状态（不隐藏）
    drawBtn.textContent = "已 抽 签";
    drawBtn.style.background = "rgba(250, 246, 238, 0.5)";
    drawBtn.style.color = "var(--ink-dim)";
    drawBtn.style.borderColor = "var(--line)";
    drawBtn.style.pointerEvents = "none";
    drawBtn.style.display = "block"; // 确保它是显示的
  } else {
    // 👈 如果今天没抽过，才绑定点击事件
    drawBtn.onclick = async () => {
      levelEl.textContent = "卜算中...";
      poemEl.innerHTML = `<div style="writing-mode: vertical-rl; font-size: 13px; color: var(--ink-soft);">静待天机...</div>`;
      
      // 抽签期间把按钮置灰，防止连点
      drawBtn.textContent = "卜算中...";
      drawBtn.style.pointerEvents = "none";
      drawBtn.style.opacity = "0.6";

      try {
        const result = await drawSign(ownerId);
        const record = result.record;

        setTimeout(async () => {
          // 1. 显示结果
          levelEl.textContent = record.level;
          levelEl.style.fontSize = record.level.length > 2 ? "16px" : "20px";
          poemEl.innerHTML = formatPoemHtml(record.poem);
          
          // 2. 保存状态
          localStorage.setItem(drawKey, JSON.stringify({ level: record.level, poem: record.poem }));

          // 3. 按钮彻底变成已抽签
          drawBtn.textContent = "已 抽 签";
          drawBtn.style.background = "rgba(250, 246, 238, 0.5)";
          drawBtn.style.color = "var(--ink-dim)";
          drawBtn.style.borderColor = "var(--line)";
          drawBtn.style.opacity = "1";

          // 4. 盲盒掉落逻辑
          const allGiftIds = Object.keys(GIFTS);
          const rewards = [];
          for (let i = 0; i < 3; i++) {
            rewards.push(allGiftIds[Math.floor(Math.random() * allGiftIds.length)]);
          }

          const currentInventory = await db.all("inventory");
          for (const giftId of rewards) {
            const existing = currentInventory.find(inv => inv.ownerId === ownerId && inv.giftId === giftId);
            if (existing) {
              existing.count += 1;
              await db.put("inventory", existing);
            } else {
              await db.put("inventory", { id: "inv_" + Date.now() + Math.random(), ownerId, giftId, count: 1 });
            }
          }

          const rewardNames = rewards.map(id => GIFTS[id].name).join("、");
          const { showModal, closeModal } = await import("../ui/modal.js");
          const modal = showModal(`
            <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
              天 机 已 现
            </div>
            <div style="text-align:center; font-size:14px; color:var(--ink); line-height: 2;">
              签文已解。<br>
              你获得了今日福缘：<br>
              <span style="font-family:var(--font-title); color:var(--cinnabar); font-size:16px;">${rewardNames}</span>
            </div>
            <button class="btn" id="btn-close-daily" style="width:100%; margin-top:20px; padding:12px; letter-spacing:4px;">收 下</button>
          `);
          modal.querySelector("#btn-close-daily").onclick = () => closeModal(modal);

        }, 800);
      } catch (err) {
        console.error("抽签失败:", err);
        levelEl.textContent = randomWaiting.level;
        levelEl.style.fontSize = "20px";
        poemEl.innerHTML = formatPoemHtml(randomWaiting.poem);
        drawBtn.textContent = "每 日 一 抽";
        drawBtn.style.pointerEvents = "auto";
        drawBtn.style.opacity = "1";
        showToast("天机紊乱，请稍后再试");
      }
    };
  }

  el.querySelectorAll(".chenshi-tab").forEach(tab => {
    tab.onclick = () => {
      currentTab = tab.dataset.tab;
      el.querySelectorAll(".chenshi-tab").forEach(t =>
        t.classList.toggle("on", t.dataset.tab === currentTab)
      );
      render();
    };
  });

  async function render() {
    if (currentTab === "chat") await renderChat(contentEl, ownerId);
    else await renderFriend(contentEl, ownerId);
  }

  // ==========================================
  // 👈 轮播引擎 (加入容错处理)
  // ==========================================
  let coverList = [];
  try {
    coverList = JSON.parse(localStorage.getItem("chenshi_daily_covers") || "[]");
  } catch (e) {
    console.error("读取轮播图失败", e);
  }

  if (Array.isArray(coverList) && coverList.length > 0) {
    let currentImgIndex = 0;
    // 初始显示第一张
    bgEl.style.backgroundImage = `url('${coverList[0]}')`;

    // 如果有多张图，开启定时器
    if (coverList.length > 1) {
      setInterval(() => {
        currentImgIndex = (currentImgIndex + 1) % coverList.length;
        // 加上淡入淡出过渡效果
        bgEl.style.transition = "background-image 0.8s ease-in-out";
        bgEl.style.backgroundImage = `url('${coverList[currentImgIndex]}')`;
      }, 5000);
    }
  }

  await render();
  return el;
}

/* ============================================================
 * 闲谈 —— 对话列表
 * ============================================================ */
async function renderChat(container, ownerId) {
  const chats = await getChatsByOwner(ownerId);

  if (!chats.length) {
    container.innerHTML = `
      <div class="empty-state">
        还没有对话。<br>
        去 <a href="#/yaji" style="color: var(--cinnabar);">雅集</a> 结识一位吧。
      </div>
    `;
    return;
  }

  const chatItems = await Promise.all(chats.map(async c => {
    let avatarUrl = null;
    let displayName = "未知";

    if (c.type === "group") {
      displayName = c.name || "群聊";
    } else if (c.npcId) {
      const partner = await db.get("npc_relations", c.npcId);
      if (partner) {
        displayName = partner.name;
        if (partner.avatarId) {
          avatarUrl = await getImageUrl(partner.avatarId, true);
        }
      }
    } else if (c.characterId) {
      const partner = await db.get("characters", c.characterId);
      if (partner) {
        displayName = partner.name;
        if (partner.avatarId) {
          avatarUrl = await getImageUrl(partner.avatarId, true);
        }
      }
    }

    return { chat: c, avatarUrl, displayName };
  }));

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${chatItems.map(({ chat, avatarUrl, displayName }) => `
        <div class="chenshi-card" data-cid="${chat.id}">
          <div class="chenshi-avatar">
            ${avatarUrl
              ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
              : escapeHtml(displayName.charAt(0))}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-title);font-size:15px;letter-spacing:2px;margin-bottom:4px;">${escapeHtml(displayName)}</div>
            <div style="font-size:12px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(chat.lastMessageText || "（尚无消息）")}</div>
          </div>
          <div style="font-size:11px;color:var(--ink-dim);flex-shrink:0;">${formatChatTime(chat.lastMessageAt)}</div>
        </div>
      `).join("")}
    </div>
  `;

  container.querySelectorAll(".chenshi-card").forEach(card => {
    card.onclick = () => {
      const cid = card.dataset.cid;
      const item = chatItems.find(i => i.chat.id === cid);
      if (!item) return;
      const c = item.chat;
      if (c.type === "group") {
        location.hash = `#/chat/group/${c.id}`;
      } else if (c.npcId) {
        location.hash = `#/chat/npc/${c.npcId}`;
      } else if (c.characterId) {
        location.hash = `#/chat/${c.characterId}`;
      }
    };
  });
}

/* ============================================================
 * 友人
 * ============================================================ */
async function renderFriend(container, ownerId) {
  const allChars = (await db.all("characters"))
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const charItems = await Promise.all(allChars.map(async c => ({
    type: "character",
    id: c.id,
    name: c.name,
    relation: c.du || c.rank || "",
    description: c.bio || "",
    avatarUrl: c.avatarId ? await getImageUrl(c.avatarId, true) : null,
  })));

  const friends = await getFriendNpcs(ownerId);
  const npcItems = await Promise.all(friends.map(async n => ({
    type: "npc",
    id: n.id,
    name: n.name,
    relation: n.relation || "",
    description: n.description || "",
    avatarUrl: n.avatarId ? await getImageUrl(n.avatarId, true) : null,
  })));

  const all = [...charItems, ...npcItems];

  container.innerHTML = `
    <div id="friend-list"></div>
  `;

  const listEl = container.querySelector("#friend-list");

  if (!all.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        还没有好友。<br>
        点右上角「笺」→ 结识新友。
      </div>
    `;
  } else {

    // 容器改成三列网格（如果手机屏幕宽，可以用 auto-fill 自动适应更多列）
    listEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px;">
        ${all.map(item => `
          <div class="friend-card" data-type="${item.type}" data-id="${item.id}" style="
            position: relative;
            display: flex; 
            flex-direction: column;
            background: var(--paper);
            border: 2px solid #fff; /* 边框细一点 */
            border-radius: 6px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.08);
            cursor: pointer;
            overflow: hidden;
            transition: transform 0.2s;
          ">
            
            <!-- 上半部分：图片 -->
            <div style="width: 100%; aspect-ratio: 3/4; background: var(--paper-soft); position: relative;">
              ${item.avatarUrl 
                ? `<img src="${item.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` 
                : `<div style="width:100%;height:100%;background:linear-gradient(135deg, #e8f0ec 0%, #b4cac1 100%);display:flex;align-items:center;justify-content:center;font-family:var(--font-title);font-size:24px;color:var(--ink); opacity:0.6;">${escapeHtml(item.name.charAt(0))}</div>`}
              
              <!-- 下方半透明的名字遮罩 -->
              <div style="
                position: absolute; bottom: 0; left: 0; right: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
                padding: 16px 4px 4px;
                text-align: center;
              ">
                <div style="font-family:var(--font-title); font-size:13px; color:#fff; letter-spacing: 1px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
                  ${escapeHtml(item.name)}
                </div>
                ${item.relation ? `<div style="font-size:10px; color:var(--paper-soft); opacity: 0.9; transform: scale(0.9);">${escapeHtml(item.relation)}</div>` : ""}
              </div>
            </div>

          </div>
        `).join("")}
      </div>
    `;

    // 点击事件逻辑保持不变
    listEl.querySelectorAll(".friend-card").forEach(card => {
      card.onclick = () => {
        const type = card.dataset.type;
        const id = card.dataset.id;
        const item = all.find(i => i.type === type && i.id === id);
        if (!item) return;
        if (type === "character") {
          openCharacterDetail(item, ownerId, container);
        } else {
          openNpcDetail(item, ownerId, container);
        }
      };
    });
  }
}

/* ============================================================
 * 详情弹窗
 * ============================================================ */
async function openCharacterDetail(item, ownerId, container) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:18px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      ${escapeHtml(item.name)}
    </div>
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div style="
        width:80px;height:80px;border-radius:50%;
        background:#b8b0a0;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-family:var(--font-title);font-size:32px;overflow:hidden;
      ">
        ${item.avatarUrl
          ? `<img src="${item.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
          : escapeHtml(item.name.charAt(0))}
      </div>
    </div>
    ${item.relation ? `
      <div style="text-align:center;font-size:13px;color:var(--cinnabar);letter-spacing:2px;margin-bottom:12px;">
        ${escapeHtml(item.relation)}
      </div>` : ""}
    ${item.description ? `
      <div class="form-field">
        <div style="font-size:13px;line-height:1.8;color:var(--ink-soft);padding:12px;background:var(--paper-soft);border-radius:8px;max-height:40vh;overflow-y:auto;">
          ${escapeHtml(item.description).replace(/\n/g, "<br>")}
        </div>
      </div>` : ""}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">
      <button class="btn" id="char-chat" style="padding:12px;letter-spacing:4px;">闲 谈</button>
      <button class="btn ghost" id="char-close" style="padding:12px;letter-spacing:4px;">收 起</button>
    </div>
  `);

  modal.querySelector("#char-chat").onclick = () => {
    closeModal(modal);
    location.hash = `#/chat/${item.id}`;
  };
  modal.querySelector("#char-close").onclick = () => closeModal(modal);
}

async function openNpcDetail(item, ownerId, container) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:18px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      ${escapeHtml(item.name)}
    </div>
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div style="
        width:80px;height:80px;border-radius:50%;
        background:#b8b0a0;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-family:var(--font-title);font-size:32px;overflow:hidden;
      ">
        ${item.avatarUrl
          ? `<img src="${item.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
          : escapeHtml(item.name.charAt(0))}
      </div>
    </div>
    ${item.relation ? `
      <div style="text-align:center;font-size:13px;color:var(--cinnabar);letter-spacing:2px;margin-bottom:12px;">
        ${escapeHtml(item.relation)}
      </div>` : ""}
    ${item.description ? `
      <div class="form-field">
        <div style="font-size:13px;line-height:1.8;color:var(--ink-soft);padding:12px;background:var(--paper-soft);border-radius:8px;">
          ${escapeHtml(item.description).replace(/\n/g, "<br>")}
        </div>
      </div>` : ""}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">
      <button class="btn" id="npc-chat" style="padding:12px;letter-spacing:4px;">闲 谈</button>
      <button class="btn ghost" id="npc-unfriend" style="padding:12px;letter-spacing:4px;color:var(--cinnabar);border-color:var(--cinnabar);">删 除 好 友</button>
      <button class="btn ghost" id="npc-close" style="padding:12px;letter-spacing:4px;">收 起</button>
    </div>
  `);

  modal.querySelector("#npc-chat").onclick = () => {
    closeModal(modal);
    location.hash = `#/chat/npc/${item.id}`;
  };

  modal.querySelector("#npc-unfriend").onclick = async () => {
    closeModal(modal);
    const ok = await showConfirm("删除好友", `确定删除「${item.name}」？`);
    if (!ok) return;
    await removeFriend(item.id);
    showToast("已删除好友");
    renderFriend(container, ownerId);
  };

  modal.querySelector("#npc-close").onclick = () => closeModal(modal);
}

/* ============================================================
 * 结识新友（添加 NPC 好友）
 * ============================================================ */
async function openAddFriendModal(ownerId, container) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const nonFriends = await getNonFriendNpcs(ownerId);

  if (!nonFriends.length) {
    showToast("没有可结识的人物。去雅集的角色编辑里添加吧。");
    return;
  }

  const items = await Promise.all(nonFriends.map(async n => ({
    ...n,
    avatarUrl: n.avatarId ? await getImageUrl(n.avatarId, true) : null,
    canAdd: await canAddFriend(n, ownerId),
  })));

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      结 识 新 友
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${items.map(n => `
        <div class="add-friend-row" data-npc-id="${n.id}" style="
          display:flex;align-items:center;gap:12px;padding:12px;
          background:var(--paper-soft);border:1px solid var(--line-light);
          border-radius:var(--radius-sm);
          cursor:${n.canAdd ? "pointer" : "not-allowed"};
          opacity:${n.canAdd ? 1 : 0.6};
        ">
          <div style="
            width:40px;height:40px;border-radius:50%;flex-shrink:0;
            background:#b8b0a0;color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-family:var(--font-title);font-size:16px;overflow:hidden;
          ">
            ${n.avatarUrl
              ? `<img src="${n.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
              : escapeHtml(n.name.charAt(0))}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-title);font-size:14px;color:var(--ink);margin-bottom:2px;">
              ${escapeHtml(n.name)}
              ${n.relation ? `<span style="font-size:11px;color:var(--cinnabar);margin-left:4px;">${escapeHtml(n.relation)}</span>` : ""}
            </div>
            <div style="font-size:11px;color:var(--ink-dim);">
              ${n.canAdd ? "可结识" : `需要与绑定角色友善值 ≥ ${n.requiredFriendship}`}
            </div>
          </div>
          ${n.canAdd ? `<span style="font-size:12px;color:var(--cinnabar);">结识</span>` : `<span style="font-size:11px;color:var(--ink-dim);">未达标</span>`}
        </div>
      `).join("")}
    </div>
    <button class="btn ghost" id="add-friend-close" style="width:100%;margin-top:16px;padding:12px;letter-spacing:4px;">收 起</button>
  `);

  modal.querySelectorAll(".add-friend-row").forEach(row => {
    const npc = items.find(i => i.id === row.dataset.npcId);
    if (!npc || !npc.canAdd) return;

    row.onclick = async () => {
      await addFriend(npc.id);
      showToast(`已结识「${npc.name}」`);
      closeModal(modal);
      // 切到友人 Tab
      const tabs = document.querySelectorAll(".chenshi-tab");
      tabs.forEach(t => t.classList.toggle("on", t.dataset.tab === "friend"));
      // 触发渲染
      const evt = new Event("click", { bubbles: true });
      tabs.forEach(t => { if (t.dataset.tab === "friend") t.dispatchEvent(evt); });
    };
  });

  modal.querySelector("#add-friend-close").onclick = () => closeModal(modal);
}

/* ============================================================
 * 邀众共叙（建群）
 * ============================================================ */
async function openNewGroupModal(ownerId, container) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const chars = (await db.all("characters"))
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const npcs = await getFriendNpcs(ownerId);

  const allMembers = [
    ...chars.map(c => ({ type: "character", id: c.id, name: c.name })),
    ...npcs.map(n => ({ type: "npc", id: n.id, name: n.name })),
  ];

  let selected = new Set();

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      邀 众 共 叙
    </div>

    <div class="form-field">
      <label>群聊名称</label>
      <input type="text" class="input" id="ng-name" placeholder="如：竹林小分队" maxlength="20">
    </div>

    <div class="form-field">
      <label>选择成员（至少 1 位）</label>
      <div id="ng-members" style="display:flex;flex-direction:column;gap:6px;max-height:40vh;overflow-y:auto;">
        ${allMembers.map((m, i) => `
<label class="member-row" data-idx="${i}" style="
  display:flex;align-items:center;gap:10px;padding:10px 12px;
  background:var(--paper-soft);border:1px solid var(--line-light);
  border-radius:var(--radius-sm);cursor:pointer;
">
  <input type="checkbox" class="ng-member-cb" data-type="${m.type}" data-id="${m.id}" style="flex-shrink:0;">
  <span style="flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.name)}</span>
</label>
        `).join("")}
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:20px;">
      <button class="btn ghost" id="ng-cancel" style="flex:1;padding:12px;">取 消</button>
      <button class="btn" id="ng-ok" style="flex:1;padding:12px;">创 建</button>
    </div>
  `);

  modal.querySelector("#ng-cancel").onclick = () => closeModal(modal);

  modal.querySelector("#ng-ok").onclick = async () => {
    const name = modal.querySelector("#ng-name").value.trim() || "群聊";
    const members = [...modal.querySelectorAll(".ng-member-cb:checked")].map(cb => ({
      type: cb.dataset.type,
      id: cb.dataset.id,
    }));

    if (!members.length) {
      showToast("至少选一位成员");
      return;
    }

    await createGroupChat(ownerId, { name, members });
    closeModal(modal);
    showToast("已建群");
    location.reload();
  };
}

/* ============================================================
 * 工具
 * ============================================================ */
function formatChatTime(ts) {
  if (!ts) return "";
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  const d = new Date(ts);

  if (diff < day && d.getDate() === new Date().getDate()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (diff < 2 * day) return "昨天";
  if (diff < 7 * day) return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

/* ============================================================
 * 顶部「＋」菜单（结识新友 / 邀众共叙）
 * ============================================================ */
async function openTopAddMenu(ownerId, rootEl) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="menu-item" data-act="add-friend">结 识 新 友</button>
      <button class="menu-item" data-act="new-group">邀 众 共 叙</button>
    </div>
    <style>
      .menu-item {
        padding: 14px;
        background: var(--paper-soft);
        border: 1px solid var(--line-light);
        border-radius: var(--radius-sm);
        font-family: var(--font-title);
        font-size: 14px;
        letter-spacing: 2px;
        color: var(--ink);
        cursor: pointer;
        text-align: center;
      }
      .menu-item:hover {
        border-color: var(--cinnabar);
        color: var(--cinnabar);
      }
    </style>
  `);

  modal.querySelector("[data-act='add-friend']").onclick = async () => {
    closeModal(modal);
    // 这里调用你原本写好的加好友函数（在文件底部应该有）
    if (typeof openAddFriendModal === "function") {
       await openAddFriendModal(ownerId, rootEl.querySelector("#chenshi-content"));
    }
  };

  modal.querySelector("[data-act='new-group']").onclick = async () => {
    closeModal(modal);
    // 这里调用你原本写好的建群函数
    if (typeof openNewGroupModal === "function") {
       await openNewGroupModal(ownerId, rootEl.querySelector("#chenshi-content"));
    }
  };
}