import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { createPost, triggerCharacterInteractions } from "../services/post-service.js";

export async function tanmiPostsNewView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const user = state.currentUser;
  const name = user?.name || "我";
  const initial = name[0] || "我";

  el.innerHTML = `
    <div class="post-new-page">
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--paper-soft);display:flex;align-items:center;justify-content:center;font-family:var(--font-title);font-size:18px;color:var(--cinnabar);overflow:hidden;">
          ${user?.avatarId ? `<img src="${await getAvatarUrl(user.avatarId)}" style="width:100%;height:100%;object-fit:cover;">` : initial}
        </div>
        <div>
          <div style="font-family:var(--font-title);font-size:15px;color:var(--cinnabar);letter-spacing:2px;">@${escapeHtml(name)}</div>
          <div style="font-size:12px;color:var(--ink-dim);margin-top:2px;">以「我」的身份发帖</div>
        </div>
      </div>

      <div class="form-field">
        <label>标题</label>
        <input type="text" id="post-title" class="input" placeholder="想讨论的话题……" maxlength="50">
      </div>

      <div class="form-field">
        <label>正文</label>
        <textarea id="post-content" class="input" style="min-height:200px;resize:vertical;" placeholder="正文内容……" maxlength="2000"></textarea>
      </div>

      <div class="form-field" style="display:flex; align-items:center; gap:10px;">
        <div id="toggle-anon" class="sw-toggle" style="cursor:pointer;"></div>
        <span style="font-size:13px; color:var(--ink-dim);">匿名发帖（不暴露身份）</span>
      </div>



      <div class="post-new-actions">
        <button class="btn ghost" id="btn-cancel">取 消</button>
        <button class="btn" id="btn-publish">发 布</button>
      </div>
    </div>
  `;

  el.insertBefore(pageHeader("发 帖", "#/tanmi/posts"), el.firstChild);

  el.querySelector("#btn-cancel").onclick = () => { location.hash = "#/tanmi/posts"; };

  el.querySelector("#toggle-anon").onclick = function() {
    this.classList.toggle("on");
  };

  // 👈 确保元素存在再绑定
  const toggleAnonBtn = el.querySelector("#toggle-anon");
  if (toggleAnonBtn) {
    toggleAnonBtn.onclick = function() {
      this.classList.toggle("on");
    };
  }

  el.querySelector("#btn-publish").onclick = async () => {
    const title = el.querySelector("#post-title").value.trim();
    const content = el.querySelector("#post-content").value.trim();

    if (!title) { showToast("请填写标题"); return; }
    if (!content) { showToast("请填写正文"); return; }

    // 检查全坛隐私开关，或者手动勾选
    const isPrivacyOn = localStorage.getItem(`forum_privacy_${ownerId}`) === "true";
    const isManualAnon = toggleAnonBtn ? toggleAnonBtn.classList.contains("on") : false;

    const post = await createPost(ownerId, {
      authorId: ownerId,
      authorType: "user",
      title,
      content,
      isAnonymous: isPrivacyOn || isManualAnon, // 只要一个条件满足就匿名
    });

    showToast("已发布");
    triggerCharacterInteractions(ownerId, post.id);
    location.hash = "#/tanmi/posts";
  };

  return el; // 👈 放在最外层
}

async function getAvatarUrl(avatarId) {
  const { db } = await import("../core/db.js");
  const img = await db.get("images", avatarId);
  if (!img?.thumb?.data) return null;
  return URL.createObjectURL(img.thumb.data);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}