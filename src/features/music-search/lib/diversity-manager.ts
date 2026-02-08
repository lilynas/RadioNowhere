// 禁止列表管理 - 追踪近24小时内已使用的歌手（支持 localStorage 持久化）

interface ProhibitedArtistEntry {
    artist: string;
    timestamp: number;
}

const STORAGE_KEY = 'radio_nowhere_prohibited_artists_v1';
const ARTIST_PROHIBITION_MS = 24 * 60 * 60 * 1000; // 24小时

let prohibitedArtists: ProhibitedArtistEntry[] = [];
let initialized = false;

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function pruneExpired(entries: ProhibitedArtistEntry[]): ProhibitedArtistEntry[] {
    const cutoff = Date.now() - ARTIST_PROHIBITION_MS;
    return entries.filter(entry => entry.timestamp > cutoff);
}

function normalizeEntries(raw: unknown): ProhibitedArtistEntry[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map(item => {
            const artist = typeof item?.artist === 'string' ? item.artist.trim() : '';
            const timestamp = Number(item?.timestamp);
            if (!artist || !Number.isFinite(timestamp)) return null;

            return {
                artist,
                timestamp
            };
        })
        .filter((entry): entry is ProhibitedArtistEntry => Boolean(entry));
}

function saveToStorage(): void {
    if (!isBrowser()) return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prohibitedArtists));
    } catch (error) {
        console.warn('[DiversityManager] Failed to save prohibited artists:', error);
    }
}

function loadFromStorage(): void {
    if (!isBrowser()) return;

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as unknown;
        prohibitedArtists = normalizeEntries(parsed);
    } catch (error) {
        console.warn('[DiversityManager] Failed to load prohibited artists:', error);
        prohibitedArtists = [];
    }
}

function ensureInitialized(): void {
    if (initialized) return;

    loadFromStorage();
    prohibitedArtists = pruneExpired(prohibitedArtists);
    initialized = true;
    saveToStorage();
}

/**
 * 手动加载禁止列表（可选）
 */
export function loadProhibitedArtists(): void {
    initialized = false;
    ensureInitialized();
}

/**
 * 手动保存禁止列表（可选）
 */
export function saveProhibitedArtists(): void {
    ensureInitialized();
    saveToStorage();
}

/**
 * 获取禁止列表（近24小时内已使用的歌手）
 */
export function getProhibitedArtists(): string[] {
    ensureInitialized();

    const cleaned = pruneExpired(prohibitedArtists);
    if (cleaned.length !== prohibitedArtists.length) {
        prohibitedArtists = cleaned;
        saveToStorage();
    }

    return prohibitedArtists.map(entry => entry.artist);
}

/**
 * 记录已使用的歌手（添加到禁止列表）
 */
export function addProhibitedArtist(artist: string): void {
    ensureInitialized();

    const normalizedArtist = artist.trim();
    if (!normalizedArtist) return;

    const exists = prohibitedArtists.some(entry => entry.artist.toLowerCase() === normalizedArtist.toLowerCase());
    if (!exists) {
        prohibitedArtists.push({ artist: normalizedArtist, timestamp: Date.now() });
        saveToStorage();
    }
}

/**
 * 批量记录多个歌手
 */
export function addProhibitedArtists(artists: string[]): void {
    artists.forEach(artist => addProhibitedArtist(artist));
}

/**
 * 检查歌手是否在禁止列表中
 */
export function isArtistProhibited(artist: string): boolean {
    const prohibited = getProhibitedArtists();
    return prohibited.some(item => item.toLowerCase() === artist.toLowerCase());
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
    const violations = artists.filter(artist =>
        prohibited.some(item => item.toLowerCase() === artist.toLowerCase())
    );

    const feedback: string[] = [];
    let score = 0;

    // 检查唯一性
    const uniqueArtists = new Set(artists.map(artist => artist.toLowerCase()));
    const uniquenessRatio = uniqueArtists.size / artists.length;
    if (uniquenessRatio === 1) {
        score += 40;
        feedback.push('✓ 歌手唯一性完美（每个歌手仅一次）');
    } else {
        score += Math.floor(uniquenessRatio * 40);
        feedback.push(`✗ 歌手重复：${(1 - uniquenessRatio) * 100 | 0}% 重复率`);
    }

    // 检查语言多样性
    const hasChineseSingers = artists.some(artist => /[\u4E00-\u9FA5]/.test(artist));
    const hasEnglishSingers = artists.some(artist => /[a-zA-Z\s]/.test(artist));
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
    ensureInitialized();
    prohibitedArtists.length = 0;
    saveToStorage();
}
