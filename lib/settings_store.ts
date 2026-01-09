/**
 * Settings Store - LocalStorage-based persistent API configuration
 */

const STORAGE_KEY = "radio_nowhere_settings";

export type ApiType = "openai" | "gemini";

export interface IApiSettings {
    endpoint: string;      // API base URL (e.g., https://api.openai.com)
    apiKey: string;        // API Key
    modelName: string;     // Model name (e.g., gpt-4o, gemini-2.5-flash)
    apiType: ApiType;      // API format type: openai or gemini

    // TTS 独立配置
    ttsEndpoint: string;   // TTS API Endpoint (留空则使用官方)
    ttsApiKey: string;     // TTS API Key (可以和主 key 不同)
    ttsModel: string;      // TTS Model name
    ttsVoice: string;      // 默认语音
}

const DEFAULT_SETTINGS: IApiSettings = {
    endpoint: "",
    apiKey: "",
    modelName: "gpt-4o",
    apiType: "openai",
    ttsEndpoint: "",
    ttsApiKey: "",
    ttsModel: "gemini-2.5-flash-preview-tts",
    ttsVoice: "Aoede",
};

// 可用的 TTS 语音列表
export const TTS_VOICES = [
    { name: 'Aoede', desc: '女声 · 清澈温柔' },
    { name: 'Kore', desc: '女声 · 坚定专业' },
    { name: 'Leda', desc: '女声 · 年轻活泼' },
    { name: 'Despina', desc: '女声 · 温暖亲切' },
    { name: 'Gacrux', desc: '男声 · 成熟稳重' },
    { name: 'Charon', desc: '男声 · 专业播报' },
    { name: 'Puck', desc: '中性 · 活泼开朗' },
    { name: 'Sadachbia', desc: '男声 · 低沉有磁性' },
];

/**
 * Get API settings from LocalStorage
 */
export function getSettings(): IApiSettings {
    if (typeof window === "undefined") {
        return DEFAULT_SETTINGS;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return DEFAULT_SETTINGS;
        }

        const parsed = JSON.parse(stored) as Partial<IApiSettings>;
        return {
            endpoint: parsed.endpoint ?? DEFAULT_SETTINGS.endpoint,
            apiKey: parsed.apiKey ?? DEFAULT_SETTINGS.apiKey,
            modelName: parsed.modelName ?? DEFAULT_SETTINGS.modelName,
            apiType: parsed.apiType ?? DEFAULT_SETTINGS.apiType,
            ttsEndpoint: parsed.ttsEndpoint ?? DEFAULT_SETTINGS.ttsEndpoint,
            ttsApiKey: parsed.ttsApiKey ?? DEFAULT_SETTINGS.ttsApiKey,
            ttsModel: parsed.ttsModel ?? DEFAULT_SETTINGS.ttsModel,
            ttsVoice: parsed.ttsVoice ?? DEFAULT_SETTINGS.ttsVoice,
        };
    } catch (e) {
        console.error("Failed to parse settings:", e);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save API settings to LocalStorage
 */
export function saveSettings(settings: IApiSettings): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}

/**
 * Clear all settings from LocalStorage
 */
export function clearSettings(): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear settings:", e);
    }
}

/**
 * Check if API settings are configured
 */
export function isConfigured(): boolean {
    const settings = getSettings();
    return Boolean(settings.endpoint && settings.apiKey);
}
