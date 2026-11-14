import { db } from "../core/db.js";

// 默认的 AI 配置（你可以根据喜好改默认模型）
const DEFAULT_AI_CONFIG = {
  provider: "deepseek", // 默认服务商
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1", // 默认请求地址
  model: "deepseek-chat", // 默认模型
  temperature: 0.8, // 温度，越高越有创造力
};

// 获取用户的 AI 配置
export async function getAIConfig() {
  const record = await db.get("settings", "ai_config");
  return { ...DEFAULT_AI_CONFIG, ...(record?.value || {}) };
}

// 保存用户的 AI 配置
export async function saveAIConfig(config) {
  await db.put("settings", { key: "ai_config", value: config });
}

/**
 * 核心请求函数：向 AI 发送对话并获取回复
 * @param {Array} messages 历史对话列表 [{ role: "user" | "assistant" | "system", content: "..." }]
 * @returns {Promise<string>} AI 的文本回复
 */
export async function requestAI(messages) {
  const config = await getAIConfig();
  if (!config.apiKey) {
    throw new Error("请先在「归处 -> AI 设置」中填入你的 API Key 哦！");
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "请求 AI 失败，请检查 API Key 或网络。");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("AI 请求错误:", error);
    throw error;
  }
}