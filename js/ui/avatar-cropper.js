/**
 * 头像裁剪弹窗
 * @param {File} file - 用户选择的图片
 * @param {number} size - 输出尺寸，默认 200
 * @returns {Promise<Blob|null>} 裁剪后的 JPEG Blob，取消则返回 null
 */
export function openAvatarCropper(file, size = 200) {
  return new Promise((resolve) => {
    let img = null;
    let imgW = 0, imgH = 0;
    let baseScale = 1;
    let scale = 1;
    let tx = 0, ty = 0;
    let dragging = false;
    let lastX = 0, lastY = 0;

    // ===== 构建 DOM =====
    const mask = document.createElement("div");
    mask.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      z-index: 9999; display: flex; align-items: center; justify-content: center;
      padding: 20px;
    `;
    mask.innerHTML = `
      <div style="
        width:100%; max-width:420px; background: var(--paper);
        border-radius: 12px; padding: 20px;
        display:flex; flex-direction:column; gap:16px;
      ">
        <div style="
          text-align:center; font-family: var(--font-title);
          font-size: 18px; letter-spacing: 6px; color: var(--cinnabar);
          margin-bottom: 4px;
        ">裁 头 像</div>

        <div id="crop-stage" style="
          position:relative; width:100%; aspect-ratio:1;
          background:#1a1a1a; border-radius:8px; overflow:hidden;
          touch-action:none; cursor:grab;
        ">
          <img id="crop-img" style="
            position:absolute; user-select:none; pointer-events:none;
            will-change:transform;
          ">
          <div style="
            position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
            width:70%; height:70%;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);
            border: 2px solid rgba(255,255,255,0.9);
            pointer-events:none;
          "></div>
        </div>

        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:13px; color:var(--ink-dim);">缩放</span>
          <input id="crop-zoom" type="range" min="0.5" max="3" step="0.01" value="1" style="flex:1; accent-color: var(--cinnabar);">
          <span id="crop-zoom-val" style="font-size:13px; color:var(--cinnabar); width:36px; text-align:right;">1.0</span>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn ghost" id="crop-cancel" style="flex:1; padding:12px;">取 消</button>
          <button class="btn" id="crop-ok" style="flex:1; padding:12px;">确 定</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);

    const stage = mask.querySelector("#crop-stage");
    const cropImg = mask.querySelector("#crop-img");
    const zoomRange = mask.querySelector("#crop-zoom");
    const zoomVal = mask.querySelector("#crop-zoom-val");

    // ===== 读取文件 =====
    const reader = new FileReader();
    reader.onload = (ev) => {
      const image = new Image();
      image.onload = () => {
        img = image;
        imgW = image.naturalWidth;
        imgH = image.naturalHeight;
        cropImg.src = ev.target.result;
        setTimeout(initCrop, 30);
      };
      image.src = ev.target.result;
    };
    reader.readAsDataURL(file);

    // ===== 初始化 =====
    function initCrop() {
      const rect = stage.getBoundingClientRect();
      const stageW = rect.width, stageH = rect.height;
      baseScale = Math.max(stageW / imgW, stageH / imgH);
      scale = 1;
      zoomRange.value = 1;
      zoomVal.textContent = "1.0";
      tx = (stageW - imgW * baseScale) / 2;
      ty = (stageH - imgH * baseScale) / 2;
      applyTransform();
    }

    function applyTransform() {
      const s = baseScale * scale;
      cropImg.style.width = (imgW * s) + "px";
      cropImg.style.height = (imgH * s) + "px";
      cropImg.style.left = tx + "px";
      cropImg.style.top = ty + "px";
      clampPosition();
    }

    function clampPosition() {
      const rect = stage.getBoundingClientRect();
      const stageW = rect.width, stageH = rect.height;
      const s = baseScale * scale;
      const w = imgW * s, h = imgH * s;
      const frameW = stageW * 0.7, frameH = stageH * 0.7;
      const frameX = (stageW - frameW) / 2;
      const frameY = (stageH - frameH) / 2;

      if (tx > frameX) tx = frameX;
      if (tx + w < frameX + frameW) tx = frameX + frameW - w;
      if (ty > frameY) ty = frameY;
      if (ty + h < frameY + frameH) ty = frameY + frameH - h;

      cropImg.style.left = tx + "px";
      cropImg.style.top = ty + "px";
    }

    // ===== 拖动 =====
    stage.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      clampPosition();
    });
    stage.addEventListener("pointerup", (e) => {
      dragging = false;
      stage.releasePointerCapture(e.pointerId);
    });

    // ===== 缩放 =====
    zoomRange.addEventListener("input", (e) => {
      const newScale = parseFloat(e.target.value);
      const ratio = newScale / scale;
      const rect = stage.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      tx = cx - (cx - tx) * ratio;
      ty = cy - (cy - ty) * ratio;
      scale = newScale;
      zoomVal.textContent = scale.toFixed(1);
      applyTransform();
    });

    // ===== 取消 =====
    mask.querySelector("#crop-cancel").onclick = () => {
      mask.remove();
      resolve(null);
    };

    // ===== 确定 =====
    mask.querySelector("#crop-ok").onclick = async () => {
      if (!img) return;
      const rect = stage.getBoundingClientRect();
      const s = baseScale * scale;
      const frameW = rect.width * 0.7;
      const frameH = rect.height * 0.7;
      const frameX = (rect.width - frameW) / 2;
      const frameY = (rect.height - frameH) / 2;

      const sx = (frameX - tx) / s;
      const sy = (frameY - ty) / s;
      const sw = frameW / s;
      const sh = frameH / s;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

// 用 toBlob 导出 Blob，0.9 是画质。因为只有 200x200，这个 Blob 绝对在几百 KB 以内
      let blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9));
      
      // 终极保险：如果遇到极其极端的图片（比如纯色噪点图，压不下去），我们再降画质
      if (blob && blob.size > 1024 * 1024) {
        blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.6));
      }

      mask.remove();
      resolve(blob);
    };
  });
}