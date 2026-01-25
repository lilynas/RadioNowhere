/**
 * Warmup Content - 预热内容模块
 * 处理开场问候语和过渡音乐
 */

import { ttsAgent } from '@features/tts/lib/tts-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor } from '@shared/services/monitor-service';
import { searchMusic, getMusicUrl } from '@features/music-search/lib/gd-music-service';
import { AUDIO, TRANSITION } from '@shared/utils/constants';

/**
 * 获取快速问候语（不调用 AI，直接生成）
 */
export function getQuickGreeting(): string {
    const hour = new Date().getHours();
    const greetings: Record<string, string> = {
        morning: '早安！欢迎收听电台，新的一天，让我们用音乐和好心情开始。节目正在准备中，先来一首歌吧。',
        noon: '午安！欢迎收听午间电台。工作之余，放松一下。节目马上开始，先听一首轻松的。',
        afternoon: '下午好！欢迎收听下午茶电台。一杯咖啡，一首歌，享受惬意午后。节目正在准备中。',
        evening: '傍晚好！欢迎收听晚间电台。结束了一天的忙碌，让音乐温暖你归家的路。',
        night: '夜深了，欢迎收听深夜电台。让我们一起度过这段温暖的时光。节目马上开始。',
        latenight: '凌晨了还没睡吗？让电台陪伴你。先来一首轻柔的音乐，节目马上开始。'
    };

    if (hour >= 6 && hour < 9) return greetings.morning;
    if (hour >= 9 && hour < 12) return greetings.noon;
    if (hour >= 12 && hour < 18) return greetings.afternoon;
    if (hour >= 18 && hour < 21) return greetings.evening;
    if (hour >= 21 || hour < 2) return greetings.night;
    return greetings.latenight;
}

/**
 * 播放预热内容（问候语 + 背景音乐循环）
 */
export async function playWarmupContent(
    searchAndPlayIntroMusic: () => Promise<string | null>
): Promise<void> {
    console.log('[Director] Starting warmup content...');
    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Playing warmup...');

    try {
        // 1. 先开始播放背景音乐
        searchAndPlayIntroMusic();

        // 2. 同时生成简短的开场问候语
        const greeting = getQuickGreeting();
        const ttsResult = await ttsAgent.generateSpeech(
            greeting,
            'host1',
            { mood: 'warm', priority: 10 }
        );

        // 3. 播放问候语（叠加在音乐上）
        if (ttsResult.success && ttsResult.audioData) {
            await audioMixer.fadeMusic(0.15, 500);
            await audioMixer.playVoice(ttsResult.audioData);
            await audioMixer.fadeMusic(0.7, 1000);
        }

        radioMonitor.log('DIRECTOR', 'Warmup content playing', 'info');
    } catch (error) {
        console.warn('[Director] Warmup playback error:', error);
    }
}

/**
 * 播放节目间过渡音乐（30-60秒轻音乐）
 */
export async function playTransitionMusic(delay: (ms: number) => Promise<void>): Promise<void> {
    console.log('[Director] Playing transition music...');
    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Playing transition...');

    try {
        const queries = TRANSITION.SEARCH_QUERIES;
        const query = queries[Math.floor(Math.random() * queries.length)];

        const tracks = await searchMusic(query, 5);
        if (tracks.length === 0) {
            await delay(5000);
            return;
        }

        // 随机选择一首
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        const sourceType = track.source === 'tencent' ? 'tencent' : 'netease';
        const url = await getMusicUrl(String(track.id), 320, sourceType);

        if (url) {
            audioMixer.setMusicVolume(TRANSITION.MUSIC_VOLUME);

            const transitionDuration = TRANSITION.MIN_DURATION_MS + Math.random() * (TRANSITION.MAX_DURATION_MS - TRANSITION.MIN_DURATION_MS);
            const playResult = await audioMixer.playMusic(url, { fadeIn: TRANSITION.FADE_IN_MS });
            if (!playResult.success) {
                radioMonitor.log('DIRECTOR', `Transition music playback failed: ${playResult.error}`, 'warn');
                await delay(3000);
                return;
            }

            await delay(transitionDuration);
            await audioMixer.fadeMusic(0, TRANSITION.FADE_OUT_MS);
            audioMixer.stopMusic();
            audioMixer.setMusicVolume(AUDIO.MUSIC_AFTER_TRANSITION);
        }
    } catch (error) {
        console.warn('[Director] Transition music error:', error);
        await delay(3000);
    }
}
