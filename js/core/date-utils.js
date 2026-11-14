/* ============================================================
 * 古言时间格式化 & 农历计算（终极完美版）
 * ============================================================ */

// 动态加载精确的农历库（无需 npm）
if (!window.Solar) {
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/lunar-javascript@1.6.12/lunar.js";
  document.head.appendChild(script);
}

const SHICHEN = [
  { start: 23, end: 1,  name: "子时" },
  { start: 1,  end: 3,  name: "丑时" },
  { start: 3,  end: 5,  name: "寅时" },
  { start: 5,  end: 7,  name: "卯时" },
  { start: 7,  end: 9,  name: "辰时" },
  { start: 9,  end: 11, name: "巳时" },
  { start: 11, end: 13, name: "午时" },
  { start: 13, end: 15, name: "未时" },
  { start: 15, end: 17, name: "申时" },
  { start: 17, end: 19, name: "酉时" },
  { start: 19, end: 21, name: "戌时" },
  { start: 21, end: 23, name: "亥时" },
];

const CN_NUM = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function toCnDay(n) {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return "十" + CN_NUM[n - 10];
  if (n === 20) return "二十";
  if (n < 30) return "二十" + CN_NUM[n - 20];
  if (n === 30) return "三十";
  return "三十" + CN_NUM[n - 30];
}

function getShichen(hour) {
  for (const s of SHICHEN) {
    if (s.start < s.end) {
      if (hour >= s.start && hour < s.end) return s.name;
    } else {
      if (hour >= s.start || hour < s.end) return s.name;
    }
  }
  return "";
}

export function formatAncient(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hh = d.getHours();

  const sameDay = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const beforeYesterday = new Date(now);
  beforeYesterday.setDate(now.getDate() - 2);
  const isBeforeYesterday = d.toDateString() === beforeYesterday.toDateString();

  if (sameDay) return `今日 ${getShichen(hh)}`;
  if (isYesterday) return `昨日 ${getShichen(hh)}`;
  if (isBeforeYesterday) return `前日 ${getShichen(hh)}`;

  const dayDiff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(d.getFullYear(), d.getMonth(), d.getDate())) /
      (24 * 60 * 60 * 1000)
  );
  if (dayDiff < 7) {
    return `${toCnDay(dayDiff)}日之前`;
  }

  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${toCnDay(month)}月${toCnDay(day)}日`;
}

/**
 * 获取农历日期（调用权威库，保证 100% 准确）
 */
export function getLunarDate(date) {
  // 如果库还没加载完，给个兜底提示（刷新一下就会好）
  if (!window.Solar) {
    return "农历加载中";
  }

  // 使用权威库计算
  const lunar = window.Solar.fromDate(date).getLunar();
  
  // 获取月份和日期
  const m = lunar.getMonth(); // 负数表示闰月
  const isLeap = m < 0;
  const monthStr = (isLeap ? "闰" : "") + lunar.getMonthInChinese() + "月";
  const dayStr = lunar.getDayInChinese();

  return monthStr + dayStr;
}

/**
 * 获取角色的实时状态
 * @param {Object} character 角色对象
 * @returns {Object} { status: "状态描述", mood: "心情", isSleeping: 是否在睡觉 }
 */
export function getCharacterStatus(character) {
  // 准备一个神秘状态池
  const secretStatuses = [
    "不知在忙些什么",
    "似在闭目养神",
    "行踪成谜",
    "且待片刻",
    "不知去向"
  ];

  // 如果传进来的是空值，随机抽一个神秘状态
  if (!character) {
    return { status: secretStatuses[Math.floor(Math.random() * secretStatuses.length)], mood: "神秘", isSleeping: false };
  }

  const nowHour = new Date().getHours();
  
  // 如果没有作息表，也随机抽一个
  if (!character.schedule || !Array.isArray(character.schedule)) {
    return { status: secretStatuses[Math.floor(Math.random() * secretStatuses.length)], mood: "神秘", isSleeping: false };
  }
  



  for (const item of character.schedule) {
    // 处理跨夜的情况（比如 23 点到次日 5 点）
    if (item.start > item.end) {
      if (nowHour >= item.start || nowHour < item.end) {
        return { status: item.status, mood: item.mood, isSleeping: item.mood === "勿扰" };
      }
    } else {
      if (nowHour >= item.start && nowHour < item.end) {
        return { status: item.status, mood: item.mood, isSleeping: item.mood === "勿扰" };
      }
    }
  }
  return { status: "不知在忙些什么", mood: "正常", isSleeping: false };
}