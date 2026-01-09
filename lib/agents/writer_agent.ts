/**
 * Writer Agent - 编剧 Agent
 * 根据导演指令生成节目台本，选择主持人、设置语气
 */

import { getSettings } from '../settings_store';
import {
    ShowTimeline,
    TimelineBlock,
} from '../types/radio_types';
import { globalState } from '../global_state';

// ================== Constants ==================

const MAX_PARSE_RETRIES = 3;

// ================== Radio Setting ==================

const RADIO_SETTING = `
你是一个现代中文网络电台的节目编排AI。

电台名称：「深夜电波」
定位：陪伴型深夜电台，温暖治愈
时段：晚间 22:00 - 02:00

常驻主持人：
- host1 (阿静)：女，温柔知性，擅长情感话题
- host2 (小北)：男，幽默随和，擅长音乐推荐

节目风格：轻松温馨、偶尔搞笑、深夜陪伴感
`;

// ================== Writer Agent Class ==================

export class WriterAgent {

    /**
     * 生成节目时间线
     * @param duration 目标时长（秒），默认 120 秒（2分钟）
     * @param theme 节目主题（可选）
     * @param userRequest 用户投稿内容（可选）
     */
    async generateTimeline(
        duration: number = 120,
        theme?: string,
        userRequest?: string
    ): Promise<ShowTimeline> {
        const prompt = this.buildPrompt(duration, theme, userRequest);

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_PARSE_RETRIES; attempt++) {
            try {
                const response = await this.callAI(prompt + (attempt > 0 ? this.getRetryHint(lastError) : ''));
                const timeline = this.parseResponse(response);
                return timeline;
            } catch (error) {
                lastError = error as Error;
                console.warn(`Parse attempt ${attempt + 1} failed:`, error);
            }
        }

        // 所有重试失败，返回默认内容
        return this.getDefaultTimeline();
    }

    /**
     * 构建生成 Prompt
     */
    private buildPrompt(duration: number, theme?: string, userRequest?: string): string {
        let prompt = `${RADIO_SETTING}

## 任务
生成一段约 ${duration} 秒的电台节目时间线。

## 输出格式
严格按以下 JSON 格式输出，不要有其他内容：

\`\`\`json
{
  "id": "唯一ID",
  "title": "节目标题",
  "estimatedDuration": ${duration},
  "blocks": [
    {
      "type": "talk",
      "id": "talk-1",
      "scripts": [
        {
          "speaker": "host1",
          "text": "台词内容",
          "mood": "warm",
          "voiceStyle": "温柔地说"
        }
      ],
      "backgroundMusic": {
        "action": "continue",
        "volume": 0.2
      }
    },
    {
      "type": "music",
      "id": "music-1",
      "action": "play",
      "search": "歌名或歌手",
      "duration": 30,
      "intro": {
        "speaker": "host2",
        "text": "接下来这首歌...",
        "mood": "cheerful"
      }
    },
    {
      "type": "music_control",
      "id": "mc-1",
      "action": "fade_out",
      "fadeDuration": 2000
    }
  ]
}
\`\`\`

## 可用类型

### speaker (主持人)
- "host1": 阿静（女）
- "host2": 小北（男）
- "guest": 嘉宾
- "news": 新闻播报

### mood (情绪)
- "cheerful": 开朗
- "calm": 平静
- "excited": 兴奋
- "serious": 严肃
- "warm": 温暖
- "playful": 俏皮
- "melancholy": 忧郁
- "mysterious": 神秘

### backgroundMusic.action
- "continue": 继续播放（调整音量）
- "fade": 淡出
- "pause": 暂停

### music_control.action
- "pause": 暂停
- "resume": 继续
- "fade_out": 淡出
- "fade_in": 淡入

## 内容要求
1. **对话要丰富**：主持人之间的对话要自然、有来有往，每个 talk 块至少 3-5 句台词
2. **音乐时长**：
   - 可以让音乐完整播放（不设 duration，或 duration: 180）
   - 也可以在播放过程中主持人开始说话（通过 backgroundMusic.action: "continue" + volume: 0.15）
3. **过渡自然**：音乐 fade_out 后主持人要有承接的话语
4. **内容深入**：话题展开要详细，不要蜻蜓点水
5. **情感丰富**：台词要有感情起伏，设置合适的 mood 和 voiceStyle
6. **节目节奏**：可以是 [对话] → [音乐完整播放] → [评论] → [背景音乐+聊天]
`;

        if (theme) {
            prompt += `\n## 主题要求\n${theme}\n`;
        }

        if (userRequest) {
            prompt += `\n## 听众来信\n"${userRequest}"\n请在节目中回应这封来信。\n`;
        }

        // 注入上下文记忆（避免重复）
        const context = globalState.getContextForPrompt();
        if (context) {
            prompt += `\n${context}\n`;
        }

        prompt += `\n请直接输出 JSON，不要有任何其他解释文字。`;

        return prompt;
    }

    /**
     * 调用 AI 生成
     */
    private async callAI(prompt: string): Promise<string> {
        const settings = getSettings();

        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: `${this.normalizeEndpoint(settings.endpoint)}/models/${settings.modelName}:generateContent`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 4096
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`AI API Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
    }

    /**
     * 解析 AI 响应
     */
    private parseResponse(response: string): ShowTimeline {
        // 提取 JSON 内容
        let jsonStr = response;

        // 移除 markdown 代码块
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        // 尝试解析
        const parsed = JSON.parse(jsonStr.trim());

        // 验证结构
        if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
            throw new Error('Invalid timeline structure: missing blocks array');
        }

        // 生成缺失的 ID
        parsed.id = parsed.id || `timeline-${Date.now()}`;
        parsed.blocks.forEach((block: TimelineBlock, index: number) => {
            if (!block.id) {
                block.id = `block-${index}`;
            }
        });

        return parsed as ShowTimeline;
    }

    /**
     * 重试时的提示
     */
    private getRetryHint(error: Error | null): string {
        return `

注意：上次生成的格式有误 (${error?.message})。
请确保：
1. 输出的是有效的 JSON
2. 不要有多余的文字
3. 所有字段名用双引号包裹
`;
    }

    /**
     * 默认时间线（备选）
     */
    private getDefaultTimeline(): ShowTimeline {
        return {
            id: `default-${Date.now()}`,
            title: '深夜电波',
            estimatedDuration: 60,
            blocks: [
                {
                    type: 'talk',
                    id: 'default-talk',
                    scripts: [
                        {
                            speaker: 'host1',
                            text: '嗨，欢迎收听深夜电波。今晚的夜很静，让我们一起度过这段温暖的时光。',
                            mood: 'warm'
                        }
                    ]
                }
            ]
        };
    }

    /**
     * 规范化 endpoint
     */
    private normalizeEndpoint(endpoint: string): string {
        let url = endpoint.replace(/\/$/, '');
        if (!url.endsWith('/v1') && !url.endsWith('/v1beta')) {
            url = `${url}/v1`;
        }
        return url;
    }
}

// 单例导出
export const writerAgent = new WriterAgent();
