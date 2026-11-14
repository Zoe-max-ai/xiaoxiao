import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { getAIConfig, saveAIConfig } from "../services/ai-service.js";

export async function guichuAiSettingsView() {
  const el = document.createElement("div");
  const config = await getAIConfig();

  el.innerHTML = `
    <div class="form-field">
      <label>API 服务商</label>
      <select id="ai-provider" class="input">
        <option value="deepseek" ${config.provider === "deepseek" ? "selected" : ""}>DeepSeek (默认)</option>
        <option value="openai" ${config.provider === "openai" ? "selected" : ""}>OpenAI</option>
        <option value="custom" ${config.provider === "custom" ? "selected" : ""}>自定义</option>
      </select>
    </div>

    <div class="form-field">
      <label>API Key (必填)</label>
      <input type="password" id="ai-key" class="input" value="${config.apiKey}" placeholder="sk-...">
      <div style="font-size: 11px; color: var(--ink-dim); margin-top: 6px;">
        仅保存在你本地浏览器，不会上传到任何服务器。
      </div>
    </div>

    <div class="form-field">
      <label>API Base URL</label>
      <input type="text" id="ai-base-url" class="input" value="${config.baseUrl}" placeholder="https://api.deepseek.com/v1">
    </div>

    <div class="form-field">
      <label>模型名称</label>
      <input type="text" id="ai-model" class="input" value="${config.model}" placeholder="如：deepseek-chat">
    </div>

    <button class="btn" id="btn-save-ai" style="width: 100%; padding: 14px; letter-spacing: 4px; margin-top: 20px;">
      保 存 设 置
    </button>
  `;

  el.insertBefore(pageHeader("AI 设 置", "#/guichu"), el.firstChild);

  // 服务商切换时，自动填入默认的 URL 和模型
  const providerSelect = el.querySelector("#ai-provider");
  providerSelect.onchange = (e) => {
    const p = e.target.value;
    const baseUrlInput = el.querySelector("#ai-base-url");
    const modelInput = el.querySelector("#ai-model");
    
    if (p === "deepseek") {
      baseUrlInput.value = "https://api.deepseek.com/v1";
      modelInput.value = "deepseek-chat";
    } else if (p === "openai") {
      baseUrlInput.value = "https://api.openai.com/v1";
      modelInput.value = "gpt-4o-mini"; // 便宜且好用
    } else {
      baseUrlInput.value = "";
      modelInput.value = "";
    }
  };

  el.querySelector("#btn-save-ai").onclick = async () => {
    const provider = providerSelect.value;
    const apiKey = el.querySelector("#ai-key").value.trim();
    const baseUrl = el.querySelector("#ai-base-url").value.trim();
    const model = el.querySelector("#ai-model").value.trim();

    if (!apiKey) return showToast("请填写 API Key");
    if (!baseUrl) return showToast("请填写 Base URL");
    if (!model) return showToast("请填写模型名称");

    await saveAIConfig({ provider, apiKey, baseUrl, model });
    showToast("AI 设置已保存");
  };

  return el;
}