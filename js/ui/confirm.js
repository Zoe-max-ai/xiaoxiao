import { showModal, closeModal } from "./modal.js";

export function showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = showModal(`
      <div style="text-align: center;">
        <div style="
          font-family: var(--font-title);
          font-size: 16px;
          color: var(--ink);
          letter-spacing: 2px;
          margin-bottom: 12px;
        ">${title}</div>
        <div style="
          font-size: 14px;
          color: var(--ink-soft);
          line-height: 1.7;
          margin-bottom: 24px;
        ">${message}</div>
        <div style="display: flex; gap: 12px;">
          <button id="confirm-cancel" class="btn ghost" style="flex: 1;">再 想 想</button>
          <button id="confirm-ok" class="btn" style="flex: 1;">确 定</button>
        </div>
      </div>
    `, { maskClose: false });

    modal.querySelector("#confirm-cancel").onclick = () => {
      closeModal(modal);
      resolve(false);
    };
    modal.querySelector("#confirm-ok").onclick = () => {
      closeModal(modal);
      resolve(true);
    };
  });
}