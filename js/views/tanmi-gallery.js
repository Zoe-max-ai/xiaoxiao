import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { db } from "../core/db.js";
import {
  getAllImages, uploadImage, renameImage, deleteImage, isImageReferenced,
} from "../services/image-service.js";
import { updateOverrides, getOverrides } from "../theme/theme-runtime.js";

const CATEGORIES = [
  { id: "all",        name: "全部" },
  { id: "background", name: "背景" },
  { id: "avatar",     name: "头像" },
  { id: "portrait",   name: "立绘" },
  { id: "game_cover", name: "文游封面" }, 
  { id: "deco",       name: "装饰" },
  { id: "frame",      name: "头像框" },
  { id: "illustration", name: "插画" },
{ id: "qavatar", name: "Q版小人" },
];

export async function guichuGalleryView() {
  const el = document.createElement("div");
  let currentCat = "all";
  let allImages = [];

  el.innerHTML = `
    <div id="gallery-wrap"></div>
  `;
  el.insertBefore(pageHeader("绘 卷", "#/tanmi"), el.firstChild);

  const wrap = el.querySelector("#gallery-wrap");

  async function render() {
    allImages = await getAllImages();

    const list = currentCat === "all"
      ? allImages
      : allImages.filter(img => img.category === currentCat);

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:12px;color:var(--ink-dim);">共 ${list.length} 张</div>
        <button class="btn" id="btn-upload" style="padding:8px 18px;letter-spacing:3px;font-size:13px;">＋ 上传</button>
      </div>

      <div id="cat-tabs" style="display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;margin-bottom:16px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">
        ${CATEGORIES.map(c => `
          <div class="chip ${currentCat === c.id ? "on" : ""}" data-cat="${c.id}" style="white-space:nowrap;flex-shrink:0;padding:6px 14px;border-radius:16px;font-size:13px;background:${currentCat === c.id ? 'var(--cinnabar)' : 'var(--paper-soft)'};color:${currentCat === c.id ? '#fff' : 'var(--ink)'};cursor:pointer;transition:all 0.2s;">${c.name}</div>

        `).join("")}
      </div>

      <div id="img-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(100px, 1fr));gap:10px;"></div>
    `;

    // 分类切换
    wrap.querySelectorAll(".chip").forEach(chip => {
      chip.onclick = () => {
        currentCat = chip.dataset.cat;
        render();
      };
    });

    // 上传
    wrap.querySelector("#btn-upload").onclick = () => openUploadModal();

    // 图片网格
    const grid = wrap.querySelector("#img-grid");
    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-dim);font-size:13px;">暂无图片</div>`;
      return;
    }

    for (const img of list) {
      const cell = await renderCell(img);
      grid.appendChild(cell);
    }
  }

  async function renderCell(img) {
    const cell = document.createElement("div");
    cell.style.cssText = `
      position: relative;
      aspect-ratio: 3/4;
      border-radius: 8px;
      overflow: hidden;
      background: var(--paper-soft);
      cursor: pointer;
      border: 1px solid var(--line-light);
    `;

    if (img.thumb?.data instanceof Blob) {
      const url = URL.createObjectURL(img.thumb.data);
      cell.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      cell.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--ink-dim);font-size:11px;">无图</div>`;
    }

    // 名称标签
    const label = document.createElement("div");
    label.style.cssText = `
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 4px 6px;
      background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
      color: #fff; font-size: 10px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;
    label.textContent = img.name || "未命名";
    cell.appendChild(label);

    // 种子标记
    if (img.isSeed) {
      const badge = document.createElement("div");
      badge.style.cssText = `
        position: absolute; top: 4px; right: 4px;
        padding: 1px 5px;
        background: rgba(0,0,0,0.5);
        color: #fff; font-size: 9px;
        border-radius: 3px;
      `;
      badge.textContent = "种子";
      cell.appendChild(badge);
    }

    cell.onclick = () => openActions(img);
    return cell;
  }

  /* ========== 上传弹窗 ========== */
  async function openUploadModal() {
    const { showModal, closeModal } = await import("../ui/modal.js");

    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
        上 传 图 片
      </div>

      <div class="form-field">
        <label>选择图片</label>
        <input type="file" id="up-file" accept="image/*" class="input" style="padding:10px;" multiple>
      </div>

      <div class="form-field">
        <label>分类</label>
        <select id="up-cat" class="input">
          <option value="background">背景</option>
          <option value="avatar">头像</option>
          <option value="portrait">立绘</option>
          <option value="game_cover">文游封面</option> <!-- 👈 顺便把之前的中划线也统一成下划线了 -->
          <option value="deco">装饰</option>
          <option value="frame">头像框</option>
          <option value="illustration">插画</option> 
          <option value="qavatar">Q版小人</option>
        </select>
      </div>

      <div class="form-field">
        <label>名称</label>
        <input type="text" id="up-name" class="input" placeholder="留空则用文件名" maxlength="30">
      </div>

      <div style="display:flex;gap:12px;margin-top:16px;">
        <button class="btn ghost" id="up-cancel" style="flex:1;padding:12px;">取 消</button>
        <button class="btn" id="up-confirm" style="flex:1;padding:12px;">上 传</button>
      </div>
    `);

    modal.querySelector("#up-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#up-confirm").onclick = async () => {
      const fileInput = modal.querySelector("#up-file");
      const files = fileInput.files;
      if (!files.length) { showToast("请选择图片"); return; }

      const category = modal.querySelector("#up-cat").value;
      const baseName = modal.querySelector("#up-name").value.trim();

      showToast(`正在处理 ${files.length} 张图片…`);
      const { compressImage } = await import("../ui/image-cropper.js");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = baseName 
          ? (files.length > 1 ? `${baseName}_${i + 1}` : baseName) 
          : file.name.replace(/\.[^.]+$/, "");

        try {
          // 1. 读取文件为 Base64
          const rawBase64 = await new Promise((resolve) => {
            const r = new FileReader();
            r.onload = (e) => resolve(e.target.result);
            r.readAsDataURL(file);
          });

          // 2. 居中裁剪成标准比例并压缩
          const croppedAndCompressed = await autoCropAndCompress(rawBase64, 600, 800, 0.8);

          // 3. 转成 Blob
          const res = await fetch(croppedAndCompressed);
          const blob = await res.blob();

          // 4. 存入数据库
          await uploadImage({ blob, category, name });
        } catch (err) {
          console.error(`处理第 ${i + 1} 张图失败:`, err);
        }
      }

      closeModal(modal);
      showToast("全部上传完成");
      await render();
    };
      }

  /* ========== 图片操作菜单 ========== */
  async function openActions(img) {
    const { showModal, closeModal } = await import("../ui/modal.js");

    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
        ${escapeHtml(img.name)}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="menu-item" data-act="rename">重 命 名</button>
        ${img.category === "background" ? `
          <button class="menu-item" data-act="bg-chenshi">应用为尘世背景</button>
          <button class="menu-item" data-act="bg-chat">应用为聊天背景</button>
        ` : ""}
        ${!img.isSeed ? `<button class="menu-item danger" data-act="del">删 除</button>` : ""}
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
        .menu-item.danger { color: var(--cinnabar); }
      </style>
    `);

    modal.querySelector("[data-act='rename']").onclick = async () => {
      closeModal(modal);
      const newName = prompt("新名称：", img.name);
      if (newName === null) return;
      await renameImage(img.id, newName);
      showToast("已重命名");
      render();
    };

    ["bg-chenshi", "bg-chat"].forEach(act => {
      const btn = modal.querySelector(`[data-act='${act}']`);
      if (!btn) return;
      btn.onclick = async () => {
        const key = act === "bg-chenshi" ? "bgChenshi" : "bgChat";
        await updateOverrides({ [key]: img.id });
        closeModal(modal);
        showToast("已应用");
      };
    });

    const delBtn = modal.querySelector("[data-act='del']");
    if (delBtn) {
      delBtn.onclick = async () => {
        closeModal(modal);
        const referenced = await isImageReferenced(img.id);
        if (referenced) {
          showToast("该图正被使用，无法删除");
          return;
        }
        const ok = await showConfirm("删除图片", `确定删除「${img.name}」？`);
        if (!ok) return;
        await deleteImage(img.id);
        showToast("已删除");
        render();
      };
    }
  }

  await render();
  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

function autoCropAndCompress(base64, maxWidth, maxHeight, quality = 0.9) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;

      if (w > maxWidth || h > maxHeight) {
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        w = w * ratio;
        h = h * ratio;
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      
      // 👈 注释掉或删掉这一行！千万别填白底！
      // ctx.fillStyle = "#ffffff";
      // ctx.fillRect(0, 0, w, h);
      
      ctx.drawImage(img, 0, 0, w, h);

      // 👈 核心：改成 image/png，PNG 支持透明！
      resolve(canvas.toDataURL("image/png"));
    };
  });
}