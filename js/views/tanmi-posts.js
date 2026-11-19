import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { getImageUrl } from "../services/seed-service.js";
import {
  getAllPosts, getHotPosts, getComments, addComment,
  toggleLike, updatePost, deletePost,
  checkAutoPosts, triggerCharacterInteractions,
  getFavoritePosts,
} from "../services/post-service.js";

/* ========== SVG 图标 ========== */
const ICON_MY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><circle cx="12" cy="10" r="2.8"/><path d="M6.5 18 C 8 14.5, 16 14.5, 17.5 18"/></svg>`;
const ICON_NEW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 L18 7 L8 17 L3 20 L6 15 Z"/><path d="M14 3 L18 7" opacity="0.5"/><path d="M3 20 L6 15" opacity="0.5"/></svg>`;
const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 A 8 8 0 0 1 20 12"/><path d="M20 12 A 8 8 0 0 1 12 20" opacity="0.5"/><polyline points="17,7 20,12 15,13" fill="none"/></svg>`;
const ICON_SETTINGS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3 L13.5 6 L17 5 L17 8 L20 9 L18 12 L20 15 L17 16 L17 19 L13.5 18 L12 21 L10.5 18 L7 19 L7 16 L4 15 L6 12 L4 9 L7 8 L7 5 L10.5 6 Z" opacity="0.7"/></svg>`;

export async function tanmiPostsView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  el.innerHTML = `
    <div class="posts-topbar">
      <button class="posts-back" id="btn-back">←</button>
      <div class="posts-title">心 绪</div>
      <div class="posts-icon-group">
        <button class="posts-icon-btn" id="btn-mine" title="我的帖子">${ICON_MY}</button>
        <button class="posts-icon-btn" id="btn-new" title="发帖">${ICON_NEW}</button>
        <button class="posts-icon-btn" id="btn-refresh" title="刷新">${ICON_REFRESH}</button>
        <button class="posts-icon-btn" id="btn-settings" title="设置">${ICON_SETTINGS}</button>
      </div>
    </div>

    <!-- 👈 骨架屏占位 -->
    <div id="posts-content">
      <div style="text-align: center; padding: 80px 0; color: var(--ink-dim); font-family: var(--font-title); letter-spacing: 4px;">
        正在翻阅江湖卷宗…
      </div>
    </div>
  `;

  const contentEl = el.querySelector("#posts-content");

  el.querySelector("#btn-back").onclick = () => { location.hash = "#/tanmi"; };
  el.querySelector("#btn-mine").onclick = () => { location.hash = "#/tanmi/posts/mine"; };
  el.querySelector("#btn-new").onclick = () => { location.hash = "#/tanmi/posts/new"; };
  el.querySelector("#btn-refresh").onclick = async () => {
    showToast("刷新中…");
    // 👈 把耗时的操作放到后台，不卡当前页面交互
    requestAnimationFrame(async () => {
      try {
        await checkAutoPosts(ownerId);
        await render();
      } catch (e) {
        console.error(e);
      }
    });
  };
  el.querySelector("#btn-settings").onclick = () => openForumSettings(ownerId);

  const onPostUpdated = () => render();
  window.addEventListener("post-updated", onPostUpdated);

  async function render() {
    const [hot, all] = await Promise.all([
      getHotPosts(ownerId, 3),
      getAllPosts(ownerId),
    ]);

    const authorMap = await buildAuthorMap(ownerId);

    contentEl.innerHTML = `
      ${hot.length ? renderHotSection(hot) : ""}
      <div style="margin-top: 20px;" id="post-list"></div>
    `;

    const listEl = contentEl.querySelector("#post-list");

    if (!all.length) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
          论坛还没有帖。<br>
          <button class="btn" id="btn-first-post" style="margin-top: 20px; padding: 10px 24px;">发第一条帖</button>
        </div>
      `;
      listEl.querySelector("#btn-first-post").onclick = () => { location.hash = "#/tanmi/posts/new"; };
      return;
    }

    // 👈 核心修复：用 Promise.all 并行把所有帖子的 DOM 拼好，然后在内存中组装
    const cardPromises = all.map(post => renderPostCard(post, authorMap, ownerId, render));
    const cards = await Promise.all(cardPromises);

    const fragment = document.createDocumentFragment();
    cards.forEach(card => fragment.appendChild(card));
    
    // 一次性把组装好的列表塞进页面
    listEl.appendChild(fragment);

    // 绑定热帖点击
    contentEl.querySelectorAll(".hot-item").forEach(item => {
      item.onclick = () => {
        const pid = item.dataset.pid;
        const target = contentEl.querySelector(`.post-card[data-pid="${pid}"]`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.style.transition = "background 0.4s";
          target.style.background = "var(--paper-soft)";
          setTimeout(() => { target.style.background = ""; }, 800);
        }
      };
    });
  }

  await checkAutoPosts(ownerId);
  await render();

  el.__cleanup = () => window.removeEventListener("post-updated", onPostUpdated);

  return el;
}

/* ============================================================
 * 作者信息缓存
 * ============================================================ */

async function buildAuthorMap(ownerId) {
  const chars = (await db.all("characters")).filter(c => c.ownerId === ownerId);
  const npcs = (await db.all("npc_relations")).filter(n => n.ownerId === ownerId);
  const map = {};

  const user = state.currentUser;
  if (user) {
    map[user.id] = {
      name: user.name || "我",
      sub: user.nickname || "",
      avatarUrl: user.avatarId ? await getImageUrl(user.avatarId, true) : null,
      isMe: true,
    };
  }

  for (const c of chars) {
    map[c.id] = {
      name: c.name,
      sub: c.du || "",
      avatarUrl: c.avatarId ? await getImageUrl(c.avatarId, true) : null,
      isMe: false,
    };
  }

  for (const n of npcs) {
    map[n.id] = {
      name: n.name,
      sub: n.relation || "",
      avatarUrl: n.avatarId ? await getImageUrl(n.avatarId, true) : null,
      isMe: false,
    };
  }

  return map;
}

/* ============================================================
 * 热帖区
 * ============================================================ */

function renderHotSection(hot) {
  return `
    <div class="hot-section">
      <div class="hot-title">🔥 江 湖 热 帖</div>
      <div class="hot-list">
        ${hot.map((p, i) => `
          <div class="hot-item" data-pid="${p.id}">
            <span class="hot-rank">${i + 1}</span>
            <span class="hot-text">${escapeHtml(p.title || "无题")}</span>
            <span class="hot-stats">💬${p.commentCount || 0}  👍${p.likes || 0}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ============================================================
 * 帖子卡片
 * ============================================================ */

async function renderPostCard(post, authorMap, ownerId, onRefresh) {
  const card = document.createElement("div");
  card.className = "post-card";
  card.dataset.pid = post.id;

  const isAnonymous = post.isAnonymous;
  const author = authorMap[post.authorId] || { name: "？", sub: "", avatarUrl: null, isMe: false };
  
  const displayName = isAnonymous ? "匿 名 侠 客" : author.name;
  const avatarHtml = isAnonymous 
    ? `<span>匿</span>` 
    : (author.avatarUrl ? `<img src="${author.avatarUrl}" loading="lazy" alt="">` : `<span>${escapeHtml(author.name[0] || "？")}</span>`);

  const isMine = post.authorType === "user" && post.authorId === ownerId;
  const likedByMe = (post.likedBy || []).includes(ownerId);

  card.innerHTML = `
    <div class="post-head">
      <div class="post-avatar">${avatarHtml}</div>
      <div class="post-head-info">
        <div class="post-title">${escapeHtml(post.title || "无题")}</div>
        <div class="post-meta">
          <span class="post-author">@${escapeHtml(displayName)}</span>
          ${author.isMe && !isAnonymous ? `<span class="post-me-tag">我</span>` : ""}
          <span class="post-time">${formatTime(post.createdAt)}</span>
        </div>
      </div>
      <button class="post-more" title="更多">⋯</button>
    </div>

    <div class="post-content">${escapeHtml(post.content).replace(/\n/g, "<br>")}</div>

    <div class="post-actions">
      <button class="post-act like ${likedByMe ? "on" : ""}">
        👍 <span class="like-count">${post.likes || 0}</span>
      </button>
      <button class="post-act comment-toggle">
        💬 <span class="comment-count">${post.commentCount || 0} 条回复</span>
      </button>
      <span class="post-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6,10 12,16 18,10"/>
        </svg>
      </span>
    </div>

    <div class="post-expand" style="display:none;">
      <div class="post-likes-row" style="display:none;">
        <span class="likes-icon">👍</span>
        <span class="liker-names"></span>
        <span class="likes-suffix">觉得很赞</span>
      </div>
      <div class="post-comments-list" style="display:none;"></div>
      <div class="comment-input-row">
        <input type="text" class="input comment-input" placeholder="说点什么……">
        <button class="btn comment-send" style="padding: 10px 16px;">递</button>
      </div>
    </div>
  `;

  const expandEl = card.querySelector(".post-expand");
  const arrowEl = card.querySelector(".post-arrow");
  const actionsEl = card.querySelector(".post-actions");

  // 👈 注意：这里改成了 let，因为后面要重新赋值
  let toggleExpand = () => {
    const open = expandEl.style.display !== "none";
    expandEl.style.display = open ? "none" : "block";
    arrowEl.innerHTML = open
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,10 12,16 18,10"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,14 12,8 18,14"/></svg>`;
  };

  card.querySelector(".comment-toggle").onclick = (e) => { e.stopPropagation(); toggleExpand(); };
  arrowEl.onclick = (e) => { e.stopPropagation(); toggleExpand(); };
  actionsEl.onclick = (e) => {
    if (e.target.closest(".like")) return;
    if (e.target.closest(".comment-toggle")) return;
    if (e.target.closest(".post-arrow")) return;
    toggleExpand();
  };

  card.querySelector(".post-more").onclick = () => { openMoreMenu(post, isMine, onRefresh); };

  card.querySelector(".like").onclick = async (e) => {
    e.stopPropagation();
    const updated = await toggleLike(post.id, ownerId);
    if (updated) {
      post.likedBy = updated.likedBy;
      post.likes = updated.likes;
      const btn = card.querySelector(".like");
      btn.classList.toggle("on", updated.likedBy.includes(ownerId));
      btn.querySelector(".like-count").textContent = updated.likes;
      await renderLikes();
    }
  };

  const likesRowEl = card.querySelector(".post-likes-row");
  const likerNamesEl = card.querySelector(".liker-names");
  async function renderLikes() {
    const ids = post.likedBy || [];
    if (ids.length === 0) {
      likesRowEl.style.display = "none";
      return;
    }
    const names = ids.map(id => authorMap[id]?.name).filter(Boolean);
    if (names.length === 0) {
      likesRowEl.style.display = "none";
      return;
    }
    likerNamesEl.textContent = names.join("、");
    likesRowEl.style.display = "flex";
  }

  const commentsListEl = card.querySelector(".post-comments-list");
  async function renderComments() {
    const list = await getComments(post.id);
    if (list.length === 0) {
      commentsListEl.style.display = "none";
      return;
    }

    const commentMap = {};
    list.forEach(c => commentMap[c.id] = c);

    commentsListEl.innerHTML = list.map(c => {
      const a = authorMap[c.authorId] || { name: "？" };
      const displayName = c.isAnonymous ? "匿名" : a.name; 
      
      let replyHtml = "";
      if (c.replyTo && commentMap[c.replyTo]) {
        const target = commentMap[c.replyTo];
        const targetName = target.isAnonymous ? "匿名" : (authorMap[target.authorId]?.name || "某人");
        replyHtml = `<span style="color:var(--ink-dim); font-size:12px;"> 回复 <span style="color:var(--cinnabar);">@${escapeHtml(targetName)}</span>：</span>`;
      } else {
        replyHtml = `<span class="comment-colon">：</span>`;
      }

      return `
        <div class="comment-line" style="position:relative; margin-bottom:6px;">
          <span class="comment-author">${escapeHtml(displayName)}</span>
          ${replyHtml}
          <span class="comment-text">${escapeHtml(c.content)}</span>
          <span class="btn-reply" data-cid="${c.id}" data-name="${escapeHtml(displayName)}" style="font-size:11px; color:var(--cinnabar); cursor:pointer; margin-left:8px; opacity:0.8;">回复</span>
        </div>
      `;
    }).join("");
    commentsListEl.style.display = "block";

    commentsListEl.querySelectorAll(".btn-reply").forEach(btn => {
      btn.onclick = () => {
        const cid = btn.dataset.cid;
        const name = btn.dataset.name;
        const input = card.querySelector(".comment-input");
        input.value = `@${name} `;
        input.focus();
        input.dataset.replyTo = cid;
      };
    });
  }

  const inputEl = card.querySelector(".comment-input");
  const sendBtn = card.querySelector(".comment-send");

  const sendComment = async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    
    const replyTo = inputEl.dataset.replyTo || null;
    
    await addComment(post.id, ownerId, {
      authorId: ownerId,
      authorType: "user",
      content: text,
      replyTo,
    });

    inputEl.value = "";
    delete inputEl.dataset.replyTo;
    post.commentCount = (post.commentCount || 0) + 1;
    card.querySelector(".comment-count").textContent = `${post.commentCount} 条回复`;
    
    await renderComments();
  };

  sendBtn.onclick = sendComment;
  inputEl.onkeydown = (e) => { if (e.key === "Enter") sendComment(); };

  // 👈 初始只加载点赞，不加载评论（懒加载）
  await renderLikes();
  
  // 监听展开事件，只在用户第一次展开时，才去数据库拉取评论
  let commentsLoaded = false;
  const originalToggle = toggleExpand;
  toggleExpand = () => {
    originalToggle(); // 执行原本的展开/收起逻辑
    
    // 如果刚刚是展开的，并且还没加载过评论，就去加载
    if (expandEl.style.display !== "none" && !commentsLoaded) {
      commentsLoaded = true;
      renderComments(); // 这时候才去查数据库拼 HTML
    }
  };

  return card;
}

async function openMoreMenu(post, isMine, onRefresh) {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="more-item" data-act="fav">
        ${post.isFavorite ? "取消收藏" : "收藏"}
      </button>
      ${isMine ? `<button class="more-item danger" data-act="del">删除</button>` : ""}
    </div>
    <style>
      .more-item {
        padding: 14px;
        background: var(--paper-soft);
        border: 1px solid var(--line-light);
        border-radius: var(--radius-sm);
        font-family: var(--font-title);
        font-size: 14px;
        letter-spacing: 2px;
        color: var(--ink);
        cursor: pointer;
      }
      .more-item.danger { color: var(--cinnabar); }
    </style>
  `);

  modal.querySelector("[data-act='fav']").onclick = async () => {
    await updatePost(post.id, { isFavorite: !post.isFavorite });
    closeModal(modal);
    showToast(post.isFavorite ? "已取消收藏" : "已收藏");
    onRefresh();
  };

  const delBtn = modal.querySelector("[data-act='del']");
  if (delBtn) {
    delBtn.onclick = async () => {
      closeModal(modal);
      const ok = await showConfirm("删除帖子", "确定删除这条帖子？");
      if (!ok) return;
      await deletePost(post.id);
      showToast("已删除");
      onRefresh();
    };
  }
}

async function openForumSettings(ownerId) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  
  const isPrivacyOn = localStorage.getItem(`forum_privacy_${ownerId}`) === "true";

  const modal = showModal(`
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:8px;">
        社 区 设 置
      </div>

      <div class="form-field" style="margin:0;">
        <label>AI 智能生成</label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <div id="toggle-ai-interaction" class="sw-toggle ${localStorage.getItem(`forum_ai_${ownerId}`) !== "false" ? "on" : ""}" style="cursor:pointer;"></div>
          <span style="font-size:12px;color:var(--ink-dim);">开启优先用 AI 发帖评论；关闭则用本地字卡</span>
        </div>
      </div>

      <div class="form-field" style="margin:0;">
        <label>隐私保护（全坛匿名）</label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <div id="toggle-privacy" class="sw-toggle ${isPrivacyOn ? "on" : ""}" style="cursor:pointer;"></div>
          <span style="font-size:12px;color:var(--ink-dim);">开启后，所有人发帖都将隐藏真实身份</span>
        </div>
      </div>

      <button class="btn ghost" id="forum-fav" style="width:100%;padding:12px;letter-spacing:4px;">只 看 收 藏</button>
      <button class="btn ghost" id="forum-close" style="width:100%;padding:12px;letter-spacing:4px;">收 起</button>
    </div>
  `);

  const togglePrivacy = modal.querySelector("#toggle-privacy");
  togglePrivacy.onclick = () => {
    const newVal = !togglePrivacy.classList.contains("on");
    togglePrivacy.classList.toggle("on", newVal);
    localStorage.setItem(`forum_privacy_${ownerId}`, newVal);
    showToast(newVal ? "已开启全坛匿名" : "已关闭全坛匿名");
    window.dispatchEvent(new Event("post-updated"));
  };

  const toggleAi = modal.querySelector("#toggle-ai-interaction");
  toggleAi.onclick = () => {
    const newVal = !toggleAi.classList.contains("on");
    toggleAi.classList.toggle("on", newVal);
    localStorage.setItem(`forum_ai_${ownerId}`, newVal ? "true" : "false");
    showToast(newVal ? "已开启 AI 智能生成" : "已切换为本地字卡");
  };

  modal.querySelector("#forum-fav").onclick = () => {
    closeModal(modal);
    openFavoritePosts(ownerId);
  };
  modal.querySelector("#forum-close").onclick = () => closeModal(modal);
}
  
async function openFavoritePosts(ownerId) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const favs = await getFavoritePosts(ownerId);

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      我 的 收 藏
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto;">
      ${favs.length ? favs.map(p => `
        <div style="padding:10px 12px;background:var(--paper-soft);border-radius:var(--radius-sm);cursor:pointer;" data-pid="${p.id}">
          <div style="font-size:13px;font-family:var(--font-title);color:var(--ink);margin-bottom:4px;">${escapeHtml(p.title || "无题")}</div>
          <div style="font-size:11px;color:var(--ink-dim);">${formatTime(p.createdAt)}</div>
        </div>
      `).join("") : `<div class="empty-state" style="padding:30px 0;">暂无收藏。</div>`}
    </div>
    <button class="btn ghost" id="fav-close" style="width:100%;margin-top:16px;padding:12px;">收 起</button>
  `);

  modal.querySelector("#fav-close").onclick = () => closeModal(modal);
  modal.querySelectorAll("[data-pid]").forEach(item => {
    item.onclick = () => {
      closeModal(modal);
      const target = document.querySelector(`.post-card[data-pid="${item.dataset.pid}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.style.transition = "background 0.4s";
        target.style.background = "var(--paper-soft)";
        setTimeout(() => { target.style.background = ""; }, 800);
      }
    };
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `今天 ${hh}:${mm}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hh}:${mm}`;

  const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return `周${week} ${hh}:${mm}`;
  }

  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}