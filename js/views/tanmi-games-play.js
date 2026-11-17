import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { showToast } from "../ui/toast.js";
import { DUIYI_DATA } from "../data/duiyi-data.js";
import { TOUHU_DATA } from "../data/touhu-data.js";
import { addMessage } from "../services/chat-service.js";
import { addRelation } from "../services/relation-service.js";
import { openImagePicker } from "../ui/image-picker.js";

export async function guichuGamesPlayView({ params }) {
  const el = document.createElement("div");
  el.style.cssText = "position: relative; background: var(--bg); display: flex; flex-direction: column;";
  
  const charId = params?.[0];
  const gameType = params?.[1];
  const ownerId = state.currentUserId;

  if (!ownerId) return el;

  let character = null;
  let displayName = "独自练手";
  
  if (charId && charId !== "solo") {
    character = await db.get("characters", charId);
    if (character) displayName = character.name;
  }

  let gameData = null;
  let gameTitle = "";
  if (gameType === "duiyi") {
    gameData = DUIYI_DATA[displayName] || DUIYI_DATA["方承意"];
    gameTitle = "对弈";
  } else if (gameType === "touhu") {
    gameData = TOUHU_DATA[displayName] || TOUHU_DATA["方承意"];
    gameTitle = "投壶";
  } else {
    el.innerHTML = "<div class='empty-state'>未知的游戏类型。</div>";
    return el;
  }

let qAvatarUrl = null;
if (character?.qAvatarId) {
  const img = await db.get("images", character.qAvatarId);
  if (img?.origin?.data) qAvatarUrl = img.origin.data;
} else if (charId === "solo") {
  const soloQId = localStorage.getItem(`solo_qavatar_${ownerId}`);
  if (soloQId) {
    const img = await db.get("images", soloQId);
    if (img?.origin?.data) qAvatarUrl = img.origin.data;
  }
}


  el.innerHTML = `
    <!-- 顶部导航 -->
    <div class="chat-topbar" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; flex-shrink: 0;">
      <button id="btn-back" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--ink);">←</button>
      <div style="font-family: var(--font-title); font-size: 16px; color: var(--ink); letter-spacing: 2px;">${gameTitle}</div>
      <button id="btn-switch-char" style="background: none; border: none; font-size: 13px; color: var(--cinnabar); cursor: pointer; font-family: var(--font-title);">换人</button>
    </div>

    <!-- 主内容区 -->
    <div style="padding: 0 20px;">
      <!-- 顶部：对话与 Q版 -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div id="game-dialog" style="flex: 1; font-size: 14px; color: var(--ink); line-height: 1.8; min-height: 60px;">
          <span style="color:var(--ink-dim);">准备开始${gameTitle}吧。</span>
        </div>
        <div style="width: 80px; flex-shrink: 0; position: relative;">
          <div id="q-avatar-box" style="width: 80px; height: 90px; cursor: pointer; position: relative;">
            ${qAvatarUrl 
              ? `<img src="${qAvatarUrl}" style="width:100%; height:100%; object-fit:contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));">` 
              : `<span style="font-size: 36px; color: var(--cinnabar); font-family: var(--font-title); display: flex; justify-content: center; align-items: center; height: 100%;">${displayName[0]}</span>`
            }
            <div id="btn-upload-q" style="position: absolute; bottom: 0px; right: 0px; width: 22px; height: 22px; background: var(--paper-soft); border: 1px solid var(--cinnabar); color: var(--cinnabar); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2;">+</div>
          </div>
        </div>
      </div>

      <div id="game-area" style="display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%;  margin-bottom: 16px;">
        <!-- 游戏区动态注入 -->
      </div>
    </div>

    <div id="game-controls" style="padding: 0 20px 30px;"></div>
  `;

  const dialogEl = el.querySelector("#game-dialog");
  const gameArea = el.querySelector("#game-area");
  const controlsEl = el.querySelector("#game-controls");

  // Q版上传
el.querySelector("#btn-upload-q").onclick = (e) => {
  e.stopPropagation();
  openImagePicker("qavatar", async (imgId) => {
    const img = await db.get("images", imgId);
    if (img && img.origin && img.origin.data) {
      const url = img.origin.data;
      const box = el.querySelector("#q-avatar-box");
      // 重绘头像+加号，但是【事件委托】不再直接绑onclick在加号上
      box.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.2));">
        <div class="q-upload-btn" style="position: absolute; bottom: 0px; right: 0px; width: 22px; height: 22px; background: var(--paper-soft); border: 1px solid var(--cinnabar); color: var(--cinnabar); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2;">+</div>
      `;
      // 保存图片ID，存入角色/本地存储
      if (character) {
        character.qAvatarId = imgId;
        await db.put("characters", character);
      } else {
        localStorage.setItem(`solo_qavatar_${ownerId}`, imgId);
      }
      showToast("Q版已更新");
    }
  });
};
// ✅ 全局事件委托，绑定在box上，不管里面的加号怎么刷新，永远能点
const box = el.querySelector("#q-avatar-box");
box.addEventListener("click", (e) => {
  if (e.target.classList.contains("q-upload-btn")) {
    e.stopPropagation();
    openImagePicker("qavatar", async (imgId) => {
      const img = await db.get("images", imgId);
      if (img && img.origin && img.origin.data) {
        const url = img.origin.data;
        box.innerHTML = `
          <img src="${url}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.2));">
          <div class="q-upload-btn" style="position: absolute; bottom: 0px; right: 0px; width: 22px; height: 22px; background: var(--paper-soft); border: 1px solid var(--cinnabar); color: var(--cinnabar); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2;">+</div>
        `;
        if (character) {
          character.qAvatarId = imgId;
          await db.put("characters", character);
        } else {
          localStorage.setItem(`solo_qavatar_${ownerId}`, imgId);
        }
        showToast("Q版已更新");
      }
    });
  }
});


  // 👈 通用结算弹窗
  // 👈 加上 async
  async function showSettlementModal(isWin, isDraw, charSay) {
    const { showModal, closeModal } = await import("../ui/modal.js"); 
    
    let title = isWin ? "大获全胜" : (isDraw ? "旗鼓相当" : "未竟全功");
    let color = isWin ? "var(--cinnabar)" : (isDraw ? "var(--gold)" : "var(--ink-dim)");

    const modal = showModal(`
      <div style="text-align:center; margin-bottom: 20px;">
        <div style="font-family:var(--font-title);font-size:24px;color:${color};letter-spacing:6px;margin-bottom:8px;">${title}</div>
        ${charSay ? `<div style="font-size:14px;color:var(--ink);line-height:1.6;margin-top:12px;">“${escapeHtml(charSay)}”</div>` : ""}
      </div>
      <div style="display:flex; gap:12px; flex-direction: column;">
        <button class="btn" id="btn-replay" style="padding:12px; background:var(--cinnabar); color:#fff; letter-spacing:4px;">再 来 一 局</button>
        <button class="btn ghost" id="btn-leave" style="padding:12px; letter-spacing:4px;">暂 时 离 席</button>
      </div>
    `);

    modal.querySelector("#btn-replay").onclick = () => {
      closeModal(modal);
      location.reload();
    };
    modal.querySelector("#btn-leave").onclick = () => {
      closeModal(modal);
      if (charId === "solo") location.hash = "#/tanmi/games";
      else location.hash = `#/chat/${charId}`;
    };
  }

  // ================= 对弈逻辑 =================
  if (gameType === "duiyi") {
    const SIZE = 15;
    let board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)); 
    let isPlayerTurn = true;
    let gameOver = false;
    let difficulty = "认真"; 
    let history = [];

    gameArea.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; width: 100%;">
        <div style="font-size: 13px; color: var(--ink-dim); white-space: nowrap;">
          <span style="font-family:var(--font-title); font-weight:bold; color:var(--ink);">${displayName}</span> · 你希望他：
        </div>
        <div style="display: flex; gap: 6px; flex: 1;">
          <button class="btn ghost diff-btn" data-diff="放水" style="flex:1; padding: 6px 0; font-size: 12px;">放水</button>
          <button class="btn ghost diff-btn on" data-diff="认真" style="flex:1; padding: 6px 0; font-size: 12px; border-color: var(--cinnabar); color: var(--cinnabar);">认真</button>
          <button class="btn ghost diff-btn" data-diff="杀伐" style="flex:1; padding: 6px 0; font-size: 12px;">杀伐</button>
        </div>
      </div>
      <div style="width: 100%; height: 1px; background: var(--line-light); margin-bottom: 16px;"></div>
      <div style="display: flex; justify-content: center; width: 100%;">
        <div id="board" style="width: 100%; max-width: 340px; aspect-ratio: 1/1; background: #e8dcc8; border: 4px solid #8a6d4b; border-radius: 8px; padding: 12px; position: relative;"></div>
      </div>
    `;

    controlsEl.innerHTML = `
      <!-- 补充上互动按钮 -->
      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
        <button class="btn ghost interact-btn" data-act="撒娇" style="flex:1; padding: 8px 0; font-size: 12px;">撒娇</button>
        <button class="btn ghost interact-btn" data-act="扮鬼脸" style="flex:1; padding: 8px 0; font-size: 12px;">扮鬼脸</button>
        <button class="btn ghost interact-btn" data-act="假装生气" style="flex:1; padding: 8px 0; font-size: 12px;">假装生气</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        <button class="btn ghost" id="btn-undo" style="padding: 10px; font-size: 13px;">悔棋</button>
        <button class="btn ghost" id="btn-draw" style="padding: 10px; font-size: 13px;">求和</button>
        <button class="btn" id="btn-resign" style="padding: 10px; font-size: 13px; background: var(--cinnabar); color: #fff;">认输</button>
      </div>
    `;

    // 👈 记得给互动按钮绑定事件
    el.querySelectorAll(".interact-btn").forEach(btn => {
      btn.onclick = () => {
        if (displayName === "独自练手") return showToast("一个人下棋，就不要撒娇啦~");
        const act = btn.dataset.act;
        const textPool = gameData.interact ? gameData.interact[act] : null;
        if (!textPool || textPool.length === 0) return;
        const text = textPool[Math.floor(Math.random() * textPool.length)];
        dialogEl.innerHTML = `<span style="color:var(--cinnabar); font-weight:bold;">${escapeHtml(displayName)}</span>：<br>“${escapeHtml(text)}”`;
      };
    });

    const boardEl = el.querySelector("#board");
    
    // 渲染网格（完整恢复！）
    boardEl.innerHTML = `
      <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; padding: 12px; box-sizing: border-box;">
        ${Array(SIZE).fill(0).map((_, i) => {
          const pos = (i / (SIZE - 1)) * 100;
          return `<line x1="${pos}" y1="0" x2="${pos}" y2="100" stroke="rgba(138,109,75,0.4)" stroke-width="0.5"/>
                  <line x1="0" y1="${pos}" x2="100" y2="${pos}" stroke="rgba(138,109,75,0.4)" stroke-width="0.5"/>`;
        }).join('')}
      </svg>
      ${Array(SIZE * SIZE).fill(0).map((_, i) => {
        const r = Math.floor(i / SIZE);
        const c = i % SIZE;
        const top = (r / (SIZE - 1)) * 100;
        const left = (c / (SIZE - 1)) * 100;
        return `<div class="cell" data-index="${i}" style="position: absolute; top: ${top}%; left: ${left}%; transform: translate(-50%, -50%); width: 6.5%; height: 6.5%; border-radius: 50%; cursor: pointer; z-index: 3;"></div>`;
      }).join('')}
    `;

    // 绑定难度
    el.querySelectorAll(".diff-btn").forEach(btn => {
      btn.onclick = () => {
        el.querySelectorAll(".diff-btn").forEach(b => {
          b.classList.remove("on"); b.style.borderColor = "var(--line-light)"; b.style.color = "var(--ink)";
        });
        btn.classList.add("on"); btn.style.borderColor = "var(--cinnabar)"; btn.style.color = "var(--cinnabar)";
        difficulty = btn.dataset.diff;
      };
    });

    function renderBoard() {
      boardEl.querySelectorAll(".piece").forEach(p => p.remove());
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const val = board[r][c];
          if (val === 0) continue;
          const top = (r / (SIZE - 1)) * 100;
          const left = (c / (SIZE - 1)) * 100;
          const piece = document.createElement("div");
          piece.className = "piece";
          piece.style.cssText = `position: absolute; top: ${top}%; left: ${left}%; transform: translate(-50%, -50%); width: 6.5%; height: 6.5%; border-radius: 50%; z-index: 2; pointer-events: none;`;
          piece.style.background = val === 1 ? "#2b2b2b" : "#faf6ee";
          piece.style.border = val === 2 ? "1px solid #ccc" : "none";
          boardEl.appendChild(piece);
        }
      }
    }

    boardEl.onclick = (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || !isPlayerTurn || gameOver) return;
      const index = +cell.dataset.index;
      const r = Math.floor(index / SIZE);
      const c = index % SIZE;
      if (board[r][c] !== 0) return;
      board[r][c] = 1;
      history.push({ r, c, player: 1 });
      renderBoard();
      if (checkWin(r, c, 1)) { gameOver = true; endGame("你赢了！"); return; }
      isPlayerTurn = false;
      setTimeout(() => { aiMove(); }, 300);
    };

    el.querySelector("#btn-undo").onclick = () => {
      if (gameOver || history.length < 2) return showToast("现在还不能悔棋哦");
      const aiLast = history.pop(); board[aiLast.r][aiLast.c] = 0;
      const playerLast = history.pop(); board[playerLast.r][playerLast.c] = 0;
      isPlayerTurn = true; renderBoard(); showToast("已悔棋");
    };

    el.querySelector("#btn-draw").onclick = () => {
      if (gameOver) return;
      gameOver = true; boardEl.style.pointerEvents = "none";
      endGame("平局。");
    };

    el.querySelector("#btn-resign").onclick = () => { if (!gameOver) { gameOver = true; endGame("你认输了。"); } };

    function checkWin(r, c, player) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i <= 4; i++) { const nr = r + dr * i, nc = c + dc * i; if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== player) break; count++; }
        for (let i = 1; i <= 4; i++) { const nr = r - dr * i, nc = c - dc * i; if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== player) break; count++; }
        if (count >= 5) return true;
      }
      return false;
    }

    function aiMove() {
      if (gameOver) return;
      let bestScore = -1, bestMove = null;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] !== 0 || !hasNeighbor(r, c)) continue;
          let score = 0;
          let aiScore = evaluatePoint(r, c, 2), playerScore = evaluatePoint(r, c, 1);
          if (difficulty === "放水") score = Math.random() * 10; 
          else if (difficulty === "认真") score = Math.max(aiScore, playerScore * 0.9); 
          else if (difficulty === "杀伐") score = Math.max(aiScore * 1.2, playerScore); 
          if (score > bestScore) { bestScore = score; bestMove = { r, c }; }
        }
      }
      if (bestMove) {
        board[bestMove.r][bestMove.c] = 2;
        history.push({ r: bestMove.r, c: bestMove.c, player: 2 });
        renderBoard();
        if (checkWin(bestMove.r, bestMove.c, 2)) { gameOver = true; endGame("你输了。"); return; }
      }
      isPlayerTurn = true;
    }

    function hasNeighbor(r, c) {
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const nr = r + i, nc = c + j;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] !== 0) return true;
      }
      return false;
    }

    function evaluatePoint(r, c, player) {
      let score = 0;
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i <= 4; i++) { const nr = r + dr * i, nc = c + dc * i; if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break; if (board[nr][nc] === player) count++; else break; }
        for (let i = 1; i <= 4; i++) { const nr = r - dr * i, nc = c - dc * i; if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break; if (board[nr][nc] === player) count++; else break; }
        if (count >= 5) score += 1000000; else if (count === 4) score += 10000; else if (count === 3) score += 1000; else if (count === 2) score += 100; else if (count === 1) score += 10;
      }
      return score;
    }

    async function endGame(result) {
      let isWin = result === "你赢了！";
      let isDraw = result === "平局。";
      let charSay = "";
      if (displayName !== "独自练手") {
        let pool = isWin ? gameData.win : (isDraw ? ["平分秋色，也算是一桩雅事。"] : gameData.lose);
        charSay = pool[Math.floor(Math.random() * pool.length)];
        dialogEl.innerHTML = `<span style="color:var(--cinnabar); font-weight:bold;">${escapeHtml(displayName)}</span>：<br>“${escapeHtml(charSay)}”`;
        const chat = await db.all("chats").then(all => all.find(c => c.ownerId === ownerId && c.characterId === charId));
        if (chat) {
          await addMessage(chat.id, ownerId, { fromId: charId, fromType: "character", content: `（对弈结束，${result}）\n“${charSay}”`, mode: "card" });
          let addAff = isWin ? 3 : 1;
          await addRelation(ownerId, charId, { affection: addAff, friendship: 1, type: "game", note: `对弈` });
        }
      } else {
        dialogEl.innerHTML = result;
      }
      boardEl.style.pointerEvents = "none";
      showSettlementModal(isWin, isDraw, charSay);
    }
  }

  // ================= 投壶逻辑 =================
  if (gameType === "touhu") {
    let playerScore = 0, opponentScore = 0;
    let playerArrows = 8, opponentArrows = 8;
    let playerAiming = false, isPlayerTurn = true, gameOver = false;

    gameArea.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%; font-size: 14px; font-family: var(--font-title); color: var(--ink); margin-bottom: 8px; padding: 0 10px;">
        <div>你: <span id="p-score" style="color:var(--cinnabar); font-weight:bold; font-size:18px;">0</span> 分 (剩 <span id="p-arrows">8</span> 箭)</div>
        <div>对方: <span id="o-score" style="color:var(--cinnabar); font-weight:bold; font-size:18px;">0</span> 分 (剩 <span id="o-arrows">8</span> 箭)</div>
      </div>
      <div style="position: relative; width: 100%; max-width: 340px; height: 220px; background: var(--paper-soft); border-radius: 12px; border: 1px dashed var(--line); overflow: hidden; display: flex; align-items: flex-end; justify-content: space-between; padding: 20px;">
        <!-- 左侧箭筒 -->
        <div style="width: 60px; height: 120px; background: #5a4430; border-radius: 4px; position: relative;">
          <div style="position: absolute; top: -10px; left: 5px; right: 5px; height: 10px; background: #3a2c1e; border-radius: 4px;"></div>
        </div>
        <!-- 右侧壶 -->
        <div id="hu-pot" style="width: 70px; height: 90px; background: linear-gradient(to right, #8a6d4b, #b8922e, #8a6d4b); border-radius: 10px 10px 30px 30px; position: relative; border: 2px solid #3a2c1e; box-shadow: inset 0 -10px 20px rgba(0,0,0,0.5);">
           <div style="position: absolute; top: 0; left: 10%; width: 80%; height: 15px; background: #2b1d10; border-radius: 50%;"></div>
        </div>
        <!-- 飞行的箭 -->
        <div id="flying-arrow" style="position: absolute; width: 4px; height: 50px; background: #8a6d4b; border-radius: 2px; bottom: 20px; left: 60px; opacity: 0; pointer-events: none; box-shadow: 0 0 2px rgba(0,0,0,0.5);">
          <div style="position: absolute; top: -8px; left: -3px; width: 10px; height: 12px; background: #ccc; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>
        </div>
      </div>
    `;

    controlsEl.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
        <button class="btn ghost" id="btn-aim" style="flex:1; padding: 10px; font-size: 13px;">凝神瞄准</button>
        <button class="btn ghost" id="btn-throw" style="flex:1; padding: 10px; font-size: 13px;">运劲投掷</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
        <button class="btn ghost" id="btn-help" style="padding: 10px; font-size: 13px; color: var(--cinnabar); border-color: var(--cinnabar);">请君代劳</button>
        <button class="btn" id="btn-end" style="padding: 10px; font-size: 13px; background: var(--cinnabar); color: #fff;">认输 / 结束</button>
      </div>
    `;

    const flyingArrow = el.querySelector("#flying-arrow");
    const huPot = el.querySelector("#hu-pot");

    function updateUI() {
      el.querySelector("#p-score").textContent = playerScore;
      el.querySelector("#o-score").textContent = opponentScore;
      el.querySelector("#p-arrows").textContent = playerArrows;
      el.querySelector("#o-arrows").textContent = opponentArrows;
    }

    function playThrowAnimation(isHit) {
      return new Promise((resolve) => {
        flyingArrow.style.transition = "none";
        flyingArrow.style.bottom = "20px";
        flyingArrow.style.left = "60px";
        flyingArrow.style.opacity = "1";
        flyingArrow.style.transform = "rotate(0deg)";

        setTimeout(() => {
          flyingArrow.style.transition = "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)";
          if (isHit) {
            flyingArrow.style.bottom = "130px"; 
            flyingArrow.style.left = "75%"; 
            flyingArrow.style.opacity = "0";
            flyingArrow.style.transform = "rotate(180deg) translateY(20px)";
            setTimeout(() => {
              huPot.style.transform = "rotate(5deg)";
              setTimeout(() => huPot.style.transform = "rotate(-5deg)", 100);
              setTimeout(() => huPot.style.transform = "rotate(0deg)", 200);
            }, 400);
          } else {
            const offsetLeft = Math.random() > 0.5 ? "85%" : "60%";
            flyingArrow.style.bottom = "0px";
            flyingArrow.style.left = offsetLeft;
            flyingArrow.style.transform = "rotate(80deg)";
          }
        }, 50);

        setTimeout(() => { flyingArrow.style.opacity = "0"; resolve(); }, 600);
      });
    }

    el.querySelector("#btn-aim").onclick = () => {
      if (gameOver || !isPlayerTurn) return;
      playerAiming = true;
      dialogEl.innerHTML = `<span style="color:var(--ink-dim);">你屏住呼吸，仔细瞄准了壶口。</span>`;
    };

    el.querySelector("#btn-throw").onclick = async () => {
      if (gameOver || !isPlayerTurn || playerArrows <= 0) return;
      el.querySelector("#btn-throw").disabled = true; el.querySelector("#btn-aim").disabled = true; el.querySelector("#btn-help").disabled = true;
      playerArrows--;
      let isHit = Math.random() < (playerAiming ? 0.8 : 0.4);
      await playThrowAnimation(isHit);
      if (isHit) { playerScore += 10; dialogEl.innerHTML = `<span style="color:var(--cinnabar); font-weight:bold;">命中！</span> 箭矢稳稳落入壶中。`; } 
      else { dialogEl.innerHTML = `<span style="color:var(--ink-dim);">可惜，偏了一点。</span>`; }
      playerAiming = false; updateUI();
      el.querySelector("#btn-throw").disabled = false; el.querySelector("#btn-aim").disabled = false; el.querySelector("#btn-help").disabled = false;
      if (playerArrows === 0) return endGame();
      isPlayerTurn = false;
      setTimeout(() => opponentTurn(), 800);
    };

    el.querySelector("#btn-help").onclick = async () => {
      if (gameOver || !isPlayerTurn || playerArrows <= 0 || displayName === "独自练手") return;
      el.querySelector("#btn-throw").disabled = true; el.querySelector("#btn-aim").disabled = true; el.querySelector("#btn-help").disabled = true;
      let helpText = gameData.help ? gameData.help[Math.floor(Math.random() * gameData.help.length)] : "好吧，我替你投。";
      dialogEl.innerHTML = `<span style="color:var(--cinnabar); font-weight:bold;">${escapeHtml(displayName)}</span>：<br>“${escapeHtml(helpText)}”`;
      await new Promise(r => setTimeout(r, 1000));
      playerArrows--;
      await playThrowAnimation(true); // 代劳必中
      playerScore += 10; updateUI();
      if (playerArrows === 0) return endGame();
      dialogEl.innerHTML += `<br><span style="color:var(--ink-dim); font-size:12px;">—— 轮到他投掷了 ——</span>`;
      setTimeout(() => opponentTurn(), 800);
    };

    async function opponentTurn() {
      if (gameOver || opponentArrows <= 0) return;
      opponentArrows--;
      let isHit = Math.random() < 0.7;
      await playThrowAnimation(isHit);
      if (isHit) { opponentScore += 10; dialogEl.innerHTML = `<span style="color:var(--cinnabar); font-weight:bold;">${escapeHtml(displayName)}</span>：<br>“${escapeHtml(gameData.hit?.[0] || "中了。")}”`; } 
      else { dialogEl.innerHTML = `<span style="color:var(--cinnabar); font-weight:bold;">${escapeHtml(displayName)}</span>：<br>“${escapeHtml(gameData.miss?.[0] || "偏了。")}”`; }
      updateUI();
      if (opponentArrows === 0) return endGame();
      isPlayerTurn = true;
      el.querySelector("#btn-throw").disabled = false; el.querySelector("#btn-aim").disabled = false; el.querySelector("#btn-help").disabled = false;
      dialogEl.innerHTML += `<br><span style="color:var(--ink-dim); font-size:12px;">—— 轮到你投掷了 ——</span>`;
    }

    el.querySelector("#btn-end").onclick = () => { if (!gameOver) endGame(); };

    async function endGame() {
      gameOver = true;
      let isWin = playerScore > opponentScore;
      let isLose = playerScore < opponentScore;
      let isDraw = playerScore === opponentScore;
      let charSay = "";
      
      if (displayName !== "独自练手") {
        if (isWin) charSay = gameData.win[Math.floor(Math.random() * gameData.win.length)];
        else if (isLose) charSay = gameData.lose[Math.floor(Math.random() * gameData.lose.length)];
        else charSay = "平分秋色，也算是一桩雅事。";

        const chat = await db.all("chats").then(all => all.find(c => c.ownerId === ownerId && c.characterId === charId));
        if (chat) {
          await addMessage(chat.id, ownerId, { fromId: charId, fromType: "character", content: `（投壶结束，最终比分 ${playerScore} : ${opponentScore}）\n“${charSay}”`, mode: "card" });
          await addRelation(ownerId, charId, { affection: isWin ? 3 : 1, friendship: 1, type: "game", note: "投壶" });
        }
      } else {
        dialogEl.innerHTML = `最终比分 ${playerScore} : ${opponentScore}`;
      }
      
      el.querySelector("#btn-throw").disabled = true; el.querySelector("#btn-aim").disabled = true; el.querySelector("#btn-help").disabled = true; el.querySelector("#btn-end").disabled = true;
      
      // 调起漂亮的结算面板
      showSettlementModal(isWin, isDraw, charSay);
    }
  }

  // ================= 通用返回与换人 =================
  el.querySelector("#btn-back").onclick = () => {
    if (charId === "solo") location.hash = "#/tanmi/games";
    else location.hash = `#/chat/${charId}`;
  };

  el.querySelector("#btn-switch-char").onclick = async () => {
    const { showModal, closeModal } = await import("../ui/modal.js");
    const allChars = (await db.all("characters")).filter(c => c.ownerId === ownerId);
    const modal = showModal(`
      <div style="text-align:center;font-family:var(--font-title);font-size:16px;color:var(--cinnabar);letter-spacing:4px;margin-bottom:16px;">换 人</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn ghost switch-item" data-id="solo" style="padding:12px; text-align:left;">独自练手</button>
        ${allChars.map(c => `<button class="btn ghost switch-item" data-id="${c.id}" style="padding:12px; text-align:left;">${escapeHtml(c.name)}</button>`).join("")}
      </div>
      <button class="btn ghost" id="switch-cancel" style="width:100%;margin-top:16px;padding:12px;">收 起</button>
    `);
    modal.querySelector("#switch-cancel").onclick = () => closeModal(modal);
    modal.querySelectorAll(".switch-item").forEach(btn => {
      btn.onclick = () => {
        closeModal(modal);
        location.hash = `#/tanmi/games/play/${btn.dataset.id}/${gameType}`;
        window.location.reload(); 
      };
    });
  };

  return el;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}