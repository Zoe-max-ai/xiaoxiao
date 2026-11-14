import { on } from "../core/event-bus.js";

let container = null;
let currentType = null;
let rafId = null;
let particles = [];

/**
 * 初始化粒子引擎
 */
export function initParticleEngine() {
  console.log("[particle] 引擎初始化");
  container = document.getElementById("particle-layer");
  if (!container) {
    container = document.createElement("div");
    container.id = "particle-layer";
    container.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 0;
      overflow: hidden;
    `;
    document.body.appendChild(container);
  }

  // 监听主题切换
  on("theme-changed", ({ particle }) => {
    setParticleType(particle);
  });
}

/**
 * 设置粒子类型
 */
export function setParticleType(type) {
  if (currentType === type) return;
  currentType = type;
  clearParticles();

  if (!type || type === "none") return;
  startLoop(type);
}

function clearParticles() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  container.innerHTML = "";
  particles = [];
}

function startLoop(type) {
const config = {
  snow:  { count: 50, size: [3, 7],  speed: [0.3, 1.2], color: "rgba(255, 255, 255, 0.95)", shape: "circle", shadow: "0 0 6px rgba(255,255,255,0.9)" },
  petal: { count: 25, size: [6, 12], speed: [0.4, 1.0], color: "rgba(240, 180, 200, 0.85)", shape: "petal",  shadow: "0 0 4px rgba(240,180,200,0.5)" },
  ash:   { count: 30, size: [2, 4],  speed: [0.2, 0.8], color: "rgba(120, 100, 80, 0.6)",   shape: "circle", shadow: null },
}[type];
  if (!config) return;

  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let i = 0; i < config.count; i++) {
    const p = createParticle(config, w, h);
    particles.push(p);
    container.appendChild(p.el);
  }

  let lastTime = performance.now();

  function animate(time) {
    const dt = Math.min(time - lastTime, 50);
    lastTime = time;

    for (const p of particles) {
      p.y += p.vy * dt * 0.05;
      p.x += Math.sin(time * 0.001 + p.seed) * 0.3;
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;

      // 超出屏幕，重置到顶部
      if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      }
    }

    rafId = requestAnimationFrame(animate);
  }

  rafId = requestAnimationFrame(animate);
}

function createParticle(config, w, h) {
  const el = document.createElement("div");
  const size = rand(config.size[0], config.size[1]);
  const isPetal = config.shape === "petal";

el.style.cssText = `
  position: absolute;
  left: 0; top: 0;
  width: ${size}px;
  height: ${isPetal ? size * 1.5 : size}px;
  background: ${config.color};
  border-radius: ${isPetal ? "60% 10% 60% 10%" : "50%"};
  opacity: ${rand(0.3, 0.7)};
  pointer-events: none;
  will-change: transform;
  ${config.shadow ? `box-shadow: ${config.shadow};` : ""}
`;

  return {
    el,
    x: Math.random() * w,
    y: Math.random() * h,
    vy: rand(config.speed[0], config.speed[1]),
    rot: rand(0, 360),
    seed: Math.random() * 10,
  };
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}