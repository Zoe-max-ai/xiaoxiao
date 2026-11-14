export function showModal(html, options = {}) {
  const modal = document.createElement("div");
  modal.className = "app-modal-mask";
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: modal-fade 0.2s ease;
  `;

  modal.innerHTML = `
    <div class="app-modal-content" style="
      width: 100%;
      max-width: 420px;
      max-height: 85vh;
      overflow-y: auto;
      background: var(--paper);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    ">
      ${html}
    </div>
  `;

  document.body.appendChild(modal);

  // 点击遮罩关闭
  if (options.maskClose !== false) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal);
    });
  }

  return modal;
}

export function closeModal(modal) {
  if (!modal || !modal.parentNode) return;
  modal.style.animation = "modal-fade-out 0.2s ease";
  setTimeout(() => modal.remove(), 180);
}

export function closeAllModals() {
  document.querySelectorAll(".app-modal-mask").forEach(m => m.remove());
}

/* 新增：弹窗标题统一组件 */
export function modalTitle(text) {
  return `<div class="app-modal-title">${text}</div>`;
}

// 动画
const style = document.createElement("style");
style.textContent = `
  @keyframes modal-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes modal-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);