import { pageHeader } from "../ui/page-header.js";
import { getAllThemes, getTheme } from "../theme/theme-registry.js";
import {
  applyTheme, getCurrentThemeId,
  getOverrides, updateOverrides, resetOverrides,
} from "../theme/theme-runtime.js";
import { db } from "../core/db.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";

export async function guichuThemeView() {
  const el = document.createElement("div");
  el.innerHTML = `<div id="theme-wrap"></div>`;
  el.insertBefore(pageHeader("主 题", "#/guichu"), el.firstChild);

  await render(el.querySelector("#theme-wrap"));
  return el;
}

async function render(container) {
  container.innerHTML = "";

  const themes = getAllThemes();
  const current = getCurrentThemeId();
  const ov = getOverrides();

  /* ===== 1. 主题选择（2 列网格） ===== */
  const themeGrid = document.createElement("div");
  themeGrid.style.cssText = "display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;";

  for (const theme of themes) {
    const isActive = theme.id === current;
    const item = document.createElement("div");
    item.style.cssText = `
      padding: 0;
      background: var(--paper);
      border: 1.5px solid ${isActive ? "var(--cinnabar)" : "var(--line-light)"};
      border-radius: var(--radius);
      cursor: pointer;
      overflow: hidden;
      transition: transform 0.15s, box-shadow 0.15s;
    `;
    if (isActive) item.style.boxShadow = "0 2px 8px rgba(138, 43, 43, 0.15)";

    // 小预览（用主题的颜色拼一个缩略图）
    const previewBg = theme.colors?.bg || "#f4efe6";
    const previewPaper = theme.colors?.paper || "#faf6ee";
    const previewAccent = theme.colors?.cinnabar || "#8a2b2b";

item.innerHTML = `
  <div style="
    height: 70px;
    display: flex;
    overflow: hidden;
    position: relative;
    border-bottom: 1px solid var(--line-light);
  ">
    <div style="flex:1; background:${theme.colors?.bg || "#f4efe6"};"></div>
    <div style="flex:1; background:${theme.colors?.paper || "#faf6ee"};"></div>
    <div style="flex:1; background:${theme.colors?.cinnabar || "#8a2b2b"};"></div>
    ${isActive ? `
      <div style="
        position: absolute;
        top: 6px; right: 6px;
        width: 20px; height: 20px;
        background: var(--cinnabar);
        color: #fff;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px;
        box-shadow: 0 0 0 2px var(--paper);
        z-index: 2;
      ">✓</div>
    ` : ""}
  </div>
  <div style="padding: 10px 12px;">
    <div style="
      font-family: var(--font-title);
      font-size: 14px;
      color: var(--cinnabar);
      letter-spacing: 3px;
      margin-bottom: 2px;
    ">${theme.name}</div>
    <div style="
      font-size: 10px;
      color: var(--ink-dim);
      letter-spacing: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    ">${theme.subtitle}</div>
  </div>
`;
    item.onclick = async () => {
      if (theme.id === current) return;
      await applyTheme(theme.id);
      await render(container);
    };
    themeGrid.appendChild(item);
  }
  container.appendChild(themeGrid);

  /* ===== 2. 微调区 ===== */
  const sectionTitle = document.createElement("div");
  // 👈 把 color:var(--ink-dim) 换成 color:var(--ink)，并加上 text-shadow
  sectionTitle.style.cssText = "margin:28px 0 12px;font-size:14px;letter-spacing:4px;color:var(--ink); font-weight:bold; text-shadow: 0 1px 4px rgba(255,255,255,0.8);";
  sectionTitle.textContent = "—— 微 调 ——";
  container.appendChild(sectionTitle);

  const patch = {};

  /* ===== 背景图（3 列并排） ===== */
  const bgTitle = document.createElement("div");
  // 👈 这里同理
  bgTitle.style.cssText = "font-size:13px;color:var(--ink); margin-bottom:8px;letter-spacing:2px; font-weight:bold; text-shadow: 0 1px 4px rgba(255,255,255,0.8);";
  bgTitle.textContent = "背景图";
  container.appendChild(bgTitle);

  const bgGrid = document.createElement("div");
  bgGrid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;";
  bgGrid.appendChild(await makeBgCard("尘世", "bgChenshi", ov.bgChenshi, patch));
  bgGrid.appendChild(await makeBgCard("聊天", "bgChat", ov.bgChat, patch));
  bgGrid.appendChild(await makeBgCard("信纸", "bgLetter", ov.bgLetter, patch));
  container.appendChild(bgGrid);

  /* ===== 颜色微调 ===== */
  container.appendChild(makeColorRow("主文字色", "ink", ov.ink, "#2b2b2b", patch));
  container.appendChild(makeColorRow("次要文字色", "inkDim", ov.inkDim, "#8a8378", patch));
  container.appendChild(makeColorRow("强调色", "cinnabar", ov.cinnabar, "#8a2b2b", patch));

  /* ===== 遮罩透明度 ===== */
  container.appendChild(makeSliderRow("背景遮罩", "overlayOpacity", ov.overlayOpacity ?? 0.5, 0, 1, 0.05, patch));

  /* ===== 气泡样式 ===== */
  container.appendChild(makeSelectRow("气泡样式", "bubbleStyle", ov.bubbleStyle || "paper",
    [["paper","宣纸"],["glass","玻璃"],["solid","纯色"]], patch));

  /* ===== 粒子 ===== */
  container.appendChild(makeSelectRow("粒子", "particle", ov.particle || "auto",
    [["auto","跟随主题"],["snow","落雪"],["petal","落花"],["none","无"]], patch));

  /* ===== 3. 底部按钮 ===== */
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;margin:24px 0;";

  const btnSave = document.createElement("button");
  btnSave.className = "btn";
  btnSave.style.cssText = "flex:1;padding:14px;letter-spacing:6px;";
  btnSave.textContent = "应 用";
  btnSave.onclick = async () => {
    if (patch.particle === "auto") patch.particle = undefined;
    await updateOverrides(patch);
    showToast("已应用");
    await render(container);
  };

  const btnReset = document.createElement("button");
  btnReset.className = "btn ghost";
  btnReset.style.cssText = "flex:1;padding:14px;letter-spacing:6px;color:var(--cinnabar);";
  btnReset.textContent = "恢复默认";
  btnReset.onclick = async () => {
    const ok = await showConfirm("恢复默认", "将清空当前主题的所有微调，确定吗？");
    if (!ok) return;
    await resetOverrides();
    showToast("已恢复");
    await render(container);
  };

  btnRow.appendChild(btnSave);
  btnRow.appendChild(btnReset);
  container.appendChild(btnRow);
}

/* ========== 背景卡片（3 列并排） ========== */

async function makeBgCard(label, key, currentImageId, patch) {
  const card = document.createElement("div");
  card.style.cssText = "display:flex;flex-direction:column;gap:6px;";

  let previewUrl = null;
  if (currentImageId) {
    const img = await db.get("images", currentImageId);
    if (img?.thumb?.data) {
      previewUrl = URL.createObjectURL(img.thumb.data);
    }
  }

  card.innerHTML = `
    <div style="font-size:12px;color:var(--ink); font-weight:bold; text-align:center;letter-spacing:2px; text-shadow: 0 1px 4px rgba(255,255,255,0.8);">${label}</div>
    <div id="bg-preview-${key}" style="
      aspect-ratio: 3/4;
      border: 1px dashed var(--line-light);
      border-radius: 6px;
      background: var(--paper-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--ink-dim);
      cursor: pointer;
      overflow: hidden;
      transition: border-color 0.15s;
    ">
      ${previewUrl ? `<img src="${previewUrl}" style="width:100%;height:100%;object-fit:cover;">` : "选择"}
    </div>
  `;

  const previewEl = card.querySelector(`#bg-preview-${key}`);
  previewEl.onmouseenter = () => previewEl.style.borderColor = "var(--cinnabar)";
  previewEl.onmouseleave = () => previewEl.style.borderColor = "var(--line-light)";

  previewEl.onclick = async () => {
    const id = await openImagePicker();
    if (id) {
      patch[key] = id;
      showToast("已选择，点应用生效");
      const img = await db.get("images", id);
      if (img?.thumb?.data) {
        const url = URL.createObjectURL(img.thumb.data);
        previewEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    }
  };

  return card;
}

/* ========== 其他行组件 ========== */

function makeColorRow(label, key, currentValue, fallback, patch) {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px; padding: 12px; background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--line-light);";
  row.innerHTML = `
    <div style="font-size:13px;color:var(--ink); font-weight: bold;">${label}</div>
    <input type="color" value="${currentValue || fallback}" style="width:60px;height:32px;border:none;background:none;cursor:pointer;">
  `;
  row.querySelector("input").oninput = (e) => {
    patch[key] = e.target.value;
  };
  return row;
}

function makeSliderRow(label, key, currentValue, min, max, step, patch, suffix = "") {
  const row = document.createElement("div");
  row.style.cssText = "margin-bottom:12px; padding: 12px; background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--line-light);";  
  // 👈 核心改动：这里加了图标，并且去掉了多余样式
  row.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink);margin-bottom:8px; font-weight: bold;">
      <span>${label}</span>
      <span id="slider-val-${key}">${currentValue}${suffix}</span>
    </div>
    <!-- 拉条这里只保留原生 accent-color，非常干净 -->
    <input type="range" min="${min}" max="${max}" step="${step}" value="${currentValue}" style="width:100%; accent-color: var(--cinnabar);">

  `;
  
  const input = row.querySelector("input");
  input.oninput = (e) => {
    const v = parseFloat(e.target.value);
    patch[key] = v;
    row.querySelector(`#slider-val-${key}`).textContent = v + suffix;
  };
  return row;
}


function makeSelectRow(label, key, currentValue, options, patch) {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px; padding: 12px; background: rgba(250, 246, 238, 0.85); backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--line-light);";
  row.innerHTML = `
    <div style="font-size:13px;color:var(--ink); font-weight: bold;">${label}</div>
    <select style="padding:6px 10px;border:1px solid var(--line-light);border-radius:6px;background:var(--paper);">
      ${options.map(([v, t]) => `<option value="${v}" ${v === currentValue ? "selected" : ""}>${t}</option>`).join("")}
    </select>
  `;
  row.querySelector("select").onchange = (e) => {
    patch[key] = e.target.value;
  };
  return row;
}

/* ========== 简易图库选图 ========== */

async function openImagePicker() {
  const all = await db.all("images");
  const bgs = all.filter(img => img.category === "background");

  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    const box = document.createElement("div");
    box.style.cssText = `
      background:var(--paper);border-radius:12px;padding:20px;
      max-width:600px;width:100%;max-height:80vh;overflow-y:auto;
    `;
    box.innerHTML = `
      <div style="font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">选择背景图</div>
      <div id="picker-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;"></div>
      <button class="btn ghost" style="width:100%;margin-top:16px;" id="picker-cancel">取消</button>
    `;
    const grid = box.querySelector("#picker-grid");

    if (bgs.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--ink-dim);font-size:12px;padding:20px;">图库里还没有背景图</div>`;
    } else {
      for (const img of bgs) {
        const cell = document.createElement("div");
        cell.style.cssText = "aspect-ratio:3/4;border-radius:6px;overflow:hidden;cursor:pointer;border:1px solid var(--line-light);";
        if (img.thumb?.data) {
          const url = URL.createObjectURL(img.thumb.data);
          cell.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        cell.onclick = () => { modal.remove(); resolve(img.id); };
        grid.appendChild(cell);
      }
    }

    box.querySelector("#picker-cancel").onclick = () => { modal.remove(); resolve(null); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
    modal.appendChild(box);
    document.body.appendChild(modal);
  });
}