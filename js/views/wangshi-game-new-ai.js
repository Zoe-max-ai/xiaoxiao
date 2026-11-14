import { pageHeader } from "../ui/page-header.js";
import { showToast } from "../ui/toast.js";
import { state } from "../core/state.js";
import { db } from "../core/db.js";
import { requestAI } from "../services/ai-service.js";
import { createGame, createChapter, createNode, updateGame } from "../services/game-service.js";
import { openImagePicker } from "../ui/image-picker.js";

export async function wangshiGameNewAiView() {
  const el = document.createElement("div");
  const ownerId = state.currentUserId;
  if (!ownerId) {
    el.innerHTML = `<div class="empty-state">请先创建身份。</div>`;
    return el;
  }

  let coverImageId = null;

  el.innerHTML = `
    <div class="game-new-page">
      <div class="form-field">
        <label>标题（必填）</label>
        <input type="text" id="g-title" class="input" placeholder="给你的故事起个名字" maxlength="30">
      </div>

      <div class="form-field">
        <label>封面（可选）</label>
        <div style="display:flex;gap:12px;align-items:center;">
          <div id="cover-preview" style="
            width:80px;height:100px;
            border:1px dashed var(--line-light);border-radius:6px;
            background:var(--paper-soft);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;color:var(--ink-dim);cursor:pointer;overflow:hidden;
          ">选择</div>
          <div style="font-size:12px;color:var(--ink-dim);">点击从绘卷选图</div>
        </div>
      </div>

      <div class="form-field">
        <label>简介</label>
        <textarea id="g-desc" class="input" style="min-height:60px;resize:vertical;" placeholder="一句话介绍这个故事" maxlength="200"></textarea>
      </div>

      <div class="form-field">
        <label>指令（告诉 AI 你想要什么故事）</label>
        <textarea id="g-prompt" class="input" style="min-height:120px;resize:vertical;" placeholder="如：一个关于少年踏入江湖的故事，主角在某天遇到一位神秘剑客…" maxlength="1000"></textarea>
      </div>

      <div class="game-new-actions">
        <button class="btn ghost" id="btn-cancel">取 消</button>
        <button class="btn" id="btn-generate">生 成</button>
      </div>


    </div>
  `;

  el.insertBefore(pageHeader("AI 生 成", "#/wangshi"), el.firstChild);

  el.querySelector("#cover-preview").onclick = async () => {
    openImagePicker("game_cover", async (imgId) => {
      coverImageId = imgId;
      const img = await db.get("images", imgId);
      if (img?.thumb?.data) {
        const url = URL.createObjectURL(img.thumb.data);
        el.querySelector("#cover-preview").innerHTML =
          `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    });
  };

  el.querySelector("#btn-cancel").onclick = () => {
    location.hash = "#/wangshi";
  };

  el.querySelector("#btn-generate").onclick = async () => {
    const title = el.querySelector("#g-title").value.trim();
    const desc = el.querySelector("#g-desc").value.trim();
    const promptText = el.querySelector("#g-prompt").value.trim();

    if (!title) return showToast("请先起个标题");
    if (!promptText) return showToast("请告诉 AI 你想写个什么故事");

    const btn = el.querySelector("#btn-generate");
    btn.disabled = true;
    btn.textContent = "AI 正在奋笔疾书…";

    try {
      // 1. 把你建的世界书也带上，让 AI 知道大背景
      const allWorldBooks = await db.all("world_book");
      const myWorldBooks = allWorldBooks.filter(w => w.ownerId === ownerId && w.enabled);
      let worldContext = "";
      if (myWorldBooks.length > 0) {
        worldContext = "【世界观背景】：\n" + myWorldBooks.map(wb => `[${wb.title}] ${wb.content}`).join("\n");
      }

      // 2. 组装给 AI 的指令，要求它严格按照 JSON 格式输出
      const sysPrompt = `你是一个古风互动文字游戏的编剧。请根据用户的要求，写一段短小精悍的互动剧本。
${worldContext}

【输出要求】
请严格输出 JSON 格式，不要包含任何 Markdown 标记（如 \`\`\`json ），不要有任何废话。
JSON 结构如下：
{
  "chapterTitle": "第一章 章节名",
  "startNode": {
    "title": "节点小标题",
    "content": "这里的剧情正文，大约 100-200 字。",
    "choices": [
      { "text": "选项A的文字", "affection": 5, "friendship": 0 },
      { "text": "选项B的文字", "affection": 0, "friendship": 5 }
    ]
  },
  "endNode": {
    "title": "结局小标题",
    "content": "无论选哪个选项，目前都先导向这个结局。",
    "endingText": "游戏通关的彩蛋文字。"
  }
}`;

      const messages = [
        { role: "system", content: sysPrompt },
        { role: "user", content: `故事标题：${title}\n故事简介：${desc}\n用户要求：${promptText}` }
      ];

      // 3. 请求 AI
      let aiText = await requestAI(messages);
      
      // 4. 清理可能包含的 Markdown 标记并解析
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
      const scriptData = JSON.parse(aiText);

      // 5. 把数据写入数据库
      showToast("剧本生成成功，正在排版…");

      // 创建游戏本体
      const game = await createGame(ownerId, {
        title,
        description: desc,
        coverImageId,
        source: "ai",
      });

      // 创建第一章
      const chapter = await createChapter(game.id, scriptData.chapterTitle || "第一章");

      // 创建开始节点
      const startNode = await createNode(game.id, chapter.id, {
        title: scriptData.startNode.title,
        content: scriptData.startNode.content,
        choices: [], // 先留空，等结局建好后再填
      });

      // 创建结局节点
      const endNode = await createNode(game.id, chapter.id, {
        title: scriptData.endNode.title,
        content: scriptData.endNode.content,
        choices: [],
        endingText: scriptData.endNode.endingText || "",
      });

      // 把选项补全，并指向结局节点
      const finalChoices = (scriptData.startNode.choices || []).map(c => ({
        text: c.text,
        nextNodeId: endNode.id,
        targetCharacterId: null, // AI 暂时不加角色数值，你可以去编辑器里手动加
        affection: c.affection || 0,
        friendship: c.friendship || 0,
      }));

      // 更新开始节点
      // 注意：如果你的 game-service 没有 updateNode 导出，请用 db.put("game_nodes", ...) 手动更新
      const { updateNode } = await import("../services/game-service.js");
      await updateNode(startNode.id, { choices: finalChoices });

      // 6. 更新游戏的起始节点和统计数据
      await updateGame(game.id, {
        startNodeId: startNode.id,
        chapterCount: 1,
        nodeCount: 2,
      });

      showToast("生成完毕！");
      // 直接跳转到编辑器，让用户自己微调
      location.hash = `#/wangshi/game/edit/${game.id}`;

    } catch (err) {
      console.error(err);
      showToast("AI 生成失败，可能是格式没对上，再试一次吧");
      btn.disabled = false;
      btn.textContent = "生 成";
    }
  };



  return el;
}

