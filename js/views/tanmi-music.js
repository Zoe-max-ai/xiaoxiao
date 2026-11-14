import { state } from "../core/state.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showModal, closeModal } from "../ui/modal.js";
import { showConfirm } from "../ui/confirm.js";
import {
  getAllTracks, getTrack, addTrack, updateTrack, deleteTrack,
  isDuplicateTrack, toggleFavorite,
  saveUploadedFile, getPlayableUrl, parseLinkLine,
  importBuiltinTracks,
} from "../services/audio-service.js";
import { db } from "../core/db.js";

/* ========== 模块级状态 ========== */
let audioEl = null;
let currentId = null;
let isPlaying = false;
let animFrame = null;
let spinStartTime = 0;
const ROTATION_SPEED = 45;   // 度/秒

/* ========== 主视图 ========== */
export async function tanmiMusicView() {
  const el = document.createElement("div");
  el.className = "music-page";

  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  // 首次启动导入内置曲目
  await importBuiltinTracks(ownerId);

  el.innerHTML = `
    <div class="music-player">
      <div class="music-stage">
        <div class="music-char">律</div>
        <div class="music-umbrella-wrap">
          <img class="music-umbrella" id="music-umbrella" alt="">
        </div>
        <div class="music-controls">
          <button class="music-btn" id="music-btn-play">奏</button>
          <button class="music-btn" id="music-btn-stop">止</button>
        </div>
      </div>

      <div class="music-current">
        <div class="music-current-name" id="music-cur-name">未在播放</div>
        <div class="music-current-artist" id="music-cur-artist">—</div>
      </div>

      <div class="music-progress" id="music-progress">
        <div class="music-progress-fill" id="music-progress-fill"></div>
      </div>
      <div class="music-time">
        <span id="music-time-cur">0:00</span>
        <span id="music-time-dur">0:00</span>
      </div>
    </div>

    <div class="music-lib">
      <div class="music-tabs">
        <button class="music-tab active" data-tab="all">全部</button>
        <button class="music-tab" data-tab="fav">我收藏的</button>
      </div>

      <div class="music-search-wrap">
        <input type="text" class="music-search" id="music-search" placeholder="寻曲……">
        <button class="music-add-btn" id="music-add">＋</button>
      </div>

      <div class="music-list" id="music-list"></div>
    </div>
  `;

  el.insertBefore(pageHeader("音 律", "#/tanmi"), el.firstChild);

  const umbrellaEl = el.querySelector("#music-umbrella");
  const listEl = el.querySelector("#music-list");
  const searchEl = el.querySelector("#music-search");
  const btnPlay = el.querySelector("#music-btn-play");
  const btnStop = el.querySelector("#music-btn-stop");
  const curNameEl = el.querySelector("#music-cur-name");
  const curArtistEl = el.querySelector("#music-cur-artist");

  let currentTab = "all";
  let searchKeyword = "";

  /* ========== 伞（按主题切图） ========== */
  function updateUmbrellaForTheme() {
    const theme = document.documentElement.dataset.theme || "qinglv";
    const src = theme === "songya"
      ? "assets/seed/deco/umbrella-maple.png"
      : "assets/seed/deco/umbrella-bamboo.png";
    if (umbrellaEl && !umbrellaEl.src.endsWith(src)) {
      umbrellaEl.src = src;
    }
  }

  /* ========== 伞旋转 ========== */
  function startSpin() {
    if (animFrame) cancelAnimationFrame(animFrame);
    spinStartTime = 0;
    animFrame = requestAnimationFrame(spin);
  }
  function stopSpin() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }
function spin(ts) {
  if (!isPlaying) {
    animFrame = null;
    return;
  }
  if (!spinStartTime) spinStartTime = ts;
  const elapsed = (ts - spinStartTime) / 1000;
  const degrees = elapsed * ROTATION_SPEED;   // ← 去掉 % 360
  if (umbrellaEl) umbrellaEl.style.transform = `rotate(${degrees}deg)`;
  animFrame = requestAnimationFrame(spin);
}
  /* ========== 渲染曲库 ========== */
  async function renderList() {
    let list = await getAllTracks(ownerId);

    if (currentTab === "fav") {
      list = list.filter(t => t.collectedBy === "me");
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      list = list.filter(t =>
        (t.name || "").toLowerCase().includes(kw) ||
        (t.artist || "").toLowerCase().includes(kw)
      );
    }

    if (!list.length) {
      listEl.innerHTML = `<div class="music-empty">曲库空空，按 ＋ 添一曲吧。</div>`;
      return;
    }

    listEl.innerHTML = list.map(t => {
      const active = t.id === currentId;
      return `
        <div class="music-row ${active ? "active" : ""}" data-id="${t.id}">
          <div class="music-row-icon">${active && isPlaying ? "♪" : "·"}</div>
          <div class="music-row-info">
            <div class="music-row-name">
              ${escapeHtml(t.name)}
              ${t.collectedBy === "me" ? `<span class="music-row-fav">♡</span>` : ""}
            </div>
            <div class="music-row-artist">${escapeHtml(t.artist || "未知")}</div>
          </div>
          <button class="music-row-more" data-more="${t.id}">⋯</button>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".music-row").forEach(row => {
      row.onclick = (e) => {
        if (e.target.dataset.more) return;
        playTrack(row.dataset.id);
      };
    });
    listEl.querySelectorAll("[data-more]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openTrackMenu(btn.dataset.more);
      };
    });
  }

  /* ========== 音频 ========== */
  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.preload = "auto";

    audioEl.addEventListener("play", () => {
      isPlaying = true;
      startSpin();
      updatePlayUI();
      renderList();
    });
    audioEl.addEventListener("pause", () => {
      isPlaying = false;
      stopSpin();
      updatePlayUI();
      renderList();
    });
    audioEl.addEventListener("ended", () => {
      isPlaying = false;
      stopSpin();
      updatePlayUI();
      renderList();
    });
    audioEl.addEventListener("timeupdate", () => {
      if (el.isConnected) updateProgress();
    });
    audioEl.addEventListener("loadedmetadata", () => {
      if (el.isConnected) updateProgress();
    });
    return audioEl;
  }

  async function playTrack(id) {
    const track = await getTrack(id);
    if (!track) return;

    currentId = id;
    const url = await getPlayableUrl(track);
    if (!url) {
      showToast("无法播放：" + track.name);
      return;
    }

    const a = ensureAudio();
    if (a.dataset.blobUrl) {
      try { URL.revokeObjectURL(a.dataset.blobUrl); } catch (e) {}
      a.dataset.blobUrl = "";
    }
    if (url.startsWith("blob:")) {
      a.dataset.blobUrl = url;
    }
    a.src = url;
    try {
      await a.play();
    } catch (e) {
      try {
        a.muted = true;
        await a.play();
        a.muted = false;
      } catch (e2) {
        showToast("点击播放被拦截");
      }
    }

    updateCurInfo(track);
    await renderList();
  }

  function updateCurInfo(track) {
    curNameEl.textContent = track.name;
    curArtistEl.textContent = track.artist || "—";
  }

  function updatePlayUI() {
    btnPlay.classList.toggle("active", isPlaying);
    btnStop.classList.toggle("active", !isPlaying && !!currentId);
  }

  function updateProgress() {
    if (!audioEl) return;
    const c = audioEl.currentTime || 0;
    const d = audioEl.duration || 0;
    const fill = el.querySelector("#music-progress-fill");
    if (fill) fill.style.width = d ? `${(c / d) * 100}%` : "0%";
    const curT = el.querySelector("#music-time-cur");
    const durT = el.querySelector("#music-time-dur");
    if (curT) curT.textContent = fmtTime(c);
    if (durT) durT.textContent = fmtTime(d);
  }

  /* ========== 按钮 ========== */
  btnPlay.onclick = () => {
    if (!currentId) {
      getAllTracks(ownerId).then(list => {
        if (list.length) playTrack(list[0].id);
      });
      return;
    }
    if (audioEl && audioEl.paused) {
      audioEl.play();
    }
  };

  btnStop.onclick = () => {
    if (audioEl && !audioEl.paused) audioEl.pause();
  };

  /* ========== 进度条 seek ========== */
  el.querySelector("#music-progress").onclick = (e) => {
    if (!audioEl || !audioEl.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    audioEl.currentTime = Math.max(0, Math.min(1, x / rect.width)) * audioEl.duration;
  };

  /* ========== tabs ========== */
  el.querySelectorAll(".music-tab").forEach(tab => {
    tab.onclick = () => {
      el.querySelectorAll(".music-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      renderList();
    };
  });

  /* ========== 搜索 ========== */
  let searchTimer = null;
  searchEl.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchKeyword = searchEl.value.trim();
      renderList();
    }, 200);
  };

  /* ========== 添加曲目 ========== */
  el.querySelector("#music-add").onclick = () => openAddMenu();

  function openAddMenu() {
    const modal = showModal(`
      <div class="music-modal-title">添 曲</div>
      <div class="music-modal-list">
        <button class="music-modal-item" data-act="link">🔗 添加外链</button>
        <button class="music-modal-item" data-act="json">⇪ 批量导入 JSON</button>
        <button class="music-modal-item" data-act="upload">📁 上传 mp3</button>
      </div>
    `);
    modal.querySelector("[data-act='link']").onclick = () => { closeModal(modal); openAddLinkModal(); };
    modal.querySelector("[data-act='json']").onclick = () => { closeModal(modal); openImportJsonModal(); };
    modal.querySelector("[data-act='upload']").onclick = () => { closeModal(modal); openUploadModal(); };
  }

  function openAddLinkModal() {
    const modal = showModal(`
      <div class="music-modal-title">添 加 外 链</div>
      <div class="form-field">
        <label>链接 / 网易云 ID（一行一条）</label>
        <textarea id="link-input" rows="4" placeholder="支持 mp3 链接、网易云 ID"></textarea>
      </div>
      <div class="form-field">
        <label>歌名（可选）</label>
        <input type="text" id="link-name">
      </div>
      <div class="form-field">
        <label>歌手（可选）</label>
        <input type="text" id="link-artist">
      </div>
      <div class="music-modal-actions">
        <button class="btn ghost" id="link-cancel">取 消</button>
        <button class="btn" id="link-ok">添 加</button>
      </div>
    `);
    modal.querySelector("#link-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#link-ok").onclick = async () => {
      const raw = modal.querySelector("#link-input").value.trim();
      const name = modal.querySelector("#link-name").value.trim();
      const artist = modal.querySelector("#link-artist").value.trim();
      const lines = raw.split("\n").map(s => s.trim()).filter(Boolean);
      if (!lines.length) { showToast("请输入链接"); return; }

      let added = 0, skipped = 0;
      const existing = await getAllTracks(ownerId);
      for (const line of lines) {
        const t = parseLinkLine(line, lines.length === 1 ? name : "", lines.length === 1 ? artist : "");
        if (!t) continue;
        if (isDuplicateTrack(t, existing)) { skipped++; continue; }
        await addTrack(ownerId, t);
        existing.push(t);
        added++;
      }
      closeModal(modal);
      showToast(`已添加 ${added} 首${skipped ? `，跳过 ${skipped}` : ""}`);
      renderList();
    };
  }

  function openImportJsonModal() {
    const modal = showModal(`
      <div class="music-modal-title">批 量 导 入 JSON</div>
      <div class="form-field">
        <label>粘贴 JSON</label>
        <textarea id="json-input" rows="5" placeholder='[{"name":"歌名","artist":"歌手","url":"https://..."}]'></textarea>
      </div>
      <div class="form-field">
        <label>或选择 .json 文件</label>
        <input type="file" id="json-file" accept=".json,application/json">
      </div>
      <div class="music-modal-actions">
        <button class="btn ghost" id="json-cancel">取 消</button>
        <button class="btn" id="json-ok">导 入</button>
      </div>
    `);
    modal.querySelector("#json-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#json-ok").onclick = async () => {
      let text = modal.querySelector("#json-input").value.trim();
      const fileInput = modal.querySelector("#json-file");
      if (!text && fileInput.files[0]) {
        text = await fileInput.files[0].text();
      }
      if (!text) { showToast("请粘贴 JSON 或选择文件"); return; }

      let arr;
      try { arr = JSON.parse(text); } catch (e) { showToast("JSON 格式错误"); return; }
      if (!Array.isArray(arr)) { showToast("必须是数组"); return; }

      let added = 0, skipped = 0;
      const existing = await getAllTracks(ownerId);
      for (const it of arr) {
        const url = it.url || it.src || "";
        const nm = it.name || it.title || "";
        const ar = it.artist || it.singer || "";
        if (!url) continue;
        const t = parseLinkLine(url, nm, ar);
        if (!t) continue;
        if (isDuplicateTrack(t, existing)) { skipped++; continue; }
        await addTrack(ownerId, t);
        existing.push(t);
        added++;
      }
      closeModal(modal);
      showToast(`已导入 ${added} 首${skipped ? `，跳过 ${skipped}` : ""}`);
      renderList();
    };
  }

  function openUploadModal() {
    const modal = showModal(`
      <div class="music-modal-title">上 传 mp3</div>
      <div class="form-field">
        <label>选择文件（可多选）</label>
        <input type="file" id="upload-file" accept="audio/*" multiple>
      </div>
      <div class="music-modal-actions">
        <button class="btn ghost" id="upload-cancel">取 消</button>
        <button class="btn" id="upload-ok">上 传</button>
      </div>
    `);
    modal.querySelector("#upload-cancel").onclick = () => closeModal(modal);
    modal.querySelector("#upload-ok").onclick = async () => {
      const files = modal.querySelector("#upload-file").files;
      if (!files.length) { showToast("请选择文件"); return; }

      let added = 0, skipped = 0;
      const existing = await getAllTracks(ownerId);
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) { showToast(`${f.name} 超过 20MB，跳过`); continue; }
        const blobId = await saveUploadedFile(f, f.name, f.size);
        const cleanName = f.name.replace(/\.mp3$/i, "").replace(/[-_]/g, " ").trim();
        const t = { name: cleanName || f.name, artist: "本地上传", source: "upload", blobId };
        if (isDuplicateTrack(t, existing)) {
          await db.del("audio_files", blobId);
          skipped++;
          continue;
        }
        await addTrack(ownerId, t);
        existing.push(t);
        added++;
      }
      closeModal(modal);
      showToast(`已上传 ${added} 首${skipped ? `，跳过 ${skipped}` : ""}`);
      renderList();
    };
  }

  /* ========== 更多菜单 ========== */
  async function openTrackMenu(id) {
    const track = await getTrack(id);
    if (!track) return;
    const modal = showModal(`
      <div class="music-modal-title">${escapeHtml(track.name)}</div>
      <div class="music-modal-list">
        <button class="music-modal-item" data-act="fav">${track.collectedBy === "me" ? "♡ 取消收藏" : "♡ 收藏"}</button>
        <button class="music-modal-item" data-act="edit">✎ 编辑信息</button>
        <button class="music-modal-item" data-act="delete" style="color:var(--cinnabar);">🗑 删除</button>
      </div>
    `);
    modal.querySelector("[data-act='fav']").onclick = async () => {
      await toggleFavorite(id);
      closeModal(modal);
      showToast("已更新收藏");
      renderList();
    };
    modal.querySelector("[data-act='edit']").onclick = () => { closeModal(modal); openEditModal(id); };
    modal.querySelector("[data-act='delete']").onclick = async () => {
      closeModal(modal);
      const ok = await showConfirm("删除曲目", `确定删除《${track.name}》？`);
      if (!ok) return;
      await deleteTrack(id);
      if (id === currentId) {
        if (audioEl) audioEl.pause();
        currentId = null;
      }
      showToast("已删除");
      renderList();
    };
  }

  function openEditModal(id) {
    getTrack(id).then(track => {
      const modal = showModal(`
        <div class="music-modal-title">编 辑 信 息</div>
        <div class="form-field">
          <label>歌名</label>
          <input type="text" id="edit-name" value="${escapeHtml(track.name)}">
        </div>
        <div class="form-field">
          <label>歌手</label>
          <input type="text" id="edit-artist" value="${escapeHtml(track.artist || "")}">
        </div>
        <div class="music-modal-actions">
          <button class="btn ghost" id="edit-cancel">取 消</button>
          <button class="btn" id="edit-ok">保 存</button>
        </div>
      `);
      modal.querySelector("#edit-cancel").onclick = () => closeModal(modal);
      modal.querySelector("#edit-ok").onclick = async () => {
        const name = modal.querySelector("#edit-name").value.trim();
        const artist = modal.querySelector("#edit-artist").value.trim();
        await updateTrack(id, { name: name || track.name, artist });
        closeModal(modal);
        showToast("已保存");
        renderList();
      };
    });
  }

  /* ========== 初始化：恢复当前播放状态 ========== */
  updateUmbrellaForTheme();

  if (currentId) {
    const track = await getTrack(currentId);
    if (track) {
      updateCurInfo(track);
      if (audioEl && !audioEl.paused) {
        isPlaying = true;
        startSpin();
      }
    }
  }

  updatePlayUI();
  updateProgress();
  await renderList();

  return el;
}

/* ========== 工具 ========== */
function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}