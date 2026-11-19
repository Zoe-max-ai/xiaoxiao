import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import {
  getUserProfile, updateUserProfile,
  updateUserAvatar,
  getAvatarUrl,
} from "../services/user-service.js";
import { db } from "../core/db.js";
import { openAvatarCropper } from "../ui/avatar-cropper.js";

export async function guichuProfileView() {
  const el = document.createElement("div");
  const userId = state.currentUserId;

  if (!userId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const user = await getUserProfile(userId);
  if (!user) {
    el.innerHTML = `<div class="empty-state">档案不存在。</div>`;
    return el;
  }

  const avatarUrl = await getAvatarUrl(user.avatarId);

  // 临时状态（编辑中）
  let tempAvatarBlob = null;

  el.innerHTML = `
<div style="text-align: center; margin-bottom: 24px;">
  <!-- 外层容器 -->
  <div style="position: relative; width: 140px; height: 140px; margin: 0 auto;">
    
    <!-- 1. 底层头像：强行把原本自带的边框和背景色全干掉！ -->
    <div id="avatar-preview" style="
      position: absolute; inset: 12px; /* 👈 往里缩一点，让水墨框显得更大气 */
      border: none !important;        /* 👈 强行去掉黑圈 */
      box-shadow: none !important;    /* 👈 强行去掉黑圈 */
      background: transparent !important;
      border-radius: 50%; overflow: hidden;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: var(--ink-dim);
    ">
      ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` : "+ 头像"}
    </div>

    <!-- 2. 顶层头像框：只有水墨框 -->
    <div style="
      position: absolute; inset: 0; 
      background-image: var(--theme-avatar-frame);
      background-size: contain; background-position: center; background-repeat: no-repeat;
      pointer-events: none; z-index: 2;
    "></div>
  </div>
  <input type="file" id="avatar-input" accept="image/*" hidden>
</div>

    <div class="form-field">
      <label>姓名（必填）</label>
      <input type="text" id="name-input" class="input" value="${escapeHtml(user.name || "")}">
    </div>

    <div class="form-field">
      <label>昵称</label>
      <input type="text" id="nickname-input" class="input" value="${escapeHtml(user.nickname || "")}" placeholder="亲近的人怎么叫你">
    </div>

    <div class="form-field" style="display: flex; gap: 12px;">
      <div style="flex: 1;">
        <label>性别</label>
        <select id="gender-input" class="input">
          <option value="">未填</option>
          <option value="男" ${user.gender === "男" ? "selected" : ""}>男</option>
          <option value="女" ${user.gender === "女" ? "selected" : ""}>女</option>
        </select>
      </div>
      <div style="flex: 1;">
        <label>年龄</label>
        <input type="text" id="age-input" class="input" value="${escapeHtml(user.age || "")}">
      </div>
    </div>

    <div class="form-field">
      <label>生日</label>
      <input type="text" id="birthday-input" class="input" value="${escapeHtml(user.birthday || "")}" placeholder="如：9.25">
    </div>

    <div class="form-field">
      <label>身份（渡客）</label>
      <input type="text" id="du-input" class="input" value="${escapeHtml(user.du || "渡客")}">
    </div>

    <div class="form-field">
      <label>渡言</label>
      <input type="text" id="du-motto-input" class="input" value="${escapeHtml(user.duMotto || "")}" placeholder="山河风雨皆过客，唯此风渡是归程。">
    </div>

    <div class="form-field">
      <label>性格标签（逗号分隔）</label>
      <input type="text" id="tags-input" class="input" value="${(user.tags || []).join(",")}" placeholder="如：天真,正直,重情">
    </div>

    <div class="form-field">
      <label>喜好（逗号分隔）</label>
      <input type="text" id="likes-input" class="input" value="${(user.likes || []).join(",")}" placeholder="如：甜食,葡萄,酒">
    </div>

    <div class="form-field">
      <label>厌恶（逗号分隔）</label>
      <input type="text" id="dislikes-input" class="input" value="${(user.dislikes || []).join(",")}">
    </div>

    <div class="form-field">
      <label>外貌</label>
      <textarea id="appearance-input" class="input" style="min-height: 80px; resize: vertical;">${escapeHtml(user.appearance?.text || "")}</textarea>
    </div>

    <div class="form-field">
      <label>小传 / 经历</label>
      <textarea id="bio-input" class="input" style="min-height: 120px; resize: vertical;">${escapeHtml(user.bio || "")}</textarea>
    </div>

    <button class="btn" id="btn-save" style="width: 100%; padding: 14px; font-size: 15px; letter-spacing: 6px; margin-top: 20px;">
      保 存
    </button>
  `;

  el.insertBefore(pageHeader("我 的 档 案", "#/guichu"), el.firstChild);


  // 头像上传
  const avatarPreview = el.querySelector("#avatar-preview");
  const avatarInput = el.querySelector("#avatar-input");
  avatarPreview.onclick = () => avatarInput.click();
avatarInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const cropped = await openAvatarCropper(file, 200);
  if (!cropped) return;

  // 预览依旧用 blob url，不影响实时预览体验
  const url = URL.createObjectURL(cropped);
  avatarPreview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;

  // blob 转 base64，存字符串用于入库持久化
  const reader = new FileReader();
  reader.readAsDataURL(cropped);
  reader.onload = () => {
    let b64 = reader.result;
    b64 = b64.replace(/\s/g, ""); // 清除换行空格，安卓兼容
    tempAvatarBlob = b64; // 现在这个变量存的是base64字符串，不再是Blob
  };
};


  // 保存
  el.querySelector("#btn-save").onclick = async () => {
    const name = el.querySelector("#name-input").value.trim();
    if (!name) {
      showToast("请输入姓名");
      return;
    }

    // 上传头像
    if (tempAvatarBlob) {
      await updateUserAvatar(userId, tempAvatarBlob);
    }


    // 保存其他字段
    await updateUserProfile(userId, {
      name,
      nickname: el.querySelector("#nickname-input").value.trim() || null,
      gender: el.querySelector("#gender-input").value || null,
      age: el.querySelector("#age-input").value.trim() || null,
      birthday: el.querySelector("#birthday-input").value.trim() || null,
      du: el.querySelector("#du-input").value.trim() || "渡客",
      duMotto: el.querySelector("#du-motto-input").value.trim() || null,
      tags: parseList(el.querySelector("#tags-input").value),
      likes: parseList(el.querySelector("#likes-input").value),
      dislikes: parseList(el.querySelector("#dislikes-input").value),
      appearance: { text: el.querySelector("#appearance-input").value.trim() },
      bio: el.querySelector("#bio-input").value.trim() || "",
    });

    // 更新全局状态 + 顶栏
    const updated = await getUserProfile(userId);
    state.currentUser = updated;
    document.getElementById("user-name").textContent = updated.name;

    // 更新顶栏头像
    if (updated.avatarId) {
      const url = await getAvatarUrl(updated.avatarId);
      if (url) document.getElementById("user-avatar").src = url;
    }

    showToast("已保存");
  };

  return el;
}

function parseList(str) {
  return str.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}