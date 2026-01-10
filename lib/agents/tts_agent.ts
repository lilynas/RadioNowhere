/**
 * TTS Agent - Gemini Flash Lite TTS 语音合成
 * 管理语音生成队列，自动重试失败请求
 */

import { getSettings } from '../settings_store';
import { buildVertexUrl, apiFetch } from '../ai_service';
import {
    TTSRequest,
    TTSResult,
    VOICE_PROFILES,
    SpeakerId,
    MoodType
} from '../types/radio_types';
import { radioMonitor } from '../radio_monitor';
import { getMicrosoftFullVoiceName } from '../voice_provider';

// ================== Constants ==================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ================== Style Prompt Builder ==================

/**
 * 构建 TTS 风格提示
 */
export function buildStylePrompt(
    speaker: SpeakerId,
    mood?: MoodType,
    customStyle?: string
): string {
    const profile = VOICE_PROFILES[speaker];

    const moodDescriptions: Record<MoodType, string> = {
        cheerful: '开朗愉快，带着微笑的语气',
        calm: '平静舒缓，让人感到放松',
        excited: '兴奋激动，充满热情',
        serious: '严肃认真，专业可信',
        warm: '温暖亲切，像老朋友一样',
        playful: '俏皮活泼，带点调侃',
        melancholy: '略带忧郁，深情款款',
        mysterious: '神秘莫测，引人入胜'
    };

    let prompt = `# AUDIO PROFILE: ${speaker === 'host1' ? '阿静' : speaker === 'host2' ? '小北' : speaker}
## ${profile.description}

### DIRECTOR'S NOTES
Style: ${profile.style}`;

    if (mood) {
        prompt += `\nMood: ${moodDescriptions[mood]}`;
    }

    if (customStyle) {
        prompt += `\nSpecial Instructions: ${customStyle}`;
    }

    prompt += `\nLanguage: 中文普通话，自然流畅
Pace: 适中，像电台主持人一样`;

    return prompt;
}

// ================== TTS Agent Class ==================

import { Cast, CastMember } from '../cast_system';

const MAX_CONCURRENT = 5; // 最大并发数

export class TTSAgent {
    private queue: TTSRequest[] = [];
    private cache: Map<string, ArrayBuffer> = new Map();
    private activeCast: Cast | null = null;
    private activeRequests = 0; // 当前并发数
    private waitingQueue: Array<() => void> = []; // 等待队列
    private abortController: AbortController | null = null; // 用于中止请求
    private isAborted = false; // 中止标志

    /**
     * 获取并发槽位（最多 5 个并发）
     */
    private async acquireSlot(): Promise<void> {
        if (this.activeRequests < MAX_CONCURRENT) {
            this.activeRequests++;
            return;
        }
        // 排队等待
        return new Promise(resolve => {
            this.waitingQueue.push(resolve);
        });
    }

    /**
     * 释放并发槽位
     */
    private releaseSlot(): void {
        if (this.waitingQueue.length > 0) {
            // 唤醒下一个等待的请求
            const next = this.waitingQueue.shift();
            next?.();
        } else {
            this.activeRequests--;
        }
    }

    /**
     * 设置当前演员阵容
     */
    setActiveCast(cast: Cast): void {
        this.activeCast = cast;
    }

    /**
     * 中止所有进行中的请求
     */
    abort(): void {
        this.isAborted = true;
        // 中止正在进行的 fetch 请求
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // 清空等待队列
        this.waitingQueue.forEach(resolve => resolve());
        this.waitingQueue = [];
        this.activeRequests = 0;
        // 重置状态
        radioMonitor.updateStatus('TTS', 'IDLE', 'Aborted');
    }

    /**
     * 重置中止状态（启动新会话时调用）
     */
    reset(): void {
        this.isAborted = false;
        this.abortController = null;
        this.waitingQueue = [];
        this.activeRequests = 0;
    }

    /**
     * 根据 speaker ID 获取音色
     */
    private getVoiceForSpeaker(speaker: SpeakerId | string): { voiceName: string; description: string } {
        // 1. 先从当前演员阵容查找
        if (this.activeCast) {
            const member = this.activeCast.members.find(m => m.roleId === speaker);
            if (member) {
                return {
                    voiceName: member.voiceName,
                    description: `${member.roleName}: ${member.personality}`
                };
            }
        }

        // 2. 回退到预设配置
        const profile = VOICE_PROFILES[speaker as SpeakerId];
        if (profile) {
            return {
                voiceName: profile.voiceName,
                description: profile.description
            };
        }

        // 3. 默认音色
        return {
            voiceName: 'Aoede',
            description: '默认音色'
        };
    }

    /**
     * 添加 TTS 请求到队列
     */
    async addToQueue(request: TTSRequest): Promise<TTSResult> {
        // 检查缓存
        const cacheKey = this.getCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            radioMonitor.log('TTS', `Cache Hit: ${request.text.slice(0, 20)}...`, 'trace');
            return {
                id: request.id,
                success: true,
                audioData: cached
            };
        }

        // 记录队列状态
        radioMonitor.updateStatus('TTS', 'BUSY', `Processing: ${request.text.slice(0, 15)}...`);

        // 直接处理请求（队列仅用于状态跟踪）
        return this.processRequest(request);
    }

    /**
     * 生成 TTS 音频
     */
    async generateSpeech(
        text: string,
        speaker: SpeakerId | string,
        options?: {
            mood?: MoodType;
            customStyle?: string;
            priority?: number;
            voiceName?: string;  // AI 指定的音色名（优先使用）
        }
    ): Promise<TTSResult> {
        // 优先使用 AI 指定的音色名，否则通过 speaker 映射
        const voiceInfo = this.getVoiceForSpeaker(speaker);
        const finalVoiceName = options?.voiceName || voiceInfo.voiceName;

        // 构建风格提示
        let stylePrompt = `# AUDIO PROFILE: ${speaker}\n## ${voiceInfo.description}\n`;

        if (options?.mood) {
            const moodDescriptions: Record<MoodType, string> = {
                cheerful: '开朗愉快，带着微笑的语气',
                calm: '平静舒缓，让人感到放松',
                excited: '兴奋激动，充满热情',
                serious: '严肃认真，专业可信',
                warm: '温暖亲切，像老朋友一样',
                playful: '俏皮活泼，带点调侃',
                melancholy: '略带忧郁，深情款款',
                mysterious: '神秘莫测，引人入胜'
            };
            stylePrompt += `\nMood: ${moodDescriptions[options.mood]}`;
        }

        if (options?.customStyle) {
            stylePrompt += `\nSpecial Instructions: ${options.customStyle}`;
        }

        stylePrompt += `\nLanguage: 中文普通话，自然流畅\nPace: 适中，像电台主持人一样`;

        const request: TTSRequest = {
            id: `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            voiceName: finalVoiceName,
            stylePrompt,
            priority: options?.priority || 5
        };

        return this.addToQueue(request);
    }

    /**
     * 处理单个请求（最多 5 个并发）
     */
    private async processRequest(request: TTSRequest): Promise<TTSResult> {
        const retryCount = request.retryCount || 0;

        // 获取并发槽位（超过 5 个则排队等待）
        await this.acquireSlot();

        try {
            radioMonitor.updateStatus('TTS', 'BUSY', `Generating: ${request.text.slice(0, 15)}...`);
            const audioData = await this.callTTSApi(request);

            // 缓存结果
            const cacheKey = this.getCacheKey(request);
            this.cache.set(cacheKey, audioData);

            radioMonitor.updateStatus('TTS', 'READY', `Generated: ${request.text.slice(0, 10)}`);
            // 成功：释放槽位并返回
            this.releaseSlot();
            return {
                id: request.id,
                success: true,
                audioData
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`TTS Error (attempt ${retryCount + 1}):`, errorMsg);

            // 检查是否是 429 限流错误
            if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
                // 提取 retry-after 时间，默认 45 秒
                const retryMatch = errorMsg.match(/retry in (\d+)/i);
                const retryDelay = retryMatch ? parseInt(retryMatch[1]) * 1000 + 2000 : 47000;
                console.log(`[TTS] Rate limited, retrying in ${retryDelay}ms...`);
                // 释放槽位再重试
                this.releaseSlot();
                await this.delay(retryDelay);
                request.retryCount = retryCount + 1;
                return this.processRequest(request);
            }

            if (retryCount < MAX_RETRIES) {
                // 普通重试：释放槽位再重试
                radioMonitor.updateStatus('TTS', 'BUSY', `Retrying (attempt ${retryCount + 1})...`);
                this.releaseSlot();
                await this.delay(RETRY_DELAY_MS * (retryCount + 1));
                request.retryCount = retryCount + 1;
                return this.processRequest(request);
            }

            // 失败时释放槽位
            this.releaseSlot();
            return {
                id: request.id,
                success: false,
                error: `TTS 生成失败: ${errorMsg}`
            };
        }
    }

    /**
     * 调用 TTS API（根据 ttsProvider 分发）
     */
    private async callTTSApi(request: TTSRequest): Promise<ArrayBuffer> {
        const settings = getSettings();

        if (settings.ttsProvider === 'microsoft') {
            return this.callMicrosoftTTSApi(request.text, request.voiceName);
        }

        // Gemini TTS 调用逻辑
        return this.callGeminiTTSApi(request);
    }

    /**
     * 调用 Microsoft TTS API
     * API 格式: GET /api/text-to-speech?voice=...&volume=...&rate=...&pitch=...&text=...
     * Token: 优先使用自定义 token，留空则使用内置 token
     */
    private async callMicrosoftTTSApi(text: string, voiceName: string): Promise<ArrayBuffer> {
        const settings = getSettings();

        const endpoint = (settings.msTtsEndpoint || 'https://tts.cjack.top').replace(/\/$/, '');

        // 获取 Microsoft 音色完整名称（支持直接指定或映射）
        const msVoice = this.getMicrosoftVoiceName(voiceName);
        const voice = encodeURIComponent(msVoice);

        // 过滤掉舞台指令和描述文本 (括号内容)
        const cleanText = this.filterStageDirections(text);
        if (!cleanText.trim()) {
            // 如果过滤后为空，返回静音
            throw new Error('No text to speak after filtering stage directions');
        }
        const encodedText = encodeURIComponent(cleanText);

        const url = `${endpoint}/api/text-to-speech?` +
            `voice=${voice}&volume=100&rate=0&pitch=0&text=${encodedText}`;

        // 优先使用自定义 token，留空则使用内置 token
        const token = settings.msTtsAuthKey || 'tetr5354';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`
        };

        radioMonitor.updateStatus('TTS', 'BUSY', `Microsoft TTS: ${cleanText.slice(0, 15)}...`);
        radioMonitor.log('TTS', `Microsoft TTS [${msVoice.match(/\(([^)]+)\)/)?.[1] || 'Unknown'}]: ${cleanText.slice(0, 20)}...`, 'info');

        // 创建 AbortController 用于中止请求
        this.abortController = new AbortController();
        const response = await fetch(url, { headers, signal: this.abortController.signal });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Microsoft TTS Error: ${response.status} - ${errorText}`);
        }

        return response.arrayBuffer();
    }

    /**
     * 过滤舞台指令和描述文本
     * 移除 (音乐声渐弱)、【旁白】 等内容
     */
    private filterStageDirections(text: string): string {
        return text
            // 移除中文括号内容 (舞台指令)
            .replace(/（[^）]*）/g, '')
            // 移除英文括号内容
            .replace(/\([^)]*\)/g, '')
            // 移除方括号内容 [旁白]
            .replace(/\[[^\]]*\]/g, '')
            // 移除中文方括号内容 【旁白】
            .replace(/【[^】]*】/g, '')
            // 清理多余空白
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 获取 Microsoft TTS 完整音色名称
     * 直接使用 AI 选择的微软音色名
     */
    private getMicrosoftVoiceName(voiceName: string): string {
        // 1. 如果已经是完整的微软格式，直接返回
        if (voiceName.includes('Microsoft Server Speech')) {
            return voiceName;
        }

        // 2. 使用 voice_provider 查找微软音色完整名称
        return getMicrosoftFullVoiceName(voiceName);
    }

    /**
     * 调用 Gemini TTS API
     */
    private async callGeminiTTSApi(request: TTSRequest): Promise<ArrayBuffer> {
        const settings = getSettings();

        // 使用 TTS 专用配置，如果没有设置则使用主配置
        const ttsApiKey = settings.ttsApiKey || settings.apiKey;
        const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';

        // 自定义 Endpoint 或使用官方
        const baseEndpoint = settings.ttsEndpoint?.trim()
            || 'https://generativelanguage.googleapis.com';
        const normalizedEndpoint = baseEndpoint.replace(/\/$/, '');

        // 构建完整的 TTS 提示
        const fullPrompt = `${request.stylePrompt}

#### TRANSCRIPT
${request.text}`;

        const body = {
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: request.voiceName
                        }
                    }
                }
            }
        };

        let response: Response;

        if (settings.apiType === 'vertexai' && settings.ttsUseVertex) {
            // 使用 Vertex AI 配置
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            const apiUrl = buildVertexUrl(
                settings.gcpProject,
                settings.gcpLocation,
                ttsModel,
                'generateContent'
            ) + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (!isGcpApiKey) {
                headers['Authorization'] = `Bearer ${settings.apiKey}`;
            }

            response = await apiFetch(apiUrl, {
                method: 'POST',
                headers,
                body
            });
        } else {
            // 使用 Gemini Native (AI Studio) 配置
            const apiUrl = `${normalizedEndpoint}/v1beta/models/${ttsModel}:generateContent?key=${ttsApiKey}`;
            response = await apiFetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // 提取音频数据
        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) {
            throw new Error('No audio data in response');
        }

        // Base64 转 ArrayBuffer
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer;
    }



    /**
     * 获取缓存键
     */
    private getCacheKey(request: TTSRequest): string {
        return `${request.text}|${request.voiceName}|${request.stylePrompt}`;
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 获取队列状态
     */
    getQueueStatus(): { pending: number; cacheSize: number } {
        return {
            pending: this.queue.length,
            cacheSize: this.cache.size
        };
    }
}

// 单例导出
export const ttsAgent = new TTSAgent();
