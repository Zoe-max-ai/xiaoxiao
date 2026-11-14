import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import {
  getOrCreateChat, getOrCreateNpcChat, getChat,
  getMessages, getMessageCount, addMessage,
  drawCard, drawNpcCard, drawCardByMember,
  clearChat, deleteChat, recallMessage, deleteMessage,
} from "../services/chat-service.js";
import { getImageUrl } from "../services/seed-service.js";
import { getEffectiveChatSettings } from "../services/chat-settings-service.js";
import { pickToCard } from "../services/card-service.js";
import { getGroups } from "../services/card-service.js";
import { getAIConfig, requestAI } from "../services/ai-service.js";
import { getCharacterStatus } from "../core/date-utils.js";


const PAGE_SIZE = 50;
const RECALL_WINDOW_MS = 2 * 60 * 1000;   // 2 分钟

export async function chatView({ params }) {
  const el = document.createElement("div");
  el.className = "chat-page";

  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const p0 = params?.[0];
  const p1 = params?.[1];

  let mode;
  let targetId;

  if (p0 === "npc") { mode = "npc"; targetId = p1; }
  else if (p0 === "group") { mode = "group"; targetId = p1; }
  else { mode = "character"; targetId = p0; }

  if (!targetId) {
    el.innerHTML = `<div class="empty-state">未指定对象。</div>`;
    return el;
  }

  /* ===== 加载对象 ===== */
  let chat;
  let displayName = "未知";
  let avatarUrl = null;
  let character = null;
  let npc = null;
  let settings;

  if (mode === "group") {
    chat = await getChat(targetId);
    if (!chat || chat.type !== "group" || chat.ownerId !== ownerId) {
      el.innerHTML = `<div class="empty-state">群聊不存在。</div>`;
      return el;
    }
    displayName = chat.name;
    const firstMember = chat.members?.[0];
    if (firstMember) {
      settings = await getEffectiveChatSettings(
        firstMember.type === "npc" ? "__npc__" : firstMember.id
      );
    } else {
      settings = await getEffectiveChatSettings("__none__");
    }
  } else if (mode === "npc") {
    npc = await db.get("npc_relations", targetId);
    if (!npc || npc.ownerId !== ownerId) {
      el.innerHTML = `<div class="empty-state">此人已不知所踪。</div>`;
      return el;
    }
    displayName = npc.name;
    if (npc.avatarId) avatarUrl = await getImageUrl(npc.avatarId, true);
    chat = await getOrCreateNpcChat(ownerId, targetId);
    const linkedCharId = npc.linkedCharacterIds?.[0];
    settings = linkedCharId
      ? await getEffectiveChatSettings(linkedCharId)
      : await getEffectiveChatSettings("__none__");
  } else {
    character = await db.get("characters", targetId);
    if (!character || character.ownerId !== ownerId) {
      el.innerHTML = `<div class="empty-state">此人已隐入尘烟。</div>`;
      return el;
    }
    displayName = character.name;
    if (character.avatarId) avatarUrl = await getImageUrl(character.avatarId, true);
    chat = await getOrCreateChat(ownerId, targetId);
    settings = await getEffectiveChatSettings(targetId);
  }

  let userAvatarUrl = null;
  if (state.currentUser?.avatarId) {
    userAvatarUrl = await getImageUrl(state.currentUser.avatarId, true);
  }

  let currentMode = localStorage.getItem("chat_mode") || "card";

  // 群聊成员信息
  const memberInfo = {};
  if (mode === "group") {
    for (const m of (chat.members || [])) {
      let obj;
      if (m.type === "npc") obj = await db.get("npc_relations", m.id);
      else obj = await db.get("characters", m.id);
      if (!obj) continue;
      let mAvatar = null;
      if (obj.avatarId) mAvatar = await getImageUrl(obj.avatarId, true);
      memberInfo[m.id] = { name: obj.name, avatarUrl: mAvatar, type: m.type };
    }
  }

  // 假设你前面已经通过 db 查到了当前角色的完整数据，叫 character 或者 char 之类的变量
  // 如果前面的变量叫 targetCharacter 或者 partner，请替换成实际变量名
  const charStatus = getCharacterStatus(character); 

  /* ===== HTML ===== */
  el.innerHTML = `
    <div class="chat-topbar" style="display: flex; align-items: center; justify-content: space-between;">
      
      <!-- 左侧：返回、名字、模式 -->
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button class="chat-back" id="btn-back" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--ink); padding: 0 4px;">←</button>
        <span class="chat-title" style="font-family: var(--font-title); font-size: 16px; color: var(--ink); letter-spacing: 2px;">${escapeHtml(displayName)}</span>
        <button class="chat-mode" id="btn-mode" data-mode="${currentMode}" style="
          background: none; border: 1px dashed var(--cinnabar); color: var(--cinnabar);
          font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer;
          font-family: var(--font-title); letter-spacing: 1px;
        ">${currentMode === "ai" ? "心言" : "笺语"}</button>
      </div>

      <!-- 中间：实时状态 -->
      <div id="chat-live-status" style="
        flex: 1; text-align: center; font-size: 13px; color: var(--ink-soft);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        padding: 0 10px; letter-spacing: 2px; opacity: 0.9;
      ">
        ${escapeHtml(charStatus.status)}
      </div>

      <!-- 右侧：印章设置 -->
      <div style="display: flex; gap: 4px; flex-shrink: 0;">
        <button class="chat-settings" id="btn-settings" style="background: none; border: none; cursor: pointer; padding: 0;">
          <img src="assets/seed/seal/seal-ji.png" alt="记" style="height: 24px;">
        </button>
      </div>

    </div>
 

    <div class="chat-timeline" id="timeline"></div>

    <div id="quote-preview" class="chat-quote-preview" style="display:none;"></div>

    <div class="chat-quickbar ${mode === "group" ? "chat-quickbar-group" : ""}">
      <button data-act="action">拂袖</button>
      ${mode === "group" ? "" : `<button data-act="image">赠画</button>`}
      ${mode === "group" ? "" : `<button data-act="placehold">闲事</button>`}
      ${mode === "group" ? "" : `<button data-act="gift">赠礼</button>`}
      ${mode === "group" ? "" : `<button data-act="more">长卷</button>`}
    </div>

    <div class="chat-composer">
      <input type="text" id="chat-input" placeholder="展笺研墨……" autocomplete="off">
      <button id="btn-send">递</button>
    </div>
  `;

  const timelineEl = el.querySelector("#timeline");
  const inputEl = el.querySelector("#chat-input");
  const sendBtn = el.querySelector("#btn-send");
  const quotePreviewEl = el.querySelector("#quote-preview");

  // 👈 定义正在输入的变量和渲染函数
  let typingIndicatorEl = null;

  function showTypingIndicator() {
    if (settings.readReceipt === false) return; 
    if (typingIndicatorEl) return;

    typingIndicatorEl = document.createElement("div");
    typingIndicatorEl.className = "chat-row he";
    typingIndicatorEl.innerHTML = `
      <div class="chat-avatar-wrap">
        <div class="chat-avatar">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="">` : `<span>${escapeHtml(displayName[0])}</span>`}
        </div>
      </div>
      <div class="chat-bubble-wrap">
        <div class="chat-bubble" style="color: var(--ink-dim); font-size: 13px; display: flex; align-items: center; gap: 4px; padding: 10px 16px;">
          对方正在输入
          <span class="typing-dots" style="display: flex; gap: 2px;">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      </div>
    `;
    timelineEl.appendChild(typingIndicatorEl);
    timelineEl.scrollTop = timelineEl.scrollHeight;
  }

  function hideTypingIndicator() {
    if (typingIndicatorEl) {
      typingIndicatorEl.remove();
      typingIndicatorEl = null;
    }
  }

  let currentQuote = null;   // { msgId, fromName, content }
  let loadedBefore = null;   // 加载更多时的「before」时间戳
  let hasMore = true;
  let totalCount = 0;

  const modeBtn = el.querySelector("#btn-mode");
  modeBtn.onclick = () => {
    currentMode = currentMode === "card" ? "ai" : "card";
    modeBtn.textContent = currentMode === "card" ? "笺语" : "心言";
    modeBtn.dataset.mode = currentMode;
    localStorage.setItem("chat_mode", currentMode); // 👈 记住用户的选择！
    showToast(currentMode === "card" ? "已切换：笺语模式" : "已切换：心言模式");
  };

  // 👈 加了一个参数 targetTime
  async function renderMessages(scrollToBottom = false, targetTime = null) {
    let messages;

    if (targetTime) {
      // 如果传入了定位时间，就加载该时间附近的 50 条消息
      const all = await db.all("messages");
      const chatMsgs = all
        .filter(m => m.chatId === chat.id)
        .sort((a, b) => a.createdAt - b.createdAt); // 按时间正序

      // 找到目标消息在数组里的位置
      let targetIndex = chatMsgs.findIndex(m => m.createdAt >= targetTime);
      if (targetIndex === -1) targetIndex = chatMsgs.length - 1;

      // 前后各取 25 条，确保目标消息一定在范围内
      const start = Math.max(0, targetIndex - 25);
      const end = Math.min(chatMsgs.length, targetIndex + 25);
      messages = chatMsgs.slice(start, end);
      loadedBefore = messages.length ? messages[0].createdAt : null;
    } else {
      // 正常分页加载
      messages = await getMessages(chat.id, {
        before: loadedBefore,
        limit: PAGE_SIZE,
      });
    }

    totalCount = await getMessageCount(chat.id);
    hasMore = messages.length === PAGE_SIZE;

    if (!messages.length) {
      timelineEl.innerHTML = `<div class="chat-empty">从这里开始，说说话吧。</div>`;
      return;
    }

    timelineEl.innerHTML = `
      ${hasMore ? `<div class="chat-load-more" id="load-more">↑ 查看更多消息</div>` : `<div class="chat-load-more-disabled">已到最前</div>`}
      ${messages.map(m => renderMessageHtml(m)).join("")}
    `;

    bindLongPress();

    const loadMoreEl = timelineEl.querySelector("#load-more");
    if (loadMoreEl) {
      loadMoreEl.onclick = async () => {
        if (!messages.length) return;
        const oldScrollHeight = timelineEl.scrollHeight;
        const oldScrollTop = timelineEl.scrollTop;

        loadedBefore = messages[0].createdAt;
        await renderMessages();
        const newScrollHeight = timelineEl.scrollHeight;
        timelineEl.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
      };
    }

    timelineEl.querySelectorAll(".chat-thumb").forEach(img => {
      img.onclick = () => openImageViewer(img.dataset.full);
    });

    // 👈 新增：纯 JS 逐字打字机逻辑（只针对刚发出来的新消息）
    if (settings.typewriter !== false) {
      const twBubbles = timelineEl.querySelectorAll("[data-text]");
      
      twBubbles.forEach(bubble => {
        const fullText = bubble.getAttribute("data-text");
        if (!fullText) return;
        
        bubble.removeAttribute("data-text"); // 删掉标记，防止重复触发
        bubble.textContent = ""; 
        
        let i = 0;
        const timer = setInterval(() => {
          if (i < fullText.length) {
            if (fullText.charAt(i) === '\n') {
              bubble.innerHTML += "<br>";
            } else {
              bubble.innerHTML += fullText.charAt(i);
            }
            i++;
            // 如果是在最底部，打字时让滚动条跟着走
            if (scrollToBottom) timelineEl.scrollTop = timelineEl.scrollHeight;
          } else {
            clearInterval(timer);
          }
        }, 50);
      });
    }

    // 👈 如果是要定位到某条消息，等 DOM 渲染完，滚过去并高亮
    if (targetTime) {
      setTimeout(() => {
        const rows = timelineEl.querySelectorAll(".chat-row[data-mid]");
        for (const row of rows) {
          const mid = row.dataset.mid;
          const msg = messages.find(m => m.id === mid);
          if (msg && msg.createdAt >= targetTime) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.style.transition = "background 0.5s";
            row.style.background = "rgba(255, 215, 0, 0.3)";
            setTimeout(() => row.style.background = "", 2000);
            break;
          }
        }
      }, 100);
    }

    if (scrollToBottom && !targetTime) {
      setTimeout(() => {
        timelineEl.scrollTop = timelineEl.scrollHeight;
      }, 50);
    }
  }


/**
 * 构建发给 AI 的 System Prompt (设定集)
 */
async function buildSystemPrompt(ownerId, targetId, mode, displayName, character, npc) {
  let prompt = `你正在扮演一个角色与用户进行沉浸式古风角色扮演。请你完全沉浸入戏，绝不能打破第四面墙，绝不能说出现代词汇。\n\n`;

  // 1. 核心角色人设
  if (mode === "character" && character) {
    prompt += `【角色设定】\n`;
    prompt += `名字：${character.name}\n`;
    if (character.nickname) prompt += `昵称：${character.nickname}\n`;
    if (character.title) prompt += `称号：${character.title}\n`;
    if (character.du) prompt += `渡号：${character.du}（渡言：${character.duMotto || ""}）\n`;
    if (character.bio) prompt += `生平简介：${character.bio}\n`;
    if (character.tags) prompt += `性格标签：${character.tags.join("、")}\n`;
    if (character.likes) prompt += `喜好：${character.likes.join("、")}\n`;
    if (character.dislikes) prompt += `厌恶：${character.dislikes.join("、")}\n`;
    if (character.memories?.length) {
      prompt += `TA对你的记忆：\n${character.memories.map(m => `- ${m.text}`).join("\n")}\n`;
    }
    // 👈 加上读取 facts 的逻辑
    if (character.facts?.length) {
      prompt += `TA记得的事实：\n${character.facts.map(f => `- ${f.text}`).join("\n")}\n`;
    }
  } else if (mode === "npc" && npc) {
    prompt += `【角色设定】\n名字：${npc.name}\n关系：${npc.relation || "未知"}\n简介：${npc.description || ""}\n`;
  }

  // 2. 注入世界书设定（这里就是咱们刚才建的那些词条！）
  const allWorldBooks = await db.all("world_book");
  const myWorldBooks = allWorldBooks.filter(w => w.ownerId === ownerId && w.enabled);
  
  if (myWorldBooks.length > 0) {
    prompt += `\n【世界观背景设定】\n`;
    myWorldBooks.forEach(wb => {
      prompt += `[${wb.title}] ${wb.content}\n`;
    });
  }

  // 3. 注入好感度状态
  if (mode === "character" && character) {
    const { getRelation } = await import("../services/relation-service.js");
    const relation = await getRelation(ownerId, targetId);
    prompt += `\n【当前关系状态】\n`;
    prompt += `用户对你的爱慕值：${relation.affection}/100\n`;
    prompt += `用户对你的友善值：${relation.friendship}/100\n`;
    if (relation.affection > 60) prompt += `(你们的关系已经很亲密了，你可以表现出更多的偏宠和在意。)\n`;
    else if (relation.affection < 20) prompt += `(你们的关系还有些疏远，请保持适当的距离感。)\n`;
  }

  // 4. 行为守则（防止AI变智障或出戏）
  prompt += `\n【行为守则】\n`;
  prompt += `1. 说话风格要符合宋代古风，用词要文雅，符合你的身份。\n`;
  prompt += `2. 你的回复应以对话为主。只有在情绪有起伏、或者需要强调某句话时，才使用括号描写动作。不要每句话都带动作，显得太刻意。\n`; 
  // 👈 根据聊天对象的不同，限制动作描写的范围
  if (mode === "character") {
    prompt += `3. 动作描写要符合人物身份，并且生动自然。可以描写你的标志性物件（如扇子、武器、轮椅等）。动作描写请用全角中文括号括起来，例如：（轻轻拂袖）、（低头饮茶）。绝对禁止使用星号 * ！\n`; 
  } else {
    prompt += `3. 作为一个普通的NPC或友人，你没有专属的武器或随身物件。动作描写请严格限制在【表情、神态、手势、行礼】上（例如：眉头微皱、垂眸轻笑、拱手行礼）。绝不要描写使用扇子、兵器等动作！\n`; 
  }

  prompt += `4. 每次回复保持在 50 字以内，不要长篇大论。\n`;
  prompt += `5. 绝对不要替用户做决定，不要描写用户的动作和心理。\n`;
  // 👈 下面开始是全新的称呼逻辑
  const userName = state.currentUser?.name || "我";
  const userNickname = state.currentUser?.nickname || userName;
  const userSurname = userName.charAt(0);

  prompt += `6. 用户的身份与称呼：\n`;
  prompt += `   - 用户的正式全名是：${userName}。\n`;
  prompt += `   - 用户的亲密昵称是：${userNickname}。\n`;
  
  if (mode === "character") {
    prompt += `   - 【称呼规则】：你们是熟人。你可以根据当前的好感度，称呼她为“${userNickname}”或“${userSurname}姑娘”。\n`;
  } else {
    prompt += `   - 【称呼规则】：你必须称呼她为“${userSurname}姑娘”。绝不允许称呼其他名字或昵称。\n`;
  }

  // 👈 加上判断，确保 character 存在
  if (character) {
    prompt += `7. 你是【${character.name}】，你的性格是：${character.tags?.join("、") || ""}。请保持克制，不要像个现代恋爱脑一样随便吃醋或情绪失控，你的情绪是内敛的。\n`;
    
    if (character.name === "盛崖余") {
      prompt += `(盛崖余情绪内敛，极少直白表露醋意，即使心中在意，也只会化为一句淡淡的关心或沉默，绝不轻易失态。)\n`;
    }
  }

  return prompt;
}

  function renderMessageHtml(m) {
    const isMe = m.fromType === "user";
    let msgAvatar = null;
    let msgName = "";

    if (isMe) {
      msgAvatar = userAvatarUrl;
      msgName = "我";
    } else if (mode === "group") {
      const info = memberInfo[m.fromId];
      msgAvatar = info?.avatarUrl;
      msgName = info?.name || "?";
    } else {
      msgAvatar = avatarUrl;
      msgName = displayName;
    }

    const avatarHtml = msgAvatar
      ? `<img src="${msgAvatar}" alt="">`
      : `<span>${escapeHtml(msgName.charAt(0))}</span>`;
    const timeHtml = settings.timestamps
      ? `<div class="chat-time">${formatTime(m.createdAt)}</div>`
      : "";

    const quoteHtml = m.quote
      ? `<div class="chat-quote">
           <div class="chat-quote-author">${escapeHtml(m.quote.fromName)}</div>
           <div class="chat-quote-text">${escapeHtml(m.quote.content)}</div>
         </div>`
      : "";

    if (m.revoked) {
      return `
        <div class="chat-row ${isMe ? "me" : "he"} revoked" data-mid="${m.id}">
          <div class="chat-avatar-wrap">
            <div class="chat-avatar">${avatarHtml}</div>
          </div>
          <div class="chat-bubble-wrap">
            <div class="chat-revoked">${isMe ? "你" : escapeHtml(msgName.charAt(0))}撤回了一句话</div>
          </div>
        </div>
      `;
    }

    // 👈 判断是否为图片消息
    const isImage = m.contentType === "image";
    let bubbleContentHtml = "";
    if (isImage) {
      if (m.imageData) {
        bubbleContentHtml = `
          <div class="chat-image-msg">
            <img src="${m.imageData}" alt="图片" class="chat-thumb" data-full="${m.imageData}">
          </div>
        `;renderMessages
      } else if (m.content === "[图片已清理]") {
        bubbleContentHtml = `<div class="chat-bubble" style="color:var(--ink-dim);">[图片已清理]</div>`;
      } else {
        bubbleContentHtml = `<div class="chat-bubble">${escapeHtml(m.content)}</div>`;
      }
    } else {
      // 👈 暴力清洗：不管是 AI 发疯还是历史旧数据，只要出现 *xxx* 强行转成全角括号
      // 如果 AI 不闭合星号（比如只写了 *轻叹），也能通过正则把残留的星号干掉
      let safeContent = m.content.replace(/\*([^*]+)\*/g, '（$1）');
      safeContent = safeContent.replace(/\*/g, ''); 
      
      // 👈 核心判断：只有对方发的，且消息是刚刚发出来的（比如 15 秒内），才触发打字机
      const isNewMessage = (Date.now() - m.createdAt) < 15000;
      const isTypewriter = settings.typewriter !== false && m.fromType !== "user" && isNewMessage;

      if (isTypewriter) {
        bubbleContentHtml = `<div class="chat-bubble" id="typewriter-${m.id}" data-text="${escapeHtml(safeContent)}"></div>`;
      } else {
        bubbleContentHtml = `<div class="chat-bubble">${escapeHtml(safeContent)}</div>`;
      }
      }

    return `
      <div class="chat-row ${isMe ? "me" : "he"}" data-mid="${m.id}">
        <div class="chat-avatar-wrap">
          <div class="chat-avatar">${avatarHtml}</div>
        </div>
        <div class="chat-bubble-wrap">
          ${quoteHtml}
          ${bubbleContentHtml}
          ${timeHtml}
        </div>
      </div>
    `;
  }

  /* ===== 长按消息 ===== */
  function bindLongPress() {
    timelineEl.querySelectorAll(".chat-row[data-mid]").forEach(row => {
      let pressTimer = null;
      const mid = row.dataset.mid;

      const openMenu = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const msg = await db.get("messages", mid);
        if (!msg || msg.revoked) return;
        openMessageMenu(msg, row);
      };

      row.addEventListener("touchstart", () => {
        pressTimer = setTimeout(openMenu, 600);
      }, { passive: true });
      row.addEventListener("touchend", () => clearTimeout(pressTimer));
      row.addEventListener("touchmove", () => clearTimeout(pressTimer));

      row.addEventListener("contextmenu", openMenu);

      row.addEventListener("mousedown", () => {
        pressTimer = setTimeout(openMenu, 600);
      });
      row.addEventListener("mouseup", () => clearTimeout(pressTimer));
      row.addEventListener("mouseleave", () => clearTimeout(pressTimer));
    });
  }

  async function openMessageMenu(msg, row) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const isMe = msg.fromType === "user";
    const canRecall = isMe && (Date.now() - msg.createdAt < RECALL_WINDOW_MS);
    const canDelete = isMe && !canRecall;
    const isImage = msg.contentType === "image";

    const modal = showModal(`
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${isImage ? "" : `<button class="msg-menu-item" data-act="copy">复 制</button>`}
        ${canRecall ? `<button class="msg-menu-item" data-act="recall">撤 回</button>` : ""}
        ${canDelete ? `<button class="msg-menu-item danger" data-act="delete">删 除</button>` : ""}
        ${isImage ? "" : `<button class="msg-menu-item" data-act="quote">引 用</button>`}
        <button class="msg-menu-item" data-act="pick">拾 起</button>
      </div>
      <style>
        .msg-menu-item {
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
        .msg-menu-item.danger { color: var(--cinnabar); }
      </style>
    `);

    const copyBtn = modal.querySelector("[data-act='copy']");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        closeModal(modal);
        try {
          await navigator.clipboard.writeText(msg.content);
          showToast("已复制");
        } catch (e) {
          showToast("复制失败");
        }
      };
    }

    const recallBtn = modal.querySelector("[data-act='recall']");
    if (recallBtn) {
      recallBtn.onclick = async () => {
        closeModal(modal);
        const ok = await showConfirm("撤回消息", "确定撤回这条消息？");
        if (!ok) return;
        await recallMessage(msg.id);
        showToast("已撤回");
        await renderMessages();
      };
    }

    const delBtn = modal.querySelector("[data-act='delete']");
    if (delBtn) {
      delBtn.onclick = async () => {
        closeModal(modal);
        const ok = await showConfirm("删除消息", "确定删除这条消息？");
        if (!ok) return;
        await deleteMessage(msg.id);
        showToast("已删除");
        await renderMessages();
      };
    }

    const quoteBtn = modal.querySelector("[data-act='quote']");
    if (quoteBtn) {
      quoteBtn.onclick = () => {
        closeModal(modal);
        const fromName = msg.fromType === "user" ? "我" : (msg.fromType === "npc" ? (memberInfo[msg.fromId]?.name || displayName) : displayName);
        currentQuote = {
          msgId: msg.id,
          fromName,
          content: msg.content.length > 40 ? msg.content.slice(0, 40) + "…" : msg.content,
        };
        renderQuotePreview();
        inputEl.focus();
      };
    }

    modal.querySelector("[data-act='pick']").onclick = async () => {
      closeModal(modal);
      await openPickToCardModal(msg);
    };
  }

  /* ===== 引用预览 ===== */
  function renderQuotePreview() {
    if (!currentQuote) {
      quotePreviewEl.style.display = "none";
      quotePreviewEl.innerHTML = "";
      return;
    }
    quotePreviewEl.style.display = "flex";
    quotePreviewEl.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;color:var(--cinnabar);margin-bottom:2px;">引用 ${escapeHtml(currentQuote.fromName)}</div>
        <div style="font-size:12px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(currentQuote.content)}</div>
      </div>
      <button id="quote-cancel" style="background:none;border:none;color:var(--ink-dim);font-size:18px;cursor:pointer;padding:4px 8px;">×</button>
    `;
    quotePreviewEl.querySelector("#quote-cancel").onclick = () => {
      currentQuote = null;
      renderQuotePreview();
    };
  }

  /* ===== 拾起 ===== */
  async function openPickToCardModal(msg) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const groups = await getGroups(ownerId);

    // 1. 排除系统自带的“全部”分组
    const validGroups = groups.filter(g => !g.isAll);

    // 2. 提取一级分类
    const firstLevelMap = new Map();
    firstLevelMap.set("通用", []);

    validGroups.forEach(g => {
      const match = g.name.match(/^\[(.+?)\]\s*(.*)$/);
      if (match) {
        const level1Name = match[1];
        if (!firstLevelMap.has(level1Name)) {
          firstLevelMap.set(level1Name, []);
        }
        firstLevelMap.get(level1Name).push({
          id: g.id,
          displayName: match[2]
        });
      } else {
        firstLevelMap.get("通用").push({
          id: g.id,
          displayName: g.name
        });
      }
    });

    const firstLevelOptions = [...firstLevelMap.keys()].map(name => 
      `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
    ).join("");

    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
        拾 起
      </div>

      <div class="form-field">
        <label>内容</label>
        <div style="font-size:13px;line-height:1.7;padding:10px 12px;background:var(--paper-soft);border-radius:var(--radius-sm);color:var(--ink);">
          ${escapeHtml(msg.contentType === "image" ? "[图片]" : msg.content)}
        </div>
      </div>

      <div class="form-field">
        <label>一级分组</label>
        <select class="input" id="pick-root">
          <option value="">（不选）</option>
          ${firstLevelOptions}
        </select>
      </div>

      <div class="form-field">
        <label>二级分组</label>
        <select class="input" id="pick-sub">
          <option value="">（请先选一级）</option>
        </select>
      </div>

      <div class="form-field">
        <label>或者，直接选任意分组</label>
        <select class="input" id="pick-any">
          <option value="">（不选）</option>
          ${validGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}
        </select>
      </div>

      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn ghost" id="pick-cancel" style="flex:1;padding:12px;">取 消</button>
        <button class="btn" id="pick-ok" style="flex:1;padding:12px;">存 入</button>
      </div>
    `);

    const rootSel = modal.querySelector("#pick-root");
    const subSel = modal.querySelector("#pick-sub");
    const anySel = modal.querySelector("#pick-any");

    rootSel.onchange = () => {
      const rootName = rootSel.value;
      if (!rootName) {
        subSel.innerHTML = `<option value="">（请先选一级）</option>`;
        return;
      }
      
      const children = firstLevelMap.get(rootName) || [];
      if (children.length) {
        subSel.innerHTML = `<option value="">（不选）</option>` +
          children.map(g => `<option value="${g.id}">${escapeHtml(g.displayName)}</option>`).join("");
      } else {
        subSel.innerHTML = `<option value="">（无二级）</option>`;
      }
    };

    modal.querySelector("#pick-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#pick-ok").onclick = async () => {
      let groupId = subSel.value || anySel.value;

      if (!groupId && rootSel.value) {
        const children = firstLevelMap.get(rootSel.value);
        if (children && children.length > 0) {
          groupId = children[0].id;
        } else {
          showToast("该分类下没有具体分组，请选择任意分组");
          return;
        }
      }

      if (!groupId) {
        showToast("请选择分组");
        return;
      }
      
      const contentToSave = msg.contentType === "image" ? "[图片]" : msg.content;
      await pickToCard(ownerId, { content: contentToSave, groupId });
      closeModal(modal);
      showToast("已存入字卡库");
    };
  }

  // 👈 新增：AI 自动总结记忆与事实
  async function checkAndSummarizeMemory() {
    // 只有角色单聊才总结
    if (mode !== "character") return;

    const total = await getMessageCount(chat.id);
    // 每 20 条消息总结一次（20, 40, 60...）
    if (total > 0 && total % 5 === 0) {
      const recentMsgs = await getMessages(chat.id, { limit: 20 });
      const chatText = recentMsgs.map(m => `${m.fromType === 'user' ? '我' : displayName}: ${m.content}`).join("\n");
      
      try {
        const prompt = `请阅读以下对话，并提取两类信息：
1. 【回忆】：关于你们两人的共同经历、情感互动、或对方的心意（带情感色彩）。
2. 【事实】：玩家透露的客观信息、身份秘密、或你在这段对话中确立的重要世界观设定。
要求：每类最多提取 2 条，每条用简短的一句话描述。如果没有，请留空。
请严格输出 JSON 格式，不要带有 markdown 代码块标记（\`\`\`json）。格式如下：
{
  "memories": ["回忆1", "回忆2"],
  "facts": ["事实1", "事实2"]
}`;

        const res = await requestAI([
          { role: "system", content: prompt }, 
          { role: "user", content: chatText }
        ]);
        
        if (res && character) {
          // 清洗并解析 AI 返回的 JSON
          let cleanRes = res.replace(/```json/g, "").replace(/```/g, "").trim();
          const data = JSON.parse(cleanRes);

          // 1. 存入回忆
          if (data.memories && data.memories.length > 0) {
            if (!character.memories) character.memories = [];
            data.memories.forEach(text => {
              character.memories.push({
                id: Date.now().toString() + Math.random(),
                text: text,
                source: "story",
                createdAt: Date.now()
              });
            });
            if (character.memories.length > 30) character.memories = character.memories.slice(-30);
          }

          // 2. 存入事实
          if (data.facts && data.facts.length > 0) {
            if (!character.facts) character.facts = [];
            data.facts.forEach(text => {
              character.facts.push({
                id: Date.now().toString() + Math.random(),
                text: text,
                source: "story",
                createdAt: Date.now()
              });
            });
            if (character.facts.length > 30) character.facts = character.facts.slice(-30);
          }
          
          await db.put("characters", character);
          console.log("[AI记忆] 总结并保存成功", data);
        }
      } catch (e) {
        console.warn("AI记忆总结失败，可能是格式未对齐:", e);
      }
    }
  }

  /* ===== 回复逻辑 ===== */
  async function scheduleReplies() {
    const intervalMin = Math.max(0.1, settings.intervalMin || 5);
    const intervalMax = Math.max(intervalMin, settings.intervalMax || 30);
    const replyMin = Math.max(1, settings.replyMin || 1);
    const replyMax = Math.max(replyMin, settings.replyMax || 3);
    const recall = settings.recall;
    const recallProb = settings.recallProbability || 0;
    const actionProb = settings.actionProbability !== undefined ? settings.actionProbability : 20;

    // 👈 1. 将“正在输入”的变量和函数，全部定义在这个函数内部
    let typingIndicatorEl = null;
    function showTypingIndicator() {
      if (settings.readReceipt === false) return; 
      if (typingIndicatorEl) return;

      typingIndicatorEl = document.createElement("div");
      typingIndicatorEl.className = "chat-row he";
      typingIndicatorEl.innerHTML = `
        <div class="chat-avatar-wrap">
          <div class="chat-avatar">
            ${avatarUrl ? `<img src="${avatarUrl}" alt="">` : `<span>${escapeHtml(displayName[0])}</span>`}
          </div>
        </div>
        <div class="chat-bubble-wrap">
          <div class="chat-bubble" style="color: var(--ink-dim); font-size: 13px; display: flex; align-items: center; gap: 4px; padding: 10px 16px;">
            对方正在输入
            <span class="typing-dots" style="display: flex; gap: 2px;">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        </div>
      `;
      timelineEl.appendChild(typingIndicatorEl);
      timelineEl.scrollTop = timelineEl.scrollHeight;
    }

    function hideTypingIndicator() {
      if (typingIndicatorEl) {
        typingIndicatorEl.remove();
        typingIndicatorEl = null;
      }
    }

    if (mode === "group") {
      const members = chat.members || [];
      if (!members.length) return;

      const total = members.length;
      const minCount = Math.max(1, Math.floor(total / 3));
      const maxCount = Math.max(minCount, Math.floor(total * 2 / 3));
      const replyCount = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

      const shuffled = [...members].sort(() => Math.random() - 0.5);
      const replyMembers = shuffled.slice(0, replyCount);

      const firstWait = (intervalMin + Math.random() * (intervalMax - intervalMin)) * 1000;
      let acc = firstWait;

      for (let i = 0; i < replyMembers.length; i++) {
        const m = replyMembers[i];
        const thisReplyCount = Math.floor(Math.random() * (replyMax - replyMin + 1)) + replyMin;

        for (let j = 0; j < thisReplyCount; j++) {
          if (!(i === 0 && j === 0)) {
            acc += (2 + Math.random() * 1) * 1000;
          }
          const wait = acc;

          setTimeout(async () => {
            // 👈 显示正在输入
            showTypingIndicator();

            let replyText;
            if (currentMode === "card") {
              // 👈 加个 1500 毫秒的延迟，让“正在输入”多停留一会儿
       await new Promise(r => setTimeout(r, 1500));
              // 完整的抽卡逻辑
              const card = m.type === "npc"
                ? await drawNpcCard(ownerId, m.id)
                : await drawCard(ownerId, m.id);
              replyText = card ? card.content : "……";
            } else {
              // AI 请求代码
              try {
                // 👈 在 AI 请求前，强行停顿 1 秒，保证至少能看到一秒的提示
                await new Promise(r => setTimeout(r, 1000));
                let tempChar = null;
                let tempNpc = null;
                if (m.type === "character") {
                  tempChar = await db.get("characters", m.id);
                } else if (m.type === "npc") {
                  tempNpc = await db.get("npc_relations", m.id);
                }

                const recentMsgs = await getMessages(chat.id, { limit: 10 });
                const historyList = recentMsgs.map(msg => ({
                  role: msg.fromType === "user" ? "user" : "assistant",
                  content: msg.content
                }));

                const currentDisplayName = memberInfo[m.id]?.name || "群友";
                const sysPrompt = await buildSystemPrompt(
                  ownerId, 
                  m.id, 
                  m.type, 
                  currentDisplayName, 
                  tempChar, 
                  tempNpc
                );

                const messages = [
                  { role: "system", content: sysPrompt },
                  ...historyList
                ];

                replyText = await requestAI(messages);
              } catch (error) {
                replyText = `（心言未通：${error.message}）`;
              }
            }

            // 👈 隐藏正在输入
            hideTypingIndicator();

            // 插入动作逻辑
            if (Math.random() * 100 < actionProb) {
              const act = await getRandomAction(ownerId, targetId, mode);
              if (act) {
                if (Math.random() < 0.5) {
                  replyText = `（${act.content}）${replyText}`;
                } else {
                  replyText = `${replyText} （${act.content}）`;
                }
              }
            }

            const msg = await addMessage(chat.id, ownerId, {
              fromId: m.id,
              fromType: m.type,
              content: replyText,
              mode: currentMode,
            });

            await renderMessages(true);

            if (recall && Math.random() * 100 < recallProb) {
              const delay = 2000 + Math.random() * 3000;
              setTimeout(async () => {
                msg.revoked = true;
                await db.put("messages", msg);
                await renderMessages();
              }, delay);
            }
          }, wait);
        }
      }

      setTimeout(() => { sendBtn.disabled = false; }, acc + 500);
    } else {
      const replyCount = Math.floor(Math.random() * (replyMax - replyMin + 1)) + replyMin;
      let acc = 0;
      for (let i = 0; i < replyCount; i++) {
        const wait = (intervalMin + Math.random() * (intervalMax - intervalMin)) * 1000;
        acc += wait;

        setTimeout(async () => {
          // 👈 显示正在输入
          showTypingIndicator();

          let replyText;
          if (currentMode === "card") {
            // 👈 加个 1500 毫秒的延迟
     await new Promise(r => setTimeout(r, 1500));
            // 完整的抽卡逻辑
            const card = mode === "npc"
              ? await drawNpcCard(ownerId, targetId)
              : await drawCard(ownerId, targetId);
            replyText = card ? card.content : "……";
          } else {
            // AI 请求代码
            try {
          // 👈 在 AI 请求前，强行停顿 1 秒，保证至少能看到一秒的提示
                await new Promise(r => setTimeout(r, 1000));
              const recentMsgs = await getMessages(chat.id, { limit: 10 });
              const historyList = recentMsgs.map(m => ({
                role: m.fromType === "user" ? "user" : "assistant",
                content: m.content
              }));
              const sysPrompt = await buildSystemPrompt(ownerId, targetId, mode, displayName, character, npc);
              const messages = [
                { role: "system", content: sysPrompt },
                ...historyList
              ];
              replyText = await requestAI(messages);
            } catch (error) {
              replyText = `（心言未通：${error.message}）`;
            }
          }

          // 👈 隐藏正在输入
          hideTypingIndicator();

          // 插入动作逻辑
          if (Math.random() * 100 < actionProb) {
            const act = await getRandomAction(ownerId, targetId, mode);
            if (act) {
              if (Math.random() < 0.5) {
                replyText = `（${act.content}）${replyText}`;
              } else {
                replyText = `${replyText} （${act.content}）`;
              }
            }
          }

          const msg = await addMessage(chat.id, ownerId, {
            fromId: targetId,
            fromType: mode === "npc" ? "npc" : "character",
            content: replyText,
            mode: currentMode,
          });

          await renderMessages(true);

          if (recall && Math.random() * 100 < recallProb) {
            const delay = 2000 + Math.random() * 3000;
            setTimeout(async () => {
              msg.revoked = true;
              await db.put("messages", msg);
              await renderMessages();
            }, delay);
          }

          if (i === replyCount - 1) {
            sendBtn.disabled = false;
          }
        }, acc);
      }
    }
  }

/* ===== 赠画 ===== */
  async function handleSendImage(chatId, ownerId) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const imageDataUrl = reader.result;

       // 👈 加上这两行压缩
        const { compressImage } = await import("../ui/image-cropper.js");
        const compressedData = await compressImage(imageDataUrl, 1);

        await addMessage(chatId, ownerId, {
          fromId: ownerId,
          fromType: "user",
          content: "[图片]",
          contentType: "image",
          mode: "card",
          quote: null,
         imageData: compressedData, // 👈 存压缩后的
        });

        await renderMessages(true);
        showToast("画作已赠出");

        await scheduleReplies();
      };
      reader.onerror = () => showToast("图片读取失败");
    };

    fileInput.click();
  }

  /* ===== 看大图 ===== */
  function openImageViewer(url) {
    const viewer = document.createElement("div");
    viewer.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.9);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
      cursor: zoom-out;
    `;
    viewer.innerHTML = `<img src="${url}" style="max-width: 95%; max-height: 95%; object-fit: contain;">`;
    viewer.onclick = () => viewer.remove();
    document.body.appendChild(viewer);
  }

  /* ===== 聊天记录搜索 ===== */
  async function openSearchModal(chatId, ownerId) {
    const { showModal, closeModal } = await import("../ui/modal.js");

    // 统计有记录的日期
    const allMsgs = await db.all("messages");
    const chatMsgs = allMsgs.filter(m => m.chatId === chatId);
    const dateSet = new Set();
    const firstMsgOfDay = new Map();
    chatMsgs.forEach(m => {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      dateSet.add(key);
      if (!firstMsgOfDay.has(key)) firstMsgOfDay.set(key, m.id);
    });

    const now = new Date();
    let calYear = now.getFullYear();
    let calMonth = now.getMonth() + 1; // 1-12

    let selectedDate = null;

    function renderCalendar() {
      const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth, 0).getDate();

      let html = "";
      for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${calYear}-${calMonth}-${d}`;
        const hasRecord = dateSet.has(key);
        const isSelected = key === selectedDate;
        html += `
          <div class="cal-cell ${hasRecord ? "has-record" : ""} ${isSelected ? "selected" : ""}" 
               data-key="${key}" data-mid="${firstMsgOfDay.get(key) || ""}">
            ${d}
          </div>
        `;
      }
      return html;
    }

    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
        搜寻旧笺
      </div>
      <div class="form-field">
        <label>关键词</label>
        <input type="text" class="input" id="search-keyword" placeholder="输入要查找的内容……">
      </div>
      <div class="form-field">
        <label>按日期查找</label>
        <button class="btn ghost" id="cal-toggle" style="width:100%;padding:10px;text-align:left;justify-content:space-between;display:flex;align-items:center;">
          <span>📅 展开日历</span>
          <span id="cal-toggle-arrow" style="transition:transform 0.2s;">▼</span>
        </button>
        <div id="cal-panel" style="display:none;margin-top:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <button class="btn ghost" id="cal-prev" style="padding:4px 10px;font-size:12px;">←</button>
            <span id="cal-title" style="font-family:var(--font-title);font-size:14px;">${calYear}年${calMonth}月</span>
            <button class="btn ghost" id="cal-next" style="padding:4px 10px;font-size:12px;">→</button>
          </div>
          <div class="cal-head" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:12px;color:var(--ink-dim);">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
          </div>
          <div class="calendar-grid" id="cal-grid">${renderCalendar()}</div>
        </div>
      </div>
      <div id="search-results" style="max-height: 40vh; overflow-y: auto; margin-top: 12px;"></div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn ghost" id="search-cancel" style="flex:1;padding:12px;">取 消</button>
        <button class="btn" id="search-ok" style="flex:1;padding:12px;">搜 寻</button>
      </div>
    `);

    // 绑定日历点击
    function bindCalClicks() {
      modal.querySelectorAll(".cal-cell.has-record").forEach(cell => {
        cell.onclick = () => {
          const mid = cell.dataset.mid;
          if (mid) {
            closeModal(modal);
            locateMessage(mid);
          }
        };
      });
    }
    bindCalClicks();

    // 折叠/展开日历
    modal.querySelector("#cal-toggle").onclick = () => {
      const panel = modal.querySelector("#cal-panel");
      const arrow = modal.querySelector("#cal-toggle-arrow");
      const isHidden = panel.style.display === "none";
      panel.style.display = isHidden ? "block" : "none";
      arrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      modal.querySelector("#cal-toggle span:first-child").textContent = isHidden ? "📅 收起日历" : "📅 展开日历";
    };

    // 切换月份
    modal.querySelector("#cal-prev").onclick = () => {
      calMonth--;
      if (calMonth < 1) { calMonth = 12; calYear--; }
      modal.querySelector("#cal-title").textContent = `${calYear}年${calMonth}月`;
      modal.querySelector("#cal-grid").innerHTML = renderCalendar();
      bindCalClicks();
    };
    modal.querySelector("#cal-next").onclick = () => {
      calMonth++;
      if (calMonth > 12) { calMonth = 1; calYear++; }
      modal.querySelector("#cal-title").textContent = `${calYear}年${calMonth}月`;
      modal.querySelector("#cal-grid").innerHTML = renderCalendar();
      bindCalClicks();
    };

    modal.querySelector("#search-cancel").onclick = () => closeModal(modal);

    modal.querySelector("#search-ok").onclick = async () => {
      const keyword = modal.querySelector("#search-keyword").value.trim();
      let result = chatMsgs.slice();
      if (keyword) {
        result = result.filter(m => m.content && m.content.includes(keyword));
      }
      result.sort((a, b) => b.createdAt - a.createdAt);

      const resultsEl = modal.querySelector("#search-results");
      if (!result.length) {
        resultsEl.innerHTML = `<div style="text-align:center;color:var(--ink-dim);padding:20px;">无匹配消息</div>`;
        return;
      }

      resultsEl.innerHTML = result.map(m => {
        const isImg = m.contentType === "image";
        const displayContent = isImg ? (m.imageData ? "[图片]" : "[图片已清理]") : m.content;
        const d = new Date(m.createdAt);
        const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return `
          <div class="search-result-item" data-mid="${m.id}" style="padding:10px; border-bottom:1px solid var(--line-light); cursor:pointer;">
            <div style="font-size:12px;color:var(--cinnabar);">${timeStr}</div>
            <div style="font-size:13px;color:var(--ink);">${escapeHtml(displayContent)}</div>
          </div>
        `;
      }).join("");

      resultsEl.querySelectorAll(".search-result-item").forEach(item => {
        item.onclick = async () => {
          closeModal(modal);
          await locateMessage(item.dataset.mid);
        };
      });
    };
  }


  // 👈 新的定位函数：传入消息对象，不再只靠 mid
  async function locateMessage(mid) {
    const msg = await db.get("messages", mid);
    if (!msg) {
      showToast("找不到这条消息");
      return;
    }
    // 用消息的时间戳重新加载消息列表
    loadedBefore = null;
    await renderMessages(false, msg.createdAt);
  }

  /* ===== 发送 ===== */
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    sendBtn.disabled = true;

    await addMessage(chat.id, ownerId, {
      fromId: ownerId,
      fromType: "user",
      content: text,
      mode: "card",
      quote: currentQuote,
    });

    currentQuote = null;
    renderQuotePreview();

    await renderMessages(true);

    if (mode === "character") {
      await handleChatRelation(ownerId, targetId, text);
    }

    await scheduleReplies();
    
    // 👈 加上这句，触发表情记忆总结
    checkAndSummarizeMemory();
  }

  /* ===== 顶栏 ===== */
  el.querySelector("#btn-back").onclick = () => { location.hash = "#/chenshi"; };

  el.querySelector("#btn-settings").onclick = () => {
    if (mode === "group") {
      location.hash = `#/chat/group-settings/${chat.id}`;
    } else {
      openSettingsMenu(chat, { name: displayName }, mode, () => {
        renderMessages();
      }, () => {
        openSearchModal(chat.id, ownerId);
      });
    }
  };

  el.querySelector(".chat-quickbar").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "action") {
      await openActionPicker(ownerId, inputEl, targetId, mode);
      return;
    }

    if (act === "image") {
      await handleSendImage(chat.id, ownerId);
      return;
    }

    if (act === "gift") {
      await openChatGiftPicker(ownerId, chat.id, targetId, mode);
      return;
    }

    if (act === "placehold") {
      // 👈 先打开游戏选择菜单
      openXianshiMenu(displayName, ownerId, targetId);
      return;
    }

    // 长卷等待开发
    const labels = { more: "长卷" };
    if (act && labels[act]) {
      showToast(`${labels[act]} · 待开发`);
    }
  });

  // 👈 下面这行原本就被你写在了事件里面，现在拿出来放到外面！
  sendBtn.onclick = sendMessage;
  inputEl.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };

  await renderMessages(true);


  // ==========================================
  // 👈 赠礼函数（干净无重复版）
  // ==========================================
  async function openChatGiftPicker(ownerId, chatId, targetId, mode) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const { GIFTS, GIFT_REACTIONS } = await import("../data/gift-data.js");

    const inventory = (await db.all("inventory")).filter(i => i.ownerId === ownerId && i.count > 0);
    if (!inventory.length) return showToast("你的百宝袋空空如也，去藏品里弄点礼物吧~");

    // 1. 检查今日送礼上限
    const today = new Date().toISOString().slice(0, 10);
    const dailyGiftKey = `daily_gift_${ownerId}_${today}`;
    let todayGiftScore = +(localStorage.getItem(dailyGiftKey) || 0);
    const MAX_DAILY_SCORE = 30;

    if (todayGiftScore >= MAX_DAILY_SCORE) {
      return showToast("今日心意已达上限，明日再来吧~");
    }

    let selectedGiftId = null;
    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
        赠 礼
      </div>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; max-height:40vh; overflow-y:auto;" id="chat-gift-list">
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
        <button class="btn ghost" id="chat-gift-cancel" style="flex:1; padding:12px;">取 消</button>
        <button class="btn" id="chat-gift-confirm" style="flex:1; padding:12px; opacity:0.5; pointer-events:none;">确 认 赠 送</button>
      </div>
    `);

    const confirmBtn = modal.querySelector("#chat-gift-confirm");
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

    modal.querySelector("#chat-gift-cancel").onclick = () => closeModal(modal);

    // 2. 确认送出
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

      // 获取角色名和 Key
      let charObj = null;
      if (mode === "npc") charObj = await db.get("npc_relations", targetId);
      else if (mode === "character") charObj = await db.get("characters", targetId);
      const charName = charObj?.name || "对方";

      let charKey = targetId;
      if (charName === "盛崖余") charKey = "shengyayu";
      if (charName === "叶问舟") charKey = "yewenzhou";
      if (charName === "方承意") charKey = "fangchengyi";

      // 获取反应数据
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

      // 每日上限计算
      const remainScore = MAX_DAILY_SCORE - todayGiftScore;
      const actualAdd = Math.min(addAffection, remainScore);

      // 增加好感度
      const { addRelation } = await import("../services/relation-service.js");
      await addRelation(ownerId, targetId, {
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

      // 发送你的赠送动作
      await addMessage(chatId, ownerId, {
        fromId: ownerId,
        fromType: "user",
        content: `（赠予「${charName}」一份「${gift.name}」）`,
        mode: "card",
      });

      await renderMessages(true);

      // 延迟 1.5 秒发送对方的回复
      setTimeout(async () => {
        await addMessage(chatId, ownerId, {
          fromId: targetId,
          fromType: mode === "npc" ? "npc" : "character",
          content: finalResponse,
          mode: "card",
        });
        await renderMessages(true);
      }, 1500);

      showToast(`好感度 +${actualAdd}`);
    };
  }


  return el;
} // 👈 chatView 到此完美结束

/* ============================================================
 * 工具（保留这些原封不动的函数）
 * ============================================================ */
function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${mm}`;

  // 1. 如果是今天，只显示时间
  if (d.toDateString() === now.toDateString()) {
    return timeStr;
  }

  // 2. 如果是昨天
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${timeStr}`;
  }

  // 3. 计算年份，如果是往年，要带上年份
  const isSameYear = d.getFullYear() === now.getFullYear();
  const yearStr = isSameYear ? "" : `${d.getFullYear()}年`;
  
  // 4. 其他日期：X月X日 HH:mm
  return `${yearStr}${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
}


function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

async function handleChatRelation(ownerId, characterId, text) {
  const { addRelation, incDailyChat } = await import("../services/relation-service.js");

  const count = await incDailyChat(ownerId, characterId);
  if (count > 5) return;

  const warmWords = ["喜欢", "想", "谢", "陪", "抱", "乖", "甜", "笑", "好", "对", "是"];
  const coldWords = ["滚", "走", "烦", "讨厌", "恨", "笨", "蠢", "差"];

  const isWarm = warmWords.some(w => text.includes(w));
  const isCold = coldWords.some(w => text.includes(w));

  let affection = 0.5;
  let friendship = 1;

  if (isWarm) { affection += 1; friendship += 0.5; }
  if (isCold) { affection -= 1; friendship -= 0.5; }

  await addRelation(ownerId, characterId, {
    affection,
    friendship,
    type: "chat",
    note: text.slice(0, 20),
  });
}

async function openSettingsMenu(chat, partner, mode, onRefresh, onSearch) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="text-align: center; font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 4px; margin-bottom: 20px;">
      ${escapeHtml(partner.name)}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${mode === "character" ? `<button class="menu-item" data-act="settings">聊天设置</button>` : ""}
      <button class="menu-item" data-act="search">搜寻旧笺</button>
      <button class="menu-item" data-act="export">导出聊天</button>
      <button class="menu-item" data-act="clear-images" style="color: var(--cinnabar);">清理聊天图片</button>
      <button class="menu-item" data-act="clear" style="color: var(--cinnabar);">清空聊天</button>
    </div>
    <style>
      .menu-item {
        padding: 14px 16px;
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
      .menu-item:hover { border-color: var(--cinnabar); color: var(--cinnabar); }
    </style>
  `);

  const settingsBtn = modal.querySelector("[data-act='settings']");
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      closeModal(modal);
      location.hash = "#/guichu/chat-settings";
    };
  }

  const searchBtn = modal.querySelector("[data-act='search']");
  if (searchBtn) {
    searchBtn.onclick = () => {
      closeModal(modal);
      onSearch();
    };
  }

  modal.querySelector("[data-act='export']").onclick = async () => {
    const messages = await getMessages(chat.id);
    const data = { partner: { id: partner.id, name: partner.name }, messages, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${partner.name}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    closeModal(modal);
    showToast("已导出");
  };

  modal.querySelector("[data-act='clear-images']").onclick = async () => {
    closeModal(modal);
    const ok = await showConfirm("清理图片", "将清理当前聊天中的所有图片（含备份），文字记录保留。确定？");
    if (!ok) return;

    let count = 0;
    const allMsgs = await db.all("messages");
    const imageMsgs = allMsgs.filter(m => m.chatId === chat.id && m.contentType === "image" && m.imageData);

    for (const m of imageMsgs) {
      m.imageData = null;
      m.content = "[图片已清理]";
      await db.put("messages", m);
      count++;
    }

    try {
      const allImages = await db.all("images");
      const chatImages = allImages.filter(img => img.ownerId === ownerId && img.category === "chat");
      for (const img of chatImages) {
        await db.del("images", img.id);
      }
    } catch (e) {
      console.log("images 表清理跳过：", e.message);
    }

    showToast(`已清理 ${count} 张图片`);
    onRefresh();
  };

  modal.querySelector("[data-act='clear']").onclick = async () => {
    closeModal(modal);
    const ok = await showConfirm("清空聊天", `确定清空与「${partner.name}」的全部对话？`);
    if (!ok) return;
    await clearChat(chat.id);
    showToast("已清空");
    onRefresh();
  };
}

async function getRandomAction(ownerId, targetId, mode) {
  const { getAllActions } = await import("../services/action-service.js");
  const allActions = await getAllActions(ownerId);

  const available = allActions.filter(a => {
    if (!a.scope || a.scope === "global") return true;
    if (a.scope === "char") {
      if (mode === "character" && a.charId === targetId) return true;
      if (mode === "npc" && npc?.linkedCharacterIds?.includes(a.charId)) return true;
    }
    return false;
  });

  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

async function openActionPicker(ownerId, inputEl, targetId, mode) {
  const { getAllActions } = await import("../services/action-service.js");
  const { showModal, closeModal } = await import("../ui/modal.js");
  
  const allActions = await getAllActions(ownerId);

  const actions = allActions.filter(a => {
    if (!a.scope || a.scope === "global") return true;
    if (a.scope === "char") {
      if (mode === "character" && a.charId === targetId) return true;
      if (mode === "npc" && npc?.linkedCharacterIds?.includes(a.charId)) return true;
      return false;
    }
    return false;
  });

  if (!actions.length) {
    showToast("这里还没有可用的动作。去归处 → 聊天设置 添加吧");
    return;
  }

  const modal = showModal(`
    <div style="text-align: center; font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 4px; margin-bottom: 20px;">
      拂 袖
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto;">
      ${actions.map(a => `
        <button class="action-pick-item" data-id="${a.id}" style="
          padding: 14px 16px; background: var(--paper-soft);
          border: 1px solid var(--line-light); border-radius: var(--radius-sm);
          font-family: var(--font-body); font-size: 14px; letter-spacing: 1px;
          color: var(--ink); cursor: pointer; text-align: left;
        ">
          <div style="font-weight: 500; color: var(--cinnabar); margin-bottom: 4px;">${escapeHtml(a.name)}</div>
          <div style="font-size: 12px; color: var(--ink-dim);">${escapeHtml(a.content)}</div>
        </button>
      `).join("")}
    </div>
  `);

  modal.querySelectorAll(".action-pick-item").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const action = actions.find(a => a.id === id);
      if (action) {
        const cur = inputEl.value;
        inputEl.value = cur ? `${cur}${action.content}` : action.content;
        inputEl.focus();
      }
      closeModal(modal);
    };
  });
}

// ==========================================
// 👈 闲事·对弈邀约弹窗
// ==========================================
async function openDuiyiInvite(charName, ownerId, characterId) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const { DUIYI_DATA } = await import("../data/duiyi-data.js");
  const { getRelation } = await import("../services/relation-service.js");
  
  // 先检查有没有写文案库，没有就给个兜底
  const data = DUIYI_DATA?.[charName] || DUIYI_DATA?.["方承意"];
  if (!data) {
    showToast("对弈文案缺失，请检查配置");
    return;
  }

  const rel = await getRelation(ownerId, characterId);
  const affection = rel?.affection || 0;
  
  // 同意概率：基础 60%，好感度越高越容易同意
  const isAgree = Math.random() < (0.6 + affection / 200); 

  const textPool = isAgree ? data.agree : data.refuse;
  const msg = textPool[Math.floor(Math.random() * textPool.length)];

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
      邀 请 对 弈
    </div>
    <div style="font-size:14px;line-height:1.8;color:var(--ink);padding:16px;background:var(--paper-soft);border-radius:8px;margin-bottom:20px;text-align:center;">
      ${escapeHtml(charName)}：<br><br>
      “${escapeHtml(msg)}”
    </div>
    
    <div id="duiyi-actions" style="display:flex;flex-direction:column;gap:10px;">
      ${isAgree ? `<button class="btn" id="btn-go-game" style="padding:12px;letter-spacing:4px;">落 座 开 局</button>` : ""}
      <button class="btn ghost" id="btn-cancel-invite" style="padding:12px;letter-spacing:4px;">收 起</button>
    </div>
  `);

  modal.querySelector("#btn-cancel-invite").onclick = () => closeModal(modal);

  if (isAgree) {
    modal.querySelector("#btn-go-game").onclick = () => {
      closeModal(modal);
      // 跳转到闲事阁，并把角色ID带过去
      location.hash = `#/guichu/games/play/${characterId}/duiyi`;
    };
  }
}

// ==========================================
// 👈 闲事菜单弹窗
// ==========================================
async function openXianshiMenu(charName, ownerId, characterId) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
      闲 事
    </div>
    
    <div style="display:flex;flex-direction:column;gap:12px;">
      <!-- 邀君对弈 -->
      <button class="btn ghost xianshi-item" data-game="duiyi" style="padding:16px; border-color:var(--line); display:flex; flex-direction:column; align-items:flex-start; gap:4px; text-align:left;">
        <span style="font-size:15px; font-family:var(--font-title); color:var(--cinnabar);">邀君对弈</span>
        <span style="font-size:12px; color:var(--ink-dim);">黑白交错，一局定心。</span>
      </button>
      
      <!-- 邀君投壶 -->
      <button class="btn ghost xianshi-item" data-game="touhu" style="padding:16px; border-color:var(--line); display:flex; flex-direction:column; align-items:flex-start; gap:4px; text-align:left;">
        <span style="font-size:15px; font-family:var(--font-title); color:var(--cinnabar);">邀君投壶</span>
        <span style="font-size:12px; color:var(--ink-dim);">宴饮雅戏，箭矢入壶。</span>
      </button>
    </div>

    <button class="btn ghost" id="xianshi-cancel" style="width:100%;margin-top:20px;padding:12px;">收 起</button>
  `);

  modal.querySelector("#xianshi-cancel").onclick = () => closeModal(modal);

  modal.querySelectorAll(".xianshi-item").forEach(btn => {
    btn.onclick = () => {
      closeModal(modal);
      const gameId = btn.dataset.game;
      // 调用同意/拒绝逻辑，并把 gameId 传进去
      openInviteResultModal(charName, ownerId, characterId, gameId);
    };
  });
}

// 👈 新增：同意/拒绝的判定弹窗
async function openInviteResultModal(charName, ownerId, characterId, gameId) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const { DUIYI_DATA } = await import("../data/duiyi-data.js");
  const { TOUHU_DATA } = await import("../data/touhu-data.js");
  const { getRelation } = await import("../services/relation-service.js");
  
  // 根据不同的游戏，拿不同的文案库
  let data = null;
  let gameTitle = "";
  if (gameId === "duiyi") {
    data = DUIYI_DATA?.[charName] || DUIYI_DATA?.["方承意"];
    gameTitle = "对弈";
  } else if (gameId === "touhu") {
    data = TOUHU_DATA?.[charName] || TOUHU_DATA?.["方承意"];
    gameTitle = "投壶";
  }
  
  if (!data) return showToast("文案缺失");

  const rel = await getRelation(ownerId, characterId);
  const affection = rel?.affection || 0;
  const isAgree = Math.random() < (0.6 + affection / 200); 

  const textPool = isAgree ? (data.agree || data.win) : (data.refuse || data.lose); // 兜底逻辑
  const msg = textPool[Math.floor(Math.random() * textPool.length)];

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
      邀 请 ${gameTitle}
    </div>
    <div style="font-size:14px;line-height:1.8;color:var(--ink);padding:16px;background:var(--paper-soft);border-radius:8px;margin-bottom:20px;text-align:center;">
      ${escapeHtml(charName)}：<br><br>
      “${escapeHtml(msg)}”
    </div>
    
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${isAgree ? `<button class="btn" id="btn-go-game" style="padding:12px;letter-spacing:4px;">前 往 ${gameTitle}</button>` : ""}
      <button class="btn ghost" id="btn-cancel-invite" style="padding:12px;letter-spacing:4px;">收 起</button>
    </div>
  `);

  modal.querySelector("#btn-cancel-invite").onclick = () => closeModal(modal);

  if (isAgree) {
    modal.querySelector("#btn-go-game").onclick = () => {
      closeModal(modal);
      // 跳转到对应的游戏页面
      location.hash = `#/guichu/games/play/${characterId}/${gameId}`;
    };
  }
}