// ============================================
// AI 模型调用器 — 支持任意 OpenAI-compatible API
// ============================================
// 安全模型:
//   AI_API_KEY  → Wrangler Secret (加密，不可读)
//   AI_BASE_URL → wrangler.toml [vars] (可自定义端点)
//   AI_MODEL    → wrangler.toml [vars] (可自定义模型)
// ============================================

export interface AIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICallOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /** 额外的自定义上下文，拼接到 system prompt 末尾 */
  extraContext?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 从 Worker Env 安全读取 AI 配置
 * AI_API_KEY 来自 Wrangler Secret，绝不会出现在代码或配置中
 */
export function getAIConfig(env: {
  AI_API_KEY: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
}): AIConfig {
  return {
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL || 'anthropic/claude-sonnet-4-20250514',
    baseUrl: env.AI_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions',
  };
}

/**
 * 通用 AI 调用 (OpenAI-compatible API)
 */
export async function callAI(
  messages: AIMessage[],
  config: AIConfig,
  options?: AICallOptions
): Promise<AIResponse> {
  const { apiKey, model, baseUrl } = config;
  const temperature = options?.temperature ?? 0.8;
  const maxTokens = options?.maxTokens ?? 8192;

  // 构建消息列表
  const finalMessages: AIMessage[] = [];

  // System prompt (如果有)
  if (options?.systemPrompt) {
    let systemContent = options.systemPrompt;

    // 追加自定义上下文
    if (options.extraContext) {
      systemContent += '\n\n' + options.extraContext;
    }

    finalMessages.push({ role: 'system', content: systemContent });
  }

  finalMessages.push(...messages);

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ainovel.com',
      'X-Title': 'AI Novel Platform',
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  if (!data.choices || data.choices.length === 0) {
    throw new Error('AI API returned no choices');
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}

// ============================================
// 场景化调用函数
// ============================================

/** 生成章节正文 */
export async function generateChapter(
  prompt: string,
  config: AIConfig,
  context?: string,
  language: 'zh' | 'en' = 'zh'
): Promise<AIResponse> {
  const systemPrompt = language === 'en' ? SYSTEM_PROMPT_CHAPTER_EN : SYSTEM_PROMPT_CHAPTER;
  return callAI([{ role: 'user', content: prompt }], config, {
    systemPrompt,
    extraContext: context,
    temperature: 0.85,
    maxTokens: 4096,  // 降低以适应30s限制
  });
}

/** 生成核心文件 (世界观/情节架构/角色状态) */
export async function generateCoreFiles(
  prompt: string,
  config: AIConfig,
  context?: string,
  language: 'zh' | 'en' = 'zh'
): Promise<AIResponse> {
  const systemPrompt = language === 'en' ? SYSTEM_PROMPT_ARCHITECT_EN : SYSTEM_PROMPT_ARCHITECT;
  return callAI([{ role: 'user', content: prompt }], config, {
    systemPrompt,
    extraContext: context,
    temperature: 0.7,
    maxTokens: 4096,  // 降低以加速
  });
}

/** 后处理分析 (提要/钩子/物品) */
export async function postProcessChapter(
  prompt: string,
  config: AIConfig,
  context?: string,
  language: 'zh' | 'en' = 'zh'
): Promise<AIResponse> {
  const systemPrompt = language === 'en' ? SYSTEM_PROMPT_EDITOR_EN : SYSTEM_PROMPT_EDITOR;
  return callAI([{ role: 'user', content: prompt }], config, {
    systemPrompt,
    extraContext: context,
    temperature: 0.3,
    maxTokens: 4096,
  });
}

// ============================================
// 内置 System Prompts — Chinese
// ============================================

const SYSTEM_PROMPT_CHAPTER = `你是一位顶级中文网络小说作家，擅长玄幻、仙侠、科幻等类型的长篇连载小说。
你的写作风格:
- 文笔流畅，画面感强
- 对话自然，符合角色性格
- 节奏把控精准，善于制造悬念
- 注重角色情感和成长
- 世界观设定严谨自洽

请直接输出小说内容，不要添加任何元说明。`;

const SYSTEM_PROMPT_ARCHITECT = `你是一位顶级世界观架构师和小说策划师。
你擅长:
- 构建宏大而自洽的虚构世界
- 设计多层次的情节架构
- 创建有深度的角色和角色弧光
- 规划章节节奏和悬念曲线

请严格按照要求的格式输出，不要添加额外说明。`;

const SYSTEM_PROMPT_EDITOR = `你是一位小说编辑和分析专家。
请仔细阅读章节内容，提取关键信息。
严格按照要求的格式输出分析结果。`;

// ============================================
// 内置 System Prompts — English
// ============================================

const SYSTEM_PROMPT_CHAPTER_EN = `You are a top web novelist, skilled in long-form serialized fiction across fantasy, sci-fi, and adventure genres.
Your writing style:
- Fluid prose with strong visual imagery
- Natural dialogue that fits each character's personality
- Precise pacing control, skilled at building suspense
- Focus on character emotions and growth
- Rigorous and self-consistent worldbuilding

Output the novel content directly, do not add any meta-commentary.`;

const SYSTEM_PROMPT_ARCHITECT_EN = `You are a top-tier worldbuilder and fiction architect.
You specialize in:
- Building grand and self-consistent fictional worlds
- Designing multi-layered plot architectures
- Creating deep characters with compelling arcs
- Planning chapter pacing and suspense curves

Output strictly in the required format, do not add extra explanations.`;

const SYSTEM_PROMPT_EDITOR_EN = `You are a fiction editor and analysis expert.
Read the chapter content carefully and extract key information.
Output the analysis results strictly in the required format.`;
