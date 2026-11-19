/**
 * 主题注册表
 * 两套主题：青墨云山 / 宋雅素笺
 */

export const THEMES = {
  qinglv: {
    id: "qinglv",
    name: "青墨云山",
    subtitle: "青绿山水 · 落雪 · 清冷",
    particle: "snow",
    colors: {
      bg: "#f4efe6",
      bgSoft: "#ece6d8",
      paper: "#faf6ee",
      paperSoft: "#f0e9d8",
      ink: "#2b2b2b",
      inkSoft: "#4a453d",
      inkDim: "#8a8378",
      cinnabar: "#4a6b5a",
      cinnabarLight: "#6b8a7a",
      gold: "#b8922e",
      green: "#4a6b5a",
    },
    background: {
      chenshi: "bg/bg-chenshi-qinglv.jpg",
      chat: "bg/bg-chat-qinglv.jpg",
      letter: "bg/bg-letter-qinglv.jpg",
    },
    deco: {
      boat: "assets/seed/deco/deco-boat-01.png",
      avatarFrame: "assets/seed/frame/frame-qinglv.png",
      bubbleSticker: "assets/seed/deco/deco-bamboo-02.png",
      seal: "assets/seed/seal/seal-du.png"
    },
  },

  songya: {
    id: "songya",
    name: "宋雅素笺",
    subtitle: "羊皮纸 · 落花 · 温润",
    particle: "petal",
    colors: {
      bg: "#f5f1e8",
      bgSoft: "#ece6d8",
      paper: "#ffffff",
      paperSoft: "#faf6ee",
      ink: "#2a2620",
      inkSoft: "#4a453d",
      inkDim: "#8a8275",
      cinnabar: "#8a2b2b",
      cinnabarLight: "#b04a3c",
      gold: "#a8845a",
      green: "#6b7a5a",
    },
    background: {
      chenshi: "bg/bg-chenshi-songya.jpg",
      chat: "bg/bg-chat-songya.jpg",
      letter: "bg/bg-letter-songya.jpg",
    },
    deco: {  /* 👈 这里补上了漏掉的 deco: { */
      boat: "assets/seed/deco/deco-boat-02.png",
      avatarFrame: "assets/seed/frame/frame-songya.png",
      bubbleSticker: "assets/seed/deco/deco-plum-01.png",
      seal: "assets/seed/seal/seal-ji.png"
    },
  },
};

export function getTheme(id) {
  return THEMES[id] || THEMES.qinglv;
}

export function getAllThemes() {
  return Object.values(THEMES);
}