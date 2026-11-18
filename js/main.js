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
import { guichuGalleryView } from "./views/tanmi-gallery.js";
import { guichuBooksView } from "./views/tanmi-books.js";
import { guichuBookReadView } from "./views/tanmi-book-read.js";
import { guichuBookNewView, guichuBookEditView } from "./views/tanmi-book-edit.js";
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
import { guichuGamesView } from "./views/tanmi-games.js";
import { guichuGamesPlayView } from "./views/tanmi-games-play.js";
import { getImageUrl } from "./services/seed-service.js";


window.addEventListener("unhandledrejection", (event) => {
  alert("未处理的异步错误：\n" + (event.reason?.message || event.reason));
  console.error("异步错误:", event.reason);
});

// 先注册所有路由（这部分不动，注册必须提前）
register("welcome", welcomeView, { topbar: false, tabbar: false });
register("user/create", userCreateView, { topbar: false, tabbar: false });
register("chenshi", chenshiView);
register("yaji", yajiView, { topbar: false, bodyClass: "yaji" });
register("yaji/new", yajiNewView, { topbar: false });
register("yaji/detail", yajiDetailView);
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
register("tanmi/gallery", guichuGalleryView, { topbar: false });
register("tanmi/books", guichuBooksView, { topbar: false });
register("tanmi/books/read", guichuBookReadView, { topbar: false });
register("tanmi/books/new",  guichuBookNewView,  { topbar: false });
register("tanmi/books/edit", guichuBookEditView, { topbar: false });
register("wangshi/game/new",    wangshiGameNewView,   { topbar: false });
register("wangshi/game/new-ai", wangshiGameNewAiView, { topbar: false });
register("wangshi/game/edit", wangshiGameEditView, { topbar: false });
register("wangshi/game/play", wangshiGamePlayView, { topbar: false });
register("chat/group-settings", chatGroupSettingsView, { topbar: false, tabbar: false });
register("guichu/world-book", guichuWorldbookView, { topbar: false, tabbar: true });
register("guichu/ai-settings", guichuAiSettingsView, { topbar: false });
register("wangshi/game/read", wangshiGameReadView, { topbar: false });
register("guichu/inventory", guichuInventoryView, { topbar: false });
register("tanmi/games", guichuGamesView, { topbar: false });
register("tanmi/games/play", guichuGamesPlayView, { topbar: false, tabbar: false });

// ========== 删掉外面单独的 start(); ==========
// start(); 删掉这一行！

async function bootDBAndAssets() {
  try {
    await openDB();
    await importSeedIfNeeded();
    initParticleEngine();
    await initTheme();
    await initFontSettings();
    const settings = await db.get("settings", "init");
async function restoreUser() {
  try {
    if (!settings?.userId) return;
    const user = await db.get("users", settings.userId);
    if (!user) return;
    setCurrentUser(user);
    await initPresetWorldbook(db, user.id);
    
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = user.name;
    if (user.avatarId) {
      const avatarEl = document.getElementById("user-avatar");
      try {
        const src = await getImageUrl(user.avatarId, true);
        if (src) {
          avatarEl.src = src;
        }
      } catch (e) {
        console.warn("顶部用户头像加载失败", e);
      }
    }
  } catch (e) {
    console.error("[main] restoreUser 失败:", e);
  }
}

    if (!settings?.initialized) {
      location.hash = "#/welcome";
    } else {
      await restoreUser();
      if (!location.hash || location.hash === "#/welcome") {
        location.hash = "#/chenshi";
      }
    }
    // ✅ 在这里，等身份恢复完成，再启动路由！
    start();
  } catch(err) {
    alert("数据库初始化失败，存档功能不可用：" + err.message);
    console.error(err);
  }
}
bootDBAndAssets();

