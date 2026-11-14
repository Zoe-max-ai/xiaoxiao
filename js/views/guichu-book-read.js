import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import {
  getChapter, getChaptersByCategory,
  getReaderSettings, saveReaderSettings, DEFAULT_READER_SETTINGS,
  toggleFavoriteChapter,
} from "../services/book-service.js";

const FONT_OPTIONS = [
  { id: "default",  name: "默认", css: "var(--font-body)" },
  { id: "songti",   name: "宋体", css: "'Noto Serif SC', 'Songti SC', serif" },
  { id: "kaiti",    name: "楷体", css: "'Kaiti', 'STKaiti', serif" },
  { id: "yuanti",   name: "圆体", css: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
];

const BG_COLORS = [
  "#faf6ee",  // 宣纸
  "#ffffff",  // 白
  "#f0e9d8",  // 米黄
  "#f5e6e6",  // 浅粉
  "#e6eef5",  // 浅蓝
  "#e8f0e6",  // 浅绿
  "#2b2b2b",  // 墨黑
  "#1a1a1a",  // 深黑
];

const TEXT_COLORS = [
  "#2b2b2b",  // 墨
  "#4a453d",  // 深灰
  "#f5efe6",  // 米白
  "#ffffff",  // 白
  "#5a3e2b",  // 咖
];

export async function guichuBookReadView({ params }) {
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

  // 拿同分类下的所有剧情（用于上一篇 / 下一篇）
  const siblings = await getChaptersByCategory(chapter.categoryId);
  const idx = siblings.findIndex(c => c.id === chapterId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  // 阅读设置
  let settings = await getReaderSettings();

  // 背景图
  let bgImageUrl = null;
  if (settings.bgImageId) {
    const img = await db.get("images", settings.bgImageId);
    if (img?.origin?.data instanceof Blob) {
      bgImageUrl = URL.createObjectURL(img.origin.data);
    }
  }

  el.innerHTML = `
    <div class="reader-page" id="reader-page">
      <div class="reader-topbar">
        <button class="reader-back" id="btn-back">←</button>
        <div class="reader-title">${escapeHtml(chapter.title)}</div>
        <button class="reader-aa" id="btn-aa" title="阅读设置">Aa</button>
      </div>

      <div class="reader-content" id="reader-content">
        ${escapeHtml(chapter.content).replace(/\n/g, "<br>")}
      </div>

      <div class="reader-nav">
        ${prev ? `<button class="reader-nav-btn" id="btn-prev">← 上一篇</button>` : `<div></div>`}
        ${next ? `<button class="reader-nav-btn" id="btn-next">下一篇 →</button>` : `<div></div>`}
      </div>
    </div>
  `;

  // 应用阅读设置
  applyReaderSettings(el, settings, bgImageUrl);

  /* ===== 事件 ===== */
  el.querySelector("#btn-back").onclick = () => {
    location.hash = "#/guichu/books";
  };

  if (prev) {
    el.querySelector("#btn-prev").onclick = () => {
      location.hash = `#/guichu/books/read/${prev.id}`;
    };
  }
  if (next) {
    el.querySelector("#btn-next").onclick = () => {
      location.hash = `#/guichu/books/read/${next.id}`;
    };
  }

  el.querySelector("#btn-aa").onclick = () => openReaderSettings(el, ownerId, async () => {
    settings = await getReaderSettings();
    if (settings.bgImageId) {
      const img = await db.get("images", settings.bgImageId);
      if (img?.origin?.data instanceof Blob) {
        bgImageUrl = URL.createObjectURL(img.origin.data);
      } else {
        bgImageUrl = null;
      }
    } else {
      bgImageUrl = null;
    }
    applyReaderSettings(el, settings, bgImageUrl);
  });

  return el;
}

/* ============================================================
 * 应用阅读设置
 * ============================================================ */

function applyReaderSettings(el, settings, bgImageUrl) {
  const page = el.querySelector("#reader-page");
  const content = el.querySelector("#reader-content");
  if (!page || !content) return;

  // 背景
  if (bgImageUrl) {
    page.style.backgroundImage = `url(${bgImageUrl})`;
    page.style.backgroundSize = "cover";
    page.style.backgroundPosition = "center";
    page.style.backgroundColor = settings.bgColor || DEFAULT_READER_SETTINGS.bgColor;
  } else {
    page.style.backgroundImage = "none";
    page.style.backgroundColor = settings.bgColor || DEFAULT_READER_SETTINGS.bgColor;
  }

  // 文字
  content.style.color = settings.textColor || DEFAULT_READER_SETTINGS.textColor;
  content.style.fontSize = (settings.fontSize || 16) + "px";

  const font = FONT_OPTIONS.find(f => f.id === settings.fontFamily) || FONT_OPTIONS[0];
  content.style.fontFamily = font.css;
}

/* ============================================================
 * 阅读设置抽屉
 * ============================================================ */

async function openReaderSettings(el, ownerId, onApply) {
  const { showModal, closeModal } = await import("../ui/modal.js");
  const settings = await getReaderSettings();

  // 图库背景（只取 background 分类）
  const allImages = (await db.all("images"))
    .filter(img => img.category === "background" && img.origin?.data instanceof Blob);

  // 临时状态
  let temp = { ...settings };

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:15px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
      阅 读 设 置
    </div>

    <div class="rd-section">
      <div class="rd-label">背景色</div>
      <div class="rd-row" id="rd-bg">
        ${BG_COLORS.map(c => `
          <div class="rd-color ${settings.bgColor === c ? "on" : ""}" data-color="${c}" style="background:${c};"></div>
        `).join("")}
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-label">文字色</div>
      <div class="rd-row" id="rd-text">
        ${TEXT_COLORS.map(c => `
          <div class="rd-color ${settings.textColor === c ? "on" : ""}" data-color="${c}" style="background:${c};"></div>
        `).join("")}
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-label">字号</div>
      <div class="rd-slider-row">
        <span class="rd-slider-mark">A</span>
        <input type="range" id="rd-size" min="12" max="24" step="1" value="${settings.fontSize}" style="flex:1;accent-color:var(--cinnabar);">
        <span class="rd-slider-mark" style="font-size:20px;">A</span>
        <span class="rd-slider-value" id="rd-size-val">${settings.fontSize}px</span>
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-label">字体</div>
      <div class="rd-font-row" id="rd-font">
        ${FONT_OPTIONS.map(f => `
          <div class="rd-font ${settings.fontFamily === f.id ? "on" : ""}" data-font="${f.id}" style="font-family:${f.css};">${f.name}</div>
        `).join("")}
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-label">背景图（从绘卷选）</div>
      <div class="rd-bg-grid" id="rd-bg-grid">
        <div class="rd-bg-cell ${!settings.bgImageId ? "on" : ""}" data-img="">
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--ink-dim);">纯色</div>
        </div>
        ${allImages.map(img => {
          const url = URL.createObjectURL(img.thumb.data);
          return `<div class="rd-bg-cell ${settings.bgImageId === img.id ? "on" : ""}" data-img="${img.id}" style="background-image:url(${url});"></div>`;
        }).join("")}
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:24px;">
      <button class="btn ghost" id="rd-reset" style="flex:1;padding:12px;">重 置</button>
      <button class="btn" id="rd-ok" style="flex:1;padding:12px;">完 成</button>
    </div>
  `);

  /* ===== 背景色 ===== */
  modal.querySelectorAll("#rd-bg .rd-color").forEach(c => {
    c.onclick = () => {
      temp.bgColor = c.dataset.color;
      modal.querySelectorAll("#rd-bg .rd-color").forEach(x => x.classList.remove("on"));
      c.classList.add("on");
    };
  });

  /* ===== 文字色 ===== */
  modal.querySelectorAll("#rd-text .rd-color").forEach(c => {
    c.onclick = () => {
      temp.textColor = c.dataset.color;
      modal.querySelectorAll("#rd-text .rd-color").forEach(x => x.classList.remove("on"));
      c.classList.add("on");
    };
  });

  /* ===== 字号 ===== */
  const sizeInput = modal.querySelector("#rd-size");
  const sizeVal = modal.querySelector("#rd-size-val");
  sizeInput.oninput = () => {
    temp.fontSize = +sizeInput.value;
    sizeVal.textContent = temp.fontSize + "px";
  };

  /* ===== 字体 ===== */
  modal.querySelectorAll("#rd-font .rd-font").forEach(f => {
    f.onclick = () => {
      temp.fontFamily = f.dataset.font;
      modal.querySelectorAll("#rd-font .rd-font").forEach(x => x.classList.remove("on"));
      f.classList.add("on");
    };
  });

  /* ===== 背景图 ===== */
  modal.querySelectorAll("#rd-bg-grid .rd-bg-cell").forEach(c => {
    c.onclick = () => {
      temp.bgImageId = c.dataset.img || null;
      modal.querySelectorAll("#rd-bg-grid .rd-bg-cell").forEach(x => x.classList.remove("on"));
      c.classList.add("on");
    };
  });

  /* ===== 重置 ===== */
  modal.querySelector("#rd-reset").onclick = async () => {
    temp = { ...DEFAULT_READER_SETTINGS };
    await saveReaderSettings(temp);
    closeModal(modal);
    showToast("已重置");
    await onApply();
  };

  /* ===== 完成 ===== */
  modal.querySelector("#rd-ok").onclick = async () => {
    await saveReaderSettings(temp);
    closeModal(modal);
    showToast("已保存");
    await onApply();
  };
}

/* ============================================================
 * 工具
 * ============================================================ */

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}