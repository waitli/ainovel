// ============================================
// AI 内容审核 — 初筛 + 给管理员审核建议
// ============================================
// 不自动拒绝，而是生成审核意见存到数据库
// 管理员审批时可以看到 AI 的建议
// ============================================

export interface ModerationResult {
  risk_level: 'low' | 'medium' | 'high';
  suggestion: 'approve' | 'review' | 'reject';
  reason: string;
  categories: string[];
}

/**
 * 审核投稿内容，返回审核意见
 */
export async function moderateSubmission(
  submission: any,
  apiKey: string,
  baseUrl: string
): Promise<ModerationResult> {
  const content = `
书名: ${submission.title}
类型: ${submission.genre}
世界观: ${submission.worldview}
大纲: ${submission.outline}
核心冲突: ${submission.core_conflict}
角色: ${submission.characters?.map((c: any) =>
    `${c.name}: ${c.appearance} ${c.personality} ${c.backstory}`
  ).join('; ')}
`.trim();

  return moderateContent(content, '投稿', apiKey, baseUrl);
}

/**
 * 审核角色申请，返回审核意见
 */
export async function moderateCharacterApplication(
  character: any,
  bookTitle: string,
  apiKey: string,
  baseUrl: string
): Promise<ModerationResult> {
  const content = `
申请入书: ${bookTitle}
角色名: ${character.name}
外貌: ${character.appearance}
性格: ${character.personality}
背景: ${character.backstory}
动机: ${character.motivation}
能力: ${character.abilities || '无'}
关系: ${character.relationship_to_existing || '无'}
`.trim();

  return moderateContent(content, '角色申请', apiKey, baseUrl);
}

/**
 * 通用内容审核
 */
async function moderateContent(
  content: string,
  contentType: string,
  apiKey: string,
  baseUrl: string
): Promise<ModerationResult> {
  const defaultResult: ModerationResult = {
    risk_level: 'low',
    suggestion: 'approve',
    reason: '审核服务异常，默认通过',
    categories: [],
  };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [
          {
            role: 'system',
            content: `你是内容初审员，为管理员提供审核建议。分析用户提交的${contentType}内容，评估风险等级。

检查以下违规类型:
1. 政治敏感: 涉及现实政治人物、敏感事件、分裂国家
2. 色情低俗: 明确的性描写、色情内容
3. 暴力血腥: 过度残忍的暴力描写
4. 违法犯罪: 教唆犯罪、毒品、赌博
5. 歧视仇恨: 种族歧视、宗教仇恨、人身攻击
6. 质量过低: 内容空洞、逻辑混乱、明显敷衍

风险等级说明:
- low: 正常内容，建议通过
- medium: 有轻微问题，建议管理员复核
- high: 明显违规，建议拒绝

注意:
- 小说中的虚构暴力/冲突是正常的
- 仅当内容明确违法违规时定为 high
- 质量差但不违法的定为 medium

回复格式(严格JSON，不要其他内容):
{"risk_level":"low|medium|high","suggestion":"approve|review|reject","reason":"审核意见(给管理员看)","categories":["违规类别"]}`,
          },
          {
            role: 'user',
            content: `请审核以下${contentType}内容:\n\n${content.slice(0, 2000)}`,
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error(`[MODERATE] API error ${response.status}`);
      return defaultResult;
    }

    const data = await response.json() as any;
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        risk_level: result.risk_level || 'low',
        suggestion: result.suggestion || 'approve',
        reason: result.reason || '',
        categories: result.categories || [],
      };
    }

    return defaultResult;

  } catch (e: any) {
    console.error(`[MODERATE] Error: ${e.message}`);
    return defaultResult;
  }
}
