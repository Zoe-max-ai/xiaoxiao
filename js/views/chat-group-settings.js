import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { getImageUrl } from "../services/seed-service.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { getChat, updateGroupChat, deleteChat, clearChat } from "../services/chat-service.js";
import { getFriendNpcs } from "../services/npc-service.js";

export async function chatGroupSettingsView({ params }) {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

const chatId = params?.[0]; // #/chat/group-settings/:chatId
  if (!chatId) {
    el.innerHTML = `<div class="empty-state">未指定群聊。</div>`;
    return el;
  }

  let chat = await getChat(chatId);
  if (!chat || chat.type !== "group" || chat.ownerId !== ownerId) {
    el.innerHTML = `<div class="empty-state">群聊不存在。</div>`;
    return el;
  }

  async function render() {
    el.innerHTML = "";

    el.appendChild(pageHeader("群 聊 设 置", `#/chat/group/${chat.id}`));

    // 加载成员信息
    const memberInfo = [];
    for (const m of (chat.members || [])) {
      let obj;
      if (m.type === "npc") {
        obj = await db.get("npc_relations", m.id);
      } else {
        obj = await db.get("characters", m.id);
      }
      if (!obj) continue;
      let avatarUrl = null;
      if (obj.avatarId) {
        avatarUrl = await getImageUrl(obj.avatarId, true);
      }
      memberInfo.push({
        type: m.type,
        id: m.id,
        name: obj.name,
        avatarUrl,
      });
    }

    // 加载可添加的（未在群里的）
    const currentIds = new Set((chat.members || []).map(m => m.id));
    const chars = (await db.all("characters")).filter(c => c.ownerId === ownerId);
    const npcs = await getFriendNpcs(ownerId);
    const available = [
      ...chars.filter(c => !currentIds.has(c.id)).map(c => ({ type: "character", id: c.id, name: c.name })),
      ...npcs.filter(n => !currentIds.has(n.id)).map(n => ({ type: "npc", id: n.id, name: n.name })),
    ];

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <!-- 群名 -->
      <div class="form-field">
        <label>群聊名称</label>
        <div style="display:flex;gap:8px;">
          <input type="text" class="input" id="g-name" value="${escapeHtml(chat.name)}" maxlength="20" style="flex:1;">
          <button class="btn" id="btn-save-name" style="padding:10px 16px;">保存</button>
        </div>
      </div>

      <!-- 成员 -->
      <div class="form-field">
        <label>成员（${memberInfo.length}）</label>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${memberInfo.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--paper-soft);border:1px solid var(--line-light);border-radius:var(--radius-sm);">
              <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:#b8b0a0;color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-title);font-size:16px;flex-shrink:0;">
                ${m.avatarUrl ? `<img src="${m.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(m.name.charAt(0))}
              </div>
              <div style="flex:1;font-size:14px;">${escapeHtml(m.name)}</div>
              <button class="btn ghost btn-remove-member" data-type="${m.type}" data-id="${m.id}" style="padding:6px 10px;color:var(--cinnabar);border-color:var(--cinnabar);">移除</button>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- 添加成员 -->
      ${available.length ? `
        <div class="form-field">
          <label>添加成员</label>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${available.map(m => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--paper-soft);border:1px solid var(--line-light);border-radius:var(--radius-sm);">
                <div style="flex:1;font-size:14px;">${escapeHtml(m.name)}</div>
                <button class="btn ghost btn-add-member" data-type="${m.type}" data-id="${m.id}" style="padding:6px 10px;">添加</button>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <!-- 数据 -->
      <div class="form-field">
        <label>数据</label>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn ghost" id="btn-export" style="padding:12px;">导出聊天记录</button>
          <button class="btn ghost" id="btn-clear" style="padding:12px;color:var(--cinnabar);border-color:var(--cinnabar);">清空聊天记录</button>
          <button class="btn ghost" id="btn-dissolve" style="padding:12px;color:var(--cinnabar);border-color:var(--cinnabar);">解散群聊</button>
        </div>
      </div>
    `;

    el.appendChild(wrap);

    // 保存群名
    wrap.querySelector("#btn-save-name").onclick = async () => {
      const name = wrap.querySelector("#g-name").value.trim();
      if (!name) { showToast("请输入群名"); return; }
      await updateGroupChat(chat.id, { name });
      chat.name = name;
      showToast("已保存");
    };

    // 移除成员
    wrap.querySelectorAll(".btn-remove-member").forEach(btn => {
      btn.onclick = async () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        const newMembers = (chat.members || []).filter(m => !(m.type === type && m.id === id));
        await updateGroupChat(chat.id, { members: newMembers });
        chat = await getChat(chat.id);
        showToast("已移除");
        render();
      };
    });

    // 添加成员
    wrap.querySelectorAll(".btn-add-member").forEach(btn => {
      btn.onclick = async () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        const newMembers = [...(chat.members || []), { type, id }];
        await updateGroupChat(chat.id, { members: newMembers });
        chat = await getChat(chat.id);
        showToast("已添加");
        render();
      };
    });

    // 导出
    wrap.querySelector("#btn-export").onclick = async () => {
      const { getMessages } = await import("../services/chat-service.js");
      const messages = await getMessages(chat.id);
      const data = {
        group: { id: chat.id, name: chat.name, members: chat.members },
        messages,
        exportedAt: Date.now(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `group_${chat.name}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("已导出");
    };

    // 清空
    wrap.querySelector("#btn-clear").onclick = async () => {
      const ok = await showConfirm("清空聊天", "确定清空该群聊的所有消息？");
      if (!ok) return;
      await clearChat(chat.id);
      showToast("已清空");
    };

    // 解散
    wrap.querySelector("#btn-dissolve").onclick = async () => {
      const ok = await showConfirm("解散群聊", "确定解散该群聊？所有消息会一并删除。");
      if (!ok) return;
      await deleteChat(chat.id);
      showToast("已解散");
      location.hash = "#/chenshi";
    };
  }

  await render();
  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}