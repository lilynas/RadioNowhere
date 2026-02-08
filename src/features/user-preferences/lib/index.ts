import { ShowType } from '@features/content/lib/cast-system';

const STORAGE_KEY = 'radio_nowhere_user_preferences_v1';

export type ExplorationLevel = 'conservative' | 'balanced' | 'adventurous';

export interface UserPreference {
    favoriteGenres: string[];
    dislikedGenres: string[];
    favoriteShowTypes: ShowType[];
    explorationLevel: ExplorationLevel;
}

export const DEFAULT_USER_PREFERENCE: UserPreference = {
    favoriteGenres: [],
    dislikedGenres: [],
    favoriteShowTypes: [],
    explorationLevel: 'balanced'
};

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function normalizeShowTypes(value: unknown): ShowType[] {
    const allowed: ShowType[] = [
        'talk', 'interview', 'news', 'drama', 'entertainment',
        'story', 'history', 'science', 'mystery', 'nighttalk', 'music'
    ];

    if (!Array.isArray(value)) return [];

    return value.filter((item): item is ShowType =>
        typeof item === 'string' && allowed.includes(item as ShowType)
    );
}

function normalizeExplorationLevel(value: unknown): ExplorationLevel {
    if (value === 'conservative' || value === 'balanced' || value === 'adventurous') {
        return value;
    }

    return 'balanced';
}

export function getUserPreference(): UserPreference {
    if (!isBrowser()) {
        return DEFAULT_USER_PREFERENCE;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_USER_PREFERENCE;
        }

        const parsed = JSON.parse(raw) as Partial<UserPreference>;
        return {
            favoriteGenres: normalizeStringArray(parsed.favoriteGenres),
            dislikedGenres: normalizeStringArray(parsed.dislikedGenres),
            favoriteShowTypes: normalizeShowTypes(parsed.favoriteShowTypes),
            explorationLevel: normalizeExplorationLevel(parsed.explorationLevel)
        };
    } catch {
        return DEFAULT_USER_PREFERENCE;
    }
}

export function saveUserPreference(preference: UserPreference): void {
    if (!isBrowser()) return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    } catch (error) {
        console.warn('[UserPreference] Failed to save:', error);
    }
}

export function updateUserPreference(patch: Partial<UserPreference>): UserPreference {
    const current = getUserPreference();

    const next: UserPreference = {
        favoriteGenres: patch.favoriteGenres ? normalizeStringArray(patch.favoriteGenres) : current.favoriteGenres,
        dislikedGenres: patch.dislikedGenres ? normalizeStringArray(patch.dislikedGenres) : current.dislikedGenres,
        favoriteShowTypes: patch.favoriteShowTypes ? normalizeShowTypes(patch.favoriteShowTypes) : current.favoriteShowTypes,
        explorationLevel: patch.explorationLevel ? normalizeExplorationLevel(patch.explorationLevel) : current.explorationLevel
    };

    saveUserPreference(next);
    return next;
}

export function getUserPreferencePromptContext(): string {
    const preference = getUserPreference();

    const lines: string[] = ['## 🧭 听众偏好'];

    lines.push(`- 探索偏好：${preference.explorationLevel}`);

    if (preference.favoriteShowTypes.length > 0) {
        lines.push(`- 偏好节目类型：${preference.favoriteShowTypes.join('、')}`);
    }

    if (preference.favoriteGenres.length > 0) {
        lines.push(`- 喜爱曲风：${preference.favoriteGenres.join('、')}`);
    }

    if (preference.dislikedGenres.length > 0) {
        lines.push(`- 尽量避免：${preference.dislikedGenres.join('、')}`);
    }

    if (
        preference.favoriteShowTypes.length === 0 &&
        preference.favoriteGenres.length === 0 &&
        preference.dislikedGenres.length === 0
    ) {
        lines.push('- 当前无显式偏好，默认平衡探索。');
    }

    return lines.join('\n');
}
