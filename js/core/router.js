const routes = {};

export function register(path, view, options = {}) {
  routes[path] = { view, options };
}

export function start() {
  window.addEventListener("hashchange", render);
  render();
}

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, "") || "";

  // 从长到短匹配路由
  const paths = Object.keys(routes).sort((a, b) => b.length - a.length);
  for (const routePath of paths) {
    if (hash === routePath) {
      return { path: routePath, params: [] };
    }
    if (hash.startsWith(routePath + "/")) {
      const rest = hash.slice(routePath.length + 1);
      return { path: routePath, params: rest.split("/") };
    }
  }

  // 默认取第一段
  const [path, ...params] = hash.split("/");
  return { path, params };
}

export async function render() {
  const { path, params } = parseHash();
  const container = document.getElementById("view");
  const route = routes[path];

  // 重置 body class
  document.body.className = "";

  container.innerHTML = "";

  if (!route) {
    container.innerHTML = `<div class="empty-state">此处无路，请回尘世。</div>`;
    applyChrome(true, true);
    return;
  }

  // 路由选项
  let showTopbar = route.options?.topbar !== false;
  let showTabbar = route.options?.tabbar !== false;

  // 应用 body class
  if (route.options?.bodyClass) {
    document.body.classList.add(route.options.bodyClass);
  }

  // 👈 核心补丁：给页面渲染穿上防弹衣
  try {
    const el = await route.view({ params });
    if (el) {
      container.appendChild(el);
    }
  } catch (err) {
    console.error(`🚨 页面 [${path}] 渲染严重崩溃:`, err);
    // 即使崩溃了，也只在页面中间显示错误，绝对不把玩家踢回登录页！
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px; text-align: center;">
        <div style="color: var(--cinnabar); font-size: 16px; margin-bottom: 12px; font-family: var(--font-title);">页面加载遇到了一点阻碍</div>
        <div style="font-size: 12px; color: var(--ink-dim); margin-bottom: 20px;">可能是某条旧数据格式不兼容导致。</div>
        <button class="btn ghost" onclick="location.reload()">重新加载</button>
        <button class="btn ghost" onclick="location.hash='#/welcome'" style="margin-top:8px; color:var(--cinnabar);">回到登录页</button>
      </div>
    `;
  }

  applyChrome(showTopbar, showTabbar);

  // 高亮底部导航
  document.querySelectorAll("#tabbar a").forEach(a => {
    a.classList.toggle("active", a.dataset.tab === path);
  });

  // 根据路由切换背景
  try {
    const { setBackgroundUsage } = await import("../theme/theme-runtime.js");
    if (path === "chat") {
      await setBackgroundUsage("chat");
    } else {
      await setBackgroundUsage("chenshi");
    }
  } catch (e) {
    console.warn("背景切换失败", e);
  }
}

function applyChrome(showTopbar, showTabbar) {
  const topbar = document.getElementById("topbar");
  const tabbar = document.getElementById("tabbar");

  if (showTopbar) {
    topbar.classList.remove("hidden");
  } else {
    topbar.classList.add("hidden");
  }

  if (showTabbar) {
    tabbar.classList.remove("hidden");
  } else {
    tabbar.classList.add("hidden");
  }
}