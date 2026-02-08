/**
 * Writer Tools - 编剧 Agent 的工具系统
 * 提供音乐搜索、歌词获取、节目提交等工具
 */

import { searchMusicWithValidation, getLyrics } from '@features/music-search/lib/gd-music-service';
import { ShowTimeline } from '@shared/types/radio-core';
import { getRecentConcepts, getRecentSongs, isDuplicateConcept, recordSong } from '@features/history-tracking/lib/history-manager';
import { NEWS_SERVICE } from '@shared/utils/constants';
import { analyzeDiversity, addProhibitedArtist } from '@features/music-search/lib/diversity-manager';

// ================== Tool Definitions ==================

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        name: string;
        type: string;
        description: string;
        required: boolean;
    }[];
}

const WRITER_TOOLS_MAP: Record<string, ToolDefinition> = {
    search_music: {
        name: 'search_music',
        description: '搜索歌曲。⚠️ 重要：此API只支持搜索【具体歌手名】或【具体歌名】。可通过 genre_hint 辅助选歌方向，但 query 仍需填写具体歌手或曲名。',
        parameters: [
            { name: 'query', type: 'string', description: '搜索关键词（必须是具体歌手名或歌曲名，如"周杰伦"、"Shape of You"）', required: true },
            { name: 'mood', type: 'string', description: '期望的情绪氛围（仅供参考，不影响搜索）', required: false },
            { name: 'genre_hint', type: 'string', description: '曲风提示（如“90年代｜欧美｜摇滚”），用于提醒选歌方向', required: false }
        ]
    },
    get_lyrics: {
        name: 'get_lyrics',
        description: '获取歌曲歌词。需要先用 search_music 获取 lyricId。',
        parameters: [
            { name: 'song_title', type: 'string', description: '歌曲名称', required: true },
            { name: 'lyric_id', type: 'string', description: '歌词ID (从 search_music 结果获取)', required: false }
        ]
    },
    fetch_news: {
        name: 'fetch_news',
        description: '获取今日实时热点新闻。可用于任何需要话题素材的节目：新闻播报、脱口秀、时事评论、闲聊话题等。返回当日热点新闻列表，编剧可自由选用。',
        parameters: [
            { name: 'count', type: 'number', description: '需要的新闻条数（默认10条，最多15条）', required: false }
        ]
    },
    check_duplicate: {
        name: 'check_duplicate',
        description: '检查节目概念是否与近1小时内的节目雷同。返回 true/false。',
        parameters: [
            { name: 'concept', type: 'string', description: '节目概念描述', required: true }
        ]
    },
    check_artist_diversity: {
        name: 'check_artist_diversity',
        description: '检查节目中的歌手多样性。输入本节目中选择的所有歌手（用逗号分隔），系统会评估是否满足多样性和禁止列表要求。这是必须调用的最终检查。',
        parameters: [
            { name: 'artists', type: 'string', description: '本节目中选择的所有歌手名单（用逗号分隔，如："朴树,The Weeknd,五月天,Norah Jones"）', required: true }
        ]
    },
    search_knowledge: {
        name: 'search_knowledge',
        description: '知识/百科检索工具。用于补充历史、科学、人物、概念背景。',
        parameters: [
            { name: 'query', type: 'string', description: '检索问题或关键词', required: true },
            { name: 'limit', type: 'number', description: '返回条目数，默认 3，最多 6', required: false }
        ]
    },
    fetch_trending: {
        name: 'fetch_trending',
        description: '获取热点话题建议，适合综艺、脱口秀和评论节目。',
        parameters: [
            { name: 'topic', type: 'string', description: '热点领域，如“科技/文娱/社会”', required: false },
            { name: 'count', type: 'number', description: '返回数量，默认 5，最多 10', required: false }
        ]
    },
    search_quotes: {
        name: 'search_quotes',
        description: '检索相关名言金句，用于收束段或开场引子。',
        parameters: [
            { name: 'theme', type: 'string', description: '主题关键词，如“勇气/爱情/成长”', required: true },
            { name: 'count', type: 'number', description: '返回数量，默认 3，最多 6', required: false }
        ]
    },
    fetch_weather: {
        name: 'fetch_weather',
        description: '获取天气简报（可降级为模拟数据），用于新闻和城市陪伴类节目。',
        parameters: [
            { name: 'city', type: 'string', description: '城市名，如“上海”', required: false }
        ]
    },
    submit_show: {
        name: 'submit_show',
        description: '提交最终节目。如果格式正确返回成功，否则返回错误信息供修正。这是唯一能结束循环的方式。',
        parameters: [
            { name: 'timeline_json', type: 'string', description: '完整的 ShowTimeline JSON', required: true }
        ]
    }
};

export const WRITER_TOOLS: ToolDefinition[] = Object.values(WRITER_TOOLS_MAP);

// ================== Tool Results ==================

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

// ================== Tool Execution ==================

/**
 * 执行工具调用
 */
export async function executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    parseTimeline: (json: string) => ShowTimeline
): Promise<ToolResult> {
    try {
        switch (toolName) {
            case 'search_music':
                return await executeSearchMusic(
                    args.query as string,
                    args.genre_hint as string | undefined
                );

            case 'get_lyrics':
                return await executeGetLyrics(args.song_title as string, args.lyric_id as string | undefined);

            case 'fetch_news':
                return await executeFetchNews(args.count as number | undefined);

            case 'check_duplicate':
                return executeCheckDuplicate(args.concept as string);

            case 'check_artist_diversity':
                return executeCheckArtistDiversity(args.artists as string);

            case 'search_knowledge':
                return await executeSearchKnowledge(args.query as string, args.limit as number | undefined);

            case 'fetch_trending':
                return await executeFetchTrending(args.topic as string | undefined, args.count as number | undefined);

            case 'search_quotes':
                return await executeSearchQuotes(args.theme as string, args.count as number | undefined);

            case 'fetch_weather':
                return await executeFetchWeather(args.city as string | undefined);

            case 'submit_show':
                return executeSubmitShow(args.timeline_json as string, parseTimeline);

            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

// ================== Tool Implementations ==================

async function executeSearchMusic(query: string, genreHint?: string): Promise<ToolResult> {
    try {
        // 使用带验证的搜索，确保只返回可播放的歌曲
        const validatedTracks = await searchMusicWithValidation(query, 8); // 增加搜索数量

        // 过滤掉已播放的歌曲
        const recentSongs = getRecentSongs();
        const filteredTracks = validatedTracks.filter(({ track }) =>
            !recentSongs.some(s =>
                s.toLowerCase().includes(track.name.toLowerCase()) ||
                track.name.toLowerCase().includes(s.toLowerCase())
            )
        );

        // 随机打乱顺序，避免总是选第一首
        const shuffled = filteredTracks.sort(() => Math.random() - 0.5);

        const results = shuffled.map(({ track, url }) => ({
            title: track.name,
            artist: track.artist.join(', '),
            album: track.album,
            id: track.id,
            lyricId: track.lyricId,
            url: url,
            source: track.source
        }));

        if (results.length === 0) {
            return {
                success: false,
                error: `未找到可播放的歌曲："${query}"。请尝试其他歌手名或歌曲名。`
            };
        }

        // 生成随机推荐索引
        const recommendIndex = Math.floor(Math.random() * Math.min(3, results.length));

        return {
            success: true,
            data: {
                query,
                genreHint: genreHint || null,
                results,
                recommendedIndex: recommendIndex,
                note: `找到 ${results.length} 首可播放歌曲。建议优先考虑推荐索引 ${recommendIndex}，并结合 genre_hint 保持风格一致。`
            }
        };
    } catch (error) {
        return { success: false, error: `搜索失败: ${String(error)}` };
    }
}

async function executeGetLyrics(songTitle: string, lyricId?: string): Promise<ToolResult> {
    try {
        // 如果提供了 lyricId，直接获取歌词
        if (lyricId) {
            const lyricsData = await getLyrics(lyricId);
            if (lyricsData) {
                return {
                    success: true,
                    data: {
                        song: songTitle,
                        lyrics: lyricsData.lyric,
                        translation: lyricsData.tlyric || null
                    }
                };
            }
        }

        // 否则返回空
        return {
            success: true,
            data: {
                song: songTitle,
                lyrics: null,
                note: lyricId ? '歌词获取失败' : '需要先搜索歌曲获取 lyricId'
            }
        };
    } catch (error) {
        return { success: false, error: `歌词获取失败: ${String(error)}` };
    }
}

/**
 * 获取实时新闻
 */
async function executeFetchNews(count?: number): Promise<ToolResult> {
    try {
        const newsUrl = `${NEWS_SERVICE.API_URL}?key=${NEWS_SERVICE.API_KEY}`;

        // 通过代理调用，避免 CORS
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: newsUrl,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            })
        });

        if (!response.ok) {
            return { success: false, error: `新闻API请求失败: ${response.status}` };
        }

        const data = await response.json();

        if (data.code !== 201 || !data.data?.news) {
            return { success: false, error: '新闻API返回异常' };
        }

        // 限制返回条数
        const maxCount = Math.min(count || 10, 15);
        const newsList = data.data.news.slice(0, maxCount);

        return {
            success: true,
            data: {
                date: data.data.date || new Date().toLocaleDateString('zh-CN'),
                title: data.data.title || '今日新闻快讯',
                news: newsList,
                weiyu: data.data.weiyu || null,
                count: newsList.length,
                note: '以上为今日实时新闻，可选择2-5条有趣新闻进行播报和点评'
            }
        };
    } catch (error) {
        return { success: false, error: `获取新闻失败: ${String(error)}` };
    }
}

async function executeSearchKnowledge(query: string, limit?: number): Promise<ToolResult> {
    if (!query || !query.trim()) {
        return { success: false, error: 'search_knowledge 需要 query 参数' };
    }

    const safeLimit = Math.max(1, Math.min(limit || 3, 6));

    return {
        success: true,
        data: {
            query,
            source: 'local_fallback',
            items: [
                { title: `${query} 的背景`, summary: '请在节目中解释该主题的起源、演化与现实意义。' },
                { title: `${query} 的争议`, summary: '补充至少一个不同观点，避免单一立场叙述。' },
                { title: `${query} 的延展`, summary: '结合听众生活场景给出可理解的类比。' }
            ].slice(0, safeLimit),
            note: '当前环境未接入稳定知识 API，已返回结构化引导结果。'
        }
    };
}

async function executeFetchTrending(topic?: string, count?: number): Promise<ToolResult> {
    const safeCount = Math.max(1, Math.min(count || 5, 10));
    const normalizedTopic = (topic || '综合').trim() || '综合';

    return {
        success: true,
        data: {
            topic: normalizedTopic,
            items: [
                `${normalizedTopic}：AI 产品更新与行业竞争`,
                `${normalizedTopic}：电影/剧集口碑分化讨论`,
                `${normalizedTopic}：短视频平台新趋势`,
                `${normalizedTopic}：年轻人消费观变化`,
                `${normalizedTopic}：城市夜生活与陪伴经济`
            ].slice(0, safeCount),
            note: '热点为结构化候选话题，请在节目中选择其中 1-2 个展开。'
        }
    };
}

async function executeSearchQuotes(theme: string, count?: number): Promise<ToolResult> {
    if (!theme || !theme.trim()) {
        return { success: false, error: 'search_quotes 需要 theme 参数' };
    }

    const safeCount = Math.max(1, Math.min(count || 3, 6));

    const quotePool = [
        { quote: '真正重要的不是速度，而是方向。', author: '匿名电台编者' },
        { quote: '你听见的每段故事，都是别人走过的夜路。', author: '深夜主播语录' },
        { quote: '生活没有标准答案，但有更诚实的提问。', author: '节目手记' },
        { quote: '音乐不会替你决定，但会陪你做决定。', author: 'Radio Note' },
        { quote: '热闹是场景，清醒是能力。', author: '评论主持人' },
        { quote: '温柔不是退让，而是带着边界感的理解。', author: '夜谈嘉宾' }
    ];

    return {
        success: true,
        data: {
            theme,
            quotes: quotePool.slice(0, safeCount),
            note: '可选 1-2 句用于开场或收束，不建议整段连续引用。'
        }
    };
}

async function executeFetchWeather(city?: string): Promise<ToolResult> {
    const resolvedCity = (city || '本地城市').trim() || '本地城市';

    return {
        success: true,
        data: {
            city: resolvedCity,
            condition: '多云转晴',
            temperature: '18-26°C',
            humidity: '62%',
            advice: '早晚温差较大，外出可备薄外套。',
            source: 'mock_weather',
            note: '当前为降级天气信息，若需精确天气请接入真实 API。'
        }
    };
}

function executeCheckDuplicate(concept: string): ToolResult {
    const isDuplicate = isDuplicateConcept(concept);
    const recentConcepts = getRecentConcepts();

    return {
        success: true,
        data: {
            isDuplicate,
            recentConcepts: recentConcepts.slice(0, 5),
            suggestion: isDuplicate
                ? '该概念与近期节目雷同，请换一个不同的方向'
                : '概念独特，可以继续'
        }
    };
}

function executeSubmitShow(
    timelineJson: string,
    parseTimeline: (json: string) => ShowTimeline
): ToolResult {
    try {
        // 尝试解析
        const timeline = parseTimeline(timelineJson);

        // 验证基本结构
        if (!timeline.id || !timeline.blocks || timeline.blocks.length === 0) {
            return {
                success: false,
                error: 'Timeline 缺少必要字段: id, blocks 必须存在且 blocks 不能为空'
            };
        }

        // 记录使用的歌曲（预记录，避免后续重复选曲）
        for (const block of timeline.blocks) {
            if (block.type === 'music' && block.search) {
                recordSong(block.search);

                // 从搜索词中提取歌手名并添加到禁止列表
                const parts = block.search.split(' - ');
                if (parts.length === 2) {
                    const artistName = parts[0].trim();
                    addProhibitedArtist(artistName);
                }
            }
        }

        return {
            success: true,
            data: {
                id: timeline.id,
                title: timeline.title,
                blockCount: timeline.blocks.length,
                message: '节目提交成功！'
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `JSON 解析失败: ${String(error)}。请检查 JSON 格式是否正确，确保所有引号、逗号、括号都正确匹配。`
        };
    }
}

function executeCheckArtistDiversity(artistsParam: string): ToolResult {
    if (!artistsParam || artistsParam.trim().length === 0) {
        return {
            success: false,
            error: '错误：未提供歌手列表'
        };
    }

    // 将逗号分隔的字符串转换为数组
    const artists = artistsParam.split(',').map(a => a.trim()).filter(a => a.length > 0);

    const analysis = analyzeDiversity(artists);

    if (analysis.violations.length > 0) {
        return {
            success: false,
            data: {
                message: `❌ **多样性检查失败**\n\n禁止列表违反：${analysis.violations.join(', ')}\n\n请删除这些歌手，重新选择其他艺人。`,
                score: analysis.score,
                feedback: analysis.feedback,
                violations: analysis.violations
            }
        };
    }

    let resultMessage = `🎵 **多样性检查结果**\n\n得分: ${analysis.score}/100\n\n`;
    resultMessage += analysis.feedback.join('\n');

    if (analysis.score >= 70) {
        resultMessage += '\n\n✅ **通过**：多样性评分达标，节目可以保留。';
    } else {
        resultMessage += '\n\n⚠️ **未达标**：多样性评分过低，建议重新调整歌手选择。\n\n建议：\n';
        resultMessage += '- 增加不同语言的歌手\n';
        resultMessage += '- 选择不同年代和流派的艺人\n';
        resultMessage += '- 避免同一个歌手出现多次\n';
        resultMessage += '- 尝试一些小众或新兴艺人\n';
    }

    return {
        success: true,
        data: {
            message: resultMessage,
            score: analysis.score,
            feedback: analysis.feedback,
            violations: analysis.violations
        }
    };
}

// ================== Context Helpers ==================

/**
 * 获取历史上下文（用于 System Prompt）
 */
export function getHistoryContext(): string {
    const recentConcepts = getRecentConcepts();
    const recentSongs = getRecentSongs();

    let context = '';

    if (recentConcepts.length > 0) {
        context += `\n## 近期节目（请避免雷同）\n${recentConcepts.slice(0, 5).map(c => `- ${c}`).join('\n')}\n`;
    }

    if (recentSongs.length > 0) {
        context += `\n## 近期播放歌曲（请勿重复）\n${recentSongs.slice(0, 10).map(s => `- ${s}`).join('\n')}\n`;
    }

    return context;
}

export function getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
    if (!toolNames || toolNames.length === 0) {
        return WRITER_TOOLS;
    }

    const selected = toolNames
        .map(name => WRITER_TOOLS_MAP[name])
        .filter((tool): tool is ToolDefinition => Boolean(tool));

    return selected.length > 0 ? selected : WRITER_TOOLS;
}

/**
 * 生成工具描述（用于 System Prompt）
 */
export function getToolsDescription(toolNames?: string[]): string {
    return getToolDefinitions(toolNames).map(tool => {
        const params = tool.parameters.map(p =>
            `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
        ).join('\n');
        return `### ${tool.name}\n${tool.description}\nParameters:\n${params}`;
    }).join('\n\n');
}
