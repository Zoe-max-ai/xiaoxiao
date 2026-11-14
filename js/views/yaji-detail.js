import { getCharacter } from "../services/character-service.js";
import { getImageUrl } from "../services/seed-service.js";

export async function yajiDetailView({ params }) {
  const el = document.createElement("div");
  const charId = params?.[0];
  if (!charId) {
    el.innerHTML = `<div class="empty-state">未指定角色。</div>`;
    return el;
  }

  const char = await getCharacter(charId);
  if (!char) {
    el.innerHTML = `<div class="empty-state">此人已隐入尘烟。</div>`;
    return el;
  }

  const portraitUrl = char.portraitId ? await getImageUrl(char.portraitId) : null;

  el.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      ${portraitUrl ? `<img src="${portraitUrl}" style="width:100%;max-width:280px;border-radius:var(--radius);">` : ""}
      <div style="font-family: var(--font-title); font-size: 24px; letter-spacing: 6px; margin-top: 16px;">
        ${char.name}
      </div>
      ${char.du ? `<div style="font-size: 14px; color: var(--cinnabar); letter-spacing: 6px; margin-top: 8px;">${char.du}</div>` : ""}
    </div>
    <div class="card">
      <div style="font-size: 14px; line-height: 1.8; white-space: pre-line;">${char.bio || "（无小传）"}</div>
    </div>
    <button class="btn" style="width: 100%; margin-top: 20px;" onclick="location.hash = '#/chat/${char.id}'">与他交谈</button>
  `;
  return el;
}