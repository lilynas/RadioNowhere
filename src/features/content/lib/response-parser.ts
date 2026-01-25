/**
 * Response Parser - AI 响应解析模块
 * 处理 JSON 提取、修复和验证
 */

import { ShowTimeline, TimelineBlock } from '@shared/types/radio-core';

// ================== JSON Extraction ==================

/**
 * 从 AI 响应中提取 JSON 字符串
 */
export function extractJsonString(response: string): string {
    let jsonStr = response;

    // 策略1: 移除 markdown 代码块
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
    if (jsonMatch && jsonMatch[1].includes('{')) {
        jsonStr = jsonMatch[1];
        console.log('[Writer] Extracted JSON from markdown code block');
    }

    // 策略2: 查找第一个 { 和最后一个 }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        console.log('[Writer] Extracted JSON by finding braces');
    } else {
        console.warn('[Writer] No JSON structure found in response, will retry:', response.substring(0, 100));
        throw new Error('No valid JSON structure found in AI response');
    }

    // 策略3: 检测 tool call 格式并提前提取 timeline_json
    if (jsonStr.includes('"tool"') && jsonStr.includes('"submit_show"') && jsonStr.includes('timeline_json')) {
        console.log('[Writer] Detected tool call format, extracting timeline_json early');

        const timelineMatch = jsonStr.match(/"timeline_json"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/);
        if (timelineMatch && timelineMatch[1]) {
            try {
                const unescaped = timelineMatch[1]
                    .replace(/\\"/g, '"')
                    .replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\\\/g, '\\');
                jsonStr = unescaped;
                console.log('[Writer] Successfully extracted and unescaped timeline_json');
            } catch {
                console.warn('[Writer] Failed to unescape timeline_json, trying alternative method');
            }
        }
    }

    return jsonStr;
}

/**
 * 解析 JSON 字符串，处理常见问题
 */
export function parseJsonWithFixes(jsonStr: string): unknown {
    try {
        return JSON.parse(jsonStr.trim());
    } catch (parseError) {
        // 尝试修复常见的 JSON 问题
        try {
            const fixedJson = jsonStr
                .replace(/,\s*}/g, '}')
                .replace(/,\s*\]/g, ']');
            const parsed = JSON.parse(fixedJson.trim());
            console.log('[Writer] JSON parse succeeded after fixing trailing commas');
            return parsed;
        } catch {
            console.error('[Writer] JSON parse failed. First 500 chars:', jsonStr.substring(0, 500));
            throw parseError;
        }
    }
}

/**
 * 处理 tool call 格式响应
 */
export function extractTimelineFromToolCall(parsed: unknown): unknown {
    const obj = parsed as { tool?: string; args?: { timeline_json?: unknown } };

    if (obj.tool === 'submit_show' && obj.args?.timeline_json) {
        console.log('[Writer] Detected tool call format, extracting timeline_json');
        const timelineJson = obj.args.timeline_json;

        if (typeof timelineJson === 'string') {
            try {
                const result = JSON.parse(timelineJson);
                console.log('[Writer] Successfully parsed nested timeline_json');
                return result;
            } catch {
                // 尝试移除多余的转义
                try {
                    const unescaped = timelineJson
                        .replace(/\\"/g, '"')
                        .replace(/\\n/g, '\n')
                        .replace(/\\\\/g, '\\');
                    const result = JSON.parse(unescaped);
                    console.log('[Writer] Successfully parsed unescaped timeline_json');
                    return result;
                } catch (e2) {
                    console.error('[Writer] Failed to parse nested timeline_json:', e2);
                    throw new Error('Failed to parse nested timeline_json');
                }
            }
        }
        return timelineJson;
    }

    return parsed;
}

/**
 * 验证并规范化 timeline 结构
 */
export function validateAndNormalizeTimeline(parsed: unknown): ShowTimeline {
    const timeline = parsed as ShowTimeline;

    if (!timeline.blocks || !Array.isArray(timeline.blocks)) {
        console.error('[Writer] Invalid structure:', Object.keys(timeline));
        throw new Error('Invalid timeline structure: missing blocks array');
    }

    if (timeline.blocks.length === 0) {
        console.error('[Writer] Empty blocks array');
        throw new Error('Invalid timeline: blocks array is empty');
    }

    // 生成缺失的 ID
    timeline.id = timeline.id || `timeline-${Date.now()}`;
    timeline.blocks.forEach((block: TimelineBlock, index: number) => {
        if (!block.id) {
            block.id = `block-${index}`;
        }
    });

    console.log('[Writer] Parse successful:', timeline.blocks.length, 'blocks');
    return timeline;
}

// ================== Main Parse Function ==================

/**
 * 解析 AI 响应为 ShowTimeline
 */
export function parseResponse(response: string): ShowTimeline {
    const jsonStr = extractJsonString(response);
    let parsed = parseJsonWithFixes(jsonStr);
    parsed = extractTimelineFromToolCall(parsed);
    return validateAndNormalizeTimeline(parsed);
}

// ================== Tool Call Parsing ==================

/**
 * 解析工具调用 - 支持嵌套 JSON
 */
export function parseToolCall(response: string): { name: string; args: Record<string, unknown> } | null {
    // 查找 JSON 对象
    const patterns = [
        /```json\s*([\s\S]*?)\s*```/,
        /```\s*([\s\S]*?)\s*```/,
        /\{[\s\S]*"tool"\s*:\s*"[^"]+"/
    ];

    let jsonStr = '';
    for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
            jsonStr = match[1] || match[0];
            break;
        }
    }

    if (!jsonStr) {
        // 尝试直接查找 JSON 对象
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = response.substring(firstBrace, lastBrace + 1);
        }
    }

    if (!jsonStr) return null;

    try {
        const parsed = JSON.parse(jsonStr.trim());
        if (parsed.tool && typeof parsed.tool === 'string') {
            return {
                name: parsed.tool,
                args: parsed.args || {}
            };
        }
    } catch {
        // JSON 解析失败，返回 null
    }

    return null;
}
