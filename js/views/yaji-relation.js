import { showModal, closeModal } from "../ui/modal.js";

export function openRelationPanel(char, relation, levels) {
  const affectionLevel = levels.affectionLevels.find(l =>
    relation.affection >= l.range[0] && relation.affection <= l.range[1]
  );
  const friendshipLevel = levels.friendshipLevels.find(l =>
    relation.friendship >= l.range[0] && relation.friendship <= l.range[1]
  );

  const affectionTrait = levels.affectionTraits[affectionLevel.name] || {};
  const friendshipTrait = levels.friendshipTraits[friendshipLevel.name] || {};

  const modal = showModal(`
    <div class="relation-panel">
      <div class="relation-title">${char.name}</div>
      <div class="relation-sub">与你的关系</div>

      <div class="relation-block">
        <div class="relation-block-title">
          <span>爱慕值</span>
          <span class="relation-level">${affectionLevel.name}</span>
        </div>
        <div class="relation-bar">
          <div class="relation-bar-fill affection" style="width:${relation.affection}%"></div>
        </div>
        <div class="relation-traits">
          <div><span>语气</span>${affectionTrait.tone || ""}</div>
          <div><span>行为</span>${affectionTrait.behavior || ""}</div>
          <div><span>核心</span>${affectionTrait.core || ""}</div>
        </div>
      </div>

      <div class="relation-block">
        <div class="relation-block-title">
          <span>友善值</span>
          <span class="relation-level">${friendshipLevel.name}</span>
        </div>
        <div class="relation-bar">
          <div class="relation-bar-fill friendship" style="width:${relation.friendship}%"></div>
        </div>
        <div class="relation-traits">
          <div><span>语气</span>${friendshipTrait.tone || ""}</div>
          <div><span>行为</span>${friendshipTrait.behavior || ""}</div>
          <div><span>核心</span>${friendshipTrait.core || ""}</div>
        </div>
      </div>

      <button class="btn ghost" id="relation-close" style="width:100%; margin-top:16px;">收 起</button>
    </div>
  `);

  modal.querySelector("#relation-close").onclick = () => closeModal(modal);
}