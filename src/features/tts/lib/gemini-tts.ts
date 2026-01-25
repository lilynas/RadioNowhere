/**
 * Gemini TTS - Gemini API TTS 调用逻辑
 * 支持单说话者和多说话者批量处理
 */

import { getSettings } from '@shared/services/storage-service/settings';
import { buildVertexUrl, apiFetch } from '@shared/services/ai-service';
import { TTSRequest, SpeakerId, MoodType } from '@shared/types/radio-core';
import { buildStylePrompt, isStandardSpeaker } from './style-prompt-builder';

// ================== Types ==================

export interface GeminiTtsContext {
    abortController: AbortController | null;
    setAbortController: (controller: AbortController | null) => void;
}

// ================== Single Speaker API ==================

/**
 * 调用 Gemini TTS API（单个请求）
 */
export async function callGeminiTTSApi(
    request: TTSRequest,
    context: GeminiTtsContext
): Promise<ArrayBuffer> {
    const settings = getSettings();

    const ttsApiKey = settings.ttsApiKey || settings.apiKey;
    const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';

    const baseEndpoint = settings.ttsEndpoint?.trim()
        || 'https://generativelanguage.googleapis.com';
    const normalizedEndpoint = baseEndpoint.replace(/\/$/, '');

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

    return decodeAudioResponse(await response.json());
}

// ================== Batch API ==================

/**
 * 单说话者批量 API 调用
 * 合并多句话为一个文本，保持自然停顿
 */
export async function callGeminiSingleSpeakerBatchApi(
    scripts: Array<{ speaker: string; text: string; mood?: MoodType }>,
    speakerMap: Map<string, string>,
    context: GeminiTtsContext
): Promise<ArrayBuffer> {
    const settings = getSettings();
    const ttsApiKey = settings.ttsApiKey || settings.apiKey;
    const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';

    const combinedText = scripts.map(s => s.text).join('\n\n');
    const voiceName = speakerMap.values().next().value || 'Aoede';

    const speakerId = scripts[0].speaker;
    const stylePrompt = buildStylePrompt(
        isStandardSpeaker(speakerId) ? speakerId : 'host1',
        scripts[0].mood
    );

    const body = {
        contents: [{ role: "user", parts: [{ text: `${stylePrompt}\n\n请朗读以下内容：\n${combinedText}` }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName }
                }
            }
        }
    };

    return executeGeminiTtsRequest(body, ttsApiKey, ttsModel, settings, context);
}

/**
 * 多说话者批量 API 调用
 * 使用 multiSpeakerVoiceConfig 配置
 */
export async function callGeminiMultiSpeakerBatchApi(
    scripts: Array<{ speaker: string; text: string }>,
    speakerMap: Map<string, string>,
    context: GeminiTtsContext
): Promise<ArrayBuffer> {
    const settings = getSettings();
    const ttsApiKey = settings.ttsApiKey || settings.apiKey;
    const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';

    const conversationText = scripts
        .map(s => `${s.speaker}: ${s.text}`)
        .join('\n');

    const speakerVoiceConfigs = Array.from(speakerMap.entries())
        .slice(0, 2)
        .map(([speaker, voiceName]) => ({
            speaker,
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
            }
        }));

    const body = {
        contents: [{ role: "user", parts: [{ text: `TTS the following conversation:\n${conversationText}` }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                multiSpeakerVoiceConfig: { speakerVoiceConfigs }
            }
        }
    };

    return executeGeminiTtsRequest(body, ttsApiKey, ttsModel, settings, context);
}

// ================== Internal Helpers ==================

/**
 * 执行 Gemini TTS API 请求的公共方法
 */
async function executeGeminiTtsRequest(
    body: object,
    ttsApiKey: string,
    ttsModel: string,
    settings: ReturnType<typeof getSettings>,
    context: GeminiTtsContext
): Promise<ArrayBuffer> {
    let response: Response;

    if (settings.apiType === 'vertexai' && settings.ttsUseVertex) {
        const isGcpApiKey = settings.apiKey.startsWith('AIza');
        const apiUrl = buildVertexUrl(
            settings.gcpProject,
            settings.gcpLocation,
            ttsModel,
            'generateContent'
        ) + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (!isGcpApiKey) {
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
        }

        const abortController = new AbortController();
        context.setAbortController(abortController);
        response = await apiFetch(apiUrl, {
            method: 'POST',
            headers,
            body,
            signal: abortController.signal
        });
    } else {
        const baseEndpoint = settings.ttsEndpoint?.trim() || 'https://generativelanguage.googleapis.com';
        const normalizedEndpoint = baseEndpoint.replace(/\/$/, '');
        const apiUrl = `${normalizedEndpoint}/v1beta/models/${ttsModel}:generateContent?key=${ttsApiKey}`;

        const abortController = new AbortController();
        context.setAbortController(abortController);
        response = await apiFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: abortController.signal
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batched TTS Error: ${response.status} - ${errorText.slice(0, 300)}`);
    }

    return decodeAudioResponse(await response.json());
}

/**
 * 解码 Gemini 响应中的音频数据
 */
function decodeAudioResponse(data: unknown): ArrayBuffer {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioBase64 = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data as string | undefined;

    if (!audioBase64) {
        throw new Error('No audio data in response');
    }

    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
