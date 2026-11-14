import { db } from "../core/db.js";
import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { showModal, closeModal } from "../ui/modal.js";
import { showConfirm } from "../ui/confirm.js";
import { showToast } from "../ui/toast.js";
import {
  getAllCards, getGroups, createGroup, deleteGroup,
  createCard, updateCard, deleteCard,
  batchDeleteCards, batchMoveCards, batchToggleCards,
  exportCards, importCards,
} from "../services/card-service.js";

const INTIMACY_LEVELS = [
  { level: 0, name: "全部" },
  { level: 1, name: "陌路" },
  { level: 2, name: "相识" },
  { level: 3, name: "友邻" },
  { level: 4, name: "知己" },
  { level: 5, name: "归处" },
];

let curFirstLevel = "全部";
let curGroupId = "all";
let checked = new Set();
let intimacyFilter = 0;
let searchQuery = "";

export async function tanmiCardsView() {
  const el = document.createElement("div");
  el.className = "card-page";

  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  el.innerHTML = `
  <div class="card-top-bar">
    <input type="text" class="card-search" id="card-search" placeholder="寻笺……">
    <button class="card-add-btn" id="btn-add-menu">添</button>
  </div>

  <div class="add-menu-panel" id="add-menu-panel" style="display:none;">
    <button data-act="new-card">新建笺语</button>
    <button data-act="batch-add">批量粘贴</button>
    <button data-act="new-group">新建分组</button>
    <button data-act="import">导入字卡</button>
    <button data-act="export">导出字卡</button>
    <button data-act="intimacy">缘分筛选</button>
    <button data-act="clear-all" style="color: var(--cinnabar);">笺语尽散</button>
  </div>

  <div class="card-segmented-control" id="seg-control">
    <div class="seg-item active" data-level="通用">通用笺语</div>
    <div class="seg-item" data-level="专属" id="seg-zhuan">
      专属(<span id="current-char-name" style="cursor: pointer; text-decoration: underline; text-underline-offset: 4px;">盛崖余 ▾</span>)
    </div>
    <div class="seg-item" data-level="友人">友人笺语</div>
  </div>

  <div class="card-filters" id="intimacy-tabs" style="display: none;">
    <div class="card-tab on" data-level="0">全部</div>
    <div class="card-tab" data-level="1">陌路</div>
    <div class="card-tab" data-level="2">相识</div>
    <div class="card-tab" data-level="3">友邻</div>
    <div class="card-tab" data-level="4">知己</div>
    <div class="card-tab" data-level="5">归处</div>
  </div>

  <div class="card-filters" id="group-tabs"></div>
  <div class="card-list" id="card-list"></div>

  <div class="batch-bar" id="batch-bar">
    <a data-act="select-all">全取</a>
    <a data-act="batch-tag">共标</a>
    <a data-act="batch-delete">共删</a>
    <a data-act="batch-move">共移</a>
    <a data-act="batch-enable">共启</a>
    <a data-act="batch-disable">共禁</a>
    <a data-act="clear-check">罢</a>
  </div>
  `;

  el.insertBefore(pageHeader("笺 语", "#/tanmi"), el.firstChild);

  // --- 以下是新的事件绑定 ---
  const addMenuBtn = el.querySelector("#btn-add-menu");
  const addMenuPanel = el.querySelector("#add-menu-panel");
  
  addMenuBtn.onclick = (e) => {
    e.stopPropagation();
    addMenuPanel.style.display = addMenuPanel.style.display === "none" ? "flex" : "none";
  };
  document.addEventListener('click', (e) => {
    if (!addMenuPanel.contains(e.target) && e.target !== addMenuBtn) addMenuPanel.style.display = "none";
  });

  addMenuPanel.addEventListener("click", (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    addMenuPanel.style.display = "none";
    if (act === "new-card") openEditModal(null);
    if (act === "new-group") openNewGroupModal();
    if (act === "batch-add") openBatchAddModal();
    if (act === "import") openImportModal();
    if (act === "export") openExportModal();
    if (act === "clear-all") clearAll();
    if (act === "intimacy") {
      const tabs = el.querySelector("#intimacy-tabs");
      tabs.style.display = tabs.style.display === "none" ? "flex" : "none";
    }
  });

  el.querySelector("#intimacy-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-level]");
    if (!tab) return;
    intimacyFilter = +tab.dataset.level;
    el.querySelectorAll("#intimacy-tabs .card-tab").forEach(t => t.classList.toggle("on", +t.dataset.level === intimacyFilter));
    renderList();
  });

  el.querySelector("#batch-bar").addEventListener("click", async (e) => {
    const act = e.target.dataset.act;
    if (act) await handleBatch(act);
  });

  // 搜索
  let searchTimer = null;
  el.querySelector("#card-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      if (searchQuery) {
        curFirstLevel = "全部";
        curGroupId = "all";
      }
      renderList();
    }, 300);
  });

el.querySelector("#intimacy-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-level]");
  if (!tab) return;
  intimacyFilter = +tab.dataset.level;
  el.querySelectorAll("#intimacy-tabs .card-tab").forEach(t => {
    t.classList.toggle("on", +t.dataset.level === intimacyFilter);
  });
  renderList();
});




  // 批量操作
  el.querySelector("#batch-bar").addEventListener("click", async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    await handleBatch(act);
  });

  // 渲染
  async function renderList() {
    const groups = await getGroups(ownerId);
    const cards = await getAllCards(ownerId);
    const characters = await db.all("characters");
    const myChars = characters.filter(c => c.ownerId === ownerId);

    // 1. 初始化分类状态
    const charNameSpan = el.querySelector("#current-char-name");
    
    // 如果还没选过，默认显示“通用”
    if (!curFirstLevel || curFirstLevel === "全部") {
      curFirstLevel = "通用"; 
    }
    
    // 如果当前选中是角色，但还没设置名字，默认用第一个角色
    let currentCharName = myChars.length > 0 ? myChars[0].name : "角色";
    if (!["通用", "友人"].includes(curFirstLevel) && !myChars.some(c => c.name === curFirstLevel)) {
       curFirstLevel = currentCharName;
    }

    // 更新按钮显示的文字
    if (curFirstLevel === "通用" || curFirstLevel === "友人") {
       charNameSpan.textContent = `${currentCharName} ▾`;
    } else {
       charNameSpan.textContent = `${curFirstLevel} ▾`;
    }

    // 初始化时，把对应的 Tab 加上高亮
    el.querySelectorAll(".seg-item").forEach(item => {
      item.onclick = (e) => {
        const level = item.dataset.level;
        
        if (level === "专属") {
          // --- 点击了专属 ---
          e.preventDefault();
          e.stopPropagation();
          
          // 弹窗
          const old = document.querySelector(".custom-char-menu");
          if (old) old.remove();

          const menu = document.createElement("div");
          menu.className = "custom-char-menu";
          menu.innerHTML = myChars.map(c => 
            `<div class="char-option ${curFirstLevel === c.name ? 'active' : ''}" data-name="${c.name}">${c.name}</div>`
          ).join("");
          document.body.appendChild(menu);
          
          const rect = item.getBoundingClientRect();
          menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
          menu.style.left = `${rect.left + window.scrollX + rect.width / 2 - 50}px`; 

          menu.querySelectorAll(".char-option").forEach(opt => {
            opt.onclick = () => {
              curFirstLevel = opt.dataset.name;
              charNameSpan.textContent = `${curFirstLevel} ▾`;
              curGroupId = "all";
              menu.remove();
              
              // 切换高亮并重绘
              el.querySelectorAll(".seg-item").forEach(i => i.classList.remove("active"));
              item.classList.add("active");
              renderList(); 
            };
          });

          setTimeout(() => {
            const closeMenu = (ev) => {
              if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", closeMenu); }
            };
            document.addEventListener("click", closeMenu);
          }, 10);

        } else {
          // --- 点击了通用或友人 ---
          curFirstLevel = level;
          curGroupId = "all";
          checked.clear();
          
          // 切换高亮并重绘
          el.querySelectorAll(".seg-item").forEach(i => i.classList.remove("active"));
          item.classList.add("active");
          renderList();
        }
      };
    });

    // 2. 绑定“三分天下”的切换事件
    el.querySelectorAll(".seg-item").forEach(item => {
      item.onclick = (e) => {
        const level = item.dataset.level;
        
        // 👈 核心逻辑：如果点的是“专属”，就弹窗；如果点的是“通用/友人”，就切Tab
        if (level === "专属") {
          e.preventDefault();
          e.stopPropagation();
          
          // 先把它设为 active
          el.querySelectorAll(".seg-item").forEach(i => i.classList.remove("active"));
          item.classList.add("active");

          // 清理旧菜单，防止叠罗汉变黑
          const old = document.querySelector(".custom-char-menu");
          if (old) old.remove();

          // 弹出自定义菜单
          const menu = document.createElement("div");
          menu.className = "custom-char-menu";
          menu.innerHTML = myChars.map(c => 
            `<div class="char-option ${curFirstLevel === c.name ? 'active' : ''}" data-name="${c.name}">${c.name}</div>`
          ).join("");
          document.body.appendChild(menu);
          
          // 定位
          const rect = item.getBoundingClientRect();
          menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
          menu.style.left = `${rect.left + window.scrollX + rect.width / 2 - 50}px`; 

          // 菜单选项点击
          menu.querySelectorAll(".char-option").forEach(opt => {
            opt.onclick = () => {
              curFirstLevel = opt.dataset.name;
              charNameSpan.textContent = `${curFirstLevel} ▾`;
              curGroupId = "all";
              menu.remove();
              renderList(); // 重绘
            };
          });

          // 点空白关闭
          setTimeout(() => {
            const closeMenu = (ev) => {
              if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener("click", closeMenu);
              }
            };
            document.addEventListener("click", closeMenu);
          }, 10);

        } else {
          // 如果是“通用”或者“友人”
          el.querySelectorAll(".seg-item").forEach(i => i.classList.remove("active"));
          item.classList.add("active");
          curFirstLevel = level;
          curGroupId = "all";
          checked.clear();
          renderList();
        }
      };
    });



    // 3. 过滤并渲染二级分类
    let availableGroups = groups.filter(g => !g.isAll);
    if (curFirstLevel === "通用") {
      availableGroups = availableGroups.filter(g => !g.name.startsWith("["));
    } else if (curFirstLevel === "友人") {
      availableGroups = availableGroups.filter(g => g.name.startsWith("[友人] "));
    } else {
      availableGroups = availableGroups.filter(g => g.name.startsWith(`[${curFirstLevel}] `));
    }

    el.querySelector("#group-tabs").innerHTML = [
      `<div class="card-tab ${curGroupId === "all" ? "on" : ""}" data-gid="all">全部</div>`,
      ...availableGroups.map(g => {
        let displayName = curFirstLevel === "通用" ? g.name : g.name.replace(`[${curFirstLevel}] `, "");
        if (curFirstLevel === "友人") displayName = g.name.replace(`[友人] `, "");
        return `<div class="card-tab ${curGroupId === g.id ? "on" : ""}" data-gid="${g.id}">${displayName}<span data-del-gid="${g.id}" style="opacity:0.5;margin-left:4px;display:none;">×</span></div>`;
      })
    ].join("");

    // 👈 统一的鼠标拖拽引擎（合并版）
    const tabsContainer = el.querySelector("#group-tabs");
    let isDown = false;
    let startX;
    let scrollLeft;

    // 防止重复绑定事件（每次 renderList 重新渲染时，先清理旧的监听器）
    // 这里使用 onmousedown 等替代 addEventListener 可以避免多次渲染导致的叠加问题
    tabsContainer.onmousedown = (e) => {
      isDown = true;
      tabsContainer.dataset.dragging = "false";
      tabsContainer.style.cursor = 'grabbing';
      startX = e.pageX - tabsContainer.offsetLeft;
      scrollLeft = tabsContainer.scrollLeft;
    };

    tabsContainer.onmouseleave = () => {
      isDown = false;
      tabsContainer.style.cursor = 'default';
    };

    tabsContainer.onmouseup = () => {
      isDown = false;
      tabsContainer.style.cursor = 'default';
    };

    tabsContainer.onmousemove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - tabsContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      
      // 移动距离超过 5 像素，标记为拖拽中
      if (Math.abs(walk) > 5) {
        tabsContainer.dataset.dragging = "true"; 
      }
      tabsContainer.scrollLeft = scrollLeft - walk;
    };

    // 绑定标签的点击事件（带防误触）
    el.querySelectorAll("#group-tabs .card-tab").forEach(t => {
      t.onclick = (e) => {
        if (tabsContainer.dataset.dragging === "true") return;
        if (e.target.dataset.delGid) { 
          e.stopPropagation(); 
          onDeleteGroup(e.target.dataset.delGid); 
          return; 
        }
        curGroupId = t.dataset.gid; 
        checked.clear(); 
        renderList();
      };
      
      t.onmouseenter = () => { if(t.querySelector('[data-del-gid]')) t.querySelector('[data-del-gid]').style.display = 'inline-block'; };
      t.onmouseleave = () => { if(t.querySelector('[data-del-gid]')) t.querySelector('[data-del-gid]').style.display = 'none'; };
    });


    // 4. 过滤卡片数据 (保持你原来的逻辑)
    let list = cards.slice();
    if (curGroupId !== "all") {
      list = list.filter(c => c.groupId === curGroupId);
    } else if (curFirstLevel === "通用") {
      const generalGroupIds = new Set(groups.filter(g => !g.isAll && !g.name.startsWith("[")).map(g => g.id));
      list = list.filter(c => generalGroupIds.has(c.groupId));
    } else if (curFirstLevel === "友人") {
      const friendGroupIds = new Set(groups.filter(g => g.name.startsWith("[友人] ")).map(g => g.id));
      list = list.filter(c => friendGroupIds.has(c.groupId));
    } else {
      const charGroupIds = new Set(groups.filter(g => g.name.startsWith(`[${curFirstLevel}] `)).map(g => g.id));
      list = list.filter(c => charGroupIds.has(c.groupId));
    }

    if (intimacyFilter > 0) list = list.filter(c => (c.intimacyLevel || 1) === intimacyFilter);
    if (searchQuery) {
      list = list.filter(c => c.content.toLowerCase().includes(searchQuery) || (c.tags || []).some(t => t.toLowerCase().includes(searchQuery)));
    }

    // 5. 渲染卡片 (保持你原来的逻辑)
    const listEl = el.querySelector("#card-list");
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">${searchQuery ? "无匹配" : "该分组暂无笺语"}</div>`;
      renderBatchBar();
      return;
    }

    listEl.innerHTML = list.map(c => `
      <div class="card-row" data-cid="${c.id}">
        <input type="checkbox" class="ck" ${checked.has(c.id) ? "checked" : ""}>
        <div style="flex:1;min-width:0;">
          <div class="cnt">${escapeHtml(c.content)}</div>
          <div class="meta">
            ${(c.tags || []).map(t => `#${t}`).join(" ") || "&nbsp;"} · 权${c.weight || 1} · ${INTIMACY_LEVELS.find(l => l.level === (c.intimacyLevel || 1))?.name || "陌路"}
          </div>
        </div>
        <div class="sw ${c.enabled ? "on" : ""}" data-toggle="${c.id}"></div>
        <div class="acts"><a data-edit="${c.id}">编辑</a><a data-del="${c.id}">删除</a></div>
      </div>
    `).join("");

    listEl.querySelectorAll(".ck").forEach(ck => {
      ck.onclick = (e) => {
        const cid = e.target.closest(".card-row").dataset.cid;
        if (e.target.checked) checked.add(cid); else checked.delete(cid);
        renderBatchBar();
      };
    });
    listEl.querySelectorAll("[data-toggle]").forEach(sw => {
      sw.onclick = async () => {
        const c = await db.get("cards", sw.dataset.toggle);
        if (c) { c.enabled = !c.enabled; c.updatedAt = Date.now(); await db.put("cards", c); renderList(); }
      };
    });
    listEl.querySelectorAll("[data-edit]").forEach(a => a.onclick = () => openEditModal(a.dataset.edit));
    listEl.querySelectorAll("[data-del]").forEach(a => {
      a.onclick = async () => {
        const ok = await showConfirm("删除笺语", "确定删除这条笺语吗？");
        if (!ok) return;
        await deleteCard(a.dataset.del);
        showToast("已删除");
        renderList();
      };
    });

    renderBatchBar();
  }


  function renderBatchBar() {
    const bar = el.querySelector("#batch-bar");
    bar.classList.toggle("show", checked.size > 0);
  }

  async function handleBatch(act) {
    if (act === "select-all") {
      document.querySelectorAll("#card-list .card-row").forEach(row => {
        const ck = row.querySelector(".ck");
        if (ck && !ck.checked) {
          ck.checked = true;
          checked.add(row.dataset.cid);
        }
      });
      renderBatchBar();
      return;
    }
    if (act === "clear-check") {
      checked.clear();
      renderList();
      return;
    }
    if (!checked.size) return;

    if (act === "batch-delete") {
      const ok = await showConfirm("批量删除", `确定删除选中 ${checked.size} 条笺语？`);
      if (!ok) return;
      await batchDeleteCards([...checked]);
      checked.clear();
      showToast("已删除");
      renderList();
    }
    if (act === "batch-move") {
      const groups = await getGroups(ownerId);
      openMoveModal(groups);
    }
    if (act === "batch-enable") {
      await batchToggleCards([...checked], true);
      showToast("已启用");
      renderList();
    }
    if (act === "batch-disable") {
      await batchToggleCards([...checked], false);
      showToast("已禁用");
      renderList();
    }
  if (act === "batch-tag") {
    openBatchTagModal();
  }
  }

  async function openBatchTagModal() {
    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        批量加标签
      </div>
      <div class="form-field">
        <label>要添加的标签（逗号分隔）</label>
        <input type="text" id="bt-tags" placeholder="如：天真,正直,重情" class="input">
      </div>
      <div class="form-field">
        <label>操作方式</label>
        <select id="bt-mode" class="input">
          <option value="add">追加（保留原标签）</option>
          <option value="replace">替换（清空原标签）</option>
        </select>
      </div>
      <div style="font-size:12px;color:var(--ink-dim);margin-top:8px;">
        共 ${checked.size} 条笺语将被修改。
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="bt-cancel" class="btn ghost" style="flex: 1;">取 消</button>
        <button id="bt-save" class="btn" style="flex: 1;">确 定</button>
      </div>
    `);

    modal.querySelector("#bt-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#bt-save").onclick = async () => {
      const raw = modal.querySelector("#bt-tags").value.trim();
      const mode = modal.querySelector("#bt-mode").value;

      const newTags = raw
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean);

      if (!newTags.length && mode === "add") {
        showToast("请输入标签");
        return;
      }

      let count = 0;
      for (const id of checked) {
        const card = await db.get("cards", id);
        if (!card) continue;

        let finalTags;
        if (mode === "replace") {
          finalTags = newTags;
        } else {
          // 追加：去重
          const set = new Set([...(card.tags || []), ...newTags]);
          finalTags = [...set];
        }

        card.tags = finalTags;
        card.updatedAt = Date.now();
        await db.put("cards", card);
        count++;
      }

      showToast(`已修改 ${count} 条`);
      checked.clear();
      closeModal(modal);
      renderList();
    };
  }

  /* ====== 弹窗 ====== */

  async function openEditModal(cardId) {
    const card = cardId ? await db.get("cards", cardId) : null;
    const groups = await getGroups(ownerId);

    let tags = (card?.tags || []).slice();
    let weight = card?.weight || 1;
    let nameBonus = card?.nameBonus || 0;
    let intimacy = card?.intimacyLevel || 1;

    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        ${card ? "编辑笺语" : "新建笺语"}
      </div>

      <div class="form-field">
        <label>内容（必填）</label>
        <textarea id="edit-content" rows="3" style="resize: vertical;">${card?.content || ""}</textarea>
      </div>

      <div class="form-field">
        <label>分组</label>
        <select id="edit-group">
          <option value="">未分组</option>
          ${groups.filter(g => !g.isAll).map(g => `
            <option value="${g.id}" ${card?.groupId === g.id ? "selected" : ""}>${g.name}</option>
          `).join("")}
        </select>
      </div>

      <div class="form-field">
        <label>触发词（逗号分隔）</label>
        <input type="text" id="edit-triggers" value="${(card?.triggers || []).join(",")}" placeholder="如：我难受,我不开心">
      </div>

      <div class="form-field">
        <label>标签</label>
        <div class="tag-picker" id="edit-tags"></div>
        <input type="text" id="edit-tag-input" placeholder="输入后回车" style="margin-top: 8px;">
      </div>

      <div class="form-field">
        <label>权重 1~5</label>
        <div class="tag-picker" id="edit-weight"></div>
      </div>

      <div class="form-field">
        <label>称呼加成 0~5</label>
        <div class="tag-picker" id="edit-name-bonus"></div>
      </div>

      <div class="form-field">
        <label>亲密等级 1~5</label>
        <div class="tag-picker" id="edit-intimacy"></div>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="edit-cancel" class="btn ghost" style="flex: 1;">取 消</button>
        <button id="edit-save" class="btn" style="flex: 1;">保 存</button>
      </div>
    `);

    const tagsEl = modal.querySelector("#edit-tags");
    const weightEl = modal.querySelector("#edit-weight");
    const nameBonusEl = modal.querySelector("#edit-name-bonus");
    const intimacyEl = modal.querySelector("#edit-intimacy");

    function renderTags() {
      tagsEl.innerHTML = tags.map((t, i) =>
        `<span class="t on" data-tag-i="${i}">${t} ×</span>`
      ).join("");
      tagsEl.querySelectorAll("[data-tag-i]").forEach(s => {
        s.onclick = () => {
          tags.splice(+s.dataset.tagI, 1);
          renderTags();
        };
      });
    }

    // ✅ 修正：不用 arguments.callee
    function renderWeight() {
      renderPicker(weightEl, [1, 2, 3, 4, 5], weight, (v) => {
        weight = v;
        renderWeight();
      });
    }
    function renderNameBonus() {
      renderPicker(nameBonusEl, [0, 1, 2, 3, 4, 5], nameBonus, (v) => {
        nameBonus = v;
        renderNameBonus();
      });
    }
    function renderIntimacy() {
      renderPicker(intimacyEl, [1, 2, 3, 4, 5], intimacy, (v) => {
        intimacy = v;
        renderIntimacy();
      });
    }

    function renderPicker(el, values, current, onPick) {
      el.innerHTML = values.map(v =>
        `<span class="t ${v === current ? "on" : ""}" data-v="${v}">${v}</span>`
      ).join("");
      el.querySelectorAll("[data-v]").forEach(s => {
        s.onclick = () => onPick(+s.dataset.v);
      });
    }

    renderTags();
    renderWeight();
    renderNameBonus();
    renderIntimacy();

    // 标签输入
    modal.querySelector("#edit-tag-input").onkeydown = (e) => {
      if (e.key === "Enter") {
        const v = e.target.value.trim();
        if (v && !tags.includes(v)) {
          tags.push(v);
          renderTags();
        }
        e.target.value = "";
        e.preventDefault();
      }
    };

    modal.querySelector("#edit-cancel").onclick = () => closeModal(modal);
modal.querySelector("#edit-save").onclick = async () => {
  // ⚠️ 保存前，把输入框里没回车的标签也加上
  const tagInput = modal.querySelector("#edit-tag-input");
  const pendingTag = tagInput.value.trim();
  if (pendingTag && !tags.includes(pendingTag)) {
    tags.push(pendingTag);
  }

  const content = modal.querySelector("#edit-content").value.trim();
  if (!content) {
    showToast("请输入内容");
    return;
  }
  const groupId = modal.querySelector("#edit-group").value || null;
  const triggers = modal.querySelector("#edit-triggers").value.split(",").map(s => s.trim()).filter(Boolean);

  if (card) {
    await updateCard(card.id, { content, groupId, triggers, tags, weight, nameBonus, intimacyLevel: intimacy });
    showToast("已保存");
  } else {
    await createCard(ownerId, { content, groupId, triggers, tags, weight, nameBonus, intimacyLevel: intimacy });
    showToast("已添加");
  }
  closeModal(modal);
  renderList();
};
  }

  async function openNewGroupModal() {
    const characters = await db.all("characters");
    const myChars = characters.filter(c => c.ownerId === ownerId);

    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        新建分组
      </div>
      <div class="form-field">
        <label>分组名</label>
        <input type="text" id="ng-name" placeholder="如：通用问候">
      </div>
      <div class="form-field">
        <label>归属</label>
        <select id="ng-owner">
          <option value="general">通用</option>
          ${myChars.map(c => `<option value="${c.name}">${c.name}专属</option>`).join("")}
          <option value="友人">友人</option>
        </select>
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="ng-cancel" class="btn ghost" style="flex: 1;">取 消</button>
        <button id="ng-save" class="btn" style="flex: 1;">保 存</button>
      </div>
    `);

    modal.querySelector("#ng-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#ng-save").onclick = async () => {
      const name = modal.querySelector("#ng-name").value.trim();
      if (!name) {
        showToast("请输入分组名");
        return;
      }
      const owner = modal.querySelector("#ng-owner").value;
      const finalName = owner === "general" ? name : `[${owner}] ${name}`;

      const groups = await getGroups(ownerId);
      if (groups.some(g => g.name === finalName)) {
        showToast("已存在");
        return;
      }
      await createGroup(ownerId, finalName);
      showToast("已创建");
      closeModal(modal);
      renderList();
    };
  }

  async function onDeleteGroup(gid) {
    const cards = await getAllCards(ownerId);
    const count = cards.filter(c => c.groupId === gid).length;
    const msg = count > 0
      ? `该分组下有 ${count} 条笺语，删除后一并删除。确定？`
      : "确定删除这个分组？";
    const ok = await showConfirm("删除分组", msg);
    if (!ok) return;
    await deleteGroup(gid);
    showToast("已删除");
    renderList();
  }

  async function openMoveModal(groups) {
    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        移动到分组
      </div>
      <div class="tag-picker" id="move-list">
        ${groups.filter(g => !g.isAll).map(g => `
          <span class="t" data-gid="${g.id}">${g.name}</span>
        `).join("")}
      </div>
    `);
    modal.querySelectorAll("[data-gid]").forEach(s => {
      s.onclick = async () => {
        await batchMoveCards([...checked], s.dataset.gid);
        checked.clear();
        closeModal(modal);
        showToast("已移动");
        renderList();
      };
    });
  }

  async function openBatchAddModal() {
    const groups = await getGroups(ownerId);
    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        批量添加
      </div>
      <div class="form-field">
        <label>分组</label>
        <select id="ba-group">
          ${groups.filter(g => !g.isAll).map(g => `<option value="${g.id}">${g.name}</option>`).join("")}
        </select>
      </div>
      <div class="form-field">
        <label>内容（每行一条）</label>
        <textarea id="ba-content" rows="8" placeholder="现在方便跟我说话吗？&#10;最近有没有什么新鲜事？"></textarea>
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="ba-cancel" class="btn ghost" style="flex: 1;">取 消</button>
        <button id="ba-save" class="btn" style="flex: 1;">添 加</button>
      </div>
    `);

    modal.querySelector("#ba-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#ba-save").onclick = async () => {
      const groupId = modal.querySelector("#ba-group").value;
      const lines = modal.querySelector("#ba-content").value.split("\n").map(s => s.trim()).filter(Boolean);
      if (!lines.length) {
        showToast("请输入内容");
        return;
      }
      const existing = await getAllCards(ownerId);
      const existingContents = new Set(existing.map(c => c.content.trim().toLowerCase()));
      let added = 0;
      let skipped = 0;
      for (const line of lines) {
        if (existingContents.has(line.toLowerCase())) {
          skipped++;
          continue;
        }
        existingContents.add(line.toLowerCase());
        await createCard(ownerId, { content: line, groupId });
        added++;
      }
      showToast(`已添加 ${added} 条${skipped ? `，跳过重复 ${skipped} 条` : ""}`);
      closeModal(modal);
      renderList();
    };
  }

  async function openImportModal() {
    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        导入笺语
      </div>
      <div class="form-field">
        <label>选择 JSON 文件</label>
        <input type="file" id="import-file" accept=".json">
      </div>
      <div class="form-field">
        <label>或粘贴 JSON</label>
        <textarea id="import-text" rows="6"></textarea>
      </div>
      <div class="form-field">
        <label>导入方式</label>
        <select id="import-mode">
          <option value="append">追加（同内容跳过）</option>
          <option value="overwrite">覆盖（清空现有）</option>
        </select>
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="import-cancel" class="btn ghost" style="flex: 1;">取 消</button>
        <button id="import-save" class="btn" style="flex: 1;">导 入</button>
      </div>
    `);

    modal.querySelector("#import-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#import-save").onclick = async () => {
      const file = modal.querySelector("#import-file").files[0];
      const text = modal.querySelector("#import-text").value.trim();
      const mode = modal.querySelector("#import-mode").value;

      let raw = text;
      if (!raw && file) {
        raw = await file.text();
      }
      if (!raw) {
        showToast("请选择文件或粘贴内容");
        return;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        showToast("JSON 格式错误");
        return;
      }
      if (!data || !Array.isArray(data.cards)) {
        showToast("数据格式错误");
        return;
      }

      const result = await importCards(ownerId, data, mode);
      showToast(`导入完成：${result.added} 条${result.skipped ? `，跳过 ${result.skipped}` : ""}`);
      closeModal(modal);
      renderList();
    };
  }

  async function openExportModal() {
    const groups = await getGroups(ownerId);
    const modal = showModal(`
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--cinnabar); letter-spacing: 3px; margin-bottom: 20px; text-align: center;">
        导出笺语
      </div>
      <div class="form-field">
        <label>选择要导出的分组</label>
        <div class="tag-picker" id="export-groups">
          ${groups.filter(g => !g.isAll).map(g => `
            <span class="t on" data-gid="${g.id}">${g.name}</span>
          `).join("")}
        </div>
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button id="export-cancel" class="btn ghost" style="flex: 1;">取 消</button>
        <button id="export-save" class="btn" style="flex: 1;">导 出</button>
      </div>
    `);

    modal.querySelectorAll("[data-gid]").forEach(s => {
      s.onclick = () => s.classList.toggle("on");
    });

    modal.querySelector("#export-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#export-save").onclick = async () => {
      const selected = [...modal.querySelectorAll("[data-gid].on")].map(s => s.dataset.gid);
      if (!selected.length) {
        showToast("请至少选择一个分组");
        return;
      }
      const data = await exportCards(ownerId, selected);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `xunfengdu_cards_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("已导出");
      closeModal(modal);
    };
  }

  async function clearAll() {
    const cards = await getAllCards(ownerId);
    const groups = (await getGroups(ownerId)).filter(g => !g.isAll);
    if (!cards.length && !groups.length) {
      showToast("笺语库已经是空的");
      return;
    }
    const ok = await showConfirm("清空全部", `将清空所有笺语（${cards.length} 条）和分组（${groups.length} 个），确定？`);
    if (!ok) return;

    for (const c of cards) await db.del("cards", c.id);
    for (const g of groups) await db.del("cardGroups", g.id);
    showToast("已清空");
    renderList();
  }

  await renderList();

  return el;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}