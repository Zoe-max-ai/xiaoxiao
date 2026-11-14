import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { createGame } from "../services/game-service.js";
import { openImagePicker } from "../ui/image-picker.js";

export async function wangshiGameNewView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  let coverImageId = null;

  el.innerHTML = `
    <div class="game-new-page">
      <div class="form-field">
        <label>标题（必填）</label>
        <input type="text" id="g-title" class="input" placeholder="给你的故事起个名字" maxlength="30">
      </div>

      <div class="form-field">
        <label>简介</label>
        <textarea id="g-desc" class="input" style="min-height:80px;resize:vertical;" placeholder="一句话介绍这个故事" maxlength="200"></textarea>
      </div>

      <div class="form-field">
        <label>封面（可选）</label>
        <div style="display:flex;gap:12px;align-items:center;">
          <div id="cover-preview" style="
            width:80px;height:100px;
            border:1px dashed var(--line-light);border-radius:6px;
            background:var(--paper-soft);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;color:var(--ink-dim);cursor:pointer;overflow:hidden;
          ">选择</div>
          <div style="font-size:12px;color:var(--ink-dim);">点击从绘卷选图</div>
        </div>
      </div>

      <div class="game-new-actions">
        <button class="btn ghost" id="btn-cancel">取 消</button>
        <button class="btn" id="btn-next">下 一 步</button>
      </div>
    </div>
  `;

  el.insertBefore(pageHeader("新 建 游 戏", "#/wangshi"), el.firstChild);

  // 封面选图
  el.querySelector("#cover-preview").onclick = async () => {
    const id = await openImagePicker();
    if (id) {
      coverImageId = id;
      const img = await db.get("images", id);
      if (img?.thumb?.data) {
        const url = URL.createObjectURL(img.thumb.data);
        el.querySelector("#cover-preview").innerHTML =
          `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    }
  };

  el.querySelector("#btn-cancel").onclick = () => {
    location.hash = "#/wangshi";
  };

  el.querySelector("#btn-next").onclick = async () => {
    const title = el.querySelector("#g-title").value.trim();
    if (!title) { showToast("请填写标题"); return; }

    const desc = el.querySelector("#g-desc").value.trim();

    const game = await createGame(ownerId, {
      title,
      description: desc,
      coverImageId,
      source: "manual",
    });

    location.hash = `#/wangshi/game/edit/${game.id}`;
  };

  el.querySelector("#cover-preview").onclick = async () => {
    // 调用公共组件，指定分类为 "game_cover"
    openImagePicker("game_cover", async (imgId) => {
      coverImageId = imgId;
      const img = await db.get("images", imgId);
      if (img?.thumb?.data) {
        const url = URL.createObjectURL(img.thumb.data);
        el.querySelector("#cover-preview").innerHTML =
          `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    });
  };

  return el;
}

