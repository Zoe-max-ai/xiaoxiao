import { db } from "../core/db.js";
import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { showModal, closeModal } from "../ui/modal.js";
import { showConfirm } from "../ui/confirm.js";
import {
  DATA_GROUPS, exportData, importData, clearData,
  estimateStorage, getStorageEstimate,
} from "../services/data-service.js";

export async function guichuDataView() {
  const el = document.createElement("div");

  el.innerHTML = `
    <div class="section-title">存 储 空 间</div>
    <div class="card" style="padding: 0; overflow: hidden; background: var(--paper);">
      <!-- 折叠头部 -->
      <div id="storage-header" style="
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px; cursor: pointer;
      ">
        <div style="font-family: var(--font-title); font-size: 14px; color: var(--ink);">数据占用</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="storage-usage" style="font-size: 13px; color: var(--cinnabar); font-weight: bold;">加载中…</span>
          <span id="storage-arrow" style="font-size: 12px; color: var(--ink-dim); transition: transform 0.2s;">▼</span>
        </div>
      </div>

      <!-- 折叠内容区 -->
      <div id="storage-detail-wrap" style="display: none; padding: 0 16px 16px; border-top: 1px dashed var(--line-light);">
        <div style="padding-top: 12px;">
          <!-- 50MB 进度条 -->
          <div class="storage-bar" style="height: 6px; background: var(--line-light); border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
            <div class="storage-bar-fill" id="storage-bar-fill" style="height: 100%; background: var(--cinnabar); width: 0%; transition: width 0.3s;"></div>
          </div>
          <div class="storage-detail" id="storage-detail" style="font-size: 12px;"></div>
        </div>
      </div>
    </div>

    <div class="section-title">数 据 管 理</div>
    <div class="card data-action" data-act="export">
      <div>
        <div class="data-action-title">导出备份</div>
        <div class="data-action-sub">将所有数据导出为 JSON 文件</div>
      </div>
      <span class="data-action-arrow">›</span>
    </div>
    <div class="card data-action" data-act="import">
      <div>
        <div class="data-action-title">导入备份</div>
        <div class="data-action-sub">从 JSON 文件恢复数据</div>
      </div>
      <span class="data-action-arrow">›</span>
    </div>
    <div class="card data-action" data-act="clear">
      <div>
        <div class="data-action-title">清除缓存</div>
        <div class="data-action-sub">按分组清除本地数据</div>
      </div>
      <span class="data-action-arrow">›</span>
    </div>
    <div class="card data-action danger" data-act="reset">
      <div>
        <div class="data-action-title">恢复默认</div>
        <div class="data-action-sub">清空所有数据，回到初始状态</div>
      </div>
      <span class="data-action-arrow">›</span>
    </div>
  `;

  el.insertBefore(pageHeader("数 据 管 理", "#/guichu"), el.firstChild);

  /* ========== 存储空间 ========== */

  async function renderStorage() {
    const estimate = await getStorageEstimate();
    const usageMB = (estimate.usage / 1024 / 1024).toFixed(2);
    
    // 👈 设定参考上限为 50MB
    const MAX_QUOTA_MB = 50;
    const percent = Math.min(100, (estimate.usage / (MAX_QUOTA_MB * 1024 * 1024)) * 100);

    // 显示格式：已用 8.70 MB / 50 MB
    el.querySelector("#storage-usage").textContent = `已用 ${usageMB} / 50 MB`;

    // 进度条计算（至少留一点点宽度让它看起来有进度）
    el.querySelector(".storage-bar").style.display = "block";
    const barFill = el.querySelector("#storage-bar-fill");
    barFill.style.display = "block";
    barFill.style.width = Math.max(1, percent) + "%";

    // 各分组详情
    const stats = await estimateStorage();
    el.querySelector("#storage-detail").innerHTML = stats
      .filter(s => s.count > 0)
      .map(s => {
        let sizeText = "";
        if (s.bytes > 1024 * 1024) {
          sizeText = (s.bytes / 1024 / 1024).toFixed(2) + " MB";
        } else if (s.bytes > 1024) {
          sizeText = (s.bytes / 1024).toFixed(1) + " KB";
        } else {
          sizeText = s.bytes + " B";
        }
        return `
        <div class="storage-item" style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px dashed var(--line-light);">
          <span style="color:var(--ink); font-weight:bold;">${s.name}</span>
          <span style="color:var(--ink-dim); font-size:12px;">${s.count} 条 <span style="margin-left:8px; color:var(--cinnabar);">${sizeText}</span></span>
        </div>
        `;
      }).join("") || `<div class="storage-item" style="color:var(--ink-dim); text-align: center; padding: 20px 0;">暂无数据</div>`;
  }
  
  await renderStorage();
  
  // 👈 绑定折叠事件
  const storageHeader = el.querySelector("#storage-header");
  const storageDetailWrap = el.querySelector("#storage-detail-wrap");
  const storageArrow = el.querySelector("#storage-arrow");

  storageHeader.onclick = () => {
    const isHidden = storageDetailWrap.style.display === "none";
    storageDetailWrap.style.display = isHidden ? "block" : "none";
    storageArrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  };

  /* ========== 导出 ========== */

  el.querySelector("[data-act='export']").onclick = () => {
    openExportModal();
  };

  function openExportModal() {
    const modal = showModal(`
      <div class="data-modal-title">导 出 备 份</div>
      <div class="data-modal-sub">选择要导出的数据分组</div>
      <div class="data-group-list" id="export-groups">
        ${DATA_GROUPS.map(g => `
          <label class="data-group-item">
            <input type="checkbox" data-gid="${g.id}" checked>
            <span class="data-group-name">${g.name}</span>
            ${g.hasBlob ? `<span class="data-group-badge">含 Blob</span>` : ""}
          </label>
        `).join("")}
      </div>
      <label class="data-group-item" style="margin-top:8px;">
        <input type="checkbox" id="include-blob">
        <span class="data-group-name">包含图片 / 音频数据（文件会很大）</span>
      </label>
      <div class="data-modal-actions">
        <button class="btn ghost" id="export-cancel">取 消</button>
        <button class="btn" id="export-ok">导 出</button>
      </div>
    `);

    modal.querySelector("#export-cancel").onclick = () => closeModal(modal);
    
    modal.querySelector("#export-ok").onclick = async () => {
      const groupIds = [...modal.querySelectorAll("#export-groups input:checked")]
        .map(i => i.dataset.gid);
      if (!groupIds.length) {
        showToast("请至少选择一个分组");
        return;
      }
      const includeBlob = modal.querySelector("#include-blob").checked;

      showToast("正在导出…");
      const data = await exportData(groupIds, includeBlob);
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `xunfengdu-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      closeModal(modal);
      showToast("已导出");
    };
  }

  /* ========== 导入 ========== */

  el.querySelector("[data-act='import']").onclick = () => {
    openImportModal();
  };

  function openImportModal() {
    const modal = showModal(`
      <div class="data-modal-title">导 入 备 份</div>
      <div class="data-modal-sub">选择 JSON 文件</div>
      <div class="data-group-item">
        <input type="file" id="import-file" accept=".json,application/json" style="width:100%;">
      </div>
      <div id="import-preview" style="margin-top:12px;"></div>
      <div class="data-modal-actions">
        <button class="btn ghost" id="import-cancel">取 消</button>
        <button class="btn" id="import-next" disabled>下 一 步</button>
      </div>
    `);

    modal.querySelector("#import-cancel").onclick = () => closeModal(modal);

    let parsedData = null;

    modal.querySelector("#import-file").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        parsedData = JSON.parse(text);
        if (!parsedData.version || !parsedData.groups) {
          throw new Error("格式不对");
        }
        modal.querySelector("#import-next").disabled = false;
        modal.querySelector("#import-preview").innerHTML = `
          <div style="font-size:12px;color:var(--ink-dim);">
            文件已载入：${Object.keys(parsedData.groups).length} 个分组
          </div>
        `;
      } catch (e) {
        showToast("文件格式错误");
        parsedData = null;
      }
    };

    modal.querySelector("#import-next").onclick = () => {
      closeModal(modal);
      openImportSelectModal(parsedData);
    };
  }

  function openImportSelectModal(data) {
    const modal = showModal(`
      <div class="data-modal-title">选 择 要 导 入 的 分 组</div>
      <div class="data-group-list" id="import-groups">
        ${DATA_GROUPS.filter(g => data.groups[g.id]).map(g => `
          <label class="data-group-item">
            <input type="checkbox" data-gid="${g.id}" checked>
            <span class="data-group-name">${g.name}</span>
          </label>
        `).join("")}
      </div>

      <div class="data-modal-sub" style="margin-top:12px;">导入方式</div>
      <div class="data-radio-list">
        <label class="data-radio-item">
          <input type="radio" name="conflict" value="skip" checked>
          <span>跳过重复（安全）</span>
        </label>
        <label class="data-radio-item">
          <input type="radio" name="conflict" value="overwrite">
          <span>覆盖已有</span>
        </label>
        <label class="data-radio-item">
          <input type="radio" name="conflict" value="rename">
          <span>生成新 ID（追加）</span>
        </label>
      </div>

      <div class="data-modal-actions">
        <button class="btn ghost" id="import-cancel2">取 消</button>
        <button class="btn" id="import-ok">导 入</button>
      </div>
    `);

    modal.querySelector("#import-cancel2").onclick = () => closeModal(modal);
    
    modal.querySelector("#import-ok").onclick = async () => {
      const groupIds = [...modal.querySelectorAll("#import-groups input:checked")]
        .map(i => i.dataset.gid);
      if (!groupIds.length) {
        showToast("请至少选择一个分组");
        return;
      }
      const conflictMode = modal.querySelector("input[name='conflict']:checked").value;

      showToast("正在导入…");
      const stats = await importData(data, groupIds, conflictMode);
      closeModal(modal);
      showToast(`导入完成：新增 ${stats.imported}，覆盖 ${stats.overwritten}，跳过 ${stats.skipped}`);

      setTimeout(() => {
        window.location.reload();
      }, 800);
    };
  }

  /* ========== 清除 ========== */

  el.querySelector("[data-act='clear']").onclick = () => {
    openClearModal();
  };

  function openClearModal() {
    const modal = showModal(`
      <div class="data-modal-title">清 除 缓 存</div>
      <div class="data-modal-sub">选择要清除的分组</div>
      <div class="data-group-list" id="clear-groups">
        ${DATA_GROUPS.map(g => `
          <label class="data-group-item">
            <input type="checkbox" data-gid="${g.id}">
            <span class="data-group-name">${g.name}</span>
          </label>
        `).join("")}
      </div>
      <div class="data-modal-actions">
        <button class="btn ghost" id="clear-cancel">取 消</button>
        <button class="btn" id="clear-ok" style="background:var(--cinnabar);">清 除</button>
      </div>
    `);

    modal.querySelector("#clear-cancel").onclick = () => closeModal(modal);
    
    modal.querySelector("#clear-ok").onclick = async () => {
      const groupIds = [...modal.querySelectorAll("#clear-groups input:checked")]
        .map(i => i.dataset.gid);
      if (!groupIds.length) {
        showToast("请至少选择一个分组");
        return;
      }
      const ok = await showConfirm("清除缓存", `确定清除选中的 ${groupIds.length} 个分组？此操作不可恢复。`);
      if (!ok) return;

      const cleared = await clearData(groupIds);
      closeModal(modal);
      showToast(`已清除 ${cleared} 条`);
      await renderStorage();
    };
  }

  /* ========== 恢复默认 ========== */

  el.querySelector("[data-act='reset']").onclick = () => {
    openResetModal();
  };

  function openResetModal() {
    const modal = showModal(`
      <div class="data-modal-title" style="color:var(--cinnabar);">恢 复 默 认</div>
      <div class="data-modal-sub">
        此操作会清空所有数据，回到初始状态。<br>
        请输入"确认"两个字，然后点击下方按钮。
      </div>
      <input type="text" id="reset-input" class="input" placeholder="输入：确认" style="margin-top:12px;">
      <div class="data-modal-actions">
        <button class="btn ghost" id="reset-cancel">取 消</button>
        <button class="btn" id="reset-ok" style="background:var(--cinnabar);" disabled>确 认 清 空</button>
      </div>
    `);

    const input = modal.querySelector("#reset-input");
    const okBtn = modal.querySelector("#reset-ok");

    input.oninput = () => {
      okBtn.disabled = input.value.trim() !== "确认";
    };

    modal.querySelector("#reset-cancel").onclick = () => closeModal(modal);
    
    okBtn.onclick = async () => {
      if (input.value.trim() !== "确认") return;

      const allTables = [...new Set(DATA_GROUPS.flatMap(g => g.tables))];
      for (const table of allTables) {
        if (table === "settings") {
          const all = await db.all("settings");
          for (const r of all) {
            // 恢复默认：保留 主题 / 字体 / 种子标记
            if (["theme", "font_settings"].includes(r.key)) continue;
            await db.del("settings", r.key);
          }
        } else {
          const all = await db.all(table);
          for (const r of all) {
            const key = r.id !== undefined ? r.id : r.key;
            await db.del(table, key);
          }
        }
      }

      // 👈 核心新增：清空 localStorage 里的自定义图片和设置
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key.includes("chenshi_daily") || 
          key.includes("wangshi_cover") || 
          key.includes("tanmi_cover") || 
          key.startsWith("book_img_") ||
          key.startsWith("solo_qavatar") ||
          key.startsWith("forum_") ||
          key.startsWith("daily_gift_")
        ) {
          localStorage.removeItem(key);
        }
      }

      window.location.reload();
    };
  }

  return el;
}