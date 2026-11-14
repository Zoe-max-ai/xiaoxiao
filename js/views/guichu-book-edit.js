import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import {
  getChapter, createChapter, updateChapter,
} from "../services/book-service.js";

/* ============================================================
 * 新建剧情
 * ============================================================ */
export async function guichuBookNewView({ params }) {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const categoryId = params?.[0];
  if (!categoryId) {
    el.innerHTML = `<div class="empty-state">未指定分类。</div>`;
    return el;
  }

  return buildEditUI(el, {
    title: "新 建 剧 情",
    chapter: null,
    categoryId,
    isNew: true,
  });
}

/* ============================================================
 * 编辑剧情
 * ============================================================ */
export async function guichuBookEditView({ params }) {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const chapterId = params?.[0];
  if (!chapterId) {
    el.innerHTML = `<div class="empty-state">未指定剧情。</div>`;
    return el;
  }

  const chapter = await getChapter(chapterId);
  if (!chapter) {
    el.innerHTML = `<div class="empty-state">此篇章已不知所踪。</div>`;
    return el;
  }

  return buildEditUI(el, {
    title: "编 辑 剧 情",
    chapter,
    categoryId: chapter.categoryId,
    isNew: false,
  });
}

/* ============================================================
 * 共用 UI
 * ============================================================ */
function buildEditUI(el, { title, chapter, categoryId, isNew }) {
  el.innerHTML = `
    <div class="book-edit-page">
      <div class="form-field">
        <label>标题</label>
        <input type="text" id="edit-title" class="input" value="${escapeHtml(chapter?.title || "")}" placeholder="剧情标题" maxlength="60">
      </div>

      <div class="form-field">
        <label>正文</label>
        <textarea id="edit-content" class="input" style="min-height:400px;resize:vertical;line-height:2;" placeholder="正文……">${escapeHtml(chapter?.content || "")}</textarea>
        <div style="font-size:11px;color:var(--ink-dim);margin-top:6px;">
          字数：<span id="word-count">${chapter?.wordCount || 0}</span>
        </div>
      </div>

      <div class="book-edit-actions">
        <button class="btn ghost" id="btn-cancel">取 消</button>
        <button class="btn" id="btn-save">保 存</button>
      </div>
    </div>
  `;

  el.insertBefore(pageHeader(title, "#/guichu/books"), el.firstChild);

  const titleInput = el.querySelector("#edit-title");
  const contentInput = el.querySelector("#edit-content");
  const wordCountEl = el.querySelector("#word-count");

  contentInput.oninput = () => {
    const text = contentInput.value.replace(/\s/g, "");
    wordCountEl.textContent = text.length;
  };

  el.querySelector("#btn-cancel").onclick = () => {
    location.hash = "#/guichu/books";
  };

  el.querySelector("#btn-save").onclick = async () => {
    const t = titleInput.value.trim();
    const c = contentInput.value.trim();

    if (!t) { showToast("请填写标题"); return; }
    if (!c) { showToast("请填写正文"); return; }

    if (isNew) {
      await createChapter(categoryId, { title: t, content: c });
      showToast("已创建");
    } else {
      await updateChapter(chapter.id, { title: t, content: c });
      showToast("已保存");
    }

    location.hash = "#/guichu/books";
  };

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}