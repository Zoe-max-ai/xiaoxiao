import { createCharacter } from "../services/character-service.js";
import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { openAvatarCropper } from "../ui/avatar-cropper.js";
export async function yajiNewView() {
  const el = document.createElement("div");
  el.innerHTML = `
    <div style="display: flex; gap: 12px; margin: 20px 0;">
      <div style="flex: 1;">
        <div id="portrait-preview" style="
          aspect-ratio: 9/16;
          border: 1px dashed var(--line);
          border-radius: var(--radius);
          background: var(--paper-soft);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: var(--ink-dim);
          cursor: pointer;
          overflow: hidden;
        ">立绘 · 点击上传</div>
        <input type="file" id="portrait-input" accept="image/*" hidden>
      </div>
      <div style="width: 100px;">
        <div id="avatar-preview" style="
          width: 100px; height: 100px;
          border: 1px dashed var(--line);
          border-radius: 50%;
          background: var(--paper-soft);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: var(--ink-dim);
          cursor: pointer;
          overflow: hidden;
        ">头像</div>
        <input type="file" id="avatar-input" accept="image/*" hidden>
      </div>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">角色名（必填）</label>
      <input type="text" id="name-input" class="input" style="margin-top: 6px;">
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">昵称</label>
      <input type="text" id="nickname-input" class="input" style="margin-top: 6px;">
    </div>
    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <div style="flex: 1;">
        <label style="font-size: 13px; color: var(--ink-dim);">渡号</label>
        <input type="text" id="du-input" class="input" style="margin-top: 6px;" placeholder="如：霜渡">
      </div>
      <div style="flex: 1;">
        <label style="font-size: 13px; color: var(--ink-dim);">年龄</label>
        <input type="text" id="age-input" class="input" style="margin-top: 6px;">
      </div>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">渡言</label>
      <input type="text" id="dumotto-input" class="input" style="margin-top: 6px;" placeholder="如：金针裁善恶，风雪渡余生。">
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">小传</label>
      <textarea id="bio-input" class="input" style="margin-top: 6px; min-height: 100px; resize: vertical;"></textarea>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">轶事</label>
      <textarea id="anecdotes-input" class="input" style="margin-top: 6px; min-height: 100px; resize: vertical;" placeholder="写一些他/她的零散轶事，可分多段"></textarea>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">回忆（TA 对你的回忆）</label>
      <div id="memories-list" style="margin-top: 6px;"></div>
      <button class="btn ghost" id="btn-add-memory" style="width:100%;margin-top:8px;padding:10px;">+ 添加一条回忆</button>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim);">事实（TA 记得的事实）</label>
      <div id="facts-list" style="margin-top: 6px;"></div>
      <button class="btn ghost" id="btn-add-fact" style="width:100%;margin-top:8px;padding:10px;">+ 添加一条事实</button>
    </div>
    <button class="btn" id="btn-save" style="width: 100%;">保 存</button>
  `;
  el.insertBefore(pageHeader("结 识 新 友", "#/yaji"), el.firstChild);
  let portraitBlob = null;
  let avatarBlob = null;
  // 立绘上传（保持base64逻辑不变）
  const portraitPreview = el.querySelector("#portrait-preview");
  const portraitInput = el.querySelector("#portrait-input");
  portraitPreview.onclick = () => portraitInput.click();
  portraitInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawBase64 = ev.target.result;
      try {
        const { compressImage } = await import("../ui/image-cropper.js");
        const compressedBase64 = await compressImage(rawBase64, 1);
        portraitBlob = compressedBase64;
        portraitPreview.innerHTML = `<img src="${compressedBase64}" style="width:100%;height:100%;object-fit:cover">`;
      } catch (err) {
        console.error(err);
        showToast("图片处理失败");
      }
    };
    reader.readAsDataURL(file);
  };
  // 头像上传（Blob逻辑不变）
  const avatarPreview = el.querySelector("#avatar-preview");
  const avatarInput = el.querySelector("#avatar-input");
  avatarPreview.onclick = () => avatarInput.click();
  avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const cropped = await openAvatarCropper(file, 200);
    if (!cropped) return;
    avatarBlob = cropped;
    const url = URL.createObjectURL(cropped);
    avatarPreview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  // ========== 回忆 / 事实 列表编辑 ==========
  let memories = [];
  let facts = [];
  const memoriesList = el.querySelector("#memories-list");
  const factsList = el.querySelector("#facts-list");
  function makeUid() {
    return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function renderList(listEl, items) {
    listEl.innerHTML = "";
    if (items.length === 0) {
      listEl.innerHTML = `<div style="font-size:12px;color:var(--ink-dim);padding:8px 0;">暂无，点下方按钮添加。</div>`;
      return;
    }
    items.forEach((item, idx) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;";
      row.innerHTML = `
        <textarea class="input" style="flex:1;min-height:60px;resize:vertical">${escapeHtml(item.text || "")}</textarea>
        <button class="btn ghost" style="padding:8px 10px;color:var(--cinnabar);" title="删除">×</button>
      `;
      const ta = row.querySelector("textarea");
      const btn = row.querySelector("button");
      ta.oninput = () => { items[idx].text = ta.value; };
      btn.onclick = () => {
        items.splice(idx, 1);
        renderList(listEl, items);
      };
      listEl.appendChild(row);
    });
  }
  renderList(memoriesList, memories);
  renderList(factsList, facts);
  el.querySelector("#btn-add-memory").onclick = () => {
    memories.push({ id: makeUid(), text: "", source: "manual", createdAt: Date.now() });
    renderList(memoriesList, memories);
  };
  el.querySelector("#btn-add-fact").onclick = () => {
    facts.push({ id: makeUid(), text: "", source: "manual", createdAt: Date.now() });
    renderList(factsList, facts);
  };
  // ========== 保存 ==========
  el.querySelector("#btn-save").onclick = async () => {
    const name = el.querySelector("#name-input").value.trim();
    if (!name) { alert("请输入角色名"); return; }
    const ownerId = state.currentUserId;
    if (!ownerId) { alert("请先创建身份"); return; }
    let portraitId = null;
    if (portraitBlob) {
      portraitId = await saveToGallery(portraitBlob, "portrait");
    }
    let avatarId = null;
    if (avatarBlob) {
      avatarId = await saveToGallery(avatarBlob, "avatar");
    }
    try {
      await createCharacter(ownerId, {
        name,
        nickname: el.querySelector("#nickname-input").value.trim() || null,
        du: el.querySelector("#du-input").value.trim() || null,
        duMotto: el.querySelector("#dumotto-input").value.trim() || null,
        age: el.querySelector("#age-input").value.trim() || null,
        bio: el.querySelector("#bio-input").value.trim() || "",
        anecdotes: el.querySelector("#anecdotes-input").value.trim() || "",
        memories: memories.filter(m => m.text.trim() !== ""),
        facts: facts.filter(f => f.text.trim() !== ""),
        portraitId,
        avatarId,
      });
      location.hash = "#/yaji";
    } catch (e) {
      console.error("创建失败", e);
      alert("创建失败：" + e.message);
    }
  };
  return el;
}

// ========== 【修改后的兼容版】saveToGallery ==========
async function saveToGallery(data, category) {
  const { db } = await import("../core/db.js");
  const { uid } = await import("../core/uid.js");
  const id = uid("img");
  let img, blob, mime, size;

  if (typeof data === "string" && data.startsWith("data:image/")) {
    // 是 base64 立绘
    img = await loadImage(data);
    const res = await fetch(data);
    blob = await res.blob();
    mime = blob.type;
    size = blob.size;
  } else {
    // 是 Blob 头像
    blob = data;
    img = await loadImage(blob);
    mime = blob.type;
    size = blob.size;
  }

  const thumb = await generateThumb(img, 200, 300);
  await db.put("images", {
    id,
    ownerId: null,
    category,
    theme: null,
    tags: [],
    origin: {
      data: data, // 原样存：立绘存base64、头像存blob
      mime: mime,
      width: img.width,
      height: img.height,
      size: size,
    },
    thumb: {
      data: thumb,
      width: 200,
      height: 300,
      size: thumb.size,
    },
    createdAt: Date.now(),
  });
  return id;
}

// ========== 【修改后的兼容版】loadImage ==========
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof src === "string") {
      img.src = src; // base64直接赋值
    } else {
      img.src = URL.createObjectURL(src); // blob
    }
  });
}

function generateThumb(img, maxW, maxH) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/jpeg", 0.7);
  });
}
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}
