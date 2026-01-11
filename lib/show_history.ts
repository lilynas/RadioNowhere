/**
 * Show History - 节目历史记录
 * 追踪近期节目和歌曲，避免重复
 */

// ================== Types ==================

export interface ShowRecord {
    timestamp: number;
    concept: string;      // 节目概念 (如 "深夜故事会")
    style: string;        // 风格标签 (如 "温馨治愈")
    hosts: string[];      // 主持人名称
}

export interface ShowHistory {
    recentShows: ShowRecord[];
    recentSongs: string[];
    lastBreakTime: number;
}

// ================== Constants ==================

const HISTORY_DURATION_MS = 60 * 60 * 1000; // 1 小时
const MAX_RECENT_SHOWS = 30;
const MAX_RECENT_SONGS = 50;

// ================== Storage ==================

let history: ShowHistory = {
    recentShows: [],
    recentSongs: [],
    lastBreakTime: 0
};

// ================== Core Functions ==================

/**
 * 记录一期节目
 */
export function recordShow(concept: string, style: string, hosts: string[] = []): void {
    const now = Date.now();

    // 清理过期记录
    cleanupHistory();

    history.recentShows.push({
        timestamp: now,
        concept,
        style,
        hosts
    });

    // 限制数量
    if (history.recentShows.length > MAX_RECENT_SHOWS) {
        history.recentShows = history.recentShows.slice(-MAX_RECENT_SHOWS);
    }
}

/**
 * 记录播放的歌曲
 */
export function recordSong(songTitle: string): void {
    cleanupHistory();

    if (!history.recentSongs.includes(songTitle)) {
        history.recentSongs.push(songTitle);
    }

    // 限制数量
    if (history.recentSongs.length > MAX_RECENT_SONGS) {
        history.recentSongs = history.recentSongs.slice(-MAX_RECENT_SONGS);
    }
}

/**
 * 记录休息时间
 */
export function recordBreak(): void {
    history.lastBreakTime = Date.now();
}

/**
 * 检查节目概念是否与近期雷同
 * 使用简单的关键词匹配
 */
export function isDuplicateConcept(concept: string): boolean {
    cleanupHistory();

    const keywords = extractKeywords(concept);

    for (const show of history.recentShows) {
        const showKeywords = extractKeywords(show.concept);
        const overlap = keywords.filter(k => showKeywords.includes(k));

        // 如果关键词重叠超过 50%，认为雷同
        if (overlap.length >= Math.ceil(keywords.length * 0.5)) {
            return true;
        }
    }

    return false;
}

/**
 * 检查歌曲是否已播放过
 */
export function isSongPlayed(songTitle: string): boolean {
    cleanupHistory();
    return history.recentSongs.some(s =>
        s.toLowerCase().includes(songTitle.toLowerCase()) ||
        songTitle.toLowerCase().includes(s.toLowerCase())
    );
}

/**
 * 获取近期节目概念列表（用于 AI 上下文）
 */
export function getRecentConcepts(): string[] {
    cleanupHistory();
    return history.recentShows.map(s => s.concept);
}

/**
 * 获取近期歌曲列表（用于 AI 上下文）
 */
export function getRecentSongs(): string[] {
    cleanupHistory();
    return [...history.recentSongs];
}

/**
 * 获取完整历史（用于调试）
 */
export function getHistory(): ShowHistory {
    cleanupHistory();
    return { ...history };
}

/**
 * 重置历史（用于测试）
 */
export function resetHistory(): void {
    history = {
        recentShows: [],
        recentSongs: [],
        lastBreakTime: 0
    };
}

// ================== Helper Functions ==================

/**
 * 清理过期记录
 */
function cleanupHistory(): void {
    const cutoff = Date.now() - HISTORY_DURATION_MS;

    history.recentShows = history.recentShows.filter(s => s.timestamp > cutoff);
}

/**
 * 提取关键词（用于相似度比较）
 */
function extractKeywords(text: string): string[] {
    // 移除常见词，提取核心关键词
    const stopWords = ['的', '和', '与', '在', '是', '有', '了', '不', '这', '那', '会', '电台', '节目', '故事', 'the', 'a', 'an', 'radio', 'show'];

    return text
        .toLowerCase()
        .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, '') // 只保留中英文和数字
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.includes(w));
}
