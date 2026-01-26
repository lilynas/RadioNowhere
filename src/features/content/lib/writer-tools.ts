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

export const WRITER_TOOLS: ToolDefinition[] = [
    {
        name: 'search_music',
        description: '搜索歌曲。⚠️ 重要：此API只支持搜索【具体歌手名】或【具体歌名】，不支持搜索风格/流派！根据节目主题和禁止列表（见系统提示），选择合适的歌手或歌曲进行搜索。',
        parameters: [
            { name: 'query', type: 'string', description: '搜索关键词（必须是具体歌手名或歌曲名，如"周杰伦"、"Shape of You"）', required: true },
            { name: 'mood', type: 'string', description: '期望的情绪氛围（仅供参考，不影响搜索）', required: false }
        ]
    },
    {
        name: 'get_lyrics',
        description: '获取歌曲歌词。需要先用 search_music 获取 lyricId。',
        parameters: [
            { name: 'song_title', type: 'string', description: '歌曲名称', required: true },
            { name: 'lyric_id', type: 'string', description: '歌词ID (从 search_music 结果获取)', required: false }
        ]
    },
    {
        name: 'fetch_news',
        description: '获取今日实时热点新闻。可用于任何需要话题素材的节目：新闻播报、脱口秀、时事评论、闲聊话题等。返回当日热点新闻列表，编剧可自由选用。',
        parameters: [
            { name: 'count', type: 'number', description: '需要的新闻条数（默认10条，最多15条）', required: false }
        ]
    },
    {
        name: 'check_duplicate',
        description: '检查节目概念是否与近1小时内的节目雷同。返回 true/false。',
        parameters: [
            { name: 'concept', type: 'string', description: '节目概念描述', required: true }
        ]
    },
    {
        name: 'check_artist_diversity',
        description: '检查节目中的歌手多样性。输入本节目中选择的所有歌手（用逗号分隔），系统会评估是否满足多样性和禁止列表要求。这是必须调用的最终检查。',
        parameters: [
            { name: 'artists', type: 'string', description: '本节目中选择的所有歌手名单（用逗号分隔，如："朴树,The Weeknd,五月天,Norah Jones"）', required: true }
        ]
    },
    {
        name: 'submit_show',
        description: '提交最终节目。如果格式正确返回成功，否则返回错误信息供修正。这是唯一能结束循环的方式。',
        parameters: [
            { name: 'timeline_json', type: 'string', description: '完整的 ShowTimeline JSON', required: true }
        ]
    }
];

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
                return await executeSearchMusic(args.query as string);

            case 'get_lyrics':
                return await executeGetLyrics(args.song_title as string, args.lyric_id as string | undefined);

            case 'fetch_news':
                return await executeFetchNews(args.count as number | undefined);

            case 'check_duplicate':
                return executeCheckDuplicate(args.concept as string);

            case 'check_artist_diversity':
                return executeCheckArtistDiversity(args.artists as string);

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

async function executeSearchMusic(query: string): Promise<ToolResult> {
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
                results,
                recommendedIndex: recommendIndex,
                note: `找到 ${results.length} 首可播放的歌曲。建议选择第 ${recommendIndex + 1} 首（索引 ${recommendIndex}），或从列表中随机选择一首，不要总是选第一首！`
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

        if ((data.code !== 201 && data.code !== 200) || !data.data?.news) {
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
                note: '以上为今日实时新闻，可选择2-5条有趣的新闻进行播报和点评'
            }
        };
    } catch (error) {
        return { success: false, error: `获取新闻失败: ${String(error)}` };
    }
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

/**
 * 生成工具描述（用于 System Prompt）
 */
export function getToolsDescription(): string {
    return WRITER_TOOLS.map(tool => {
        const params = tool.parameters.map(p =>
            `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
        ).join('\n');
        return `### ${tool.name}\n${tool.description}\nParameters:\n${params}`;
    }).join('\n\n');
}
