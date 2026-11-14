import { showToast } from "../ui/toast.js";
import { showConfirm } from "../ui/confirm.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { formatAncient } from "../core/date-utils.js";
import {
  getLetter, markLetterRead, deleteLetter,
  getSealForCharacter, getSentSeal,
} from "../services/letter-service.js";

export async function tanmiLettersReadView({ params }) {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  const letterId = params?.[0];
  if (!letterId) {
    el.innerHTML = `<div class="empty-state">未指定信件。</div>`;
    return el;
  }

  const letter = await getLetter(letterId);
  if (!letter || letter.ownerId !== ownerId) {
    el.innerHTML = `<div class="empty-state">此信已不知所踪。</div>`;
    return el;
  }

  if (letter.direction === "received" && !letter.isRead) {
    await markLetterRead(letterId);
  }

  const isSent = letter.direction === "sent";
  const otherType = isSent ? (letter.toType || "character") : (letter.fromType || "character");
  const otherId = isSent ? letter.toId : letter.fromId;

  let other = null;
  if (otherType === "npc") {
    other = await db.get("npc_relations", otherId);
  } else {
    other = await db.get("characters", otherId);
  }

  const sealPath = isSent
    ? getSentSeal()
    : (otherType === "npc"
        ? "assets/seed/seal/seal-yin.png"
        : getSealForCharacter(other));

  const coverTitle = isSent ? "寄" : (other?.name || "无名");
  const coverSub = isSent ? (other?.name || "未知") : "台启";

  // 计算古代日期
  const d = new Date(letter.createdAt);
  const monthNames = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  const monthStr = monthNames[d.getMonth()];
  const day = d.getDate();
  let dayStr = "";
  if (day <= 10) dayStr = "上旬";
  else if (day <= 20) dayStr = "中旬";
  else dayStr = "下旬";
  const dateLabel = `${monthStr}月${dayStr}`;

  el.innerHTML = `
    <div class="letter-read-page" style="background: #d1c7b7; min-height: 100dvh; padding-bottom: 40px;">
      <div class="letter-read-topbar" style="background: rgba(250,246,238,0.9); backdrop-filter: blur(4px);">
        <button class="letter-read-back" id="btn-back" style="color: var(--ink);">←</button>
        <div class="letter-read-title" style="color: var(--ink);">${isSent ? '寄出之信' : '收到之信'}</div>
        <button class="letter-read-more" id="btn-more" style="color: var(--ink);">⋯</button>
      </div>

      <!-- 牛皮纸信封底色 -->
      <div class="envelope-wrapper" id="letter-wrapper" style="background: #e3d7c5; margin: 20px; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); position: relative; overflow: hidden; padding: 20px; min-height: 75vh;">
        
        <!-- 信封封面 -->
        <div class="envelope-cover" id="envelope-cover" style="position: absolute; inset: 0; z-index: 10; background: #e3d7c5; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 60px 20px; cursor: pointer; transition: transform 0.6s, opacity 0.6s; transform-origin: top center;">
          
          <div style="border: 4px solid #7b1a1a; padding: 30px 15px; width: 120px; display: flex; flex-direction: column; align-items: center; background: rgba(255,255,255,0.2);">
          <!-- 👈 盖在信封上的火漆印章 -->
          <div style="position: absolute; bottom: 40px; right: 40px; mix-blend-mode: multiply; transform: rotate(-15deg);">
            <img src="${sealPath}" style="width: 60px; opacity: 0.9;">
          </div>
            <div style="writing-mode: vertical-rl; font-family: 'STKaiti', 'KaiTi', serif; font-size: 28px; color: #111; letter-spacing: 10px; text-align: start;">
              ${escapeHtml(coverTitle)}
            </div>
            <div style="writing-mode: vertical-rl; font-family: 'STKaiti', 'KaiTi', serif; font-size: 22px; color: #111; letter-spacing: 6px; margin-top: 20px;">
              ${escapeHtml(coverSub)}
            </div>
          </div>

          <div style="font-family: 'STKaiti', 'KaiTi', serif; font-size: 18px; color: #444; letter-spacing: 2px;">
            - ${dateLabel} -
          </div>
          
          <div style="font-size: 12px; color: #888; letter-spacing: 4px; position: absolute; bottom: 20px;">轻 触 拆 阅</div>
        </div>

        <!-- 信纸内容 -->
        <div class="letter-paper-content" id="letter-paper" style="opacity: 0; transform: translateY(20px); transition: all 0.6s ease-out; padding-top: 30px; padding-bottom: 30px; display: flex; justify-content: center; height: 100%;">
          
          <!-- 红色线框容器 -->
          <div style="border: 2px solid #b5453c; padding: 30px 20px; position: relative; background: rgba(255,255,255,0.1); display: flex; width: 100%; max-width: 100%;">
            
            <!-- 竖排文字内容 -->
            <div style="writing-mode: vertical-rl; text-orientation: upright; font-family: 'STKaiti', 'KaiTi', serif; font-size: 20px; line-height: 2; color: #111; letter-spacing: 4px; height: 55vh; max-height: 55vh; overflow-x: auto; overflow-y: hidden; text-align: start; width: 100%; padding-left: 10px;">
              
              <div style="display: flex; flex-direction: column; height: 100%; align-items: flex-start;">
                <span style="white-space: pre-wrap;">${escapeHtml(letter.content)}</span>
                

              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  `;

  const cover = el.querySelector("#envelope-cover");
  const paper = el.querySelector("#letter-paper");

  cover.onclick = () => {
    cover.style.transform = "scale(1.1) rotateX(90deg)";
    cover.style.opacity = "0";
    
    setTimeout(() => {
      cover.style.display = "none";
      paper.style.opacity = "1";
      paper.style.transform = "translateY(0)";
    }, 400);
  };

  el.querySelector("#btn-back").onclick = () => { location.hash = "#/tanmi/letters"; };

  el.querySelector("#btn-more").onclick = async () => {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const modal = showModal(`
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="more-item danger" data-act="del">删 除</button>
      </div>
      <style>
        .more-item {
          padding: 14px;
          background: var(--paper-soft);
          border: 1px solid var(--line-light);
          border-radius: var(--radius-sm);
          font-family: var(--font-title);
          font-size: 14px;
          letter-spacing: 2px;
          color: var(--cinnabar);
          cursor: pointer;
        }
      </style>
    `);
    modal.querySelector("[data-act='del']").onclick = async () => {
      closeModal(modal);
      const ok = await showConfirm("删除信件", "确定删除这封信？");
      if (!ok) return;
      await deleteLetter(letterId);
      showToast("已删除");
      location.hash = "#/tanmi/letters";
    };
  };

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}