// js/ui/image-cropper.js

export function showCropModal(imageSrc, onConfirm) {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 20px; backdrop-filter: blur(4px);
  `;

  modal.innerHTML = `
    <div style="position: relative; width: 100%; max-width: 600px; background: #000; overflow: hidden; border-radius: 8px; border: 1px solid #555;">
      <!-- 裁剪画布 -->
      <canvas id="crop-canvas" style="display: block; width: 100%; height: auto; touch-action: none; cursor: grab;"></canvas>
    </div>
    
    <div style="display: flex; gap: 16px; margin-top: 20px;">
      <button id="crop-cancel" class="btn ghost" style="padding: 10px 24px; border: 1px solid #666; background: #333; color: #fff; border-radius: 6px;">取 消</button>
      <button id="crop-confirm" class="btn" style="padding: 10px 24px; background: var(--cinnabar, #c0392b); color: #fff; border: none; border-radius: 6px;">裁 剪 并 使 用</button>
    </div>
  `;
  document.body.appendChild(modal);

  const canvas = modal.querySelector("#crop-canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = imageSrc;

  // 设定画布比例 (16:9 左右，适配顶部卡片)
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 450; 

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startX, startY;

  img.onload = () => {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // 初始缩放，让图片刚好填满画布
    const scaleX = CANVAS_WIDTH / img.width;
    const scaleY = CANVAS_HEIGHT / img.height;
    scale = Math.max(scaleX, scaleY); 
    
    // 居中
    offsetX = (CANVAS_WIDTH - img.width * scale) / 2;
    offsetY = (CANVAS_HEIGHT - img.height * scale) / 2;
    
    draw();
  };

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  const startDrag = (e) => {
    isDragging = true;
    canvas.style.cursor = 'grabbing';
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX - offsetX;
    startY = clientY - offsetY;
  };

  const doDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    offsetX = clientX - startX;
    offsetY = clientY - startY;
    
    // 边界限制
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    if (offsetX > 0) offsetX = 0;
    if (offsetX < CANVAS_WIDTH - scaledW) offsetX = CANVAS_WIDTH - scaledW;
    if (offsetY > 0) offsetY = 0;
    if (offsetY < CANVAS_HEIGHT - scaledH) offsetY = CANVAS_HEIGHT - scaledH;

    draw();
  };

  const endDrag = () => { isDragging = false; canvas.style.cursor = 'grab'; };

  canvas.addEventListener("mousedown", startDrag);
  canvas.addEventListener("mousemove", doDrag);
  canvas.addEventListener("mouseup", endDrag);
  canvas.addEventListener("mouseleave", endDrag);
  canvas.addEventListener("touchstart", startDrag, { passive: false });
  canvas.addEventListener("touchmove", doDrag, { passive: false });
  canvas.addEventListener("touchend", endDrag);

  modal.querySelector("#crop-cancel").onclick = () => modal.remove();
  modal.querySelector("#crop-confirm").onclick = async () => {
    // 先导出裁剪后的基础图
    const croppedBase64 = canvas.toDataURL("image/jpeg", 0.85);
    
    // 👈 直接调用，不用 import 了！
    const compressedBase64 = await compressImage(croppedBase64, 1);
    
    onConfirm(compressedBase64);
    modal.remove();
  };
}

/**
 * 将 Base64 图片压缩到指定大小（默认 1MB）以内
 * @param {string} base64Str 原始图片 Base64
 * @param {number} maxSizeMB 最大体积（MB）
 * @returns {Promise<string>} 压缩后的 Base64
 */
export function compressImage(base64Str, maxSizeMB = 1) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // 初始压缩质量为 0.9
      let quality = 0.9;
      let newBase64 = canvas.toDataURL("image/jpeg", quality);

      // 循环压缩，直到体积小于规定大小（或者降到最低极限 0.1）
      while (newBase64.length > maxSizeMB * 1024 * 1024 && quality > 0.1) {
        quality -= 0.1;
        newBase64 = canvas.toDataURL("image/jpeg", quality);
      }

      resolve(newBase64);
    };
  });
}