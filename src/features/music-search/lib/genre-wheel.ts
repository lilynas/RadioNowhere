interface GenreDimension {
    name: string;
    options: string[];
}

interface UsedGenreEntry {
    value: string;
    timestamp: number;
}

const STORAGE_KEY = 'radio_nowhere_genre_wheel_v1';
const GENRE_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 小时
const DEFAULT_SUGGESTION_COUNT = 3;

export const GENRE_DIMENSIONS: GenreDimension[] = [
    {
        name: '流派',
        options: ['民谣/Folk', '摇滚/Rock', '电子/Electronic', '爵士/Jazz', '说唱/Hip-Hop', '古典/Classical']
    },
    {
        name: '年代',
        options: ['60年代', '70年代', '80年代', '90年代', '00年代', '10年代', '2020+']
    },
    {
        name: '文化',
        options: ['华语', '欧美', '日韩', '拉美', '非洲', '世界融合']
    },
    {
        name: '氛围',
        options: ['治愈', '激情', '忧郁', '浪漫', '复古', '未来感', '深夜陪伴']
    }
];

let usedGenres: UsedGenreEntry[] = [];
let initialized = false;

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function pruneExpired(entries: UsedGenreEntry[]): UsedGenreEntry[] {
    const threshold = Date.now() - GENRE_EXPIRY_MS;
    return entries.filter(entry => entry.timestamp > threshold);
}

function normalizeEntries(raw: unknown): UsedGenreEntry[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map(item => {
            const value = typeof item?.value === 'string' ? item.value.trim() : '';
            const timestamp = Number(item?.timestamp);
            if (!value || !Number.isFinite(timestamp)) return null;
            return { value, timestamp };
        })
        .filter((entry): entry is UsedGenreEntry => Boolean(entry));
}

function loadFromStorage(): void {
    if (!isBrowser()) return;

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        usedGenres = normalizeEntries(JSON.parse(raw));
    } catch (error) {
        console.warn('[GenreWheel] Failed to load storage:', error);
        usedGenres = [];
    }
}

function saveToStorage(): void {
    if (!isBrowser()) return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(usedGenres));
    } catch (error) {
        console.warn('[GenreWheel] Failed to save storage:', error);
    }
}

function ensureInitialized(): void {
    if (initialized) return;

    loadFromStorage();
    usedGenres = pruneExpired(usedGenres);
    initialized = true;
    saveToStorage();
}

function pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

function buildGenreCombo(): string {
    return GENRE_DIMENSIONS
        .map(dimension => `${dimension.name}:${pickRandom(dimension.options)}`)
        .join('｜');
}

function getRecentGenreSet(): Set<string> {
    ensureInitialized();
    usedGenres = pruneExpired(usedGenres);
    return new Set(usedGenres.map(entry => entry.value.toLowerCase()));
}

export function getGenreSuggestions(count: number = DEFAULT_SUGGESTION_COUNT): string[] {
    const safeCount = Math.max(1, Math.min(count, 6));
    const recent = getRecentGenreSet();
    const suggestions: string[] = [];

    let attempts = 0;
    const maxAttempts = 50;

    while (suggestions.length < safeCount && attempts < maxAttempts) {
        attempts += 1;
        const candidate = buildGenreCombo();
        const key = candidate.toLowerCase();

        if (recent.has(key) || suggestions.some(item => item.toLowerCase() === key)) {
            continue;
        }

        suggestions.push(candidate);
    }

    while (suggestions.length < safeCount) {
        suggestions.push(buildGenreCombo());
    }

    return suggestions;
}

export function recordUsedGenre(genre: string): void {
    ensureInitialized();

    const normalized = genre.trim();
    if (!normalized) return;

    const exists = usedGenres.some(entry => entry.value.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
        usedGenres.push({ value: normalized, timestamp: Date.now() });
    } else {
        usedGenres = usedGenres.map(entry =>
            entry.value.toLowerCase() === normalized.toLowerCase()
                ? { ...entry, timestamp: Date.now() }
                : entry
        );
    }

    usedGenres = pruneExpired(usedGenres);
    saveToStorage();
}

export function getGenrePromptSection(suggestions: string[] = getGenreSuggestions()): string {
    if (!suggestions.length) return '';

    return [
        '## 🎼 曲风轮盘建议（仅音乐节目强制参考）',
        ...suggestions.map((item, index) => `${index + 1}. ${item}`),
        '',
        '请优先从以上方向中选择至少 1 个作为本期音乐专题主线，并在选歌理由中体现该维度。'
    ].join('\n');
}

export function clearGenreHistory(): void {
    ensureInitialized();
    usedGenres = [];
    saveToStorage();
}
