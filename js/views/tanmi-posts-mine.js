import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { getMyPosts, deletePost } from "../services/post-service.js";

export async function tanmiPostsMineView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  el.innerHTML = `<div id="mine-list" style="display:flex;flex-direction:column;gap:12px;"></div>`;
  el.insertBefore(pageHeader("我 的 帖 子", "#/tanmi/posts"), el.firstChild);

  const listEl = el.querySelector("#mine-list");

  const render = async () => {
    const posts = await getMyPosts(ownerId);
    if (!posts.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:60px 20px;">还没有发过帖。</div>`;
      return;
    }

    listEl.innerHTML = posts.map(p => `
      <div class="post-card" data-pid="${p.id}">
        <div class="post-head">
          <div class="post-head-info">
            <div class="post-title">${escapeHtml(p.title || "无题")}</div>
            <div class="post-meta">
              <span class="post-time">${formatTime(p.createdAt)}</span>
            </div>
          </div>
          <button class="post-more" title="更多">⋯</button>
        </div>
        <div class="post-content">${escapeHtml(p.content).replace(/\n/g, "<br>")}</div>
        <div class="post-actions">
          <span style="font-size:12px;color:var(--ink-dim);padding:6px 10px;">👍 ${p.likes || 0}  💬 ${p.commentCount || 0}</span>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".post-card").forEach(card => {
      const pid = card.dataset.pid;
      const post = posts.find(p => p.id === pid);
      card.querySelector(".post-more").onclick = async () => {
        const { showModal, closeModal } = await import("../ui/modal.js");
        const modal = showModal(`
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="mine-del" style="padding:14px;background:var(--paper-soft);border:1px solid var(--line-light);border-radius:var(--radius-sm);font-family:var(--font-title);font-size:14px;letter-spacing:2px;color:var(--cinnabar);cursor:pointer;">
              删除
            </button>
          </div>
        `);
        modal.querySelector(".mine-del").onclick = async () => {
          closeModal(modal);
          const ok = await showConfirm("删除帖子", "确定删除这条帖子？");
          if (!ok) return;
          await deletePost(pid);
          showToast("已删除");
          await render();
        };
      };
    });
  };

  await render();
  return el;
}

function formatTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `今天 ${hh}:${mm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}