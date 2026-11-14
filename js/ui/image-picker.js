import { db } from "../core/db.js";
import { showModal, closeModal } from "./modal.js";

/**
 * 打开图片选择器
 * @param {string} category 过滤特定分类（如 "illustration", "game_cover", "background"），传 "all" 则显示全部
 * @param {Function} onSelect 选择后的回调，会传出图片的 ID
 */
export async function openImagePicker(category = "all", onSelect) {
  const allImages = await db.all("images");
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

  // 异步加载缩略图（防止大图卡顿）
  for (const img of list) {
    const imgEl = modal.querySelector(`.pick-img[data-src="${img.id}"]`);
    if (imgEl && img.thumb && img.thumb.data instanceof Blob) {
      imgEl.src = URL.createObjectURL(img.thumb.data);
    }
  }

  // 绑定选择事件
  modal.querySelectorAll(".pick-item").forEach(item => {
    item.onclick = () => {
      const id = item.dataset.id;
      closeModal(modal);
      if (onSelect) onSelect(id);
    };
  });
}