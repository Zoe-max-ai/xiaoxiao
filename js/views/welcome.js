export async function welcomeView() {
  const el = document.createElement("div");
  el.style.cssText = `
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 24px;
    padding: 40px 20px;
    position: fixed;
    inset: 0;
    background: var(--bg);
    z-index: 1;
  `;
  el.innerHTML = `
    <h1 style="font-family: var(--font-title); font-size: 36px; letter-spacing: 12px; color: var(--cinnabar); font-weight: 600;">寻 风 渡</h1>
    <p style="font-size: 16px; letter-spacing: 4px; color: var(--ink-soft); margin-top: 8px;">一棹寻风去，江湖此间渡。</p>
    <p style="font-size: 13px; letter-spacing: 3px; color: var(--ink-dim); margin-top: 4px;">相逢于长风起处・偕行向万里山河</p>
    <button class="btn" id="btn-start" style="margin-top: 40px; padding: 14px 48px; font-size: 16px; letter-spacing: 6px;">入 世</button>
  `;
  el.querySelector("#btn-start").onclick = () => {
    location.hash = "#/user/create";
  };
  return el;
}