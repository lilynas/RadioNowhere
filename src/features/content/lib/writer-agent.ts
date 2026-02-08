/**
 * Writer Agent - 编剧 Agent (ReAct 版本)
 * 具备工具调用能力，可搜索音乐、获取歌词、自我校验
 */

import { getSettings } from '@shared/services/storage-service/settings';
import { RADIO, AGENT } from '@shared/utils/constants';
import {
    ShowTimeline,
} from '@shared/types/radio-core';
import { globalState } from '@shared/stores/global-state';
import { radioMonitor } from '@shared/services/monitor-service';
import { getVoiceListForPrompt } from '@features/tts/lib/voice-provider';
import {
    executeToolCall,
    getHistoryContext,
    getToolsDescription
} from './writer-tools';
import { getProhibitedArtists } from '@features/music-search/lib/diversity-manager';
import { parseResponse as parseTimelineResponse } from './response-parser';
import { getShowConfig, ShowConfig } from './show-config';
import { buildPromptByType } from './prompt-templates';
import { getGenrePromptSection, getGenreSuggestions, recordUsedGenre } from '@features/music-search/lib/genre-wheel';
import { SHOW_SEGMENT_STRUCTURES } from '@shared/types/segment';
import { getUserPreferencePromptContext } from '@features/user-preferences/lib';

// ================== Constants ==================

const MAX_REACT_LOOPS = AGENT.MAX_REACT_LOOPS;

// ================== Radio Setting (Dynamic) ==================

function getRadioSetting(): string {
    const now = new Date();
    const hour = now.getHours();

    // 时段只做参考，不限制内容类型
    let timeMood = '';
    if (hour >= 6 && hour < 12) {
        timeMood = '清晨到上午的时光';
    } else if (hour >= 12 && hour < 18) {
        timeMood = '午后悠闲时光';
    } else if (hour >= 18 && hour < 22) {
        timeMood = '傍晚归家时分';
    } else {
        timeMood = '深夜静谧时刻';
    }

    return `你是 **${RADIO.NAME} ${RADIO.FREQUENCY}** 网络电台的内容创作者。

## 📻 电台身份
- 电台名称：**${RADIO.NAME}** (${RADIO.SLOGAN})
- 频率：**${RADIO.FREQUENCY}**
- 可以在节目中自然地提及电台名称，如"欢迎收听 ${RADIO.NAME} ${RADIO.FREQUENCY}"、"这里是无处电台"等

## 🎭 节目类型（请随机选择，不要每次都一样！）

### 💬 脱口秀/闲聊
两位主持人轻松聊天，分享生活趣事、热门话题、个人见解

### 📚 历史风云
讲述历史故事、人物传记、朝代兴衰，带听众穿越时空

### 🔬 科普百科
有趣的科学知识、自然奥秘、生活冷知识，深入浅出

### 👻 奇闻异事
都市传说、未解之谜、灵异故事（营造悬疑氛围，但不要过于恐怖）

### 🎤 访谈对话
模拟采访名人、专家或虚构人物，深度对话

### 🌙 深夜心声
情感话题、人生感悟、温暖治愈（适合${timeMood}）

### 🎵 音乐专题
介绍某个曲风、歌手或音乐背后的故事

### 🎪 娱乐互动
有趣的话题讨论、游戏互动、轻松搞笑

## 🚨 重要原则
1. **内容优先**：选择有趣的话题比"符合时段"更重要
2. **避免重复**：不要每次都是同一种风格或话题
3. **深度展开**：挑一个具体话题深入讨论，不要泛泛而谈
4. **真实感**：主持人要有真实的对话感，不要念稿子味
5. **创意自由**：可以创造任何风格的电台、任何人设的主持人

## 参考时段
当前是${timeMood}，可以参考但不必被限制。一期讲三国历史的节目在早上播放也完全可以！
`;
}

// ================== Writer Agent Class ==================

import { Cast, castDirector, ShowType } from './cast-system';

export class WriterAgent {
    private currentCast: Cast | null = null;
    private conversationHistory: Array<{ role: string; content: string }> = [];
    private currentShowType: ShowType = 'talk';
    private currentShowConfig: ShowConfig = getShowConfig('talk');
    private activeToolNames: string[] = [];
    private currentGenreSuggestions: string[] = [];

    /**
     * 获取当前演员阵容
     */
    getCurrentCast(): Cast | null {
        return this.currentCast;
    }

    /**
     * 生成节目时间线 (ReAct 版本)
     * 使用多轮对话和工具调用
     */
    async generateTimeline(
        duration: number = 120,
        theme?: string,
        userRequest?: string,
        showType?: ShowType
    ): Promise<ShowTimeline> {
        // 1. 选择节目类型、配置和演员阵容
        const selectedShowType = showType || castDirector.randomShowType();
        const config = getShowConfig(selectedShowType);

        this.currentShowType = selectedShowType;
        this.currentShowConfig = config;
        this.activeToolNames = this.getToolsForType(selectedShowType, config);
        this.currentGenreSuggestions = selectedShowType === 'music' ? getGenreSuggestions(3) : [];
        this.currentCast = castDirector.selectCast(selectedShowType);

        radioMonitor.updateStatus('WRITER', 'BUSY', `ReAct Loop: ${selectedShowType}`);
        radioMonitor.log('WRITER', `Starting ReAct loop for ${selectedShowType}`);

        // 2. 构建 ReAct 系统提示
        const typePrompt = this.buildPromptForType(
            selectedShowType,
            config,
            duration,
            theme,
            userRequest
        );
        const systemPrompt = this.buildReActSystemPrompt(typePrompt, selectedShowType, config);

        // 3. 初始化对话历史
        this.conversationHistory = [];

        // 4. ReAct 循环
        let finalTimeline: ShowTimeline | null = null;

        for (let loop = 0; loop < MAX_REACT_LOOPS; loop++) {
            radioMonitor.log('WRITER', `ReAct loop ${loop + 1}/${MAX_REACT_LOOPS}`);

            try {
                // 调用 AI
                const response = await this.callReActAI(systemPrompt);

                // 发布 AI 原始输出
                radioMonitor.emitThought('output', response);

                // 解析工具调用
                const toolCall = this.parseToolCall(response);

                if (toolCall) {
                    radioMonitor.log('WRITER', `Tool call: ${toolCall.name}`, 'info');
                    radioMonitor.emitThought('tool_call', JSON.stringify(toolCall.args, null, 2), toolCall.name);

                    // 执行工具
                    const result = await executeToolCall(
                        toolCall.name,
                        toolCall.args,
                        (json) => this.parseResponse(json)
                    );

                    // 发布工具结果
                    radioMonitor.emitThought('tool_result', JSON.stringify(result, null, 2), toolCall.name);

                    // 添加到对话历史
                    this.conversationHistory.push({
                        role: 'assistant',
                        content: response
                    });
                    this.conversationHistory.push({
                        role: 'user',
                        content: `Tool Result for ${toolCall.name}:\n${JSON.stringify(result, null, 2)}`
                    });

                    // 如果是 submit_show 且成功，结束循环
                    if (toolCall.name === 'submit_show' && result.success) {
                        radioMonitor.log('WRITER', 'Show submitted successfully!', 'info');
                        // 从工具调用参数中解析 timeline（不是从 result）
                        try {
                            const timelineJson = toolCall.args.timeline_json;

                            // 如果 timeline_json 已经是对象，直接使用
                            if (typeof timelineJson === 'object' && timelineJson !== null) {
                                finalTimeline = timelineJson as ShowTimeline;
                                break;
                            }

                            // 字符串处理
                            if (typeof timelineJson === 'string') {
                                let jsonStr = timelineJson;

                                // 尝试多种解析策略
                                for (let attempt = 0; attempt < 3; attempt++) {
                                    try {
                                        const parsed = JSON.parse(jsonStr);
                                        if (typeof parsed === 'object' && parsed.blocks) {
                                            finalTimeline = parsed;
                                            radioMonitor.log('WRITER', `JSON parsed on attempt ${attempt + 1}`, 'info');
                                            break;
                                        } else if (typeof parsed === 'string') {
                                            // 可能是双重 stringify，继续解析
                                            jsonStr = parsed;
                                        } else {
                                            break;
                                        }
                                    } catch {
                                        // 解析失败，尝试清理字符串
                                        if (attempt === 0) {
                                            // 第一次失败：尝试提取 JSON 对象
                                            const firstBrace = jsonStr.indexOf('{');
                                            const lastBrace = jsonStr.lastIndexOf('}');
                                            if (firstBrace !== -1 && lastBrace > firstBrace) {
                                                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                                            }
                                        }
                                        break;
                                    }
                                }

                                // 如果上述方法都失败，使用 parseResponse 处理
                                if (!finalTimeline) {
                                    finalTimeline = this.parseResponse(timelineJson);
                                }
                            }

                            if (finalTimeline) {
                                break;
                            }
                        } catch (e) {
                            radioMonitor.log('WRITER', `Parse after submit failed: ${e}`, 'warn');
                            // 继续循环修正
                        }
                    }
                } else {
                    // 没有工具调用，尝试直接解析为 JSON
                    // 跳过看起来像工具结果的响应
                    if (response.includes('"success"') && response.includes('"data"')) {
                        radioMonitor.log('WRITER', 'Skipping tool result format', 'trace');
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: response
                        });
                        this.conversationHistory.push({
                            role: 'user',
                            content: '请使用 submit_show 工具提交最终节目。'
                        });
                        continue;
                    }

                    try {
                        finalTimeline = this.parseResponse(response);
                        radioMonitor.log('WRITER', 'Direct JSON parse successful', 'info');
                        break;
                    } catch {
                        // 添加提示继续
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: response
                        });
                        this.conversationHistory.push({
                            role: 'user',
                            content: '请使用 submit_show 工具提交最终节目，或者直接输出有效的 JSON。'
                        });
                    }
                }
            } catch (error) {
                radioMonitor.log('WRITER', `Loop error: ${error}`, 'error');
                this.conversationHistory.push({
                    role: 'user',
                    content: `发生错误: ${error}。请修正后重试。`
                });
            }
        }

        // 5. 如果循环结束仍无结果，使用默认
        if (!finalTimeline) {
            radioMonitor.updateStatus('WRITER', 'ERROR', 'ReAct loop failed, using fallback');
            return this.getDefaultTimeline();
        }

        if (selectedShowType === 'music' && this.currentGenreSuggestions.length > 0) {
            recordUsedGenre(this.currentGenreSuggestions[0]);
        }

        radioMonitor.updateStatus('WRITER', 'IDLE', 'Generation complete');
        return finalTimeline;
    }

    /**
     * 构建 ReAct 系统提示
     */
    private buildReActSystemPrompt(typePrompt: string, showType: ShowType, config: ShowConfig): string {
        const historyContext = getHistoryContext();
        const toolsDesc = getToolsDescription(this.activeToolNames);
        const userPreferenceContext = getUserPreferencePromptContext();

        const prohibitedArtists = getProhibitedArtists();
        const shouldShowProhibited = this.activeToolNames.includes('search_music') || this.activeToolNames.includes('check_artist_diversity');
        const prohibitionContext = shouldShowProhibited && prohibitedArtists.length > 0
            ? `## ⚠️ 禁止使用的歌手（近24小时已使用）\n${prohibitedArtists.map(a => `- ${a}`).join('\n')}\n\n违反该列表会导致节目校验失败。`
            : '';

        const flowSteps = [
            this.activeToolNames.includes('check_duplicate') ? '1) 先调用 check_duplicate 检查主题是否重复。' : '',
            this.activeToolNames.includes('fetch_news') ? '2) 若是资讯型内容，调用 fetch_news 获取素材。' : '',
            this.activeToolNames.includes('search_music') ? '3) 需要音乐时用 search_music（可附带 genre_hint）。' : '',
            this.activeToolNames.includes('check_artist_diversity') ? '4) 完稿后调用 check_artist_diversity 自检。' : '',
            '5) 最终必须调用 submit_show 提交完整 timeline_json。'
        ].filter(Boolean).join('\n');

        const memoryContext = globalState.getContextForPrompt();

        return `${getRadioSetting()}

## 🧩 本期模式
- 节目类型：${showType}
- 对话占比建议：${config.talkRatio[0]}%-${config.talkRatio[1]}%
- 音乐占比建议：${config.musicRatio[0]}%-${config.musicRatio[1]}%
- 音乐用途：${config.musicPurpose}

${userPreferenceContext}
${historyContext}
${prohibitionContext}
${memoryContext ? `\n## 🧠 全局记忆\n${memoryContext}` : ''}

## 🛠️ 可用工具
${toolsDesc}

## 工具调用格式
\`\`\`json
{"tool": "工具名", "args": {"参数名": "值"}}
\`\`\`

## 推荐工作流
${flowSteps}

## 输出格式
最终提交时，timeline_json 必须是以下格式：
${this.getOutputFormatExample()}

${typePrompt}

${getVoiceListForPrompt()}

开始工作！先进行必要工具调用，再完成节目。`;
    }

    /**
     * 获取输出格式示例
     */
    private getOutputFormatExample(): string {
        return `{
  "id": "唯一ID",
  "title": "节目标题",
  "estimatedDuration": 120,
  "blocks": [
    {"type": "talk", "id": "talk-1", "scripts": [{"speaker": "host1", "text": "...", "mood": "warm"}]},
    {"type": "music", "id": "music-1", "action": "play", "search": "歌名", "duration": 60}
  ]
}`;
    }

    private getShowTypeLabel(type: ShowType): string {
        const labels: Record<ShowType, string> = {
            talk: '脱口秀闲聊',
            interview: '访谈对话',
            news: '新闻资讯',
            drama: '广播剧',
            entertainment: '娱乐综艺',
            story: '故事电台',
            history: '历史故事',
            science: '科普百科',
            mystery: '奇闻异事',
            nighttalk: '深夜心声',
            music: '音乐专题'
        };

        return labels[type] || type;
    }

    private getToolsForType(type: ShowType, config: ShowConfig): string[] {
        const allTools = [...config.requiredTools, ...config.optionalTools];

        if (type !== 'music' && type !== 'talk' && type !== 'nighttalk' && type !== 'entertainment') {
            return Array.from(new Set(allTools.filter(tool => tool !== 'check_artist_diversity')));
        }

        return Array.from(new Set(allTools));
    }

    private buildPromptForType(
        type: ShowType,
        config: ShowConfig,
        duration: number,
        theme?: string,
        userRequest?: string
    ): string {
        const timeContext = this.getTimeContext();
        const castDescription = this.currentCast
            ? castDirector.getCastDescription(this.currentCast)
            : '';
        const segmentHints = SHOW_SEGMENT_STRUCTURES[type]
            ?.map((segment, index) => `${index + 1}. ${segment.type}（${segment.durationHint[0]}-${segment.durationHint[1]}秒）${segment.description ? `：${segment.description}` : ''}`)
            .join('\n') || '';
        const historyContext = getHistoryContext();
        const toolsDescription = getToolsDescription(this.activeToolNames);
        const extraSections: string[] = [];

        if (segmentHints) {
            extraSections.push(`## 🧱 环节建议\n${segmentHints}`);
        }

        if (type === 'music' && this.currentGenreSuggestions.length > 0) {
            extraSections.push(getGenrePromptSection(this.currentGenreSuggestions));
        }

        extraSections.push(`## 📐 比例约束\n- Talk 占比建议：${config.talkRatio[0]}%-${config.talkRatio[1]}%\n- Music 占比建议：${config.musicRatio[0]}%-${config.musicRatio[1]}%\n- 音乐用途：${config.musicPurpose}`);

        return buildPromptByType(type, {
            duration,
            showType: type,
            showTypeLabel: this.getShowTypeLabel(type),
            castDescription,
            timeContext,
            toolsDescription,
            historyContext,
            theme,
            userRequest,
            extraSections
        }, config);
    }

    /**
     * 调用 ReAct AI (支持对话历史 + 指数退避重试)
     */
    private async callReActAI(systemPrompt: string): Promise<string> {
        const settings = getSettings();
        const MAX_API_RETRIES = 3;
        const BASE_DELAY_MS = 1000;

        // 构建消息
        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory
        ];

        // 如果是首次调用，添加初始用户消息
        if (this.conversationHistory.length === 0) {
            messages.push({ role: 'user', content: '请开始生成节目。' });
        }

        let url: string;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: unknown;

        if (settings.apiType === 'vertexai') {
            // Vertex AI 格式
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            url = `https://${settings.gcpLocation}-aiplatform.googleapis.com/v1/projects/${settings.gcpProject}/locations/${settings.gcpLocation}/publishers/google/models/${settings.modelName}:generateContent`;

            if (isGcpApiKey) {
                url += `?key=${settings.apiKey}`;
            } else {
                headers['Authorization'] = `Bearer ${settings.apiKey}`;
            }

            // Vertex AI 使用 contents 格式（类似 Gemini）
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            body = {
                contents,
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 8192
                }
            };
        } else if (settings.apiType === 'gemini') {
            // Gemini 格式
            const endpoint = settings.endpoint || 'https://generativelanguage.googleapis.com';
            url = `${this.normalizeEndpoint(endpoint)}/models/${settings.modelName}:generateContent`;
            headers['x-goog-api-key'] = settings.apiKey;

            // Gemini 使用 contents 格式
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            body = {
                contents,
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 8192
                }
            };
        } else {
            // OpenAI 格式
            const endpoint = settings.endpoint || '';
            let baseUrl = endpoint.replace(/\/$/, '');
            if (!baseUrl.endsWith('/v1')) {
                baseUrl = `${baseUrl}/v1`;
            }
            url = `${baseUrl}/chat/completions`;
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
            body = {
                model: settings.modelName,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: 0.8,
                max_tokens: 8192
            };
        }

        // 指数退避重试
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
            try {
                radioMonitor.updateStatus('WRITER', 'BUSY', `Calling AI (attempt ${attempt + 1})...`);

                const response = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, method: 'POST', headers, body })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API Error ${response.status}: ${errorText.slice(0, 100)}`);
                }

                const data = await response.json();

                if (settings.apiType === 'openai') {
                    return data.choices?.[0]?.message?.content || '';
                } else {
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                }
            } catch (error) {
                lastError = error as Error;
                radioMonitor.log('WRITER', `API call failed (attempt ${attempt + 1}): ${error}`, 'warn');

                if (attempt < MAX_API_RETRIES - 1) {
                    // 指数退避: 1s, 2s, 4s
                    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                    radioMonitor.log('WRITER', `Retrying in ${delay}ms...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('API call failed after retries');
    }

    /**
     * 解析工具调用 - 支持嵌套 JSON
     */
    private parseToolCall(response: string): { name: string; args: Record<string, unknown> } | null {
        // 尝试找到 {"tool": ...} 结构
        const toolIndex = response.indexOf('"tool"');
        if (toolIndex === -1) return null;

        // 找到包含 tool 的 JSON 对象的起始位置
        const startIndex = response.lastIndexOf('{', toolIndex);
        if (startIndex === -1) return null;

        // 使用括号计数找到完整的 JSON 对象
        let braceCount = 0;
        let endIndex = startIndex;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < response.length; i++) {
            const char = response[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
        }

        if (braceCount !== 0) return null;

        const jsonStr = response.slice(startIndex, endIndex);

        try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.tool && parsed.args) {
                return {
                    name: parsed.tool,
                    args: parsed.args
                };
            }
        } catch {
            // JSON 解析失败
        }

        return null;
    }


    /**
     * 获取时段描述
     */
    private getTimeContext(): string {
        const now = new Date();
        const hour = now.getHours();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

        let period = '';
        let mood = '';
        let hosts = '';

        if (hour >= 6 && hour < 9) {
            period = '早间';
            mood = '元气满满，轻快活泼';
            hosts = '早安主播';
        } else if (hour >= 9 && hour < 12) {
            period = '上午';
            mood = '温馨舒适，适合工作';
            hosts = '日间主播';
        } else if (hour >= 12 && hour < 14) {
            period = '午间';
            mood = '轻松惬意，午休时光';
            hosts = '午间主播';
        } else if (hour >= 14 && hour < 18) {
            period = '下午';
            mood = '慵懒舒适，下午茶时光';
            hosts = '午后主播';
        } else if (hour >= 18 && hour < 21) {
            period = '傍晚';
            mood = '温情脉脉，归家时刻';
            hosts = '晚间主播';
        } else if (hour >= 21 && hour < 24) {
            period = '深夜';
            mood = '静谧温柔，夜猫子时光';
            hosts = '深夜主播';
        } else {
            period = '凌晨';
            mood = '梦幻朦胧，失眠者的陪伴';
            hosts = '凌晨主播';
        }

        return `## 当前时间
- 时间: ${dateStr} ${timeStr}
- 时段: ${period}频道
- 氛围: ${mood}
- 主持风格参考: ${hosts}

请根据当前时段生成合适的节目内容和氛围。`;
    }


    /**
     * 解析 AI 响应 - 委托给 response-parser 模块
     */
    private parseResponse(response: string): ShowTimeline {
        return parseTimelineResponse(response);
    }

    /**
     * 默认时间线（备选） - 简单通用版本
     */
    private getDefaultTimeline(): ShowTimeline {
        const hour = new Date().getHours();
        const isNight = hour >= 21 || hour < 6;
        const musicQuery = isNight ? 'lofi chill' : 'relaxing acoustic';

        return {
            id: `default-${Date.now()}`,
            title: '电台时光',
            estimatedDuration: 90,
            blocks: [
                {
                    type: 'talk',
                    id: 'default-talk-1',
                    scripts: [
                        {
                            speaker: 'host1' as const,
                            text: '欢迎收听，让我们用音乐陪伴这段时光。',
                            mood: 'warm'
                        }
                    ]
                },
                {
                    type: 'music',
                    id: 'default-music-1',
                    action: 'play',
                    search: musicQuery,
                    duration: 60,
                    intro: {
                        speaker: 'host1',
                        text: '先来听一段轻松的音乐。',
                        mood: 'warm'
                    }
                }
            ]
        };
    }

    /**
     * 规范化 endpoint
     */
    private normalizeEndpoint(endpoint: string): string {
        const base = endpoint?.trim() || 'https://generativelanguage.googleapis.com';
        let url = base.replace(/\/$/, '');
        if (!url.endsWith('/v1') && !url.endsWith('/v1beta')) {
            url = `${url}/v1beta`; // 默认使用 v1beta 以支持最新模型
        }
        return url;
    }
}

// 单例导出
export const writerAgent = new WriterAgent();
