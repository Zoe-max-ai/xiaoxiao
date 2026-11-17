import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { openImagePicker } from "../ui/image-picker.js";
import { showCropModal } from "../ui/image-cropper.js";
import { db } from "../core/db.js";
export async function tanmiView() {
  const el = document.createElement("div");
  // ===== 👈 顶部视觉主卡片 =====
  const savedCover = localStorage.getItem("tanmi_cover_url");
  // 如果没有选过图，默认给一个极美的浅青绿渐变底色
  const defaultBg = savedCover
    ? `url('${savedCover}')`
    : 'linear-gradient(135deg, #e8f0ec 0%, #b4cac1 100%)';
  const heroCard = document.createElement("div");
  heroCard.style.cssText = `
    position: relative;
    width: 100vw;
    margin: 0 0 24px 0;
    height: 220px;
    border-radius: 0;
    overflow: hidden;
    cursor: pointer;
    background-image: ${defaultBg};
    background-size: cover;
    background-position: center;
  `;

  heroCard.innerHTML = `
    <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 35%); pointer-events: none;"></div>
    
    <div style="position: absolute; bottom: 20px; left: 24px; right: 24px; color: #fff;">
      <h2 style="font-family: var(--font-title); font-size: 28px; letter-spacing: 8px; margin: 0 0 6px; font-weight: normal; text-shadow: 0 2px 10px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.8);">探 秘</h2>
      <p style="font-size: 12px; opacity: 0.9; margin: 0; letter-spacing: 2px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 12px; height: 1px; background: var(--gold, #d4af37);"></span>
        寻幽探微，见天地之秘
      </p>
    </div>
  `;
  el.appendChild(heroCard);

  // 👈 绑定点击，从绘卷选择「插画」并裁剪（对齐往事写法）
  heroCard.onclick = () => {
    openImagePicker("illustration", async (imgId) => {
      const img = await db.get("images", imgId);
      if (!img || !img.origin?.data) {
        showToast("图片数据异常");
        return;
      }
      let src;
      if (img.origin.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = (event) => {
          runCrop(event.target.result);
        };
        reader.readAsDataURL(img.origin.data);
      } else {
        src = img.origin.data;
        runCrop(src);
      }
      function runCrop(imageSrc) {
        showCropModal(imageSrc, (croppedBase64) => {
          heroCard.style.backgroundImage = `url('${croppedBase64}')`;
          try {
            localStorage.setItem("tanmi_cover_url", croppedBase64);
            showToast("探秘封面已更换");
          } catch (err) {
            showToast("图片太大，请换一张");
          }
        });
      }
    });
  };
  // 九宫格容器
  const grid = document.createElement("div");
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px 12px;
    margin-top: 16px;
    padding: 0 20px;
    box-sizing: border-box;
  `;
  grid.innerHTML = `
    ${renderItem("cards",   "笺语", "#/tanmi/cards")}
    ${renderItem("letters", "书信", "#/tanmi/letters")}
    ${renderItem("posts",   "心绪", "#/tanmi/posts")}
    ${renderItem("music",   "音律", "#/tanmi/music")}
    ${renderItem("sign",    "抽签", "#/tanmi/sign")}
    ${renderItem("bagua",   "问易", "#/tanmi/bagua")}
    
    <!-- 👈 以下是新挪过来的三个入口，暂用其他图标代替 -->
    ${renderItem("cards",   "书卷", "#/tanmi/books")}
    ${renderItem("letters", "绘卷", "#/tanmi/gallery")}
    ${renderItem("music",   "雅戏", "#/tanmi/games")}
  `;
  el.appendChild(grid);
  return el;
}
function renderItem(iconName, label, href) {
  return `
    <a href="${href}" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--ink);
      cursor: pointer;
      transition: transform 0.15s;
    ">
      <img src="assets/seed/icon/icon-${iconName}.png" style="
        width: 72px;
        height: 72px;
        border-radius: 12px;
      ">
      <span style="
        font-family: var(--font-title);
        font-size: 14px;
        letter-spacing: 4px;
        color: var(--ink);
        text-shadow: 0 0 4px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.8);
        font-weight: 600;
      ">${label}</span>
    </a>
  `;
}
