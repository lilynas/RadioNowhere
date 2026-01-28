/**
 * Writer Agent - 编剧 Agent (ReAct 版本)
 * 具备工具调用能力，可搜索音乐、获取歌词、自我校验
 */

import { getSettings } from '@shared/services/storage-service/settings';
import { RADIO, AGENT } from '@shared/utils/constants';
import {
    ShowTimeline,
    TimelineBlock,
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
        // 1. 选择节目类型和演员阵容
        const selectedShowType = showType || castDirector.randomShowType();
        this.currentCast = castDirector.selectCast(selectedShowType);

        radioMonitor.updateStatus('WRITER', 'BUSY', `ReAct Loop: ${selectedShowType}`);
        radioMonitor.log('WRITER', `Starting ReAct loop for ${selectedShowType}`);

        // 2. 构建 ReAct 系统提示 - 传入选定的节目类型
        const systemPrompt = this.buildReActSystemPrompt(duration, theme, userRequest, selectedShowType);

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

        radioMonitor.updateStatus('WRITER', 'IDLE', 'Generation complete');
        return finalTimeline;
    }

    /**
     * 构建 ReAct 系统提示
     */
    private buildReActSystemPrompt(duration: number, theme?: string, userRequest?: string, selectedShowType?: ShowType): string {
        const historyContext = getHistoryContext();
        const toolsDesc = getToolsDescription();

        // 获取禁止列表
        const prohibitedArtists = getProhibitedArtists();
        const prohibitionContext = prohibitedArtists.length > 0
            ? `## ⚠️ 禁止使用的歌手（近24小时已使用）\n${prohibitedArtists.map(a => `- ${a}`).join('\n')}\n\n**注意：如果你选择了这些歌手，会导致节目被拒绝！**\n\n`
            : '';

        // 获取演员阵容描述
        const castDescription = this.currentCast
            ? castDirector.getCastDescription(this.currentCast)
            : '';

        // 根据是否指定节目类型生成不同的提示
        const showTypeInstruction = selectedShowType
            ? this.getSpecificShowTypeInstruction(selectedShowType, duration)
            : getRadioSetting();

        return `${showTypeInstruction}

${castDescription}

${this.getTimeContext()}

## 🎵 **音乐多样性要求（核心）**

你必须在这个节目中展现**真正的音乐多样性**。这不仅仅是避免重复，而是创意和品味的体现。

### 多样性原则

**1. 语境驱动的歌手选择**
   根据节目时段、主题、情绪来选择歌手风格和文化背景。同一个主题可以有完全不同的音乐表达：
   
   - 破晓时刻 → 民谣/独立 (朴树、赵雷) OR 古典/器乐 OR 爵士/舒缓
   - 午间陪伴 → 流行/轻松 (周杰伦) OR 乡村/民族 OR 电子/舒适
   - 深夜沉思 → 摇滚/实验 (五月天) OR 爵士/蓝调 OR 民谣/古风

**2. 禁止列表遵守（强制）**
   你有整个人类音乐库可选，为什么要在24小时内重复同一个歌手？

${prohibitionContext}

**3. 跨越多个维度的多样化**
   - 语言：中文 ↔ 英文 ↔ 日文 ↔ 其他
   - 年代：经典 ↔ 80年代 ↔ 2000年代 ↔ 新兴（2020+）
   - 流派：民谣 ↔ 摇滚 ↔ 爵士 ↔ 电子 ↔ 古典 ↔ 民族
   - 地域：亚洲 ↔ 西方 ↔ 其他地域
   - 知名度：超级巨星 ↔ 小众创作者

**4. 避免的选歌模式**（如果出现会被拒绝）
   ❌ 单节目中3次以上同一歌手
   ❌ 连续选择同一风格歌手（民谣 → 民谣 → 民谣）
   ❌ 只选"安全的热门艺人"
   ❌ 忽视禁止列表
   ❌ 完全无视节目主题乱选

**5. 期望看到的多样性模式**
   ✅ 节目1: 朴树(民谣/中文) + The Weeknd(电子/英文) + 五月天(摇滚/中文) + Norah Jones(爵士/英文)
   ✅ 节目2: 薛之谦(流行/中文) + 新裤子(摇滚/中文) + 李荣浩(Rnb/中文) + Bon Iver(民谣/英文)
   ✅ 节目3: 宇宙人(独立/中文) + 莫西子诗(民族/中文) + Daughter(暗民谣/英文) + 小米粒(古风/中文)

### 多样性检查机制

生成节目后，你必须调用 \`check_artist_diversity\` 工具来自我评估。
- **得分≥70分**：✓ 通过，节目保留
- **得分<70分**：✗ 失败，需要重新选择歌手

## 你的任务
生成一段约 ${duration} 秒的电台节目。

## 可用工具
${toolsDesc}

## 工具调用格式
使用以下 JSON 格式调用工具：
\`\`\`json
{"tool": "工具名", "args": {"参数名": "值"}}
\`\`\`

## 工作流程
1. 先用 check_duplicate 确认你的节目概念不与近期雷同
2. 用 search_music 搜索合适的歌曲
3. (可选) 用 get_lyrics 获取歌词
4. 编写完整脚本后，**必须**用 check_artist_diversity 检查多样性
5. 多样性达标后，用 submit_show 提交

## ⚠️ 重要：节目结构要求
- 每个节目**必须**以一首过渡音乐结尾（作为节目之间的衔接）
- 即使是脱口秀节目，结尾也要有一首歌曲
- 结尾音乐时长建议 30-60 秒

${historyContext}

${theme ? `## 主题要求\n${theme}\n` : ''}
${userRequest ? `## 听众来信\n"${userRequest}"\n请在节目中回应这封来信。\n` : ''}

## 输出格式
最终提交时，timeline_json 必须是以下格式：
${this.getOutputFormatExample()}

${getVoiceListForPrompt()}

开始工作！首先检查节目概念是否与近期雷同。`;
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
     * 获取特定节目类型的指令
     * 当用户选择了特定电台类型时，强制AI生成该类型内容
     */
    private getSpecificShowTypeInstruction(showType: ShowType, duration: number = 480): string {
        const showTypeNames: Record<ShowType, { name: string; emoji: string; description: string }> = {
            news: { name: '新闻时事', emoji: '📰', description: '播报新闻要点、深度分析时事热点、社会现象评论' },
            talk: { name: '脱口秀', emoji: '💬', description: '两位主持人轻松聊天，分享生活趣事、热门话题、个人见解' },
            history: { name: '历史风云', emoji: '📚', description: '讲述历史故事、人物传记、朝代兴衰，带听众穿越时空' },
            science: { name: '科普百科', emoji: '🔬', description: '有趣的科学知识、自然奥秘、生活冷知识，深入浅出' },
            mystery: { name: '奇闻异事', emoji: '👻', description: '都市传说、未解之谜、悬疑故事（营造悬疑氛围，但不要过于恐怖）' },
            interview: { name: '访谈对话', emoji: '🎤', description: '模拟采访名人、专家或虚构人物，进行深度对话' },
            nighttalk: { name: '深夜心声', emoji: '🌙', description: '情感话题、人生感悟、温暖治愈，适合静谧时刻倾听' },
            music: { name: '音乐专题', emoji: '🎵', description: '介绍某个曲风、歌手或音乐背后的故事，以音乐鉴赏为主' },
            entertainment: { name: '娱乐互动', emoji: '🎪', description: '有趣的话题讨论、游戏互动、轻松搞笑' },
            gaming: { name: '游戏二次元', emoji: '🎮', description: '游戏资讯、动漫话题、ACG文化讨论' },
            drama: { name: '广播剧', emoji: '🎭', description: '有声小说、广播剧，多角色演绎故事' },
            story: { name: '故事电台', emoji: '📖', description: '讲故事、读信，娓娓道来的叙事节目' },
        };

        const info = showTypeNames[showType] || { name: showType, emoji: '📻', description: '' };

        // 根据时长动态计算内容建议
        const getDurationGuidance = (dur: number) => {
            const minutes = Math.floor(dur / 60);
            if (dur <= 360) { // ≤6分钟
                return {
                    talk: '60-70%',
                    music: '30-40%',
                    musicCount: '2-3首',
                    blockCount: '4-6个',
                    talkDepth: '简短精炼，每个话题1-2分钟'
                };
            } else if (dur <= 600) { // 6-10分钟
                return {
                    talk: '70-75%',
                    music: '25-30%',
                    musicCount: '3-4首',
                    blockCount: '6-10个',
                    talkDepth: '适度展开，每个话题2-3分钟'
                };
            } else if (dur <= 1200) { // 10-20分钟
                return {
                    talk: '70-75%',
                    music: '25-30%',
                    musicCount: '4-6首',
                    blockCount: '10-15个',
                    talkDepth: '深入讨论，每个话题3-5分钟'
                };
            } else if (dur <= 1800) { // 20-30分钟
                return {
                    talk: '70-75%',
                    music: '25-30%',
                    musicCount: '6-8首',
                    blockCount: '15-20个',
                    talkDepth: '多话题深度展开，主题清晰分段'
                };
            } else { // >30分钟
                return {
                    talk: '65-70%',
                    music: '30-35%',
                    musicCount: '8-12首',
                    blockCount: '20-30个',
                    talkDepth: '长篇叙事，包含多个完整章节'
                };
            }
        };

        const guidance = getDurationGuidance(duration);
        const minutes = Math.floor(duration / 60);

        return `你是 **${RADIO.NAME} ${RADIO.FREQUENCY}** 网络电台的内容创作者。

## 📻 电台身份
- 电台名称：**${RADIO.NAME}** (${RADIO.SLOGAN})
- 频率：**${RADIO.FREQUENCY}**
- 可以在节目中自然地提及电台名称

## 🎯 **本期节目类型：${info.emoji} ${info.name}**

**⚠️ 重要：听众已选择收听「${info.name}」类型的节目，你必须严格按照这个类型来生成内容！**

### 节目要求
${info.description}

### 本期节目时长：${minutes}分钟 (${duration}秒)

### 内容比例要求（针对本期时长）
- **对话/讲述内容**：占节目的 ${guidance.talk}
- **音乐穿插**：占节目的 ${guidance.music}，建议${guidance.musicCount}
- **内容深度**：${guidance.talkDepth}
- **结构建议**：共${guidance.blockCount} talk/music块
- 音乐是辅助，不是主体！节目的核心是「${info.name}」的内容

### 🎵 音乐时长规范（强制执行）
- **每首音乐的 \`duration\` 字段必须设置**
- 单首音乐推荐时长：30-90秒
- 特殊情况（如节目结尾）可适当延长至120秒
- **禁止**不设置duration或设置过大值（>180秒）
- 音乐总时长应控制在 ${Math.floor(duration * 0.25)}-${Math.floor(duration * 0.35)} 秒范围内

### 🚫 禁止事项
- ❌ 不要生成其他类型的节目
- ❌ 不要把节目变成纯音乐节目
- ❌ 不要偏离「${info.name}」的主题

### ✅ 必须做到
- ✅ 节目主题必须是「${info.name}」相关
- ✅ 主持人对话/讲述内容要丰富、有深度
- ✅ 每个 talk 块至少要有 5-10 句有实质内容的台词
- ✅ 音乐选择要符合节目氛围

## 🚨 重要原则
1. **内容为王**：对话和讲述才是节目核心，音乐只是点缀
2. **深度展开**：挑一个具体话题深入讨论，不要泛泛而谈
3. **真实感**：主持人要有真实的对话感，不要念稿子味
`;
    }

    /**
     * 构建生成 Prompt
     */
    private buildPrompt(duration: number, theme?: string, userRequest?: string): string {
        const timeContext = this.getTimeContext();
        const castDescription = this.currentCast
            ? castDirector.getCastDescription(this.currentCast)
            : '';

        // 动态生成 speaker 示例
        let prompt = `${getRadioSetting()}

${timeContext}

${castDescription}

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
          "voiceName": "音色ID",
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
      "duration": 240,
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

### speaker (主持人ID)
你可以自由定义主持人的名字和性格！只需使用以下ID：
- "host1": 主持人1（女性）
- "host2": 主持人2（男性）
- "guest": 嘉宾
- "news": 新闻播报

请在节目开头通过台词自然地介绍主持人，如："大家好，我是xxx，今晚和我一起的是xxx..."

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
    - 可以让音乐完整播放（不设 duration，或 duration: 240-360 秒，即 4-6 分钟）
    - 优先让音乐完整播放，只有在特殊场景（如介绍多首歌曲）时才缩短时长
    - 也可以在播放过程中主持人开始说话（通过 backgroundMusic.action: "continue" + volume: 0.15）
3. **过渡自然**：音乐 fade_out 后主持人要有承接的话语
4. **内容深入**：话题展开要详细，不要蜻蜓点水
5. **情感丰富**：台词要有感情起伏，设置合适的 mood 和 voiceStyle
6. **节目节奏**：可以是 [对话] → [音乐完整播放] → [评论] → [背景音乐+聊天]

${getVoiceListForPrompt()}
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
        radioMonitor.updateStatus('WRITER', 'BUSY', 'Calling AI API...');

        let url: string;
        let body: unknown;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (settings.apiType === 'vertexai') {
            // Vertex AI 格式
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            url = `https://${settings.gcpLocation}-aiplatform.googleapis.com/v1/projects/${settings.gcpProject}/locations/${settings.gcpLocation}/publishers/google/models/${settings.modelName}:generateContent`;

            if (isGcpApiKey) {
                url += `?key=${settings.apiKey}`;
            } else {
                headers['Authorization'] = `Bearer ${settings.apiKey}`;
            }

            body = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
            body = {
                contents: [{ parts: [{ text: prompt }] }],
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
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8,
                max_tokens: 8192
            };
        }

        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                method: 'POST',
                headers,
                body
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`AI API Error: ${response.status} - ${errorText}`);
            throw new Error(`AI API Error: ${response.status}`);
        }

        const data = await response.json();

        // 根据 API 类型解析响应
        if (settings.apiType === 'openai') {
            return data.choices?.[0]?.message?.content || '';
        } else {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
    }

    /**
     * 解析 AI 响应 - 委托给 response-parser 模块
     */
    private parseResponse(response: string): ShowTimeline {
        return parseTimelineResponse(response);
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
