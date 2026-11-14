import { openDB, db } from "./core/db.js";
import { register, start } from "./core/router.js";
import { setCurrentUser } from "./core/state.js";
import { importSeedIfNeeded } from "./services/seed-service.js";
import { initTheme } from "./theme/theme-runtime.js";
import { initParticleEngine } from "./theme/particle-engine.js";

import { welcomeView } from "./views/welcome.js";
import { userCreateView } from "./views/user-create.js";
import { chenshiView } from "./views/chenshi.js";
import { yajiView } from "./views/yaji.js";
import { wangshiView } from "./views/wangshi.js";
import { tanmiView } from "./views/tanmi.js";
import { guichuView } from "./views/guichu.js";
import { guichuThemeView } from "./views/guichu-theme.js";
import { guichuProfileView } from "./views/guichu-profile.js";
import { guichuChatSettingsView } from "./views/guichu-chat-settings.js";

import { yajiDetailView } from "./views/yaji-detail.js";
import { yajiNewView } from "./views/yaji-new.js";
import { importPresetCharacters } from "./services/character-service.js";
import { tanmiSignView } from "./views/tanmi-sign.js";
import { tanmiBaguaView } from "./views/tanmi-bagua.js";
import { tanmiCardsView } from "./views/tanmi-cards.js";
import { chatView } from "./views/chat.js";
import { tanmiMusicView } from "./views/tanmi-music.js";
import { guichuFontView } from "./views/guichu-font.js";
import { initFontSettings } from "./services/font-service.js";
import { guichuDataView } from "./views/guichu-data.js";
import { yajiEditView } from "./views/yaji-edit.js";
import { tanmiPostsView } from "./views/tanmi-posts.js";
import { tanmiPostsNewView } from "./views/tanmi-posts-new.js";
import { tanmiPostsMineView } from "./views/tanmi-posts-mine.js";
import { tanmiLettersView } from "./views/tanmi-letters.js";
import { tanmiLettersNewView } from "./views/tanmi-letters-new.js";
import { tanmiLettersReadView } from "./views/tanmi-letters-read.js";
import { guichuGalleryView } from "./views/guichu-gallery.js";
import { guichuBooksView } from "./views/guichu-books.js";
import { guichuBookReadView } from "./views/guichu-book-read.js";
import { guichuBookNewView, guichuBookEditView } from "./views/guichu-book-edit.js";
import { wangshiGameNewView } from "./views/wangshi-game-new.js";
import { wangshiGameNewAiView } from "./views/wangshi-game-new-ai.js";
import { wangshiGameEditView } from "./views/wangshi-game-edit.js";
import { wangshiGamePlayView } from "./views/wangshi-game-play.js";
import { chatGroupSettingsView } from "./views/chat-group-settings.js";
import { guichuWorldbookView } from "./views/guichu-world_book.js";
import { initPresetWorldbook } from "./data/preset-worldbook.js";
import { guichuAiSettingsView } from "./views/guichu-ai-settings.js";
import { wangshiGameReadView } from "./views/wangshi-game-read.js";
import { guichuInventoryView } from "./views/guichu-inventory.js";
import { guichuGamesView } from "./views/guichu-games.js"; 
import { guichuGamesPlayView } from "./views/guichu-games-play.js";


window.addEventListener("unhandledrejection", (event) => {
  alert("未处理的异步错误：\n" + (event.reason?.message || event.reason));
  console.error("异步错误:", event.reason);
});
// 1. 打开数据库
await openDB();

// 2. 导入素材（首次）
await importSeedIfNeeded();


// 3. 初始化粒子引擎
initParticleEngine();

// 4. 初始化主题
await initTheme();

// 启动时应用字体
await initFontSettings();

// 5. 检查是否已初始化
const settings = await db.get("settings", "init");

// 6. 注册路由
register("welcome", welcomeView, { topbar: false, tabbar: false });
register("user/create", userCreateView, { topbar: false, tabbar: false });
register("chenshi", chenshiView);
register("yaji", yajiView, { topbar: false, bodyClass: "yaji" });
register("yaji/new", yajiNewView, { topbar: false });
register("yaji/detail", yajiDetailView);  // 或用 yaji/:id
register("wangshi", wangshiView, { topbar: false });
register("tanmi", tanmiView, { topbar: false });
register("tanmi/bagua", tanmiBaguaView, { topbar: false });
register("tanmi/cards", tanmiCardsView, { topbar: false });
register("guichu", guichuView, { topbar: false });
register("guichu/theme", guichuThemeView, { topbar: false });
register("tanmi/sign", tanmiSignView, { topbar: false });
register("guichu/profile", guichuProfileView, { topbar: false });
register("guichu/chat-settings", guichuChatSettingsView, { topbar: false });
register("chat", chatView, { topbar: false, tabbar: false });
register("tanmi/music", tanmiMusicView, { topbar: false });
register("guichu/font", guichuFontView, { topbar: false });
register("guichu/data", guichuDataView, { topbar: false });
register("yaji/edit", yajiEditView, { topbar: false });
register("tanmi/posts",      tanmiPostsView,     { topbar: false });
register("tanmi/posts/new",  tanmiPostsNewView,  { topbar: false });
register("tanmi/posts/mine", tanmiPostsMineView, { topbar: false });
register("tanmi/letters",          tanmiLettersView,      { topbar: false });
register("tanmi/letters/new",      tanmiLettersNewView,   { topbar: false });
register("tanmi/letters/read",     tanmiLettersReadView,  { topbar: false });
register("guichu/gallery", guichuGalleryView, { topbar: false });
register("guichu/books", guichuBooksView, { topbar: false });
register("guichu/books/read", guichuBookReadView, { topbar: false });
register("guichu/books/new",  guichuBookNewView,  { topbar: false });
register("guichu/books/edit", guichuBookEditView, { topbar: false });
register("wangshi/game/new",    wangshiGameNewView,   { topbar: false });
register("wangshi/game/new-ai", wangshiGameNewAiView, { topbar: false });
register("wangshi/game/edit", wangshiGameEditView, { topbar: false });
register("wangshi/game/play", wangshiGamePlayView, { topbar: false });
register("chat/group-settings", chatGroupSettingsView, { topbar: false, tabbar: false });
register("guichu/world-book", guichuWorldbookView, { topbar: false, tabbar: true });
register("guichu/ai-settings", guichuAiSettingsView, { topbar: false });
register("wangshi/game/read", wangshiGameReadView, { topbar: false });
register("guichu/inventory", guichuInventoryView, { topbar: false });
register("guichu/games", guichuGamesView, { topbar: false });
register("guichu/games/play", guichuGamesPlayView, { topbar: false, tabbar: false });

// 7. 恢复用户
async function restoreUser() {
  try {
    if (!settings?.userId) return;
    const user = await db.get("users", settings.userId);
    if (!user) return;

    setCurrentUser(user);
    await initPresetWorldbook(db, user.id);
    
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = user.name;

    // 👈 恢复原本最基础的写法，不要做强制 Blob 判断，直接生成链接
    if (user.avatarId) {
      const avatarEl = document.getElementById("user-avatar");
      const img = await db.get("images", user.avatarId);
      
      // 不管它是原生的 Blob 还是导入的字符串，只要它的 data 存在，我们就直接生成
      if (img && img.thumb && img.thumb.data) {
        try {
          const url = URL.createObjectURL(img.thumb.data);
          if (avatarEl) avatarEl.src = url;
        } catch (e) {
          console.warn("生成头像链接失败，可能是导入的格式有误", e);
        }
      }
    }
  } catch (e) {
    console.error("[main] restoreUser 失败:", e);
  }
}

// 8. 决定初始路由
if (!settings?.initialized) {
  location.hash = "#/welcome";
} else {
  await restoreUser();
  if (!location.hash || location.hash === "#/welcome") {
    location.hash = "#/chenshi";
  }
}
// 9. 启动路由
start();