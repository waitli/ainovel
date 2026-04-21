// ============================================
// Prompt 构建器 — 雪花写作法 + 角色弧光 + 悬念节奏曲线
// ============================================

import type { GenerationContext } from './context-assembler';
import { CHAPTER_WORD_TARGET_ZH, CHAPTER_WORD_TARGET_EN, DIRECTIONS_MIN, DIRECTIONS_MAX } from '../../../shared/src/index';

/**
 * 构建章节生成的完整 Prompt
 */
export function buildChapterPrompt(ctx: GenerationContext, language: 'zh' | 'en' = 'zh'): string {
  const WT = language === 'en' ? CHAPTER_WORD_TARGET_EN : CHAPTER_WORD_TARGET_ZH;

  if (language === 'en') {
    return `You are a top web novelist. Now you need to write Chapter ${ctx.nextChapter} based on the following complete worldbuilding, plot architecture, character state, and previous summaries.

=== Writing Principles ===

1. [Snowflake Method] Expand layer by layer from the existing outline:
   - This chapter is an organic part of the overall plot architecture
   - Every scene must serve main plot advancement or character growth
   - Extract the micro-tasks for this chapter from the macro outline

2. [Character Arc Theory] Ensure dynamic character development:
   - Every appearing character must have emotional change or cognitive advancement
   - Use the Drive Triangle (Desire/Fear/Flaw) to drive character actions
   - Relationships between characters must subtly shift due to this chapter's events

3. [Suspense Rhythm Curve] Control the reading experience:
   - Open with a hook to quickly pull back reader attention
   - Create a cognitive roller coaster in the middle (tension → relaxation → more tension)
   - The ending must leave a suspense or twist, making readers want the next chapter

=== Worldbuilding ===
${ctx.worldbuilding || '(To be established)'}

=== Plot Architecture ===
${ctx.plotArchitecture || '(To be established)'}

=== Character State ===
${ctx.characterState || '(To be established)'}

=== Original Submission ===
${ctx.submission || '(None)'}

=== Previous Summary (last 30 chapters) ===
${ctx.recentSummaries}

=== Active Hooks/Foreshadowing ===
${ctx.hooks || '(None)'}
${ctx.winningDirection ? `
=== This Chapter's Direction (voted by readers) ===
Direction: ${ctx.winningDirection.title}
Description: ${ctx.winningDirection.description}
**This chapter must follow this direction**
` : `
=== This Chapter's Direction ===
(Chapter 1 — start based on the plot architecture)
`}
${ctx.items ? `
=== Item Inventory ===
${ctx.items}
` : ''}
=== Output Requirements ===

Please output strictly in the following format, no extra content:

\`\`\`
# Chapter ${ctx.nextChapter}: [Chapter Title]

[Body content, ${WT.min}-${WT.max} words]

---

## What Happens Next?

Option A: [Title]
[Description, 50-100 words describing the plot direction]

Option B: [Title]
[Description, 50-100 words]
${DIRECTIONS_MAX > 2 ? `
Option C: [Title]
[Description, 50-100 words]` : ''}
${DIRECTIONS_MAX > 3 ? `
Option D: [Title]
[Description, 50-100 words]` : ''}
\`\`\`

Number of directions required: ${DIRECTIONS_MIN}-${DIRECTIONS_MAX}.

Direction design requirements:
- Each direction must have dramatic conflict and suspense
- Directions must be clearly differentiated from each other
- Directions must closely connect with the chapter's ending situation
- Directions must advance character arc development`;
  }

  // Chinese (default) prompt
  return `你是一位顶级网络小说作家。现在需要你根据以下完整的世界观、情节架构、角色状态和前情提要，创作第${ctx.nextChapter}章。

=== 写作原则 ===

1. 【雪花写作法】从已有架构逐层展开：
   - 本章是整体情节架构的一个有机部分
   - 每个场景都要服务于主线推进或角色成长
   - 从宏观大纲中提取本章的微观任务

2. 【角色弧光理论】确保角色动态发展：
   - 每个出场角色都要有情绪变化或认知推进
   - 利用驱动力三角(欲望/恐惧/缺陷)推动角色行动
   - 角色之间的关系要因本章事件发生微妙变化

3. 【悬念节奏曲线】控制阅读体验：
   - 开头用钩子快速拉回读者注意力
   - 中段制造认知过山车(紧张→放松→更紧张)
   - 结尾必须留下悬念或转折，让读者想看下一章

=== 世界观 ===
${ctx.worldbuilding || '(待建立)'}

=== 情节架构 ===
${ctx.plotArchitecture || '(待建立)'}

=== 角色状态 ===
${ctx.characterState || '(待建立)'}

=== 投稿原始设定 ===
${ctx.submission || '(无)'}

=== 前情提要(最近30章) ===
${ctx.recentSummaries}

=== 活跃的钩子/伏笔 ===
${ctx.hooks || '(暂无)'}
${ctx.winningDirection ? `
=== 本章方向(读者投票选出) ===
方向: ${ctx.winningDirection.title}
描述: ${ctx.winningDirection.description}
**本章必须按照这个方向展开情节**
` : `
=== 本章方向 ===
(第一章，自行根据情节架构起笔)
`}
${ctx.items ? `
=== 物品清单 ===
${ctx.items}
` : ''}
=== 输出要求 ===

请严格按照以下格式输出，不要多余内容：

\`\`\`
# 第${ctx.nextChapter}章 [章节标题]

[正文内容，${WT.min}-${WT.max}字]

---

## 后续发展方向

方向A: [标题]
[描述，50-100字，描述这个方向的情节走向]

方向B: [标题]
[描述，50-100字]
${DIRECTIONS_MAX > 2 ? `
方向C: [标题]
[描述，50-100字]` : ''}
${DIRECTIONS_MAX > 3 ? `
方向D: [标题]
[描述，50-100字]` : ''}
\`\`\`

方向数量要求: ${DIRECTIONS_MIN}-${DIRECTIONS_MAX}个。

方向设计要求:
- 每个方向都要有戏剧冲突和悬念
- 方向之间要有明显差异化，不能太相似
- 方向必须与本章结尾的局势紧密衔接
- 方向要能推动角色弧光发展`;
}

/**
 * 构建核心文件初始化 Prompt (审批通过后生成三个md)
 */
export function buildInitPrompt(submissionData: any, language: 'zh' | 'en' = 'zh'): string {
  if (language === 'en') {
    return `Based on the following novel submission, generate 3 core files (separated by ===FILE:name===).

Title: ${submissionData.title} Genre: ${submissionData.genre}
Worldbuilding: ${submissionData.worldview}
Outline: ${submissionData.outline}
Conflict: ${submissionData.core_conflict}
Characters: ${submissionData.characters?.map((c: any) => `${c.name}(${c.role}): ${c.appearance}, personality ${c.personality}, motivation ${c.motivation}`).join('; ') || 'None'}

===FILE:worldbuilding===
Brief worldbuilding: geography, rules, factions, history (2-3 sentences each)

===FILE:plot-architecture===
Brief architecture: main plot, 2 subplots, conflict layers, climax planning (2-3 sentences each)

===FILE:character-state===
Each character: basic info, arc phase (setup), initial state, relationships`;
  }

  return `根据以下小说投稿，生成3个核心文件(用===FILE:name===分隔)。

书名:${submissionData.title} 类型:${submissionData.genre}
世界观:${submissionData.worldview}
大纲:${submissionData.outline}
冲突:${submissionData.core_conflict}
角色:${submissionData.characters?.map((c: any) => `${c.name}(${c.role}):${c.appearance},性格${c.personality},动机${c.motivation}`).join('; ') || '无'}

===FILE:worldbuilding===
简要世界观:地理、规则、势力、历史(各2-3句)

===FILE:plot-architecture===
简要架构:主线、2条支线、冲突层次、高潮规划(各2-3句)

===FILE:character-state===
每个角色:基本信息、弧光阶段(setup)、初始状态、关系`;
}

/**
 * 构建章节后处理 Prompt (生成前情提要、钩子、物品清单)
 */
export function buildPostProcessPrompt(
  chapterContent: string,
  chapterNumber: number,
  ctx: GenerationContext,
  language: 'zh' | 'en' = 'zh'
): string {
  if (language === 'en') {
    return `Please perform a post-processing analysis on the following novel chapter.

=== Chapter ${chapterNumber} Text ===
${chapterContent}

=== Existing Hooks/Foreshadowing ===
${ctx.hooks || '(None)'}

=== Existing Item Inventory ===
${ctx.items || '(None)'}

=== Character State ===
${ctx.characterState || '(None)'}

=== Output Requirements ===

Separate output with --- :

===FILE:summary===
Chapter summary (100-200 words summarizing core content)
Key Events:
- [Event 1]
- [Event 2]
Character Changes:
- [Character Name]: [Change description]
New Items Introduced:
- [Item name]
Hooks Planted This Chapter:
- [Hook description]

===FILE:hooks===
[Updated complete hook/foreshadowing list]
Format: "- Chapter X: [Description] (Type: Suspense/Foreshadowing/Preview/Twist) [Status: Active/Resolved]"

===FILE:items===
[Updated complete item inventory]
Format: "- [Item Name]: [Description] (Holder: [Character Name], First appeared: Chapter X)"`;
  }

  return `请对以下小说章节进行后处理分析。

=== 第${chapterNumber}章正文 ===
${chapterContent}

=== 现有钩子/伏笔 ===
${ctx.hooks || '(无)'}

=== 现有物品清单 ===
${ctx.items || '(无)'}

=== 角色状态 ===
${ctx.characterState || '(无)'}

=== 输出要求 ===

用 --- 分隔输出以下内容：

===FILE:summary===
前情提要(100-200字概括本章核心内容)
关键事件:
- [事件1]
- [事件2]
角色变化:
- [角色名]: [变化描述]
新引入物品:
- [物品名]
本章埋设的钩子:
- [钩子描述]

===FILE:hooks===
[更新后的完整钩子/伏笔清单]
格式: "- 第X章埋设: [描述] (类型: 悬念/伏笔/预告/反转) [状态: 活跃/已回收]"

===FILE:items===
[更新后的完整物品清单]
格式: "- [物品名]: [描述] (持有者: [角色名], 首次出现: 第X章)"`;
}
