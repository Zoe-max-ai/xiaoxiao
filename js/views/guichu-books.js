import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { getImageUrl } from "../services/seed-service.js";
import {
  getAllBooks, ensureBook, getBookByCharacter, getBook,
  getCategoriesByBook, createCategory, updateCategory, deleteCategory,
  getChaptersByCategory, createChapter, updateChapter, deleteChapter,
  getFavoriteChapters, exportBook, importBook, toggleFavoriteChapter,
} from "../services/book-service.js";
import { showCropModal } from "../ui/image-cropper.js";
import { openImagePicker } from "../ui/image-picker.js";

/* ========== SVG 图标 ========== */
const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 L18 7 L8 17 L3 20 L6 15 Z"/><path d="M14 3 L18 7" opacity="0.5"/><path d="M3 20 L6 15" opacity="0.5"/></svg>`;

export async function guichuBooksView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  // 拿所有角色
  const chars = (await db.all("characters"))
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (!chars.length) {
    el.innerHTML = `<div class="empty-state">还没有角色。</div>`;
    return el;
  }

  let currentCharId = chars[0].id;
  let currentBook = null;
  let currentCategories = [];
  let currentCategoryId = null;
  let currentChapters = [];

  /* ===== HTML 框架 ===== */
  el.innerHTML = `
    <div class="books-topbar">
      <button class="books-back" id="btn-back">←</button>
      <div class="books-title">书 卷</div>
<div class="books-char-switch" id="char-switch">
  <span id="char-name">${escapeHtml(chars[0].name)}</span>
  <span class="books-switch-arrow">▾</span>
  <div class="books-char-dropdown" id="char-dropdown">
    ${chars.map(c => `
      <div class="books-char-option ${c.id === chars[0].id ? "on" : ""}" data-id="${c.id}">
        ${escapeHtml(c.name)}
      </div>
    `).join("")}
  </div>
</div>
      <button class="books-edit-btn" id="btn-edit" title="编辑">${ICON_EDIT}</button>
    </div>

    <div id="books-content"></div>
  `;

  const contentEl = el.querySelector("#books-content");

  /* ===== 顶栏事件 ===== */
  el.querySelector("#btn-back").onclick = () => { location.hash = "#/guichu"; };
const switchEl = el.querySelector("#char-switch");
const dropdownEl = el.querySelector("#char-dropdown");

switchEl.onclick = (e) => {
  e.stopPropagation();
  dropdownEl.classList.toggle("open");
};

// 点选项
dropdownEl.querySelectorAll(".books-char-option").forEach(opt => {
  opt.onclick = (e) => {
    e.stopPropagation();
    const charId = opt.dataset.id;
    if (charId === currentCharId) {
      dropdownEl.classList.remove("open");
      return;
    }
    currentCharId = charId;
    const c = chars.find(x => x.id === charId);
    el.querySelector("#char-name").textContent = c.name;
    dropdownEl.querySelectorAll(".books-char-option").forEach(o => {
      o.classList.toggle("on", o.dataset.id === charId);
    });
    dropdownEl.classList.remove("open");
    loadAndRender();
  };
});

// 点外部关闭
document.addEventListener("click", () => {
  dropdownEl.classList.remove("open");
});
  el.querySelector("#btn-edit").onclick = () => openEditMenu();



  /* ===== 加载 + 渲染 ===== */
  async function loadAndRender() {
    // 确保这本书存在（幂等）
    const char = chars.find(c => c.id === currentCharId);
    currentBook = await ensureBook(ownerId, currentCharId, char.name);

    currentCategories = await getCategoriesByBook(currentBook.id);
    if (!currentCategoryId || !currentCategories.find(c => c.id === currentCategoryId)) {
      currentCategoryId = currentCategories[0]?.id || null;
    }
    await loadChapters();
    renderContent();
  }

  async function loadChapters() {
    if (!currentCategoryId) {
      currentChapters = [];
      return;
    }
    const cat = currentCategories.find(c => c.id === currentCategoryId);
    if (cat?.isFavorite) {
      // 「收藏」分类：全站收藏的
      currentChapters = await getFavoriteChapters(ownerId);
    } else {
      currentChapters = await getChaptersByCategory(currentCategoryId);
    }
  }

  function renderContent() {
    const sections = [
      { id: "main", title: "主线", desc: "长风破浪，踏雪寻梅。主线剧情绘卷。", icon: "卷", key: "main" },
      { id: "activity", title: "活动", desc: "四时佳节，与君同游。限时活动记录。", icon: "庆", key: "activity" },
      { id: "fate", title: "因缘", desc: "红尘千丈，唯有一人。羁绊与因缘际会。", icon: "缘", key: "fate" },
      { id: "fav", title: "收藏", desc: "奇文共赏，疑义相析。珍藏的片段。", icon: "藏", key: "fav" }
    ];

    contentEl.innerHTML = `
      <div class="books-timeline">
        ${sections.map((sec, i) => {
          const isActive = currentCategories.find(c => c.id === currentCategoryId)?.name === sec.title;
          const isEven = i % 2 === 0;
          
          // 读取本地缓存的 Base64 图片
          const savedImgBase64 = localStorage.getItem(`book_img_${currentCharId}_${sec.key}`);

          return `
            <div class="timeline-item ${isEven ? 'item-left' : 'item-right'} ${isActive ? 'is-active' : ''}" data-name="${sec.title}">
              <div class="time-tag">
                <span class="tag-circle">${sec.icon}</span>
                <span class="tag-line"></span>
              </div>

              <div class="time-card">
                <h3 class="tc-title">${sec.title}</h3>
                <p class="tc-desc">${sec.desc}</p>
              </div>

              <!-- 图片容器 -->
              <div class="time-image" data-key="${sec.key}">
                ${savedImgBase64 
                  ? `<img src="${savedImgBase64}" style="width:100%; height:100%; object-fit:cover;">` 
                  : `<div class="img-placeholder"><span>点击从绘卷选择</span></div>`
                }
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    // 绑定卡片点击（打开抽屉）
    contentEl.querySelectorAll(".timeline-item").forEach(item => {
      item.onclick = async (e) => {
        // 如果点的是图片的区域，就不打开抽屉
        if (e.target.closest(".time-image")) return;

        const targetName = item.dataset.name;
        const targetCat = currentCategories.find(c => c.name === targetName);
        if (!targetCat) {
          showToast(`还没有「${targetName}」这个目录哦`);
          return;
        }
        
        currentCategoryId = targetCat.id;
        await loadChapters();
        openChapterDrawer(targetCat.name); 
      };
    });

    // 👈 绑定图片选择与裁剪事件
    contentEl.querySelectorAll(".time-image").forEach(imgWrap => {
      imgWrap.onclick = (e) => {
        e.stopPropagation(); // 阻止触发外层卡片点击
        
        openImagePicker("illustration", async (imgId) => {
          const img = await db.get("images", imgId);
          if (img && img.origin && img.origin.data instanceof Blob) {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
              const base64Url = event.target.result;
              
              // 调起裁剪框
              const { showCropModal } = await import("../ui/image-cropper.js");
              
              showCropModal(base64Url, (croppedBase64) => {
                // 显示裁剪后的图
                imgWrap.innerHTML = `<img src="${croppedBase64}" style="width:100%; height:100%; object-fit:cover;">`;
                imgWrap.dataset.imgid = imgId; 
                showToast("插图已裁剪并更新");
                
                // 存进 localStorage
                const storageKey = `book_img_${currentCharId}_${imgWrap.dataset.key}`;
                localStorage.setItem(storageKey, croppedBase64); 
              });
            };
            reader.readAsDataURL(img.origin.data);
          }
        });
      };
    });
  }
   

  // 底部滑出的剧情抽屉
  function openChapterDrawer(categoryName) {
    // 阻止重复打开
    let drawer = document.querySelector(".books-drawer");
    if (drawer) drawer.remove();

    drawer = document.createElement("div");
    drawer.className = "books-drawer";
    
    // 渲染章节列表
    let listHtml = "";
    if (!currentChapters.length) {
      listHtml = `<div class="empty-state" style="padding:40px;text-align:center;color:var(--ink-dim);">此卷宗暂无记录</div>`;
    } else {
      listHtml = currentChapters.map(ch => `
        <div class="drawer-item" data-id="${ch.id}">
          <div class="d-title">${escapeHtml(ch.title)}</div>
          <div class="d-meta">${ch.wordCount || 0} 字</div>
        </div>
      `).join("");
    }

    drawer.innerHTML = `
      <div class="drawer-mask"></div>
      <div class="drawer-panel">
        <div class="drawer-handle"></div>
        <div class="drawer-header">
          <span>${escapeHtml(categoryName)} · 章节目录</span>
          <span class="drawer-close">×</span>
        </div>
        <div class="drawer-list">
          ${listHtml}
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

    // 动画滑出
    requestAnimationFrame(() => drawer.classList.add("show"));

    // 关闭事件
    const closeDrawer = () => {
      drawer.classList.remove("show");
      setTimeout(() => drawer.remove(), 300);
    };

    drawer.querySelector(".drawer-mask").onclick = closeDrawer;
    drawer.querySelector(".drawer-close").onclick = closeDrawer;

    // 点击章节 -> 去阅读
    drawer.querySelectorAll(".drawer-item").forEach(item => {
      item.onclick = () => {
        location.hash = `#/guichu/books/read/${item.dataset.id}`;
      };
    });
  }



function renderFolds() {
  const wrap = contentEl.querySelector("#fold-wrap");
  if (!currentChapters.length) {
    wrap.classList.add("is-empty");
    wrap.innerHTML = `<div class="fold-empty">此分类下还没有剧情。</div>`;
    return;
  }
  wrap.classList.remove("is-empty");

  wrap.innerHTML = `
    <div class="bookmark-scroll">
      ${currentChapters.map((ch, i) => {
        // 错落：根据索引算偏移
        const offsets = [0, 20, 8, 28, 12, 24, 4, 18];
        const offset = offsets[i % offsets.length];
        // 高矮：根据索引算高度
        const heights = [240, 220, 260, 210, 250, 230, 245, 225];
        const height = heights[i % heights.length];

const plums = ["deco-plum-01.png", "deco-plum-02.png"];
const plum = plums[i % plums.length];
const meiSide = i % 2 === 0 ? "left" : "right";   // ← 奇偶决定位置

return `
  <div class="bookmark" data-id="${ch.id}" style="margin-top: ${offset}px; height: ${height}px;">
    <div class="bm-mei bm-mei-${meiSide}">
      <img src="assets/seed/deco/${plum}" alt="">
    </div>
            <div class="bm-title">${splitVertical(ch.title)}</div>
            <div class="bm-count">${ch.wordCount || 0}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  wrap.querySelectorAll(".bookmark").forEach(item => {
    item.onclick = () => {
      location.hash = `#/guichu/books/read/${item.dataset.id}`;
    };
  });
}



  /* ===== 编辑菜单 ===== */
  async function openEditMenu() {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const modal = showModal(`
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="edit-item" data-act="cat">目录管理</button>
        <button class="edit-item" data-act="chp">剧情管理</button>
        <button class="edit-item" data-act="exp">导出当前书卷</button>
        <button class="edit-item" data-act="imp">导入书卷</button>
      </div>
      <style>
        .edit-item {
          padding:14px;
          background:var(--paper-soft);
          border:1px solid var(--line-light);
          border-radius:var(--radius-sm);
          font-family:var(--font-title);font-size:14px;letter-spacing:2px;
          color:var(--ink);cursor:pointer;text-align:center;
        }
      </style>
    `);

    modal.querySelector("[data-act='cat']").onclick = () => { closeModal(modal); openCategoryManager(); };
    modal.querySelector("[data-act='chp']").onclick = () => { closeModal(modal); openChapterManager(); };
    modal.querySelector("[data-act='exp']").onclick = () => { closeModal(modal); doExport(); };
    modal.querySelector("[data-act='imp']").onclick = () => { closeModal(modal); doImport(); };
  }

  /* ===== 目录管理 ===== */
  async function openCategoryManager() {
    const { showModal, closeModal } = await import("../ui/modal.js");

    const render = () => {
      const modal = showModal(`
        <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
          目 录 管 理
        </div>
        <div id="cat-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        <button class="btn ghost" id="cat-add" style="width:100%;padding:12px;margin-top:12px;">＋ 新建目录</button>
        <button class="btn ghost" id="cat-close" style="width:100%;padding:12px;margin-top:8px;">收 起</button>
      `);

      const listEl = modal.querySelector("#cat-list");
      listEl.innerHTML = currentCategories.map(cat => `
        <div class="cat-row" data-id="${cat.id}" style="
          display:flex;align-items:center;gap:8px;padding:10px 12px;
          background:var(--paper-soft);border:1px solid var(--line-light);
          border-radius:var(--radius-sm);
        ">
          <input type="text" class="input cat-name" value="${escapeHtml(cat.name)}" ${cat.isDefault ? "readonly" : ""} style="flex:1;">
          ${cat.isDefault ? `<span style="font-size:11px;color:var(--ink-dim);">默认</span>` : `
            <button class="btn ghost cat-del" style="padding:6px 10px;color:var(--cinnabar);">×</button>
          `}
        </div>
      `).join("");

      listEl.querySelectorAll(".cat-row").forEach(row => {
        const id = row.dataset.id;
        const input = row.querySelector(".cat-name");
        if (!input.readOnly) {
          input.onblur = async () => {
            await updateCategory(id, { name: input.value.trim() || "未命名" });
          };
        }
        const delBtn = row.querySelector(".cat-del");
        if (delBtn) {
          delBtn.onclick = async () => {
            const ok = await showConfirm("删除目录", "目录下的所有剧情也会一起删除。确定？");
            if (!ok) return;
            await deleteCategory(id);
            showToast("已删除");
            closeModal(modal);
            await loadAndRender();
          };
        }
      });

modal.querySelector("#cat-add").onclick = async () => {
  closeModal(modal);
  openNewCategoryModal();
};

      modal.querySelector("#cat-close").onclick = () => closeModal(modal);
    };

    render();
  }

async function openNewCategoryModal() {
  const { showModal, closeModal } = await import("../ui/modal.js");

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
      新 建 目 录
    </div>
    <div class="form-field">
      <label>目录名称</label>
      <input type="text" id="new-cat-name" class="input" placeholder="如：逸闻 / 主线 / 思念" maxlength="10" autofocus>
    </div>
    <div style="display:flex;gap:12px;margin-top:20px;">
      <button class="btn ghost" id="new-cat-cancel" style="flex:1;padding:12px;">取 消</button>
      <button class="btn" id="new-cat-ok" style="flex:1;padding:12px;">确 定</button>
    </div>
  `);

  const input = modal.querySelector("#new-cat-name");
  setTimeout(() => input.focus(), 100);

  const submit = async () => {
    const name = input.value.trim();
    if (!name) {
      showToast("请输入名称");
      return;
    }
    await createCategory(currentBook.id, name, false);
    closeModal(modal);
    showToast("已创建");
    currentCategories = await getCategoriesByBook(currentBook.id);
    renderContent();
    openCategoryManager();
  };

  modal.querySelector("#new-cat-ok").onclick = submit;
  modal.querySelector("#new-cat-cancel").onclick = () => {
    closeModal(modal);
    openCategoryManager();
  };

  // 回车提交
  input.onkeydown = (e) => {
    if (e.key === "Enter") submit();
  };
}

  /* ===== 剧情管理 ===== */
  async function openChapterManager() {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const cat = currentCategories.find(c => c.id === currentCategoryId);

    const render = async () => {
      const chapters = cat?.isFavorite
        ? await getFavoriteChapters(ownerId)
        : await getChaptersByCategory(currentCategoryId);

      const modal = showModal(`
        <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
          剧 情 管 理
        </div>
        <div style="font-size:12px;color:var(--ink-dim);margin-bottom:12px;">当前目录：${escapeHtml(cat?.name || "")}</div>
        <div id="chp-list" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;"></div>
        ${!cat?.isFavorite ? `
          <button class="btn ghost" id="chp-add" style="width:100%;padding:12px;margin-top:12px;">＋ 新建剧情</button>
        ` : ""}
        <button class="btn ghost" id="chp-close" style="width:100%;padding:12px;margin-top:8px;">收 起</button>
      `);

      const listEl = modal.querySelector("#chp-list");
      listEl.innerHTML = chapters.map(ch => `
        <div class="chp-row" data-id="${ch.id}" style="
          display:flex;align-items:center;gap:8px;padding:10px 12px;
          background:var(--paper-soft);border:1px solid var(--line-light);
          border-radius:var(--radius-sm);
        ">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ch.title)}</div>
            <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${ch.wordCount || 0} 字</div>
          </div>
          <button class="btn ghost chp-edit" style="padding:6px 8px;font-size:12px;">编辑</button>
          <button class="btn ghost chp-del" style="padding:6px 10px;color:var(--cinnabar);">×</button>
        </div>
      `).join("") || `<div class="empty-state" style="padding:20px;">暂无剧情。</div>`;

      listEl.querySelectorAll(".chp-row").forEach(row => {
        const id = row.dataset.id;
        row.querySelector(".chp-edit").onclick = () => {
          closeModal(modal);
          location.hash = `#/guichu/books/edit/${id}`;
        };
        row.querySelector(".chp-del").onclick = async () => {
          const ok = await showConfirm("删除剧情", "确定删除？");
          if (!ok) return;
          await deleteChapter(id);
          showToast("已删除");
          closeModal(modal);
          await loadChapters();
          renderContent();
        };
      });

      const addBtn = modal.querySelector("#chp-add");
      if (addBtn) {
        addBtn.onclick = () => {
          closeModal(modal);
          location.hash = `#/guichu/books/new/${currentCategoryId}`;
        };
      }

      modal.querySelector("#chp-close").onclick = () => closeModal(modal);
    };

    await render();
  }

  /* ===== 导出 ===== */
  async function doExport() {
    const data = await exportBook(currentBook.id);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `book_${currentBook.name}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("已导出");
  }

  /* ===== 导入 ===== */
  function doImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importBook(ownerId, data);
        showToast("已导入");
        await loadAndRender();
      } catch (err) {
        console.error(err);
        showToast("导入失败");
      }
    };
    input.click();
  }

  /* ===== 首次加载 ===== */
  await loadAndRender();

  return el;
}

/* ============================================================
 * 工具
 * ============================================================ */

/** 竖排文字 */
function splitVertical(str) {
  return String(str).split("").map(c => `<span>${escapeHtml(c)}</span>`).join("");
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}