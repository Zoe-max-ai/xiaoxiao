import { db } from "../core/db.js";
import { state } from "../core/state.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { pageHeader } from "../ui/page-header.js";

export async function guichuWorldbookView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }
  

  el.innerHTML = `
    <div id="wb-wrap">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-size:12px; color:var(--ink-dim);">共 <span id="wb-count">0</span> 个词条</div>
        <button class="btn" id="btn-add-wb" style="padding:8px 18px; letter-spacing:3px; font-size:13px;">＋ 新词条</button>
      </div>
      <div id="wb-list" style="display:flex; flex-direction:column; gap:12px;"></div>
    </div>
  `;

  el.insertBefore(pageHeader("世 界 书", "#/guichu"), el.firstChild);

  // 加载所有词条
  async function loadData() {
    // 假设你的数据库有 worldbook表
    const all = await db.all("world_book");
    const myEntries = all.filter(w => w.ownerId === ownerId).sort((a, b) => b.createdAt - a.createdAt);
    
    el.querySelector("#wb-count").textContent = myEntries.length;
    const listEl = el.querySelector("#wb-list");

    if (!myEntries.length) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          还没有设定。<br>
          点击上方「＋ 新词条」写下第一笔江湖传闻吧。
        </div>
      `;
      return;
    }

    listEl.innerHTML = myEntries.map(entry => `
      <div class="wb-card" data-id="${entry.id}" style="
        background: var(--paper); border: 1px solid var(--line-light);
        border-radius: 12px; padding: 16px; cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.02);
      ">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div style="font-family:var(--font-title); font-size:16px; color:var(--cinnabar); letter-spacing:2px;">
            ${escapeHtml(entry.title)}
          </div>
          <div style="font-size:11px; color:var(--ink-dim); border:1px solid var(--line); padding:2px 6px; border-radius:4px;">
            ${entry.enabled ? "已启用" : "已禁用"}
          </div>
        </div>
        <div style="font-size:12px; color:var(--ink-dim); margin-bottom:8px;">
          触发词：${(entry.keywords || []).map(k => `<span style="background:var(--paper-soft); padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(k)}</span>`).join("")}
        </div>
        <div style="font-size:13px; color:var(--ink-soft); line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
          ${escapeHtml(entry.content)}
        </div>
      </div>
    `).join("");

    // 点开编辑弹窗
    listEl.querySelectorAll(".wb-card").forEach(card => {
      card.onclick = () => openEditModal(card.dataset.id);
    });
  }

  // 新建/编辑弹窗
  async function openEditModal(id = null) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    let entry = null;
    if (id) {
      entry = await db.get("world_book", id);
    }

    const modal = showModal(`
      <div style="text-align:center; font-family:var(--font-title); font-size:16px; color:var(--cinnabar); letter-spacing:4px; margin-bottom:20px;">
        ${id ? "编辑设定" : "新增设定"}
      </div>

      <div class="form-field">
        <label>词条标题（如：神侯府）</label>
        <input type="text" id="wb-title" class="input" value="${escapeHtml(entry?.title || "")}" placeholder="必填">
      </div>

      <div class="form-field">
        <label>触发词（多个词用英文逗号隔开）</label>
        <input type="text" id="wb-keywords" class="input" value="${(entry?.keywords || []).join(", ")}" placeholder="如：神侯府,诸葛正我,四大名捕">
        <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">聊天时，用户或 AI 说到这些词，会自动将此设定注入上下文。</div>
      </div>

<div class="form-field">
  <label>分类</label>
  <select id="wb-category" class="input">
    <option value="world" ${entry?.category === 'world' ? 'selected' : ''}>世界观</option>
    <option value="character" ${entry?.category === 'character' ? 'selected' : ''}>人物设定</option>
    <option value="place" ${entry?.category === 'place' ? 'selected' : ''}>地点/门派</option>
    <option value="item" ${entry?.category === 'item' ? 'selected' : ''}>物品/武学</option>
  </select>
</div>

      <div class="form-field">
        <label>详细设定内容</label>
        <textarea id="wb-content" class="input" style="min-height:150px; resize:vertical;" placeholder="写下这个设定的背景、人物关系等...">${escapeHtml(entry?.content || "")}</textarea>
      </div>

      <div class="form-field" style="display:flex; align-items:center; gap:10px; margin-top:10px;">
        <div id="wb-enabled" class="sw-toggle ${entry?.enabled !== false ? "on" : ""}"></div>
        <span style="font-size:13px;">启用此词条</span>
      </div>

      <div style="display:flex; gap:12px; margin-top:20px;">
        ${id ? `<button class="btn ghost" id="wb-del" style="flex:1; padding:12px; color:var(--cinnabar);">删 除</button>` : ""}
        <button class="btn" id="wb-save" style="flex:1; padding:12px;">保 存</button>
      </div>
    `);

    modal.querySelector("#wb-enabled").onclick = (e) => e.target.classList.toggle("on");
    
    const delBtn = modal.querySelector("#wb-del");
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = await showConfirm("删除词条", "确定要删除这个设定吗？");
        if (!ok) return;
        await db.del("world_book", id);
        closeModal(modal);
        showToast("已删除");
        await loadData();
      };
    }

    modal.querySelector("#wb-save").onclick = async () => {
      const title = modal.querySelector("#wb-title").value.trim();
      const keywords = modal.querySelector("#wb-keywords").value.split(",").map(k => k.trim()).filter(Boolean);
      const content = modal.querySelector("#wb-content").value.trim();
      const enabled = modal.querySelector("#wb-enabled").classList.contains("on");
const category = modal.querySelector("#wb-category").value;

      if (!title) return showToast("请填写标题");
      if (!content) return showToast("请填写内容");
const data = { title, keywords, content, enabled, category, ownerId, createdAt: Date.now() };
      if (id) {

await db.put("world_book", { ...entry, ...data, updatedAt: Date.now() });
        showToast("已更新");
      } else {
        data.id = "wb_" + Date.now();
        await db.put("world_book", data);
        showToast("已添加");
      }
      closeModal(modal);
      await loadData();
    };
  }
  el.querySelector("#btn-add-wb").onclick = () => openEditModal();

  await loadData();

  return el;
}


function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}