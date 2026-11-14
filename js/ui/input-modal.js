/**
 * 站内输入弹窗（替代原生 prompt）
 * @returns {Promise<string|null>} 确定返回输入值，取消返回 null
 */
export async function showInputModal({ title = "输入", label = "", defaultValue = "", placeholder = "", maxLength = 100 } = {}) {
  const { showModal, closeModal } = await import("./modal.js");

  return new Promise((resolve) => {
    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
        ${title}
      </div>
      ${label ? `<div class="form-field"><label>${label}</label>` : `<div class="form-field">`}
        <input type="text" class="input" id="input-modal-value" value="${escapeAttr(defaultValue)}" placeholder="${escapeAttr(placeholder)}" maxlength="${maxLength}">
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn ghost" id="input-modal-cancel" style="flex:1;padding:12px;">取 消</button>
        <button class="btn" id="input-modal-ok" style="flex:1;padding:12px;">确 定</button>
      </div>
    `);

    const input = modal.querySelector("#input-modal-value");
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);

    const submit = () => {
      const value = input.value.trim();
      if (!value) {
        // 空值直接关掉（或提示）
        closeModal(modal);
        resolve(null);
        return;
      }
      closeModal(modal);
      resolve(value);
    };

    const cancel = () => {
      closeModal(modal);
      resolve(null);
    };

    modal.querySelector("#input-modal-ok").onclick = submit;
    modal.querySelector("#input-modal-cancel").onclick = cancel;
    input.onkeydown = (e) => {
      if (e.key === "Enter") submit();
      if (e.key === "Escape") cancel();
    };
  });
}

function escapeAttr(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}