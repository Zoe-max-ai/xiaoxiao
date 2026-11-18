import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { db } from "../core/db.js";
import { updateCharacter, getCharactersByOwner } from "../services/character-service.js";
import { getImageUrl } from "../services/seed-service.js";
import { openAvatarCropper } from "../ui/avatar-cropper.js";
import {
  getCharacterRelations, createCharacterRelation, updateCharacterRelation,
  deleteCharacterRelation,
  getNpcsByCharacter, createNpc, updateNpc, deleteNpc,
} from "../services/npc-service.js";
import { state } from "../core/state.js";

export async function yajiEditView({ params }) {
  const el = document.createElement("div");
  const characterId = params?.[0];
  if (!characterId) {
    el.innerHTML = `<div class="empty-state">未指定角色。</div>`;
    return el;
  }

  const char = await db.get("characters", characterId);
  if (!char) {
    el.innerHTML = `<div class="empty-state">此人已隐入尘烟。</div>`;
    return el;
  }

  const ownerId = state.currentUserId;
  const portraitUrl = char.portraitId ? await getImageUrl(char.portraitId) : null;
  const avatarUrl = char.avatarId ? await getImageUrl(char.avatarId, true) : null;

  el.innerHTML = `
    <div style="display:flex;gap:16px;justify-content:center;margin-bottom:24px">
      <div style="text-align:center">
        <div id="portrait-preview" style="
          width:120px;height:160px;
          border:1px dashed var(--line);border-radius:8px;
          background:var(--paper-soft);display:flex;align-items:center;justify-content:center;
          font-size:12px;color:var(--ink-dim);cursor:pointer;overflow:hidden;
        ">
          ${portraitUrl ? `<img src="${portraitUrl}" style="width:100%;height:100%;object-fit:cover">` : "+ 立绘"}
        </div>
        <div style="font-size:12px;color:var(--ink-dim);margin-top:6px;">立绘</div>
        <input type="file" id="portrait-input" accept="image/*" hidden>
      </div>

      <div style="text-align:center">
        <div id="avatar-preview" style="
          width:80px;height:80px;
          border:1px dashed var(--line);border-radius:50%;
          background:var(--paper-soft);display:flex;align-items:center;justify-content:center;
          font-size:12px;color:var(--ink-dim);cursor:pointer;overflow:hidden;
        ">
          ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover">` : "+ 头像"}
        </div>
        <div style="font-size:12px;color:var(--ink-dim);margin-top:6px;">头像</div>
        <input type="file" id="avatar-input" accept="image/*" hidden>
      </div>
    </div>

    <div class="form-field">
      <label>角色名</label>
      <input type="text" id="name-input" class="input" value="${escapeHtml(char.name || "")}">
    </div>
    <div class="form-field">
      <label>昵称</label>
      <input type="text" id="nickname-input" class="input" value="${escapeHtml(char.nickname || "")}">
    </div>
    <div class="form-field" style="display:flex;gap:12px">
      <div style="flex:1"><label>渡号</label><input type="text" id="du-input" class="input" value="${escapeHtml(char.du || "")}"></div>
      <div style="flex:1"><label>年龄</label><input type="text" id="age-input" class="input" value="${escapeHtml(char.age || "")}"></div>
    </div>
    <div class="form-field">
      <label>渡言</label>
      <input type="text" id="dumotto-input" class="input" value="${escapeHtml(char.duMotto || "")}">
    </div>
    <div class="form-field">
      <label>小传</label>
      <textarea id="bio-input" class="input" style="min-height:120px;resize:vertical">${escapeHtml(char.bio || "")}</textarea>
    </div>

    <div class="form-field">
      <label>轶事</label>
      <textarea id="anecdotes-input" class="input" style="min-height:120px;resize:vertical" placeholder="写一些他/她的零散轶事，可分多段">${escapeHtml(char.anecdotes || "")}</textarea>
    </div>

    <div class="form-field">
      <label>回忆（TA 对你的回忆）</label>
      <div id="memories-list"></div>
      <button class="btn ghost" id="btn-add-memory" style="width:100%;margin-top:8px;padding:10px;">+ 添加一条回忆</button>
    </div>

    <div class="form-field">
      <label>事实（TA 记得的事实）</label>
      <div id="facts-list"></div>
      <button class="btn ghost" id="btn-add-fact" style="width:100%;margin-top:8px;padding:10px;">+ 添加一条事实</button>
    </div>

    <!-- ========== 关系网 ========== -->
    <div class="form-field" style="border-top:1px solid var(--line-light);padding-top:20px;margin-top:20px;">
      <label style="font-family:var(--font-title);font-size:15px;letter-spacing:3px;color:var(--cinnabar);">关 系 网</label>

      <div style="font-size:12px;color:var(--ink-dim);margin:8px 0 12px;">主要角色之间的关系，以及他身边的其他人物</div>

      <!-- 主要角色关系 -->
      <div style="font-size:13px;color:var(--ink-soft);letter-spacing:2px;margin-bottom:8px;">—— 主要角色 ——</div>
      <div id="char-relations-list"></div>
      <button class="btn ghost" id="btn-add-char-relation" style="width:100%;margin-top:8px;padding:10px;">＋ 添加角色关系</button>

      <!-- 其他人物 -->
      <div style="font-size:13px;color:var(--ink-soft);letter-spacing:2px;margin:20px 0 8px;">—— 其他人物 ——</div>
      <div id="npc-list"></div>
      <button class="btn ghost" id="btn-add-npc" style="width:100%;margin-top:8px;padding:10px;">＋ 添加人物</button>
    </div>

    <button class="btn" id="btn-save" style="width:100%;padding:14px;letter-spacing:6px;margin-top:16px;">保 存</button>
    <button class="btn ghost" id="btn-delete" style="width:100%;padding:14px;letter-spacing:6px;margin-top:8px;color:var(--cinnabar);">删 除 角 色</button>
  `;

  el.insertBefore(pageHeader("编 辑 角 色", "#/yaji"), el.firstChild);

  /* ========== 立绘 / 头像上传 ========== */
  let tempAvatarBlob = null;
  const avatarPreview = el.querySelector("#avatar-preview");
  const avatarInput = el.querySelector("#avatar-input");
  avatarPreview.onclick = () => avatarInput.click();
  avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const cropped = await openAvatarCropper(file, 200);
    if (!cropped) return;
    tempAvatarBlob = cropped;
    avatarPreview.innerHTML = `<img src="${URL.createObjectURL(cropped)}" style="width:100%;height:100%;object-fit:cover">`;
  };

  let tempPortraitBlob = null;
  const portraitPreview = el.querySelector("#portrait-preview");
  const portraitInput = el.querySelector("#portrait-input");
  portraitPreview.onclick = () => portraitInput.click();
  portraitInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 👈 读取文件并压缩
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawBase64 = ev.target.result;
      try {
        const { compressImage } = await import("../ui/image-cropper.js");
        const compressedBase64 = await compressImage(rawBase64, 1);
        
        
        // ✅ 改成直接存 Base64 字符串
        tempPortraitBlob = compressedBase64; 
        
        portraitPreview.innerHTML = `<img src="${compressedBase64}" style="width:100%;height:100%;object-fit:cover">`;
      } catch (err) {
        console.error(err);
        showToast("图片处理失败");
      }
    };
    reader.readAsDataURL(file);
  };

  /* ========== 回忆 / 事实 ========== */
  let memories = Array.isArray(char.memories) ? [...char.memories] : [];
  let facts    = Array.isArray(char.facts)    ? [...char.facts]    : [];

  const memoriesList = el.querySelector("#memories-list");
  const factsList    = el.querySelector("#facts-list");

  function makeUid() {
    return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function renderList(listEl, items) {
    listEl.innerHTML = "";
    if (items.length === 0) {
      listEl.innerHTML = `<div style="font-size:12px;color:var(--ink-dim);padding:8px 0;">暂无，点下方按钮添加。</div>`;
      return;
    }
    items.forEach((item, idx) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;";
      row.innerHTML = `
        <textarea class="input" style="flex:1;min-height:60px;resize:vertical">${escapeHtml(item.text || "")}</textarea>
        <button class="btn ghost" style="padding:8px 10px;color:var(--cinnabar);" title="删除">×</button>
      `;
      const ta = row.querySelector("textarea");
      const btn = row.querySelector("button");

      ta.oninput = () => { items[idx].text = ta.value; };
      btn.onclick = () => {
        items.splice(idx, 1);
        renderList(listEl, items);
      };

      listEl.appendChild(row);
    });
  }

  renderList(memoriesList, memories);
  renderList(factsList, facts);

  el.querySelector("#btn-add-memory").onclick = () => {
    memories.push({ id: makeUid(), text: "", source: "manual", createdAt: Date.now() });
    renderList(memoriesList, memories);
  };

  el.querySelector("#btn-add-fact").onclick = () => {
    facts.push({ id: makeUid(), text: "", source: "manual", createdAt: Date.now() });
    renderList(factsList, facts);
  };

  /* ========== 关系网 ========== */
  const allChars = (await getCharactersByOwner(ownerId)).filter(c => c.id !== char.id);

  async function renderCharRelations() {
    const listEl = el.querySelector("#char-relations-list");
    const rels = await getCharacterRelations(ownerId, char.id);

    if (!rels.length) {
      listEl.innerHTML = `<div style="font-size:12px;color:var(--ink-dim);padding:8px 0;">暂无。</div>`;
      return;
    }

    listEl.innerHTML = rels.map(r => {
      const otherId = r.fromId === char.id ? r.toId : r.fromId;
      const other = allChars.find(c => c.id === otherId);
      if (!other) return "";
      return `
        <div class="rel-row" data-id="${r.id}" style="
          display:flex;align-items:center;gap:10px;padding:10px 12px;
          background:var(--paper);border:1px solid var(--line-light);
          border-radius:var(--radius-sm);margin-bottom:6px;
        ">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--ink);">${escapeHtml(other.name)} · <span style="color:var(--cinnabar);">${escapeHtml(r.relation || "（未填关系）")}</span></div>
            ${r.description ? `<div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${escapeHtml(r.description)}</div>` : ""}
          </div>
          <button class="btn ghost rel-edit" style="padding:6px 8px;font-size:12px;">编辑</button>
          <button class="btn ghost rel-del" style="padding:6px 10px;color:var(--cinnabar);">×</button>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".rel-row").forEach(row => {
      const id = row.dataset.id;
      const rel = rels.find(r => r.id === id);
      row.querySelector(".rel-del").onclick = async () => {
        const ok = await showConfirm("删除关系", "确定？");
        if (!ok) return;
        await deleteCharacterRelation(id);
        showToast("已删除");
        renderCharRelations();
      };
      row.querySelector(".rel-edit").onclick = () => openCharRelationModal(rel);
    });
  }

  async function openCharRelationModal(rel = null) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const isEdit = !!rel;

    let selectedToId = rel?.toId || (rel?.fromId && rel.fromId !== char.id ? rel.fromId : null);
    let relationText = rel?.relation || "";
    let descriptionText = rel?.description || "";

    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
        ${isEdit ? "编辑关系" : "添加角色关系"}
      </div>

      <div class="form-field">
        <label>对方角色</label>
        <select class="input" id="rel-to">
          <option value="">（选择）</option>
          ${allChars.map(c => `<option value="${c.id}" ${selectedToId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>

      <div class="form-field">
        <label>关系</label>
        <input type="text" class="input" id="rel-name" value="${escapeHtml(relationText)}" placeholder="如：师兄弟 / 对手 / 朋友" maxlength="20">
      </div>

      <div class="form-field">
        <label>描述（可选）</label>
        <textarea class="input" id="rel-desc" style="min-height:60px;" placeholder="补充说明">${escapeHtml(descriptionText)}</textarea>
      </div>

      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn ghost" id="rel-cancel" style="flex:1;padding:12px;">取 消</button>
        <button class="btn" id="rel-ok" style="flex:1;padding:12px;">确 定</button>
      </div>
    `);

    modal.querySelector("#rel-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#rel-ok").onclick = async () => {
      const toId = modal.querySelector("#rel-to").value;
      const r = modal.querySelector("#rel-name").value.trim();
      const d = modal.querySelector("#rel-desc").value.trim();
      if (!toId) { showToast("请选择对方角色"); return; }
      if (!r) { showToast("请填写关系"); return; }

      if (isEdit) {
        await updateCharacterRelation(rel.id, { relation: r, description: d });
      } else {
        await createCharacterRelation(ownerId, char.id, toId, r, d);
      }
      closeModal(modal);
      showToast("已保存");
      renderCharRelations();
    };
  }

  el.querySelector("#btn-add-char-relation").onclick = () => openCharRelationModal();

  async function renderNpcList() {
    const listEl = el.querySelector("#npc-list");
    const npcs = await getNpcsByCharacter(ownerId, char.id);

    if (!npcs.length) {
      listEl.innerHTML = `<div style="font-size:12px;color:var(--ink-dim);padding:8px 0;">暂无。</div>`;
      return;
    }

    listEl.innerHTML = npcs.map(n => `
      <div class="npc-row" data-id="${n.id}" style="
        display:flex;align-items:center;gap:10px;padding:10px 12px;
        background:var(--paper);border:1px solid var(--line-light);
        border-radius:var(--radius-sm);margin-bottom:6px;
      ">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;color:var(--ink);">${escapeHtml(n.name)}${n.relation ? ` · <span style="color:var(--cinnabar);">${escapeHtml(n.relation)}</span>` : ""}</div>
          ${n.description ? `<div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${escapeHtml(n.description)}</div>` : ""}
        </div>
        <button class="btn ghost npc-edit" style="padding:6px 8px;font-size:12px;">编辑</button>
        <button class="btn ghost npc-del" style="padding:6px 10px;color:var(--cinnabar);">×</button>
      </div>
    `).join("");

    listEl.querySelectorAll(".npc-row").forEach(row => {
      const id = row.dataset.id;
      const npc = npcs.find(n => n.id === id);
      row.querySelector(".npc-del").onclick = async () => {
        const ok = await showConfirm("删除人物", "人物和 TA 的字卡分组会一起删除。确定？");
        if (!ok) return;
        await deleteNpc(id);
        showToast("已删除");
        renderNpcList();
      };
      row.querySelector(".npc-edit").onclick = () => openNpcModal(npc);
    });
  }

  async function openNpcModal(npc = null) {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const { openAvatarCropper } = await import("../ui/avatar-cropper.js");
    const isEdit = !!npc;

    let currentAvatarUrl = null;
    if (npc?.avatarId) {
      currentAvatarUrl = await getImageUrl(npc.avatarId, true);
    }

    let tempAvatarBlob = null;

    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:20px;">
        ${isEdit ? "编辑人物" : "添加人物"}
      </div>

      <div style="display:flex;justify-content:center;margin-bottom:16px;">
        <div style="text-align:center;">
          <div id="npc-avatar-preview" style="
            width:80px;height:80px;
            border:1px dashed var(--line);border-radius:50%;
            background:var(--paper-soft);
            display:flex;align-items:center;justify-content:center;
            font-size:12px;color:var(--ink-dim);
            cursor:pointer;overflow:hidden;
          ">
            ${currentAvatarUrl
              ? `<img src="${currentAvatarUrl}" style="width:100%;height:100%;object-fit:cover">`
              : "+ 头像"}
          </div>
          <div style="font-size:12px;color:var(--ink-dim);margin-top:6px;">头像</div>
          <input type="file" id="npc-avatar-input" accept="image/*" hidden>
        </div>
      </div>

      <div class="form-field">
        <label>名字（必填）</label>
        <input type="text" class="input" id="npc-name" value="${escapeHtml(npc?.name || "")}" maxlength="20">
      </div>

      <div class="form-field">
        <label>关系（如：随侍 / 师父 / 对手）</label>
        <input type="text" class="input" id="npc-relation" value="${escapeHtml(npc?.relation || "")}" maxlength="20">
      </div>

      <div class="form-field">
        <label>简介</label>
        <textarea class="input" id="npc-desc" style="min-height:80px;">${escapeHtml(npc?.description || "")}</textarea>
      </div>

      <div class="form-field">
        <label>加好友门槛（跟绑定角色友善值达标后）</label>
        <select class="input" id="npc-threshold">
          <option value="0" ${npc?.requiredFriendship === 0 ? "selected" : ""}>0 · 无需门槛</option>
          <option value="40" ${(!npc || npc.requiredFriendship === 40) ? "selected" : ""}>40 · 泛泛之交</option>
          <option value="60" ${npc?.requiredFriendship === 60 ? "selected" : ""}>60 · 情愫暗生</option>
        </select>
      </div>

      <div style="font-size:11px;color:var(--ink-dim);margin-top:8px;line-height:1.6;">
        字卡分组会自动创建（名字同名），可去「探秘 → 笺语」里补充字卡。
      </div>

      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn ghost" id="npc-cancel" style="flex:1;padding:12px;">取 消</button>
        <button class="btn" id="npc-ok" style="flex:1;padding:12px;">确 定</button>
      </div>
    `);

    // 头像上传
    const avatarPreview = modal.querySelector("#npc-avatar-preview");
    const avatarInput = modal.querySelector("#npc-avatar-input");
    avatarPreview.onclick = () => avatarInput.click();
    avatarInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const cropped = await openAvatarCropper(file, 200);
      if (!cropped) return;
      tempAvatarBlob = cropped;
      avatarPreview.innerHTML = `<img src="${URL.createObjectURL(cropped)}" style="width:100%;height:100%;object-fit:cover">`;
    };

    modal.querySelector("#npc-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#npc-ok").onclick = async () => {
      const name = modal.querySelector("#npc-name").value.trim();
      if (!name) { showToast("请填名字"); return; }

      const relation = modal.querySelector("#npc-relation").value.trim();
      const description = modal.querySelector("#npc-desc").value.trim();
      const requiredFriendship = +modal.querySelector("#npc-threshold").value;

      // 头像
      let avatarId = npc?.avatarId || null;
      if (tempAvatarBlob) {
        const { saveToGallery } = await import("../services/character-service.js");
        avatarId = await saveToGallery(tempAvatarBlob, "avatar");
      }

      if (isEdit) {
        await updateNpc(npc.id, { name, relation, description, requiredFriendship, avatarId });
      } else {
        await createNpc(ownerId, {
          linkedCharacterIds: [char.id],
          name, relation, description, requiredFriendship, avatarId,
        });
      }
      closeModal(modal);
      showToast("已保存");
      renderNpcList();
    };
  }

  el.querySelector("#btn-add-npc").onclick = () => openNpcModal();

  await renderCharRelations();
  await renderNpcList();

  /* ========== 保存 ========== */
  el.querySelector("#btn-save").onclick = async () => {
    const name = el.querySelector("#name-input").value.trim();
    if (!name) { showToast("请输入角色名"); return; }

    const { saveToGallery } = await import("../services/character-service.js");

    let avatarId = char.avatarId;
    if (tempAvatarBlob) {
      // 👈 确保传过去的确实是 Blob，如果是 base64 就要处理
      avatarId = await saveToGallery(tempAvatarBlob, "avatar");
    }

    let portraitId = char.portraitId;
    if (tempPortraitBlob) {
      // 👈 这里的 tempPortraitBlob 可能是 Blob，也可能是空
      if (!tempPortraitBlob) {
        showToast("立绘文件丢失，请重新上传");
        return;
      }
      portraitId = await saveToGallery(tempPortraitBlob, "portrait");
    }

    // 使用 try...catch 捕获保存报错，防止弹全局报错
    try {
      await updateCharacter(characterId, {
        name,
        nickname: el.querySelector("#nickname-input").value.trim() || null,
        du: el.querySelector("#du-input").value.trim() || null,
        duMotto: el.querySelector("#dumotto-input").value.trim() || null,
        age: el.querySelector("#age-input").value.trim() || null,
        bio: el.querySelector("#bio-input").value.trim() || "",
        avatarId,
        portraitId,
        anecdotes: el.querySelector("#anecdotes-input").value.trim() || "",
        memories: memories.filter(m => m.text.trim() !== ""),
        facts:    facts.filter(f => f.text.trim() !== ""),
      });
      showToast("已保存");
      location.hash = "#/yaji";
    } catch (e) {
      console.error("保存失败", e);
      showToast("保存失败，请查看控制台");
    }
  };

  el.querySelector("#btn-delete").onclick = async () => {
    const ok = await showConfirm("删除角色", `确定删除「${char.name}」？他的对话、笺语都会一并消失。`);
    if (!ok) return;
    const { deleteCharacter } = await import("../services/character-service.js");
    await deleteCharacter(characterId);
    showToast("已删除");
    location.hash = "#/yaji";
  };

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}