import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import {
  FONT_OPTIONS, getFontSettings, saveFontSettings, applyFontSettings,
} from "../services/font-service.js";

export async function guichuFontView() {
  const el = document.createElement("div");

  const settings = await getFontSettings();

  el.innerHTML = `
    <div class="section-title">正 文 字 体</div>
    <div class="font-options" id="body-options">
      ${FONT_OPTIONS.body.map(f => `
        <div class="font-option ${settings.body === f.id ? "on" : ""}" data-id="${f.id}">
          <span style="font-family:${f.css}">${f.name}</span>
        </div>
      `).join("")}
    </div>

    <div class="section-title">标 题 字 体</div>
    <div class="font-options" id="title-options">
      ${FONT_OPTIONS.title.map(f => `
        <div class="font-option ${settings.title === f.id ? "on" : ""}" data-id="${f.id}">
          <span style="font-family:${f.css}">${f.name}</span>
        </div>
      `).join("")}
    </div>

    <div class="section-title">正 文 字 号</div>
    <div class="font-size-wrap">
      <span class="font-size-label">小</span>
      <input type="range" id="body-size-range" min="12" max="20" step="1" value="${settings.bodySize}">
      <span class="font-size-label">大</span>
      <span class="font-size-value" id="body-size-value">${settings.bodySize}px</span>
    </div>

    <div class="section-title">标 题 字 号</div>
    <div class="font-size-wrap">
      <span class="font-size-label">小</span>
      <input type="range" id="title-size-range" min="16" max="32" step="1" value="${settings.titleSize}">
      <span class="font-size-label">大</span>
      <span class="font-size-value" id="title-size-value">${settings.titleSize}px</span>
    </div>

    <div class="section-title">预 览</div>
    <div class="font-preview" id="font-preview">
      <div class="preview-title" style="font-family:${FONT_OPTIONS.title.find(f => f.id === settings.title).css}; font-size:${settings.titleSize}px;">
        此间尘世，静候君来
      </div>
      <div class="preview-body" style="font-family:${FONT_OPTIONS.body.find(f => f.id === settings.body).css}; font-size:${settings.bodySize}px;">
        一棹寻风去，江湖此间渡。<br>
        大宋江湖 · 萍水相逢处。
      </div>
    </div>

    <button class="btn" id="btn-save" style="width:100%; padding:14px; letter-spacing:6px; margin-top:24px;">
      保 存
    </button>
  `;

  el.insertBefore(pageHeader("字 体", "#/guichu"), el.firstChild);

  // 临时状态
  let tempBody = settings.body;
  let tempTitle = settings.title;
  let tempBodySize = settings.bodySize;
  let tempTitleSize = settings.titleSize;

  const previewTitleEl = el.querySelector(".preview-title");
  const previewBodyEl = el.querySelector(".preview-body");
  const bodySizeValueEl = el.querySelector("#body-size-value");
  const titleSizeValueEl = el.querySelector("#title-size-value");

  function updatePreview() {
    const bodyFont = FONT_OPTIONS.body.find(f => f.id === tempBody);
    const titleFont = FONT_OPTIONS.title.find(f => f.id === tempTitle);
    previewBodyEl.style.fontFamily = bodyFont.css;
    previewBodyEl.style.fontSize = tempBodySize + "px";
    previewTitleEl.style.fontFamily = titleFont.css;
    previewTitleEl.style.fontSize = tempTitleSize + "px";
  }

  // 正文
  el.querySelector("#body-options").onclick = (e) => {
    const item = e.target.closest(".font-option");
    if (!item) return;
    tempBody = item.dataset.id;
    el.querySelectorAll("#body-options .font-option").forEach(i => {
      i.classList.toggle("on", i.dataset.id === tempBody);
    });
    updatePreview();
  };

  // 标题
  el.querySelector("#title-options").onclick = (e) => {
    const item = e.target.closest(".font-option");
    if (!item) return;
    tempTitle = item.dataset.id;
    el.querySelectorAll("#title-options .font-option").forEach(i => {
      i.classList.toggle("on", i.dataset.id === tempTitle);
    });
    updatePreview();
  };

  // 正文字号
  el.querySelector("#body-size-range").oninput = (e) => {
    tempBodySize = +e.target.value;
    bodySizeValueEl.textContent = tempBodySize + "px";
    updatePreview();
  };

  // 标题字号
  el.querySelector("#title-size-range").oninput = (e) => {
    tempTitleSize = +e.target.value;
    titleSizeValueEl.textContent = tempTitleSize + "px";
    updatePreview();
  };

  // 保存
  el.querySelector("#btn-save").onclick = async () => {
    await saveFontSettings({
      body: tempBody,
      title: tempTitle,
      bodySize: tempBodySize,
      titleSize: tempTitleSize,
    });
    await applyFontSettings();
    showToast("已保存");
  };

  return el;
}