/**
 * Director Agent - 导演 Agent
 * 节目调度、音乐控制、时间线执行
 * 支持上下文记忆和双缓冲预加载
 */

import {
    ShowTimeline,
    TimelineBlock,
    TalkBlock,
    MusicBlock,
    MusicControlBlock,
    PlayerState
} from '../types/radio_types';
import { writerAgent } from './writer_agent';
import { ttsAgent } from './tts_agent';
import { audioMixer } from '../audio_mixer';
import { searchMusic, getMusicUrl, IGDMusicTrack } from '../gdmusic_service';
import { globalState } from '../global_state';

// ================== Types ==================

interface ExecutionContext {
    timeline: ShowTimeline;
    currentBlockIndex: number;
    isPaused: boolean;
    onStateChange?: (state: PlayerState) => void;
    onBlockStart?: (block: TimelineBlock, index: number) => void;
    onBlockEnd?: (block: TimelineBlock) => void;
    onError?: (error: Error, block?: TimelineBlock) => void;
    onTimelineReady?: (timeline: ShowTimeline) => void;
}

// ================== Director Agent Class ==================

export class DirectorAgent {
    private context: ExecutionContext | null = null;
    private isRunning = false;
    private preparedAudio: Map<string, ArrayBuffer> = new Map();
    private musicCache: Map<string, IGDMusicTrack> = new Map();

    // 双缓冲：下一段时间线预生成
    private nextTimeline: ShowTimeline | null = null;
    private isPreparingNext = false;

    /**
     * 启动电台节目
     */
    async startShow(options?: {
        theme?: string;
        userRequest?: string;
        onStateChange?: (state: PlayerState) => void;
        onBlockStart?: (block: TimelineBlock, index: number) => void;
        onBlockEnd?: (block: TimelineBlock) => void;
        onError?: (error: Error, block?: TimelineBlock) => void;
        onTimelineReady?: (timeline: ShowTimeline) => void;
    }): Promise<void> {
        if (this.isRunning) {
            console.warn('Show already running');
            return;
        }

        this.isRunning = true;

        // 1. 生成节目时间线 (300秒 = 5分钟)
        const timeline = await writerAgent.generateTimeline(
            300,
            options?.theme,
            options?.userRequest
        );

        console.log('Generated timeline:', timeline);

        // 通知 timeline 准备完成
        options?.onTimelineReady?.(timeline);

        // 2. 初始化执行上下文
        this.context = {
            timeline,
            currentBlockIndex: 0,
            isPaused: false,
            onStateChange: options?.onStateChange,
            onBlockStart: options?.onBlockStart,
            onBlockEnd: options?.onBlockEnd,
            onError: options?.onError,
            onTimelineReady: options?.onTimelineReady
        };

        // 3. 预处理前几个块
        await this.prepareBlocks(0, 3);

        // 4. 开始执行
        await this.executeTimeline();
    }

    /**
     * 停止节目
     */
    stopShow(): void {
        this.isRunning = false;
        audioMixer.stopAll();
        this.context = null;
        this.preparedAudio.clear();
        this.nextTimeline = null;
        this.isPreparingNext = false;
        globalState.reset();
    }

    /**
     * 暂停节目
     */
    pauseShow(): void {
        if (this.context) {
            this.context.isPaused = true;
            audioMixer.pauseAll();
        }
    }

    /**
     * 继续节目
     */
    resumeShow(): void {
        if (this.context) {
            this.context.isPaused = false;
            audioMixer.resumeAll();
        }
    }

    /**
     * 预处理块（生成 TTS 和获取音乐）
     */
    private async prepareBlocks(startIndex: number, count: number): Promise<void> {
        if (!this.context) return;

        const { timeline } = this.context;
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);

        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];

            if (block.type === 'talk') {
                // 预生成所有台词的 TTS
                preparePromises.push(this.prepareTalkBlock(block));
            } else if (block.type === 'music') {
                // 预搜索音乐
                preparePromises.push(this.prepareMusicBlock(block));
            }
        }

        await Promise.all(preparePromises);
    }

    /**
     * 预处理说话块
     */
    private async prepareTalkBlock(block: TalkBlock): Promise<void> {
        for (const script of block.scripts) {
            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;

            if (this.preparedAudio.has(audioId)) continue;

            try {
                const result = await ttsAgent.generateSpeech(
                    script.text,
                    script.speaker,
                    {
                        mood: script.mood,
                        customStyle: script.voiceStyle,
                        priority: 8
                    }
                );

                if (result.success && result.audioData) {
                    this.preparedAudio.set(audioId, result.audioData);
                }
            } catch (error) {
                console.error('TTS preparation failed:', error);
            }
        }
    }

    /**
     * 预处理音乐块
     */
    private async prepareMusicBlock(block: MusicBlock): Promise<void> {
        if (this.musicCache.has(block.search)) return;

        try {
            const tracks = await searchMusic(block.search);
            if (tracks.length > 0) {
                this.musicCache.set(block.search, tracks[0]);
            }
        } catch (error) {
            console.error('Music search failed:', error);
        }
    }

    /**
     * 执行时间线
     */
    private async executeTimeline(): Promise<void> {
        if (!this.context) return;

        const { timeline } = this.context;

        while (this.isRunning && this.context.currentBlockIndex < timeline.blocks.length) {
            // 检查暂停状态
            while (this.context.isPaused && this.isRunning) {
                await this.delay(100);
            }

            if (!this.isRunning) break;

            const block = timeline.blocks[this.context.currentBlockIndex];

            // 通知块开始
            this.context.onBlockStart?.(block, this.context.currentBlockIndex);

            try {
                // 执行块
                await this.executeBlock(block);

                // 通知块结束
                this.context.onBlockEnd?.(block);
            } catch (error) {
                console.error('Block execution error:', error);
                this.context.onError?.(error as Error, block);
            }

            // 移动到下一个块
            this.context.currentBlockIndex++;

            // 双缓冲策略：播放当前块时预处理后续块
            const remainingBlocks = timeline.blocks.length - this.context.currentBlockIndex;

            // 预处理下一个块（不等待）
            if (remainingBlocks > 0) {
                this.prepareBlocks(this.context.currentBlockIndex, 2);
            }

            // 当剩余块少于 3 个时，开始预生成下一段时间线
            if (remainingBlocks <= 3 && !this.isPreparingNext && !this.nextTimeline) {
                this.prepareNextTimeline();
            }
        }

        // 时间线执行完毕，使用预生成的下一段（如有）
        if (this.isRunning) {
            if (this.nextTimeline) {
                // 使用已准备好的下一段
                const nextTL = this.nextTimeline;
                this.nextTimeline = null;
                this.isPreparingNext = false;

                // 通知新时间线准备完成 - 更新 UI
                this.context?.onTimelineReady?.(nextTL);

                this.context = {
                    timeline: nextTL,
                    currentBlockIndex: 0,
                    isPaused: false,
                    onStateChange: this.context?.onStateChange,
                    onBlockStart: this.context?.onBlockStart,
                    onBlockEnd: this.context?.onBlockEnd,
                    onError: this.context?.onError,
                    onTimelineReady: this.context?.onTimelineReady
                };

                // 预处理前几块
                await this.prepareBlocks(0, 3);
                await this.executeTimeline();
            } else {
                // 没有预生成，立即生成（备选）
                await this.startShow({
                    onStateChange: this.context?.onStateChange,
                    onBlockStart: this.context?.onBlockStart,
                    onBlockEnd: this.context?.onBlockEnd,
                    onError: this.context?.onError,
                    onTimelineReady: this.context?.onTimelineReady
                });
            }
        }
    }

    /**
     * 预生成下一段时间线（双缓冲）
     */
    private async prepareNextTimeline(): Promise<void> {
        if (this.isPreparingNext || this.nextTimeline) return;

        this.isPreparingNext = true;
        console.log('[Director] Pre-generating next timeline...');

        try {
            // 使用 globalState 的上下文
            const timeline = await writerAgent.generateTimeline(120);
            this.nextTimeline = timeline;

            // 预处理前几块
            await this.prepareBlocksForTimeline(timeline, 0, 2);

            console.log('[Director] Next timeline ready');
        } catch (error) {
            console.error('[Director] Failed to pre-generate:', error);
        } finally {
            this.isPreparingNext = false;
        }
    }

    /**
     * 为指定时间线预处理块
     */
    private async prepareBlocksForTimeline(
        timeline: ShowTimeline,
        startIndex: number,
        count: number
    ): Promise<void> {
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);
        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];
            if (block.type === 'talk') {
                preparePromises.push(this.prepareTalkBlock(block));
            } else if (block.type === 'music') {
                preparePromises.push(this.prepareMusicBlock(block));
            }
        }

        await Promise.all(preparePromises);
    }

    /**
     * 执行单个块
     */
    private async executeBlock(block: TimelineBlock): Promise<void> {
        switch (block.type) {
            case 'talk':
                await this.executeTalkBlock(block);
                break;
            case 'music':
                await this.executeMusicBlock(block);
                break;
            case 'music_control':
                await this.executeMusicControlBlock(block);
                break;
            case 'silence':
                await this.delay(block.duration);
                break;
        }
    }

    /**
     * 执行说话块
     */
    private async executeTalkBlock(block: TalkBlock): Promise<void> {
        // 处理背景音乐
        if (block.backgroundMusic) {
            const { action, volume } = block.backgroundMusic;
            switch (action) {
                case 'fade':
                    await audioMixer.fadeMusic(volume || 0.1, 1000);
                    break;
                case 'pause':
                    audioMixer.pauseMusic();
                    break;
                case 'continue':
                    if (volume !== undefined) {
                        audioMixer.setMusicVolume(volume);
                    }
                    break;
            }
        }

        // 播放所有台词
        for (const script of block.scripts) {
            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;
            const audioData = this.preparedAudio.get(audioId);

            if (audioData) {
                try {
                    await audioMixer.playVoice(audioData);
                } catch (e) {
                    console.warn('[Director] Voice playback failed, skipping:', e);
                }
            } else {
                // 实时生成（备选）
                try {
                    const result = await ttsAgent.generateSpeech(
                        script.text,
                        script.speaker,
                        { mood: script.mood, customStyle: script.voiceStyle }
                    );
                    if (result.success && result.audioData) {
                        await audioMixer.playVoice(result.audioData);
                    } else {
                        console.warn('[Director] TTS generation failed:', result.error);
                    }
                } catch (e) {
                    console.warn('[Director] TTS error, continuing:', e);
                }
            }

            // 台词间暂停
            if (script.pause) {
                await this.delay(script.pause);
            }

            // 记录话题到 globalState
            globalState.addTopic(script.text.slice(0, 50), script.speaker);
        }
    }

    /**
     * 执行音乐块
     */
    private async executeMusicBlock(block: MusicBlock): Promise<void> {
        // 播放介绍词
        if (block.intro) {
            const result = await ttsAgent.generateSpeech(
                block.intro.text,
                block.intro.speaker,
                { mood: block.intro.mood }
            );
            if (result.success && result.audioData) {
                await audioMixer.playVoice(result.audioData);
            }
        }

        // 获取音乐
        let track = this.musicCache.get(block.search);
        if (!track) {
            const tracks = await searchMusic(block.search);
            if (tracks.length > 0) {
                track = tracks[0];
            }
        }

        if (track) {
            const url = await getMusicUrl(track.id);
            if (url) {
                await audioMixer.playMusic(url, {
                    fadeIn: block.fadeIn
                });

                // 记录到 globalState
                globalState.addTrack(block.search);

                // 如果指定了时长，等待后淡出
                if (block.duration) {
                    await this.delay(block.duration * 1000);
                    await audioMixer.fadeMusic(0, 2000);
                    audioMixer.stopMusic();
                }
            }
        }
    }

    /**
     * 执行音乐控制块
     * fade_out 改为非阻塞式，让语音可以立即开始
     */
    private async executeMusicControlBlock(block: MusicControlBlock): Promise<void> {
        switch (block.action) {
            case 'pause':
                audioMixer.pauseMusic();
                break;
            case 'resume':
                audioMixer.resumeMusic();
                break;
            case 'fade_out':
                // 非阻塞式 fade out - 让语音可以立即开始
                // 音乐会在后台渐渐降低音量
                audioMixer.fadeMusic(0, block.fadeDuration || 2000);
                // 给一个短暂的过渡时间
                await this.delay(300);
                break;
            case 'fade_in':
                await audioMixer.fadeMusic(block.targetVolume || 0.7, block.fadeDuration || 2000);
                break;
            case 'stop':
                audioMixer.stopMusic();
                break;
        }
    }

    /**
     * 获取当前状态
     */
    getState(): PlayerState {
        const audioState = audioMixer.getState();

        return {
            isPlaying: this.isRunning && !this.context?.isPaused,
            currentBlockId: this.context?.timeline.blocks[this.context.currentBlockIndex]?.id || null,
            musicState: {
                isPlaying: audioState.music.isPlaying,
                currentTrack: null,
                volume: audioState.music.volume
            },
            voiceState: {
                isPlaying: audioState.voice.isPlaying,
                currentScriptId: null
            },
            queue: {
                pending: this.context?.timeline.blocks.length || 0,
                ready: this.preparedAudio.size,
                generating: 0
            }
        };
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 单例导出
export const directorAgent = new DirectorAgent();
