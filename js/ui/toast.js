export function showToast(msg, duration = 1800, offsetBottom = 100) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: ${offsetBottom}px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(43, 43, 43, 0.92);
      color: #fff;
      padding: 10px 20px;
      border-radius: 24px;
      font-size: 13px;
      letter-spacing: 1px;
      opacity: 0;
      transition: opacity 0.3s, bottom 0.3s; /* 👈 顺便加个 bottom 的过渡动画 */
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(toast);
  }
  
  // 👈 核心：每次调用时，动态修改 bottom 的位置
  toast.style.bottom = `${offsetBottom}px`;
  toast.textContent = msg;
  toast.style.opacity = "1";
  
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = "0";
  }, duration);
}