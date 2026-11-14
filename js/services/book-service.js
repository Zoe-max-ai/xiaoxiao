import { db } from "../core/db.js";
import { uid } from "../core/uid.js";

/* ============================================================
 * 书卷（一级：按角色）
 * ============================================================ */

/**
 * 获取用户的所有书卷（含角色信息）
 */
export async function getAllBooks(ownerId) {
  const all = await db.all("book_books");
  return all
    .filter(b => b.ownerId === ownerId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * 获取某本书（按角色）
 */
export async function getBookByCharacter(ownerId, characterId) {
  const all = await db.all("book_books");
  return all.find(b => b.ownerId === ownerId && b.characterId === characterId);
}

export async function getBook(id) {
  return db.get("book_books", id);
}

/**
 * 创建 / 获取书卷（幂等）
 */
export async function ensureBook(ownerId, characterId, name) {
  let book = await getBookByCharacter(ownerId, characterId);
  if (book) return book;

  const id = uid("book");
  book = {
    id,
    ownerId,
    characterId,
    name: name || "未命名",
    order: Date.now(),
    createdAt: Date.now(),
  };
  await db.put("book_books", book);

  // 默认建 4 个分类
  const defaults = ["主线", "活动", "因缘", "收藏"];
  for (let i = 0; i < defaults.length; i++) {
    await createCategory(id, defaults[i], i === 3);   // 「收藏」特殊
  }

  return book;
}

/* ============================================================
 * 分类（二级）
 * ============================================================ */

export async function getCategoriesByBook(bookId) {
  const all = await db.all("book_categories");
  return all
    .filter(c => c.bookId === bookId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function createCategory(bookId, name, isDefault = false) {
  const id = uid("cat");
  const cat = {
    id,
    bookId,
    name,
    isDefault,
    isFavorite: name === "收藏",   // 收藏分类特殊标记
    order: Date.now(),
    createdAt: Date.now(),
  };
  await db.put("book_categories", cat);
  return cat;
}

export async function updateCategory(id, patch) {
  const cat = await db.get("book_categories", id);
  if (!cat) return null;
  const updated = { ...cat, ...patch };
  await db.put("book_categories", updated);
  return updated;
}

export async function deleteCategory(id) {
  const cat = await db.get("book_categories", id);
  if (!cat) return false;
  if (cat.isDefault) return false;   // 默认分类不能删

  // 删掉分类下所有剧情
  const chapters = await db.all("book_chapters");
  for (const c of chapters) {
    if (c.categoryId === id) await db.del("book_chapters", c.id);
  }

  await db.del("book_categories", id);
  return true;
}

/* ============================================================
 * 剧情（三级）
 * ============================================================ */

export async function getChaptersByCategory(categoryId) {
  const all = await db.all("book_chapters");
  return all
    .filter(c => c.categoryId === categoryId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getChapter(id) {
  return db.get("book_chapters", id);
}

export async function createChapter(categoryId, data) {
  const id = uid("chp");
  const content = (data.content || "").trim();
  const chapter = {
    id,
    categoryId,
    title: (data.title || "").trim() || "未命名",
    content,
    wordCount: countWords(content),
    order: Date.now(),
    createdAt: Date.now(),
  };
  await db.put("book_chapters", chapter);
  return chapter;
}

export async function updateChapter(id, patch) {
  const ch = await db.get("book_chapters", id);
  if (!ch) return null;
  const updated = { ...ch, ...patch };
  if (patch.content !== undefined) {
    updated.wordCount = countWords(patch.content);
  }
  await db.put("book_chapters", updated);
  return updated;
}

export async function deleteChapter(id) {
  await db.del("book_chapters", id);
}

/* ============================================================
 * 收藏
 * ============================================================ */

export async function toggleFavoriteChapter(chapterId) {
  const ch = await db.get("book_chapters", chapterId);
  if (!ch) return null;
  ch.isFavorite = !ch.isFavorite;
  await db.put("book_chapters", ch);
  return ch;
}

export async function getFavoriteChapters(ownerId) {
  // 找该用户的所有书卷 → 所有分类 → 收藏的剧情
  const books = await getAllBooks(ownerId);
  const bookIds = new Set(books.map(b => b.id));
  const cats = await db.all("book_categories");
  const catIds = new Set(cats.filter(c => bookIds.has(c.bookId)).map(c => c.id));
  const chapters = await db.all("book_chapters");
  return chapters
    .filter(c => catIds.has(c.categoryId) && c.isFavorite)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* ============================================================
 * 阅读设置（全局）
 * ============================================================ */

export const DEFAULT_READER_SETTINGS = {
  bgColor: "#faf6ee",
  bgImageId: null,
  textColor: "#2b2b2b",
  fontSize: 16,
  fontFamily: "songti",
};

export async function getReaderSettings() {
  const rec = await db.get("settings", "reader_settings");
  return { ...DEFAULT_READER_SETTINGS, ...(rec?.value || {}) };
}

export async function saveReaderSettings(value) {
  await db.put("settings", { key: "reader_settings", value });
}

/* ============================================================
 * 导出 / 导入（按书卷）
 * ============================================================ */

export async function exportBook(bookId) {
  const book = await db.get("book_books", bookId);
  if (!book) return null;

  const categories = await getCategoriesByBook(bookId);
  const chaptersByCat = {};
  for (const cat of categories) {
    chaptersByCat[cat.id] = await getChaptersByCategory(cat.id);
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    book,
    categories,
    chaptersByCat,
  };
}

export async function importBook(ownerId, data) {
  if (!data?.book) return null;

  // 用新 id（防冲突）
  const newBookId = uid("book");
  const newBook = {
    ...data.book,
    id: newBookId,
    ownerId,
    createdAt: Date.now(),
  };
  await db.put("book_books", newBook);

  const catIdMap = {};
  for (const cat of (data.categories || [])) {
    const newCatId = uid("cat");
    catIdMap[cat.id] = newCatId;
    await db.put("book_categories", {
      ...cat,
      id: newCatId,
      bookId: newBookId,
      createdAt: Date.now(),
    });
  }

  for (const [oldCatId, chapters] of Object.entries(data.chaptersByCat || {})) {
    const newCatId = catIdMap[oldCatId];
    if (!newCatId) continue;
    for (const ch of chapters) {
      await db.put("book_chapters", {
        ...ch,
        id: uid("chp"),
        categoryId: newCatId,
        createdAt: Date.now(),
      });
    }
  }

  return newBook;
}

/* ============================================================
 * 工具
 * ============================================================ */

function countWords(text) {
  if (!text) return 0;
  // 中文字 + 英文单词，粗略
  const cleaned = text.replace(/\s/g, "");
  return cleaned.length;
}