/**
 * Microsoft TTS - Microsoft Azure TTS API 调用逻辑
 */

import { getSettings } from '@shared/services/storage-service/settings';
import { radioMonitor } from '@shared/services/monitor-service';
import { getMicrosoftFullVoiceName } from './voice-provider';

// ================== Types ==================

export interface MicrosoftTtsContext {
    abortController: AbortController | null;
    setAbortController: (controller: AbortController | null) => void;
}

// ================== Text Filtering ==================

/**
 * 过滤舞台指令和描述文本
 * 移除 (音乐声渐弱)、【旁白】 等内容
 */
export function filterStageDirections(text: string): string {
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
export function getMicrosoftVoiceName(voiceName: string): string {
    // 1. 如果已经是完整的微软格式，直接返回
    if (voiceName.includes('Microsoft Server Speech')) {
        return voiceName;
    }

    // 2. 使用 voice_provider 查找微软音色完整名称
    return getMicrosoftFullVoiceName(voiceName);
}

// ================== Microsoft TTS API ==================

/**
 * 调用 Microsoft TTS API
 * API 格式: GET /api/text-to-speech?voice=...&volume=...&rate=...&pitch=...&text=...
 * Token: 优先使用自定义 token，留空则使用内置 token
 */
export async function callMicrosoftTTSApi(
    text: string,
    voiceName: string,
    context: MicrosoftTtsContext
): Promise<ArrayBuffer> {
    const settings = getSettings();

    const endpoint = (settings.msTtsEndpoint || 'https://tts.cjack.top').replace(/\/$/, '');

    // 获取 Microsoft 音色完整名称（支持直接指定或映射）
    const msVoice = getMicrosoftVoiceName(voiceName);
    const voice = encodeURIComponent(msVoice);

    // 过滤掉舞台指令和描述文本 (括号内容)
    const cleanText = filterStageDirections(text);
    if (!cleanText.trim()) {
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
    const abortController = new AbortController();
    context.setAbortController(abortController);
    const response = await fetch(url, { headers, signal: abortController.signal });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Microsoft TTS Error: ${response.status} - ${errorText}`);
    }

    return response.arrayBuffer();
}
