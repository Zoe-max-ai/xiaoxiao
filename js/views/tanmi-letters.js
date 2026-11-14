import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { getImageUrl } from "../services/seed-service.js";
import { formatAncient } from "../core/date-utils.js";
import {
  filterLetters, checkPendingReplies, deleteLetter,
  getSealForCharacter, getSentSeal,
} from "../services/letter-service.js";

/* ========== SVG 图标 ========== */
const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5 L20 5 L14 13 L14 20 L10 18 L10 13 Z"/></svg>`;
const ICON_NEW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 L18 7 L8 17 L3 20 L6 15 Z"/><path d="M14 3 L18 7" opacity="0.5"/><path d="M3 20 L6 15" opacity="0.5"/></svg>`;
const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 A 8 8 0 0 1 20 12"/><path d="M20 12 A 8 8 0 0 1 12 20" opacity="0.5"/><polyline points="17,7 20,12 15,13" fill="none"/></svg>`;

const PAGE_SIZE = 10;

export async function tanmiLettersView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  let currentTab = "all";
  let currentFilter = { dateRange: { type: "all" }, characterId: null };
  let loadedCount = PAGE_SIZE;

  el.innerHTML = `
    <div class="letters-topbar">
      <button class="letters-back" id="btn-back">←</button>
      <div class="letters-title">书 信</div>
      <div class="letters-icon-group">
        <button class="letters-icon-btn" id="btn-filter" title="筛选">${ICON_FILTER}</button>
        <button class="letters-icon-btn" id="btn-new" title="写信">${ICON_NEW}</button>
        <button class="letters-icon-btn" id="btn-refresh" title="刷新">${ICON_REFRESH}</button>
      </div>
    </div>

    <div class="letters-tabs">
      <div class="letters-tab ${currentTab === "all" ? "on" : ""}" data-tab="all">全 部</div>
      <div class="letters-tab ${currentTab === "sent" ? "on" : ""}" data-tab="sent">寄 出</div>
      <div class="letters-tab ${currentTab === "received" ? "on" : ""}" data-tab="received">收 到</div>
    </div>

    <div id="letters-list"></div>
    <div id="letters-more" style="display:none;text-align:center;padding:16px;">
      <button class="btn ghost" id="btn-load-more" style="padding:10px 32px;letter-spacing:4px;">加 载 更 多</button>
    </div>
  `;

  const listEl = el.querySelector("#letters-list");
  const moreEl = el.querySelector("#letters-more");

  el.querySelector("#btn-back").onclick = () => { location.hash = "#/tanmi"; };
  el.querySelector("#btn-new").onclick = () => { location.hash = "#/tanmi/letters/new"; };
  el.querySelector("#btn-refresh").onclick = async () => {
    showToast("刷新中…");
    await checkPendingReplies(ownerId);
    loadedCount = PAGE_SIZE;
    await render();
  };
  el.querySelector("#btn-filter").onclick = () => openFilterDrawer();

  el.querySelectorAll(".letters-tab").forEach(tab => {
    tab.onclick = () => {
      currentTab = tab.dataset.tab;
      loadedCount = PAGE_SIZE;
      el.querySelectorAll(".letters-tab").forEach(t => t.classList.toggle("on", t.dataset.tab === currentTab));
      render();
    };
  });

  async function render() {
    const all = await filterLetters(ownerId, {
      tab: currentTab,
      dateRange: currentFilter.dateRange,
      characterId: currentFilter.characterId,
    });

    const charMap = await buildCharacterMap(ownerId);
    const npcMap = await buildNpcMap(ownerId);

    const shown = all.slice(0, loadedCount);

    if (!all.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:60px 20px;">此处空空如也。</div>`;
      moreEl.style.display = "none";
      return;
    }

    listEl.innerHTML = shown.map(l => renderLetterCard(l, charMap, npcMap, ownerId)).join("");

    listEl.querySelectorAll(".letter-card").forEach(card => {
      card.onclick = () => {
        location.hash = `#/tanmi/letters/read/${card.dataset.id}`;
      };
    });

    if (all.length > loadedCount) {
      moreEl.style.display = "block";
      el.querySelector("#btn-load-more").onclick = () => {
        loadedCount += PAGE_SIZE;
        render();
      };
    } else {
      moreEl.style.display = "none";
    }
  }

  await checkPendingReplies(ownerId);
  await render();

  /* ===== 筛选抽屉 ===== */
  function openFilterDrawer() {
    const chars = [...charMapCache.values()];

    const drawer = document.createElement("div");
    drawer.className = "filter-drawer-mask";
    drawer.innerHTML = `
      <div class="filter-drawer">
        <div class="filter-drawer-header">
          <span>筛 选</span>
          <button class="filter-close">✕</button>
        </div>

        <div class="filter-section-title">日期</div>
        <div class="filter-chips" data-group="date">
          ${chip("all", "全部", currentFilter.dateRange.type === "all")}
          ${chip("today", "今日", currentFilter.dateRange.type === "today")}
          ${chip("yesterday", "昨日", currentFilter.dateRange.type === "yesterday")}
          ${chip("3days", "三日之内", currentFilter.dateRange.type === "3days")}
          ${chip("month", "本月", currentFilter.dateRange.type === "month")}
          ${chip("custom", "自定义", currentFilter.dateRange.type === "custom")}
        </div>

        <div id="custom-date-row" style="display:${currentFilter.dateRange.type === "custom" ? "flex" : "none"};gap:8px;margin-top:10px;">
          <input type="date" class="input" id="date-from" style="flex:1;">
          <input type="date" class="input" id="date-to" style="flex:1;">
        </div>

        <div class="filter-section-title" style="margin-top:20px;">角色</div>
        <div class="filter-chips" data-group="char">
          ${chip("__all__", "全部", !currentFilter.characterId)}
          ${chars.map(c => chip(c.id, c.name, currentFilter.characterId === c.id)).join("")}
        </div>

        <div class="filter-actions">
          <button class="btn ghost" id="filter-reset" style="flex:1;padding:12px;">重 置</button>
          <button class="btn" id="filter-apply" style="flex:1;padding:12px;">确 定</button>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);

    let tempDate = { ...currentFilter.dateRange };
    let tempChar = currentFilter.characterId;
    let tempFrom = tempDate.from || null;
    let tempTo = tempDate.to || null;

    const fromInput = drawer.querySelector("#date-from");
    const toInput = drawer.querySelector("#date-to");
    if (tempFrom) fromInput.value = toInputToStr(tempFrom);
    if (tempTo) toInput.value = toInputToStr(tempTo);

    drawer.querySelectorAll(".filter-chips").forEach(group => {
      const gname = group.dataset.group;
      group.querySelectorAll(".chip").forEach(c => {
        c.onclick = () => {
          group.querySelectorAll(".chip").forEach(x => x.classList.remove("on"));
          c.classList.add("on");
          const val = c.dataset.value;
          if (gname === "date") {
            tempDate = { type: val };
            drawer.querySelector("#custom-date-row").style.display = val === "custom" ? "flex" : "none";
          } else {
            tempChar = val === "__all__" ? null : val;
          }
        };
      });
    });

    drawer.querySelector(".filter-close").onclick = () => drawer.remove();
    drawer.onclick = (e) => { if (e.target === drawer) drawer.remove(); };

    drawer.querySelector("#filter-reset").onclick = () => {
      currentFilter = { dateRange: { type: "all" }, characterId: null };
      loadedCount = PAGE_SIZE;
      drawer.remove();
      render();
    };

    drawer.querySelector("#filter-apply").onclick = () => {
      let finalDate = { ...tempDate };
      if (finalDate.type === "custom") {
        finalDate.from = fromInput.value ? new Date(fromInput.value).getTime() : 0;
        finalDate.to = toInput.value ? new Date(toInput.value).getTime() + 86400000 : Infinity;
      }
      currentFilter = { dateRange: finalDate, characterId: tempChar };
      loadedCount = PAGE_SIZE;
      drawer.remove();
      render();
    };
  }

  const charMapCache = await buildCharacterMap(ownerId);

  return el;
}

/* ============================================================ */

async function buildCharacterMap(ownerId) {
  const chars = (await db.all("characters")).filter(c => c.ownerId === ownerId);
  const map = new Map();
  for (const c of chars) map.set(c.id, c);
  return map;
}

async function buildNpcMap(ownerId) {
  const npcs = (await db.all("npc_relations")).filter(n => n.ownerId === ownerId);
  const map = new Map();
  for (const n of npcs) map.set(n.id, n);
  return map;
}

/* ============================================================ */

function renderLetterCard(letter, charMap, npcMap, ownerId) {
  const isSent = letter.direction === "sent";
  const isReceived = letter.direction === "received";
  const isUnread = isReceived && !letter.isRead;

  let nameText, sealPath;
  if (isSent) {
    const toType = letter.toType || "character";
    const target = toType === "npc" ? npcMap.get(letter.toId) : charMap.get(letter.toId);
    nameText = `致 · ${target?.name || "未知"}`;
    sealPath = getSentSeal();
  } else {
    const fromType = letter.fromType || "character";
    const from = fromType === "npc" ? npcMap.get(letter.fromId) : charMap.get(letter.fromId);
    nameText = from?.name || "未知";
    sealPath = fromType === "npc"
      ? "assets/seed/seal/seal-yin.png"
      : getSealForCharacter(from);
  }

  return `
    <div class="letter-card ${isUnread ? "unread" : ""}" data-id="${letter.id}">
      <div class="letter-card-left">
        <div class="letter-card-name">${escapeHtml(nameText)}</div>
        <div class="letter-card-time">${formatAncient(letter.createdAt)}</div>
      </div>
      <div class="letter-card-right">
        <img class="letter-seal" src="${sealPath}" alt="">
        ${isUnread ? `<span class="letter-new">新</span>` : ""}
      </div>
    </div>
  `;
}

/* ============================================================ */

function chip(value, label, active) {
  return `<div class="chip ${active ? "on" : ""}" data-value="${value}">${label}</div>`;
}

function toInputToStr(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}