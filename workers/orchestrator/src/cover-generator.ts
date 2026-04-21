// ============================================
// AI 封面生成 — Doubao Images API (Ark)
// ============================================

export interface CoverConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  size?: string;
  watermark?: boolean;
  responseFormat?: 'url' | 'b64_json';
}

export interface CoverResult {
  buffer: Uint8Array;
  contentType: string;
}

/**
 * 生成小说封面并返回二进制数据
 * - 支持 response_format = url / b64_json
 * - 默认按 Doubao Images API 请求格式
 */
export async function generateCover(
  title: string,
  genre: string,
  theme: string,
  config: CoverConfig,
): Promise<CoverResult | null> {
  try {
    const prompt = buildCoverPrompt(title, genre, theme);
    const primaryFormat = config.responseFormat || 'url';

    // 第一轮: 使用配置格式
    const primary = await requestCover(prompt, config, primaryFormat);
    if (primary) return primary;

    // 第二轮: 若配置为 url，额外回退到 b64_json 提高成功率
    if (primaryFormat === 'url') {
      console.log('[COVER] Fallback to b64_json');
      const fallback = await requestCover(prompt, config, 'b64_json');
      if (fallback) return fallback;
    }

    return null;
  } catch (e: any) {
    console.error(`[COVER] Error: ${e.message}`);
    return null;
  }
}

async function requestCover(
  prompt: string,
  config: CoverConfig,
  responseFormat: 'url' | 'b64_json',
): Promise<CoverResult | null> {
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      sequential_image_generation: 'disabled',
      response_format: responseFormat,
      size: config.size || '2K',
      stream: false,
      watermark: config.watermark ?? true,
    }),
  });

  if (!response.ok) {
    console.error(`[COVER] API error (${responseFormat}) ${response.status}: ${await response.text()}`);
    return null;
  }

  const data = await response.json() as any;
  const imageUrl = extractImageUrl(data);
  if (imageUrl) {
    const downloaded = await downloadImage(imageUrl);
    if (downloaded) return downloaded;
  }

  const base64Data = extractBase64(data);
  if (base64Data) {
    return {
      buffer: base64ToBuffer(base64Data),
      contentType: 'image/png',
    };
  }

  console.error(`[COVER] No image found (${responseFormat}) in response keys:`, Object.keys(data || {}));
  return null;
}

function extractImageUrl(data: any): string | null {
  // Doubao images: { data: [{ url: "..." }] }
  const url =
    data?.data?.[0]?.url ||
    data?.images?.[0]?.url ||
    data?.output?.url ||
    data?.result?.url ||
    null;

  return typeof url === 'string' && url.startsWith('http') ? url : null;
}

function extractBase64(data: any): string | null {
  // 常见格式:
  // 1) data[0].b64_json
  // 2) data[0].base64
  // 3) data:image/...;base64,xxxx
  const b64 =
    data?.data?.[0]?.b64_json ||
    data?.data?.[0]?.base64 ||
    data?.image ||
    null;

  if (typeof b64 !== 'string' || b64.length === 0) return null;
  return b64;
}

async function downloadImage(url: string): Promise<CoverResult | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[COVER] Download image failed ${resp.status}: ${url}`);
      return null;
    }
    const arr = new Uint8Array(await resp.arrayBuffer());
    if (arr.length === 0) return null;

    const contentType = resp.headers.get('content-type') || 'image/png';
    return { buffer: arr, contentType };
  } catch (e: any) {
    console.error(`[COVER] Download image error: ${e.message}`);
    return null;
  }
}

/**
 * 构建封面提示词
 */
function buildCoverPrompt(title: string, genre: string, theme: string): string {
  const genreStyle: Record<string, string> = {
    '玄幻': '上古能量、史诗场景、强对比光影、电影级冲击力',
    '仙侠': '云海仙山、灵气流动、东方幻想、国风电影感',
    '科幻': '太空与未来科技、霓虹与深空对比、强透视',
    '都市': '现代都市天际线、夜景反射、紧张戏剧光',
    '武侠': '古风江湖、刀剑对决、雾气与逆光',
    '悬疑': '暗色氛围、未知阴影、悬念构图',
    '奇幻': '魔法世界、超现实景观、强视觉张力',
    '言情': '细腻氛围、情感张力、柔和主色+高光点缀',
    'Fantasy': 'epic fantasy landscape, dramatic perspective, cinematic lighting',
    'Sci-Fi': 'futuristic sci-fi atmosphere, high contrast, cinematic composition',
  };

  const style = genreStyle[genre] || 'cinematic book cover, strong visual impact';

  return `为小说生成封面插画：

小说名：${title}
类型：${genre}
主题：${theme.slice(0, 220)}

风格要求：
- ${style}
- 电影级视觉冲击力，夸张广角透视，精细光影
- 主体突出，场景层次清晰，色彩丰富但统一
- 暗背景下的高质量渲染，真实质感，艺术幻想感
- 不要任何文字、logo、水印元素（系统水印配置除外）
- 竖版构图，适合小说封面`;
}

/**
 * 将 base64 / dataURL 转为 Uint8Array
 */
export function base64ToBuffer(base64Data: string): Uint8Array {
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
