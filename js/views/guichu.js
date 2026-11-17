import { guichuThemeView } from "./guichu-theme.js";

export async function guichuView() {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="section-title" style="margin-bottom: 24px;">归 处</div>
    
    <div style="display: flex; flex-direction: column; gap: 8px;">

      <!-- ================= 第一类：关于我 ================= -->
      <div style="font-size: 13px; color: var(--ink-dim); letter-spacing: 4px; margin: 8px 0 4px 8px; display: flex; align-items: center; gap: 12px;">
        <span>关于我</span>
        <div style="flex: 1; height: 1px; background: linear-gradient(to right, var(--line-light), transparent);"></div>
      </div>

      <div class="card" data-nav="profile" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>我的档案</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>
      
      <div class="card" data-nav="inventory" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>藏品</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>

      <!-- ================= 第二类：关于使用设置 ================= -->
      <div style="font-size: 13px; color: var(--ink-dim); letter-spacing: 4px; margin: 16px 0 4px 8px; display: flex; align-items: center; gap: 12px;">
        <span>关于使用</span>
        <div style="flex: 1; height: 1px; background: linear-gradient(to right, var(--line-light), transparent);"></div>
      </div>

      <div class="card" data-nav="theme" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>主题</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>
      <div class="card" data-nav="font" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>字体</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>
      <div class="card" data-nav="world-book" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>世界书</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>
      <div class="card" data-nav="ai-settings" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>AI 设置</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>
      <div class="card" data-nav="chat-settings" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>设置</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>

      <!-- ================= 第三类：关于数据与网站 ================= -->
      <div style="font-size: 13px; color: var(--ink-dim); letter-spacing: 4px; margin: 16px 0 4px 8px; display: flex; align-items: center; gap: 12px;">
        <span>关于数据与网站</span>
        <div style="flex: 1; height: 1px; background: linear-gradient(to right, var(--line-light), transparent);"></div>
      </div>

      <div class="card" data-nav="data" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>数据管理</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>
      
      <div class="card" data-nav="credits" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>关于与致谢</span>
        <span style="color: var(--ink-dim);">›</span>
      </div>

    </div>
  `;

  // ================= 绑定点击事件 =================
  el.querySelector("[data-nav='profile']").onclick = () => { location.hash = "#/guichu/profile"; };
  el.querySelector("[data-nav='inventory']").onclick = () => { location.hash = "#/guichu/inventory"; };
  el.querySelector("[data-nav='theme']").onclick = () => { location.hash = "#/guichu/theme"; };
  el.querySelector("[data-nav='font']").onclick = () => { location.hash = "#/guichu/font"; };
  el.querySelector("[data-nav='world-book']").onclick = () => { location.hash = "#/guichu/world-book"; };
  el.querySelector("[data-nav='ai-settings']").onclick = () => { location.hash = "#/guichu/ai-settings"; };
  el.querySelector("[data-nav='chat-settings']").onclick = () => { location.hash = "#/guichu/chat-settings"; };
  el.querySelector("[data-nav='data']").onclick = () => { location.hash = "#/guichu/data"; };

  el.querySelector("[data-nav='credits']").onclick = async () => {
    const { showModal, closeModal } = await import("../ui/modal.js");
    
    const modal = showModal(`
      <div style="text-align:center; margin-bottom: 24px;">
        <div style="font-family:var(--font-title);font-size:22px;color:var(--cinnabar);letter-spacing:6px;margin-bottom:8px;">寻 风 渡</div>
        <div style="font-size:12px;color:var(--ink-dim);letter-spacing:2px;">—— 一棹寻风去，江湖此间渡 ——</div>
      </div>
      
      <div style="font-size:13px;line-height:2;color:var(--ink-soft);text-align:justify;padding:0 10px;">
        <p>这不仅仅是一个文字游戏，而是一处属于你的江湖归所。</p>
        <p>在这里，你可以与心悦之人闲谈书信，也可以记录心绪、游历四方；你可以沉浸于跌宕的剧本，也可以安静地收纳、整理属于他们的每一段官方剧情与回忆。</p>
        
        <p style="margin-top:16px; color:var(--cinnabar); font-weight:bold;">【关于共创】</p>
        <p>这不是一个孤独的江湖。在这个世界里，你每一次的倾诉、发帖、甚至每一次上线下线，都有 AI 的默默陪伴。是千千万万次参数的跳动，赋予了纸片人呼吸与心跳，让他们能在你耳边轻语，与你共赴风雨。</p>
        <p>感谢科技，让这场跨越次元的相遇成为可能。</p>
        
        <p style="margin-top:16px; color:var(--cinnabar); font-weight:bold;">【技术支持】</p>
        <p>前端底层：Vanilla JS & IndexedDB</p>
        <p>AI 核心驱动：DeepSeek</p>
        
        <p style="margin-top:16px; color:var(--cinnabar); font-weight:bold;">【特别鸣谢】</p>
        <p>历时整整一个月，从初秋到深秋。</p>
        <p>感谢每一个日夜敲下代码的自己，也感谢所有在字里行间相遇的灵魂。</p>
        <p>感谢你在这里度过的每一寸光阴。愿你在寻风渡，见天地、见众生、见自己。</p>
      </div>
      
      <button class="btn ghost" id="credits-close" style="width:100%;margin-top:24px; padding:12px;">收 起</button>
    `);
      
    modal.querySelector("#credits-close").onclick = () => closeModal(modal);
  };

  return el;
}