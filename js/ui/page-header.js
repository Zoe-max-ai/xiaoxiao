/**
 * 页面顶部栏
 * @param {string} title - 页面标题
 * @param {string} backTo - 返回的 hash（可选，不传用 history.back）
 */
export function pageHeader(title, backTo = null) {
  const div = document.createElement("div");
  div.className = "page-header";
  div.innerHTML = `
    <button class="page-header-back" type="button">←</button>
    <div class="page-header-title">${title}</div>
  `;
  div.querySelector(".page-header-back").onclick = () => {
    if (backTo) {
      location.hash = backTo;
    } else {
      history.back();
    }
  };
  return div;
}