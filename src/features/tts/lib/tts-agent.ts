/**
 * TTS Agent - 语音合成代理
 * 管理语音生成队列，自动重试失败请求
 * 
 * 重构版本：使用模块化拆分
 */

import { getSettings } from '@shared/services/storage-service/settings';
import {
    TTSRequest,
    TTSResult,
    VOICE_PROFILES,
    SpeakerId,
    MoodType
} from '@shared/types/radio-core';
import { radioMonitor } from '@shared/services/monitor-service';

// ================== 导入模块 ==================
import { buildStylePrompt, isStandardSpeaker } from './style-prompt-builder';
import * as GeminiTts from './gemini-tts';
import * as MicrosoftTts from './microsoft-tts';
import { Cast, CastMember } from '@features/content/lib/cast-system';

// ================== Constants ==================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_CONCURRENT = 5;

// ================== Re-export buildStylePrompt ==================
export { buildStylePrompt } from './style-prompt-builder';

// ================== TTS Agent Class ==================

export class TTSAgent {
    private queue: TTSRequest[] = [];
    private cache: Map<string, ArrayBuffer> = new Map();
    private activeCast: Cast | null = null;
    private activeRequests = 0;
    private waitingQueue: Array<() => void> = [];
    private abortController: AbortController | null = null;
    private isAborted = false;

    // ================== Context for modules ==================
    private ttsContext: GeminiTts.GeminiTtsContext & MicrosoftTts.MicrosoftTtsContext = {
        abortController: null,
        setAbortController: (controller) => {
            this.abortController = controller;
        }
    };

    // ================== Concurrency Control ==================

    private async acquireSlot(): Promise<void> {
        if (this.activeRequests < MAX_CONCURRENT) {
            this.activeRequests++;
            return;
        }
        await new Promise<void>(resolve => {
            this.waitingQueue.push(resolve);
        });
        this.activeRequests++;
    }

    private releaseSlot(): void {
        this.activeRequests--;
        if (this.waitingQueue.length > 0 && this.activeRequests < MAX_CONCURRENT) {
            const next = this.waitingQueue.shift();
            next?.();
        }
    }

    // ================== Cast Management ==================

    setActiveCast(cast: Cast): void {
        this.activeCast = cast;
        radioMonitor.log('TTS', `Active cast set: ${cast.members.map(m => m.roleName).join(', ')}`, 'info');
    }

    // ================== Abort Control ==================

    abort(): void {
        this.isAborted = true;
        this.queue = [];
        this.waitingQueue = [];
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        radioMonitor.log('TTS', 'All TTS requests aborted', 'warn');
    }

    reset(): void {
        this.isAborted = false;
        this.abortController = null;
        radioMonitor.log('TTS', 'TTS Agent reset', 'info');
    }

    // ================== Voice Resolution ==================

    private getVoiceForSpeaker(speaker: SpeakerId | string): { voiceName: string; description: string } {
        // 1. 优先从当前演员阵容获取
        if (this.activeCast) {
            const member = this.activeCast.members.find(m => m.roleId === speaker);
            if (member) {
                return {
                    voiceName: member.voiceName,
                    description: `${member.roleName} (${member.personality})`
                };
            }
        }

        // 2. 如果是标准角色，使用预设
        if (isStandardSpeaker(speaker)) {
            const profile = VOICE_PROFILES[speaker];
            if (profile) {
                return {
                    voiceName: profile.voiceName,
                    description: profile.description
                };
            }
        }

        // 3. 默认音色
        return {
            voiceName: 'Aoede',
            description: 'Default voice'
        };
    }

    // ================== Main API ==================

    async addToQueue(request: TTSRequest): Promise<TTSResult> {
        // 检查缓存
        const cacheKey = this.getCacheKey(request);
        if (this.cache.has(cacheKey)) {
            return {
                id: request.id,
                success: true,
                audioData: this.cache.get(cacheKey)
            };
        }

        this.queue.push(request);
        return this.processRequest(request);
    }

    async generateSpeech(
        text: string,
        speaker: SpeakerId | string,
        options?: {
            mood?: MoodType;
            customStyle?: string;
            priority?: number;
            voiceName?: string;
        }
    ): Promise<TTSResult> {
        const voiceInfo = options?.voiceName
            ? { voiceName: options.voiceName, description: 'AI-specified' }
            : this.getVoiceForSpeaker(speaker);

        const speakerId = isStandardSpeaker(speaker) ? speaker : 'host1';
        const stylePrompt = buildStylePrompt(speakerId, options?.mood, options?.customStyle);

        const request: TTSRequest = {
            id: `tts-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            text,
            voiceName: voiceInfo.voiceName,
            stylePrompt,
            priority: options?.priority || 5
        };

        radioMonitor.updateStatus('TTS', 'BUSY', `Generating: ${text.slice(0, 20)}...`);
        return this.addToQueue(request);
    }

    // ================== Batched Speech ==================

    async generateBatchedSpeech(
        scripts: Array<{
            speaker: string;
            text: string;
            voiceName?: string;
            mood?: MoodType;
        }>
    ): Promise<TTSResult> {
        if (scripts.length === 0) {
            return { id: 'empty', success: false, error: 'No scripts provided' };
        }

        const settings = getSettings();
        if (settings.ttsProvider !== 'gemini') {
            return { id: 'not-gemini', success: false, error: 'Batched speech only supports Gemini' };
        }

        // 建立说话者到音色的映射
        const speakerMap = new Map<string, string>();
        for (const script of scripts) {
            if (!speakerMap.has(script.speaker)) {
                const voiceName = script.voiceName || this.getVoiceForSpeaker(script.speaker).voiceName;
                speakerMap.set(script.speaker, voiceName);
            }
        }

        const uniqueSpeakers = speakerMap.size;
        radioMonitor.log('TTS', `Batched TTS: ${scripts.length} lines, ${uniqueSpeakers} speaker(s)`, 'info');

        try {
            await this.acquireSlot();

            let audioData: ArrayBuffer;
            if (uniqueSpeakers === 1) {
                audioData = await GeminiTts.callGeminiSingleSpeakerBatchApi(scripts, speakerMap, this.ttsContext);
            } else {
                audioData = await GeminiTts.callGeminiMultiSpeakerBatchApi(scripts, speakerMap, this.ttsContext);
            }

            radioMonitor.updateStatus('TTS', 'READY', 'Batched TTS complete');
            return {
                id: `batch-${Date.now()}`,
                success: true,
                audioData
            };
        } catch (error) {
            radioMonitor.log('TTS', `Batched TTS error: ${error}`, 'error');
            return {
                id: `batch-error-${Date.now()}`,
                success: false,
                error: String(error)
            };
        } finally {
            this.releaseSlot();
        }
    }

    // ================== Request Processing ==================

    private async processRequest(request: TTSRequest): Promise<TTSResult> {
        if (this.isAborted) {
            return { id: request.id, success: false, error: 'Request aborted' };
        }

        await this.acquireSlot();

        let lastError: Error | null = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (this.isAborted) {
                this.releaseSlot();
                return { id: request.id, success: false, error: 'Request aborted' };
            }

            try {
                radioMonitor.updateStatus('TTS', 'BUSY', `Attempt ${attempt + 1}: ${request.text.slice(0, 20)}...`);
                const audioData = await this.callTTSApi(request);

                // 缓存结果
                const cacheKey = this.getCacheKey(request);
                this.cache.set(cacheKey, audioData);

                this.releaseSlot();
                radioMonitor.updateStatus('TTS', 'READY', 'Generation complete');

                return {
                    id: request.id,
                    success: true,
                    audioData
                };
            } catch (error) {
                lastError = error as Error;
                if ((error as Error).name === 'AbortError') {
                    this.releaseSlot();
                    return { id: request.id, success: false, error: 'Request aborted' };
                }
                radioMonitor.log('TTS', `Attempt ${attempt + 1} failed: ${error}`, 'warn');
                if (attempt < MAX_RETRIES - 1) {
                    await this.delay(RETRY_DELAY_MS * (attempt + 1));
                }
            }
        }

        this.releaseSlot();
        radioMonitor.updateStatus('TTS', 'ERROR', `Failed after ${MAX_RETRIES} attempts`);
        return {
            id: request.id,
            success: false,
            error: lastError?.message || 'Max retries exceeded'
        };
    }

    private async callTTSApi(request: TTSRequest): Promise<ArrayBuffer> {
        const settings = getSettings();

        if (settings.ttsProvider === 'microsoft') {
            return MicrosoftTts.callMicrosoftTTSApi(request.text, request.voiceName, this.ttsContext);
        }

        return GeminiTts.callGeminiTTSApi(request, this.ttsContext);
    }

    // ================== Utilities ==================

    private getCacheKey(request: TTSRequest): string {
        return `${request.voiceName}-${request.text}-${request.stylePrompt}`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearCache(): void {
        this.cache.clear();
        radioMonitor.log('TTS', 'Cache cleared', 'info');
    }

    getQueueStatus(): { pending: number; cacheSize: number } {
        return {
            pending: this.queue.length,
            cacheSize: this.cache.size
        };
    }
}

// 单例导出
export const ttsAgent = new TTSAgent();
