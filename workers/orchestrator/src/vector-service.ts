// ============================================
// 向量服务 — Vectorize + Workers AI Embedding
// ============================================
// 用途:
//   1. 存储角色/世界观/情节的向量表示
//   2. 生成章节时检索相关内容，确保一致性
//   3. 追踪伏笔/物品，避免遗忘
// ============================================

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    book_id: string;
    type: 'character' | 'world_rule' | 'plot_event' | 'hook' | 'item';
    name: string;
    content: string;
    chapter_number?: number;
  };
}

/**
 * 生成文本的 embedding 向量
 */
export async function generateEmbedding(
  text: string,
  ai: Ai
): Promise<number[]> {
  console.log(`[VECTOR] Generating embedding for text: ${text.slice(0, 50)}...`);
  const result = await ai.run(EMBEDDING_MODEL as any, {
    text: [text],
  }) as any;

  console.log(`[VECTOR] Embedding result type: ${typeof result}, keys: ${Object.keys(result || {}).join(',')}`);
  if (result?.data?.[0]) {
    console.log(`[VECTOR] Embedding dimension: ${result.data[0].length}`);
  }

  // Workers AI 返回 { data: [[...floats...]] }
  return result.data[0];
}

/**
 * 批量生成 embeddings
 */
export async function generateEmbeddings(
  texts: string[],
  ai: Ai
): Promise<number[][]> {
  const result = await ai.run(EMBEDDING_MODEL as any, {
    text: texts,
  }) as any;

  return result.data;
}

/**
 * 存储向量到 Vectorize
 */
export async function upsertVectors(
  vectors: VectorRecord[],
  index: VectorizeIndex
): Promise<void> {
  if (vectors.length === 0) return;

  const records = vectors.map(v => ({
    id: v.id,
    values: v.values,
    metadata: v.metadata,
  }));

  // Vectorize 批量插入上限 1000
  for (let i = 0; i < records.length; i += 200) {
    const batch = records.slice(i, i + 200);
    await index.upsert(batch);
  }
}

/**
 * 语义搜索 — 找到与查询最相关的内容
 */
export async function searchVectors(
  query: string,
  bookId: string,
  ai: Ai,
  index: VectorizeIndex,
  options?: {
    type?: string;
    topK?: number;
  }
): Promise<VectorRecord[]> {
  const embedding = await generateEmbedding(query, ai);
  const topK = options?.topK || 5;

  const filter: any = { book_id: bookId };
  if (options?.type) filter.type = options.type;

  const results = await index.query(embedding, {
    topK,
    filter,
    returnMetadata: true,
  });

  return results.matches.map(m => ({
    id: m.id,
    values: [],
    metadata: m.metadata as any,
  }));
}

/**
 * 索引角色信息
 */
export async function indexCharacter(
  bookId: string,
  characterName: string,
  characterInfo: string,
  chapterNumber: number,
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  const label = language === 'en' ? 'Character' : '角色';
  const embedding = await generateEmbedding(
    `${label}: ${characterName}\n${characterInfo}`,
    ai
  );

  await upsertVectors([{
    id: `${bookId}:character:${characterName}`,
    values: embedding,
    metadata: {
      book_id: bookId,
      type: 'character',
      name: characterName,
      content: characterInfo,
      chapter_number: chapterNumber,
    },
  }], index);
}

/**
 * 索引世界观规则
 */
export async function indexWorldRule(
  bookId: string,
  ruleName: string,
  ruleContent: string,
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  const label = language === 'en' ? 'World Rule' : '世界规则';
  const embedding = await generateEmbedding(
    `${label}: ${ruleName}\n${ruleContent}`,
    ai
  );

  await upsertVectors([{
    id: `${bookId}:world_rule:${ruleName}`,
    values: embedding,
    metadata: {
      book_id: bookId,
      type: 'world_rule',
      name: ruleName,
      content: ruleContent,
    },
  }], index);
}

/**
 * 索引伏笔/钩子
 */
export async function indexHook(
  bookId: string,
  hookId: string,
  hookDescription: string,
  chapterNumber: number,
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  const label = language === 'en' ? 'Foreshadowing' : '伏笔';
  const embedding = await generateEmbedding(
    `${label}: ${hookDescription}`,
    ai
  );

  await upsertVectors([{
    id: `${bookId}:hook:${hookId}`,
    values: embedding,
    metadata: {
      book_id: bookId,
      type: 'hook',
      name: hookId,
      content: hookDescription,
      chapter_number: chapterNumber,
    },
  }], index);
}

/**
 * 索引物品
 */
export async function indexItem(
  bookId: string,
  itemName: string,
  itemDescription: string,
  chapterNumber: number,
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  const label = language === 'en' ? 'Item' : '物品';
  const embedding = await generateEmbedding(
    `${label}: ${itemName}\n${itemDescription}`,
    ai
  );

  await upsertVectors([{
    id: `${bookId}:item:${itemName}`,
    values: embedding,
    metadata: {
      book_id: bookId,
      type: 'item',
      name: itemName,
      content: itemDescription,
      chapter_number: chapterNumber,
    },
  }], index);
}

/**
 * 索引情节事件
 */
export async function indexPlotEvent(
  bookId: string,
  eventId: string,
  eventDescription: string,
  chapterNumber: number,
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  const label = language === 'en' ? 'Plot' : '情节';
  const embedding = await generateEmbedding(
    `${label}: ${eventDescription}`,
    ai
  );

  await upsertVectors([{
    id: `${bookId}:plot:${eventId}`,
    values: embedding,
    metadata: {
      book_id: bookId,
      type: 'plot_event',
      name: eventId,
      content: eventDescription,
      chapter_number: chapterNumber,
    },
  }], index);
}

/**
 * 生成章节时获取一致性上下文
 */
export async function getConsistencyContext(
  bookId: string,
  chapterOutline: string,
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<string> {
  const contexts: string[] = [];

  // Labels based on language
  const L = language === 'en' ? {
    characters: '=== Related Characters (ensure personality/behavior consistency) ===',
    rules: '=== Related World Rules (must not be violated) ===',
    hooks: '=== Active Foreshadowing (needs handling or continuation) ===',
    items: '=== Related Items (maintain position/state consistency) ===',
  } : {
    characters: '=== 相关角色 (确保性格/行为一致) ===',
    rules: '=== 相关世界观规则 (不可违反) ===',
    hooks: '=== 活跃伏笔 (需要处理或延续) ===',
    items: '=== 相关物品 (保持位置/状态一致) ===',
  };

  // 1. 检索相关角色信息
  const characters = await searchVectors(chapterOutline, bookId, ai, index, {
    type: 'character',
    topK: 3,
  });
  if (characters.length > 0) {
    contexts.push(L.characters);
    characters.forEach(c => {
      contexts.push(`${c.metadata.name}: ${c.metadata.content.slice(0, 200)}`);
    });
  }

  // 2. 检索相关世界观规则
  const rules = await searchVectors(chapterOutline, bookId, ai, index, {
    type: 'world_rule',
    topK: 3,
  });
  if (rules.length > 0) {
    contexts.push('\n' + L.rules);
    rules.forEach(r => {
      contexts.push(`${r.metadata.name}: ${r.metadata.content.slice(0, 200)}`);
    });
  }

  // 3. 检索活跃伏笔
  const hooks = await searchVectors(chapterOutline, bookId, ai, index, {
    type: 'hook',
    topK: 3,
  });
  if (hooks.length > 0) {
    contexts.push('\n' + L.hooks);
    hooks.forEach(h => {
      contexts.push(`- ${h.metadata.content.slice(0, 150)}`);
    });
  }

  // 4. 检索相关物品
  const items = await searchVectors(chapterOutline, bookId, ai, index, {
    type: 'item',
    topK: 3,
  });
  if (items.length > 0) {
    contexts.push('\n' + L.items);
    items.forEach(i => {
      contexts.push(`${i.metadata.name}: ${i.metadata.content.slice(0, 150)}`);
    });
  }

  return contexts.join('\n');
}

/**
 * 索引章节内容 (批量便捷函数)
 * 索引角色、世界规则、伏笔、物品、情节事件
 */
export async function indexChapterContent(
  bookId: string,
  chapterNumber: number,
  data: {
    characters?: { name: string; info: string }[];
    worldRules?: { name: string; content: string }[];
    hooks?: { id: string; description: string }[];
    items?: { name: string; description: string }[];
    plotEvents?: { id: string; description: string }[];
  },
  ai: Ai,
  index: VectorizeIndex,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  if (data.characters) {
    for (const c of data.characters) {
      await indexCharacter(bookId, c.name, c.info, chapterNumber, ai, index, language);
    }
  }
  if (data.worldRules) {
    for (const r of data.worldRules) {
      await indexWorldRule(bookId, r.name, r.content, ai, index, language);
    }
  }
  if (data.hooks) {
    for (const h of data.hooks) {
      await indexHook(bookId, h.id, h.description, chapterNumber, ai, index, language);
    }
  }
  if (data.items) {
    for (const item of data.items) {
      await indexItem(bookId, item.name, item.description, chapterNumber, ai, index, language);
    }
  }
  if (data.plotEvents) {
    for (const p of data.plotEvents) {
      await indexPlotEvent(bookId, p.id, p.description, chapterNumber, ai, index, language);
    }
  }
}

/**
 * 查询一致性上下文 (getConsistencyContext 的别名，便于语义理解)
 */
export const queryConsistency = getConsistencyContext;
