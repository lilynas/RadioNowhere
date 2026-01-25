/**
 * Preload Manager - 预加载管理模块
 * 处理音频预加载、缓存管理、后台 worker
 */

import { TalkBlock, MusicBlock, TimelineBlock, ShowTimeline } from '@shared/types/radio-core';
import { getSettings } from '@shared/services/storage-service/settings';
import { radioMonitor } from '@shared/services/monitor-service';
import { DirectorState } from './director-types';

/**
 * 检查块是否已准备好
 */
export function isBlockPrepared(state: DirectorState, block: TimelineBlock): boolean {
    if (block.type === 'talk') {
        const talkBlock = block as TalkBlock;
        // 检查批量模式（1-2 说话者）
        const batchAudioId = `${block.id}-batch`;
        if (state.preparedAudio.has(batchAudioId)) return true;
        // 检查分句模式（所有脚本都已准备）
        return talkBlock.scripts.every(script => {
            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;
            return state.preparedAudio.has(audioId);
        });
    } else if (block.type === 'music') {
        const musicBlock = block as MusicBlock;
        return state.musicDataCache.has(musicBlock.search);
    }
    return true; // music_control 等不需要准备
}

/**
 * 等待第一个块准备好（带超时保护）
 */
export async function waitForFirstBlockReady(
    state: DirectorState,
    timeline: ShowTimeline,
    timeoutMs: number,
    delay: (ms: number) => Promise<void>
): Promise<void> {
    if (!timeline.blocks.length) return;

    const startTime = Date.now();
    const firstBlock = timeline.blocks[0];

    while (Date.now() - startTime < timeoutMs) {
        if (isBlockPrepared(state, firstBlock)) {
            radioMonitor.log('DIRECTOR', 'First block ready, starting playback', 'info');
            return;
        }
        await delay(200);
    }

    radioMonitor.log('DIRECTOR', 'First block not ready after timeout, starting anyway', 'warn');
}

/**
 * 计算已准备好的块数量
 */
export function countPreparedBlocks(state: DirectorState, startIndex: number, endIndex: number): number {
    if (!state.context) return 0;
    let count = 0;
    for (let i = startIndex; i < endIndex; i++) {
        const block = state.context.timeline.blocks[i];
        if (block && isBlockPrepared(state, block)) count++;
    }
    return count;
}

/**
 * 启动后台预加载 worker
 */
export function startPreloadWorker(
    state: DirectorState,
    prepareBlockAsync: (block: TimelineBlock) => Promise<void>,
    intervalRef: { current: ReturnType<typeof setInterval> | null }
): void {
    if (intervalRef.current) return;

    const WORKER_INTERVAL_MS = 2000;

    intervalRef.current = setInterval(async () => {
        if (!state.isRunning || !state.context) return;

        const { timeline, currentBlockIndex } = state.context;
        const preloadCount = getSettings().preloadBlockCount;
        const endIndex = Math.min(currentBlockIndex + preloadCount, timeline.blocks.length);

        for (let i = currentBlockIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];
            if (!block) continue;

            if (isBlockPrepared(state, block) || state.isPreparing.has(block.id)) {
                continue;
            }

            state.isPreparing.add(block.id);
            radioMonitor.log('DIRECTOR', `Preloader: preparing block ${i} (${block.type})`, 'trace');

            prepareBlockAsync(block).finally(() => {
                state.isPreparing.delete(block.id);
            });
        }

        const preparedCount = countPreparedBlocks(state, currentBlockIndex, endIndex);
        radioMonitor.updateStatus('TTS', 'READY', `Buffer: ${preparedCount}/${preloadCount}`);
    }, WORKER_INTERVAL_MS);

    radioMonitor.log('DIRECTOR', 'Preload worker started', 'info');
}

/**
 * 停止后台预加载 worker
 */
export function stopPreloadWorker(
    intervalRef: { current: ReturnType<typeof setInterval> | null }
): void {
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        radioMonitor.log('DIRECTOR', 'Preload worker stopped', 'info');
    }
}
