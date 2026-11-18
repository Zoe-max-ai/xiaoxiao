import { db } from "../core/db.js";
import { showModal, closeModal } from "./modal.js";
import { getAllImages } from "../services/image-service.js";
/**
 * 打开图片选择器
 * @param {string} category 过滤特定分类（如 "illustration", "game_cover", "background"），传 "all" 则显示全部
 * @param {Function} onSelect 选择后的回调，会传出图片的 ID
 */
export async function openImagePicker(category = "all", onSelect) {
  const allImages = await getAllImages();
  const list = category === "all"
    ? allImages
    : allImages.filter(img => img.category === category);

  const modal = showModal(`
    <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">
      从 绘 卷 选 择
    </div>
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; max-height:50vh; overflow-y:auto; padding: 4px;">
      ${list.length ? list.map(img => `
        <div class="pick-item" data-id="${img.id}" style="
          aspect-ratio: 3/4; border-radius: 8px; overflow: hidden;
          border: 1px solid var(--line-light); cursor: pointer; background: var(--paper-soft);
          position: relative;
        ">
          <img class="pick-img" data-src="${img.id}" style="width:100%;height:100%;object-fit:cover;">
        </div>
      `).join("") : `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--ink-dim);">此分类暂无图片</div>`}
    </div>
    <button class="btn ghost" id="picker-cancel" style="width:100%;margin-top:16px;padding:12px;">取 消</button>
  `);
  modal.querySelector("#picker-cancel").onclick = () => closeModal(modal);

for (const img of list) {
  const imgEl = modal.querySelector(`.pick-img[data-src="${img.id}"]`);
  if (!imgEl) continue;

  // 1. 优先判断是不是本地路径（种子图）
  if (img.base64 && typeof img.base64 === "string" && img.base64.startsWith("assets/")) {
    imgEl.src = img.base64;
  } 
  // 2. 如果不是本地路径，再判断是不是用户上传的 Base64
  else if (img.base64 && typeof img.base64 === "string" && img.base64.startsWith("data:image/")) {
    imgEl.src = img.base64;
  } 
  // 3. 如果都没有，再用缩略图兜底（你昨天写的老逻辑）
  else if (img.thumb?.data && typeof img.thumb.data === "string" && img.thumb.data.startsWith("data:image/")) {
    imgEl.src = img.thumb.data;
  } 
  // 4. 实在没有，显示灰底
  else {
    imgEl.src = "";
    imgEl.style.background = "#f4f1ec";
  }
}

  modal.querySelectorAll(".pick-item").forEach(item => {
    item.onclick = () => {
      const id = item.dataset.id;
      closeModal(modal);
      if (onSelect) onSelect(id);
    };
  });
}
