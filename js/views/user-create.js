import { db, STORES } from "../core/db.js";
import { uid } from "../core/uid.js";
import { setCurrentUser } from "../core/state.js";
import { initPresetWorldbook } from "../data/preset-worldbook.js";

export async function userCreateView() {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="section-title">创 建 身 份</div>

    <div style="text-align: center; margin: 20px 0;">
      <div id="avatar-preview" style="
        width: 100px; height: 100px; border-radius: 50%;
        background: var(--paper-soft);
        border: 1px dashed var(--line);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 12px;
        font-size: 12px; color: var(--ink-dim);
        cursor: pointer;
      ">+ 头像</div>
      <input type="file" id="avatar-input" accept="image/*" hidden>
    </div>

    <div style="margin-bottom: 16px;">
      <label style="font-size: 13px; color: var(--ink-dim); letter-spacing: 2px;">姓名（必填）</label>
      <input type="text" id="name-input" class="input" placeholder="如：风栖" style="margin-top: 8px;">
    </div>

    <div style="margin-bottom: 24px;">
      <label style="font-size: 13px; color: var(--ink-dim); letter-spacing: 2px;">昵称（可选）</label>
      <input type="text" id="nickname-input" class="input" placeholder="如：小柒" style="margin-top: 8px;">
    </div>

    <div style="margin-bottom: 24px; padding: 16px; background: var(--paper); border-radius: var(--radius); border: 1px solid var(--line-light);">
      <div style="font-size: 13px; color: var(--ink-dim); letter-spacing: 2px; margin-bottom: 8px;">身份</div>
      <div style="font-size: 16px; color: var(--cinnabar); letter-spacing: 4px; margin-bottom: 4px;">渡客</div>
      <div style="font-size: 12px; color: var(--ink-dim); letter-spacing: 1px;">山河风雨皆过客，唯此风渡是归程。</div>
    </div>

    <button class="btn" id="btn-submit" style="width: 100%; padding: 14px; font-size: 15px; letter-spacing: 6px;">入 渡</button>
  `;

  let avatarBlob = null;
  const avatarPreview = el.querySelector("#avatar-preview");
  const avatarInput = el.querySelector("#avatar-input");
  avatarPreview.onclick = () => avatarInput.click();
  avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // 和档案页一致，调用裁剪
    const { openAvatarCropper } = await import("../ui/avatar-cropper.js");
    const cropped = await openAvatarCropper(file, 200);
    if (!cropped) return;

    const url = URL.createObjectURL(cropped);
    avatarPreview.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;

    const reader = new FileReader();
    reader.readAsDataURL(cropped);
    reader.onload = () => {
      let b64 = reader.result;
      b64 = b64.replace(/\s/g, "");
      avatarBlob = b64;
    };
  };


  el.querySelector("#btn-submit").onclick = async () => {
    const name = el.querySelector("#name-input").value.trim();
    if (!name) {
      alert("请输入姓名");
      return;
    }
    const nickname = el.querySelector("#nickname-input").value.trim() || name;

    const userId = uid("user");

    // 1. 如果有头像，存入图库（images 表）
    let avatarId = null;
    if (avatarBlob) {
      avatarId = await saveAvatarToGallery(avatarBlob);
    }

    // 2. 创建用户
    const user = {
      id: userId,
      name,
      nickname,
      avatarId,       // 引用图库里的头像 ID
      du: "渡客",
      duMotto: "山河风雨皆过客，唯此风渡是归程。",
      createdAt: Date.now(),
    };

    await db.put("users", user);
    await db.put("settings", { key: "init", userId, initialized: true });
setCurrentUser(user);

// 导入预设角色
const { importPresetCharacters } = await import("../services/character-service.js");
await importPresetCharacters(userId);

    // 3. 更新状态
    setCurrentUser(user);

    // 4. 更新顶栏
    document.getElementById("user-name").textContent = user.name;
    if (avatarId) {
      const url = await getAvatarUrl(avatarId);
      document.getElementById("user-avatar").src = url;
    }

// 👈 用户创建成功，立刻把内置世界书塞给他
await initPresetWorldbook(db, user.id);
    // 5. 跳转
    location.hash = "#/chenshi";
  };

  return el;
}

/* ========== 辅助函数（base64版本，和user-service统一） ========== */
async function saveAvatarToGallery(base64Str) {
  const id = uid("img");
  const img = await loadImage(base64Str);
  const thumbB64 = await generateThumbB64(img, 200, 200);
  await db.put("images", {
    id,
    ownerId: null,
    category: "avatar",
    theme: null,
    tags: ["用户头像"],
    origin: {
      data: base64Str,
      mime: getMimeFromB64(base64Str),
      width: img.width,
      height: img.height,
    },
    thumb: {
      data: thumbB64,
      width: 200,
      height: 200,
    },
    createdAt: Date.now(),
  });
  return id;
}
async function getAvatarUrl(avatarId) {
  const img = await db.get("images", avatarId);
  if (!img?.thumb?.data) return null;
  return img.thumb.data.replace(/\s/g, "");
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function generateThumbB64(img, maxW, maxH) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.9);
    resolve(b64.replace(/\s/g, ""));
  });
}
function getMimeFromB64(b64) {
  const m = b64.match(/data:(.*?);/);
  return m ? m[1] : "image/jpeg";
}
