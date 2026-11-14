import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { sendLetter } from "../services/letter-service.js";
import { getFriendNpcs } from "../services/npc-service.js";

export async function tanmiLettersNewView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const chars = (await db.all("characters"))
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const npcs = await getFriendNpcs(ownerId);

  if (!chars.length && !npcs.length) {
    el.innerHTML = `<div class="empty-state">还没有角色或好友，无法写信。</div>`;
    return el;
  }

  const user = state.currentUser;
  const userName = user?.name || "我";
  const userNickname = user?.nickname || userName;

  el.innerHTML = `
    <div class="letter-new-page">
      <div class="form-field">
        <label>收信人</label>
        <select class="input" id="to-select">
          ${chars.length ? `
            <optgroup label="角色">
              ${chars.map(c => `<option value="character:${c.id}">${escapeHtml(c.name)}${c.du ? ` · ${escapeHtml(c.du)}` : ""}</option>`).join("")}
            </optgroup>
          ` : ""}
          ${npcs.length ? `
            <optgroup label="友人">
              ${npcs.map(n => `<option value="npc:${n.id}">${escapeHtml(n.name)}${n.relation ? ` · ${escapeHtml(n.relation)}` : ""}</option>`).join("")}
            </optgroup>
          ` : ""}
        </select>
      </div>

      <div class="form-field">
        <label>敬启</label>
        <input type="text" class="input" id="salutation" value="${escapeHtml(userNickname)}" maxlength="20">
        <div style="font-size:11px;color:var(--ink-dim);margin-top:6px;">对方收信时看到的第一行称呼</div>
      </div>

      <div class="form-field">
        <label>正文</label>
        <textarea class="input" id="letter-body" style="min-height:220px;resize:vertical;" placeholder="见字如晤……" maxlength="3000"></textarea>
      </div>

      <div class="form-field">
        <label>落款</label>
        <input type="text" class="input" id="signature" value="${escapeHtml(userName)}" maxlength="20">
      </div>

      <div class="letter-new-actions">
        <button class="btn ghost" id="btn-cancel">取 消</button>
        <button class="btn" id="btn-send">寄 出</button>
      </div>
    </div>
  `;

  el.insertBefore(pageHeader("写 信", "#/tanmi/letters"), el.firstChild);

  el.querySelector("#btn-cancel").onclick = () => { location.hash = "#/tanmi/letters"; };

  el.querySelector("#btn-send").onclick = async () => {
    const raw = el.querySelector("#to-select").value;
    // "character:xxx" 或 "npc:xxx"
    const [toType, toId] = raw.split(":");
    const salutation = el.querySelector("#salutation").value.trim();
    const body = el.querySelector("#letter-body").value.trim();
    const signature = el.querySelector("#signature").value.trim();

    if (!body) { showToast("请写点正文"); return; }

    const fullContent = [
      salutation ? `${salutation} 敬启：` : "",
      "",
      body,
      "",
      signature ? `—— ${signature} 谨启` : "",
    ].filter(s => s !== undefined).join("\n");

    await sendLetter(ownerId, { toId, toType, content: fullContent });

    showToast("已寄出。静候回音……");
    location.hash = "#/tanmi/letters";
  };

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}