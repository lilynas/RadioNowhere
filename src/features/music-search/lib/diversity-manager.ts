/**
 * Diversity Manager - 歌手多样性管理器
 * 追踪近24小时内已使用的歌手，持久化到 localStorage
 */

// ================== Storage Constants ==================

const STORAGE_KEY = 'nowhere_fm_prohibited_artists';
const ARTIST_PROHIBITION_MS = 24 * 60 * 60 * 1000; // 24小时

// ================== Types ==================

interface ProhibitedArtistEntry {
    artist: string;
    timestamp: number;
}

// ================== Storage Functions ==================

/**
 * 从 localStorage 加载禁止列表
 */
function loadProhibitedArtists(): ProhibitedArtistEntry[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as ProhibitedArtistEntry[];
            // 过滤过期记录
            const cutoff = Date.now() - ARTIST_PROHIBITION_MS;
            return parsed.filter(a => a.timestamp > cutoff);
        }
    } catch (e) {
        console.warn('[DiversityManager] Failed to load from localStorage:', e);
    }

    return [];
}

/**
 * 保存禁止列表到 localStorage
 */
function saveProhibitedArtists(artists: ProhibitedArtistEntry[]): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(artists));
    } catch (e) {
        console.warn('[DiversityManager] Failed to save to localStorage:', e);
    }
}

// ================== State Management ==================

// 初始化时从 localStorage 加载
let prohibitedArtists: ProhibitedArtistEntry[] = loadProhibitedArtists();

/**
 * 获取禁止列表（近24小时内已使用的歌手）
 */
export function getProhibitedArtists(): string[] {
    const cutoff = Date.now() - ARTIST_PROHIBITION_MS;
    // 清理过期记录
    const validArtists = prohibitedArtists.filter(a => a.timestamp > cutoff);
    
    // 如果有清理，更新内存和存储
    if (validArtists.length !== prohibitedArtists.length) {
        prohibitedArtists = validArtists;
        saveProhibitedArtists(prohibitedArtists);
    }
    
    return prohibitedArtists.map(a => a.artist);
}

/**
 * 记录已使用的歌手（添加到禁止列表）
 */
export function addProhibitedArtist(artist: string): void {
    // 标准化歌手名（去除首尾空格）
    const normalizedArtist = artist.trim();
    if (!normalizedArtist) return;

    // 检查是否已存在（不区分大小写）
    const exists = prohibitedArtists.some(
        a => a.artist.toLowerCase() === normalizedArtist.toLowerCase()
    );
    
    if (!exists) {
        prohibitedArtists.push({ artist: normalizedArtist, timestamp: Date.now() });
        saveProhibitedArtists(prohibitedArtists);
    }
}

/**
 * 批量记录多个歌手
 */
export function addProhibitedArtists(artists: string[]): void {
    let hasNew = false;
    
    for (const artist of artists) {
        const normalizedArtist = artist.trim();
        if (!normalizedArtist) continue;

        const exists = prohibitedArtists.some(
            a => a.artist.toLowerCase() === normalizedArtist.toLowerCase()
        );
        
        if (!exists) {
            prohibitedArtists.push({ artist: normalizedArtist, timestamp: Date.now() });
            hasNew = true;
        }
    }
    
    // 只有新增时才保存
    if (hasNew) {
        saveProhibitedArtists(prohibitedArtists);
    }
}

/**
 * 检查歌手是否在禁止列表中
 */
export function isArtistProhibited(artist: string): boolean {
    const prohibited = getProhibitedArtists();
    return prohibited.some(p => 
        p.toLowerCase() === artist.toLowerCase()
    );
}

/**
 * 分析音乐多样性（用于检查工具）
 */
export function analyzeDiversity(artists: string[]): {
    score: number;
    feedback: string[];
    violations: string[];
} {
    const prohibited = getProhibitedArtists();
    
    // 检查禁止列表违反
    const violations = artists.filter(a => 
        prohibited.some(p => p.toLowerCase() === a.toLowerCase())
    );
    
    const feedback: string[] = [];
    let score = 0;
    
    // 检查唯一性
    const uniqueArtists = new Set(artists.map(a => a.toLowerCase()));
    const uniquenessRatio = uniqueArtists.size / artists.length;
    if (uniquenessRatio === 1) {
        score += 40;
        feedback.push('✓ 歌手唯一性完美（每个歌手仅一次）');
    } else {
        score += Math.floor(uniquenessRatio * 40);
        feedback.push(`✗ 歌手重复：${(1 - uniquenessRatio) * 100 | 0}% 重复率`);
    }
    
    // 检查语言多样性
    const hasChineseSingers = artists.some(a => /[\u4E00-\u9FA5]/.test(a));
    const hasEnglishSingers = artists.some(a => /[a-zA-Z\s]/.test(a));
    if (hasChineseSingers && hasEnglishSingers) {
        score += 30;
        feedback.push('✓ 语言多样性：中英混搭');
    } else {
        feedback.push('✗ 语言单一');
    }
    
    // 检查歌手数量
    if (uniqueArtists.size >= 3) {
        score += 20;
        feedback.push(`✓ 歌手数量充足：${uniqueArtists.size}个不同歌手`);
    } else {
        feedback.push(`✗ 歌手数量过少：仅${uniqueArtists.size}个`);
    }
    
    // 检查禁止列表
    if (violations.length === 0) {
        score += 10;
        feedback.push('✓ 禁止列表：完全遵守');
    } else {
        feedback.push(`❌ 禁止列表违反：${violations.join(', ')}`);
        score = 0; // 违反禁止列表则整体失败
    }
    
    return { score, feedback, violations };
}

/**
 * 清空禁止列表（仅用于测试或管理员操作）
 */
export function clearProhibitedArtists(): void {
    prohibitedArtists = [];
    saveProhibitedArtists(prohibitedArtists);
}

/**
 * 获取禁止列表的统计信息（用于调试）
 */
export function getProhibitedArtistsStats(): {
    count: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
} {
    const artists = getProhibitedArtists();
    if (prohibitedArtists.length === 0) {
        return { count: 0, oldestTimestamp: null, newestTimestamp: null };
    }
    
    const timestamps = prohibitedArtists.map(a => a.timestamp);
    return {
        count: artists.length,
        oldestTimestamp: Math.min(...timestamps),
        newestTimestamp: Math.max(...timestamps)
    };
}

// ================== Debug Helper ==================

// 暴露到 window 对象以便在浏览器控制台中调试
if (typeof window !== 'undefined') {
    (window as unknown as { nowhereFmDiversity: object }).nowhereFmDiversity = {
        getProhibited: getProhibitedArtists,
        getStats: getProhibitedArtistsStats,
        clear: clearProhibitedArtists,
        isProhibited: isArtistProhibited,
        // 查看完整禁止列表（包含时间戳）
        getFullList: () => prohibitedArtists,
    };
    console.log('[DiversityManager] Debug tools available: window.nowhereFmDiversity');
}
