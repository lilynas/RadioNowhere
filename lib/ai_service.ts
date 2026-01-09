/**
 * AI Service - Multi-format API client (OpenAI & Gemini compatible)
 */

import { getSettings, isConfigured, ApiType } from "./settings_store";
import { WORLD_BIBLE, IShowSegment } from "./fictional_world";

// ================== Interfaces ==================

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
        };
    }>;
}

// ================== Helper Functions ==================

/**
 * 规范化 API endpoint
 */
function normalizeEndpoint(endpoint: string, apiType: ApiType): string {
    let url = endpoint.replace(/\/$/, '');

    if (apiType === 'openai') {
        if (!url.endsWith('/v1')) {
            url = `${url}/v1`;
        }
    } else {
        // Gemini: ensure ends with /v1 or /v1beta
        if (!url.endsWith('/v1') && !url.endsWith('/v1beta')) {
            url = `${url}/v1`;
        }
    }

    return url;
}

/**
 * 发送 API 请求（直接调用，如失败则尝试代理）
 */
async function apiFetch(
    url: string,
    options: { method: string; headers: Record<string, string>; body?: unknown }
): Promise<Response> {
    const fetchOptions: RequestInit = {
        method: options.method,
        headers: options.headers,
    };

    if (options.body && options.method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
    }

    try {
        // 尝试直接调用
        const response = await fetch(url, fetchOptions);
        return response;
    } catch (directError) {
        console.log("Direct fetch failed, trying proxy...", directError);
        // fallback 到代理
        try {
            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    method: options.method,
                    headers: options.headers,
                    body: options.body
                })
            });
            return response;
        } catch (proxyError) {
            console.error("Proxy also failed:", proxyError);
            throw directError; // 抛出原始错误
        }
    }
}


// ================== Main Functions ==================

/**
 * Generate content using OpenAI or Gemini API
 */
export async function generateSegment(historyLines: string[]): Promise<IShowSegment> {
    if (!isConfigured()) {
        return {
            type: "host_talk",
            content: "System Error: Neural Link Severed. (No API Configured - Check Settings)"
        };
    }

    const settings = getSettings();
    const baseUrl = normalizeEndpoint(settings.endpoint, settings.apiType);

    const history = historyLines.join("\n");
    const prompt = `
${WORLD_BIBLE}

HISTORY OF BROADCAST:
${history}

TASK:
Generate the next short segment for the radio broadcast.
Choose ONE of these types:

1. 'host_talk': Casual conversation from the host (max 30 words). Share thoughts, comment on the city, interact with listeners.

2. 'news': Breaking news flash about the fictional world (max 20 words). Keep it dramatic and dystopian.

3. 'music_intro': Introduce the next song (max 25 words). You MUST include "music_keyword" - a real song name and/or artist to search for. Choose music that fits the late-night, melancholic, smooth vibe. Can be any genre: electronic, lo-fi, jazz, ambient, post-rock, or classic songs.

OUTPUT FORMAT (strict JSON only):
{
  "type": "host_talk" | "news" | "music_intro",
  "content": "your speech text here...",
  "music_keyword": "song name or artist name"  // ONLY for music_intro type
}

IMPORTANT:
- For music_intro, the music_keyword should be a REAL song or artist name that can be found on music platforms
- Vary the segment types - don't repeat the same type consecutively
- Keep the dystopian radio host persona
`;

    try {
        let responseText: string;

        if (settings.apiType === 'gemini') {
            // Gemini native format
            const response = await apiFetch(
                `${baseUrl}/models/${settings.modelName}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${settings.apiKey}`,
                    },
                    body: {
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 300,
                        }
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Gemini API Error:", response.status, errorText);
                return { type: "host_talk", content: "Signal interference detected..." };
            }

            const data: GeminiResponse = await response.json();
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
            // OpenAI format
            const response = await apiFetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.apiKey}`,
                },
                body: {
                    model: settings.modelName,
                    messages: [{ role: "user", content: prompt }] as ChatMessage[],
                    temperature: 0.8,
                    max_tokens: 300,
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("OpenAI API Error:", response.status, errorText);
                return { type: "host_talk", content: "Signal interference detected..." };
            }

            const data: OpenAIResponse = await response.json();
            responseText = data.choices?.[0]?.message?.content || "";
        }

        // Parse JSON from response (handle markdown code blocks)
        const text = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(text) as IShowSegment;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return { type: "host_talk", content: "Static interference..." };
    }
}

/**
 * Test API connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
    if (!isConfigured()) {
        return { success: false, message: "API not configured" };
    }

    const settings = getSettings();
    const baseUrl = normalizeEndpoint(settings.endpoint, settings.apiType);

    try {
        if (settings.apiType === 'gemini') {
            // Gemini test
            const response = await apiFetch(
                `${baseUrl}/models/${settings.modelName}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${settings.apiKey}`,
                    },
                    body: {
                        contents: [{ parts: [{ text: "Hi" }] }],
                        generationConfig: { maxOutputTokens: 5 }
                    }
                }
            );

            if (response.ok) {
                return { success: true, message: "✅ Gemini connection successful!" };
            } else {
                const errorText = await response.text();
                return { success: false, message: `Error: ${response.status} - ${errorText.slice(0, 100)}` };
            }
        } else {
            // OpenAI test
            const response = await apiFetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.apiKey}`,
                },
                body: {
                    model: settings.modelName,
                    messages: [{ role: "user", content: "Hi" }],
                    max_tokens: 5,
                }
            });

            if (response.ok) {
                return { success: true, message: "✅ OpenAI connection successful!" };
            } else {
                const errorText = await response.text();
                return { success: false, message: `Error: ${response.status} - ${errorText.slice(0, 100)}` };
            }
        }
    } catch (error) {
        return { success: false, message: `Connection failed: ${error}` };
    }
}

/**
 * Fetch available models from the API
 */
export async function fetchModels(endpoint: string, apiKey: string, apiType: ApiType): Promise<string[]> {
    if (!endpoint || !apiKey) {
        return [];
    }

    const baseUrl = normalizeEndpoint(endpoint, apiType);

    try {
        const response = await apiFetch(`${baseUrl}/models`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            console.error("Failed to fetch models:", response.status);
            return [];
        }

        const data = await response.json();

        // OpenAI format: { data: [{ id: "model-name", ... }] }
        if (data.data && Array.isArray(data.data)) {
            return data.data
                .map((model: { id: string }) => model.id)
                .sort((a: string, b: string) => a.localeCompare(b));
        }

        // Gemini format: { models: [{ name: "models/gemini-2.5-flash", ... }] }
        if (data.models && Array.isArray(data.models)) {
            return data.models
                .map((model: { name: string }) => model.name.replace('models/', ''))
                .sort((a: string, b: string) => a.localeCompare(b));
        }

        return [];
    } catch (error) {
        console.error("Error fetching models:", error);
        return [];
    }
}
