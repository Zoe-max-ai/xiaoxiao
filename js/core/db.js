const DB_NAME = "xunfengdu_db";
const DB_VERSION = 12;

export const STORES = {
  users:                { keyPath: "id" },
  profiles:             { keyPath: "id", indexes: ["type"] },
  characters:           { keyPath: "id", indexes: ["ownerId", "profileId"] },

  relation_states:      { keyPath: "id", indexes: ["ownerId", "characterId"] },
  relation_levels:      { keyPath: "id", indexes: ["characterId"] },

  // 主角之间的关系
  character_relations:  { keyPath: "id", indexes: ["ownerId", "fromId", "toId"] },
  // NPC（关系网人物）
  npc_relations:        { keyPath: "id", indexes: ["ownerId", "linkedCharacterId"] },

  chats:                { keyPath: "id", indexes: ["ownerId", "lastMessageAt"] },
  messages:             { keyPath: "id", indexes: ["chatId", "createdAt"] },

  cards:                { keyPath: "id", indexes: ["ownerId", "characterId", "groupId", "enabled"] },
  cardGroups:           { keyPath: "id", indexes: ["ownerId", "parentId"] },

  stories:              { keyPath: "id", indexes: ["ownerId", "characterId"] },
  story_nodes:          { keyPath: "id", indexes: ["storyId"] },
  story_progress:       { keyPath: "id", indexes: ["ownerId", "storyId"] },

  letters:              { keyPath: "id", indexes: ["ownerId", "isRead", "createdAt"] },
  posts:                { keyPath: "id", indexes: ["ownerId", "createdAt"] },
  post_comments:        { keyPath: "id", indexes: ["postId"] },

  audios:               { keyPath: "id", indexes: ["ownerId", "collectedBy"] },
  audio_files:          { keyPath: "id" },

  images:               { keyPath: "id", indexes: ["ownerId", "category", "theme"] },

  theme_configs:        { keyPath: "id" },
  theme_overrides:      { keyPath: "id", indexes: ["themeId"] },

  world_book:           { keyPath: "id", indexes: ["ownerId", "category"] },
  flags:                { keyPath: "id", indexes: ["ownerId", "characterId"] },
  divinations:          { keyPath: "id", indexes: ["ownerId", "type"] },

  settings:             { keyPath: "key" },
  fonts:                { keyPath: "id" },
  actions:              { keyPath: "id", indexes: ["ownerId"] },

  book_books:           { keyPath: "id", indexes: ["ownerId", "characterId"] },
  book_categories:      { keyPath: "id", indexes: ["bookId"] },
  book_chapters:        { keyPath: "id", indexes: ["categoryId"] },

  games:                { keyPath: "id", indexes: ["ownerId", "updatedAt"] },
  game_chapters:        { keyPath: "id", indexes: ["gameId", "order"] },
  game_nodes:           { keyPath: "id", indexes: ["gameId", "chapterId", "order"] },
  game_saves:           { keyPath: "id", indexes: ["ownerId", "gameId"] },
  game_favorites:       { keyPath: "id", indexes: ["ownerId", "gameId"] },
  inventory: { keyPath: "id", indexes: ["ownerId", "giftId"] },
};

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        let store;
        if (!db.objectStoreNames.contains(name)) {
          store = db.createObjectStore(name, { keyPath: cfg.keyPath });
        } else {
          store = e.target.transaction.objectStore(name);
        }
        (cfg.indexes || []).forEach(idx => {
          if (!store.indexNames.contains(idx)) {
            store.createIndex(idx, idx, { unique: false });
          }
        });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);

    let request;
    try {
      request = fn(s);
    } catch (err) {
      reject(err);
      return;
    }

    t.oncomplete = () => {
      if (request && typeof request === "object" && "result" in request) {
        resolve(request.result);
      } else {
        resolve(request);
      }
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  put:     (store, val) => tx(store, "readwrite", s => s.put(val)),
  get:     (store, key) => tx(store, "readonly",  s => s.get(key)),
  del:     (store, key) => tx(store, "readwrite", s => s.delete(key)),
  all:     (store)      => tx(store, "readonly",  s => s.getAll()),
  clear:   (store)      => tx(store, "readwrite", s => s.clear()),
  byIndex: (store, idx, val) => tx(store, "readonly", s => s.index(idx).getAll(val)),
};