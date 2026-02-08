import { ShowType } from './cast-system';

export type MusicPurpose = 'main' | 'background' | 'transition_only';

export interface ShowConfig {
    type: ShowType;
    talkRatio: [number, number];
    musicRatio: [number, number];
    musicPurpose: MusicPurpose;
    requiredTools: string[];
    optionalTools: string[];
    promptTemplate: string;
    preferredSegmentOrder: Array<'opening' | 'main_topic' | 'music_break' | 'interaction' | 'closing'>;
}

export const SHOW_CONFIGS: Record<ShowType, ShowConfig> = {
    talk: {
        type: 'talk',
        talkRatio: [70, 85],
        musicRatio: [15, 30],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_music', 'check_artist_diversity', 'submit_show'],
        optionalTools: ['fetch_news', 'search_quotes'],
        promptTemplate: 'talk',
        preferredSegmentOrder: ['opening', 'main_topic', 'interaction', 'music_break', 'closing']
    },
    interview: {
        type: 'interview',
        talkRatio: [75, 90],
        musicRatio: [10, 25],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_music', 'check_artist_diversity', 'submit_show'],
        optionalTools: ['search_knowledge', 'fetch_trending'],
        promptTemplate: 'talk',
        preferredSegmentOrder: ['opening', 'main_topic', 'interaction', 'closing']
    },
    news: {
        type: 'news',
        talkRatio: [80, 95],
        musicRatio: [5, 20],
        musicPurpose: 'transition_only',
        requiredTools: ['check_duplicate', 'fetch_news', 'submit_show'],
        optionalTools: ['fetch_weather', 'search_knowledge'],
        promptTemplate: 'news',
        preferredSegmentOrder: ['opening', 'main_topic', 'interaction', 'closing']
    },
    drama: {
        type: 'drama',
        talkRatio: [75, 90],
        musicRatio: [10, 25],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_knowledge', 'submit_show'],
        optionalTools: ['search_music', 'search_quotes'],
        promptTemplate: 'story',
        preferredSegmentOrder: ['opening', 'main_topic', 'music_break', 'closing']
    },
    entertainment: {
        type: 'entertainment',
        talkRatio: [65, 80],
        musicRatio: [20, 35],
        musicPurpose: 'main',
        requiredTools: ['check_duplicate', 'search_music', 'check_artist_diversity', 'submit_show'],
        optionalTools: ['fetch_trending', 'search_quotes'],
        promptTemplate: 'entertainment',
        preferredSegmentOrder: ['opening', 'interaction', 'main_topic', 'music_break', 'closing']
    },
    story: {
        type: 'story',
        talkRatio: [75, 90],
        musicRatio: [10, 25],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_knowledge', 'submit_show'],
        optionalTools: ['search_quotes', 'search_music'],
        promptTemplate: 'story',
        preferredSegmentOrder: ['opening', 'main_topic', 'music_break', 'closing']
    },
    history: {
        type: 'history',
        talkRatio: [80, 92],
        musicRatio: [8, 20],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_knowledge', 'submit_show'],
        optionalTools: ['search_quotes', 'search_music'],
        promptTemplate: 'story',
        preferredSegmentOrder: ['opening', 'main_topic', 'closing']
    },
    science: {
        type: 'science',
        talkRatio: [80, 92],
        musicRatio: [8, 20],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_knowledge', 'submit_show'],
        optionalTools: ['fetch_trending', 'search_music'],
        promptTemplate: 'story',
        preferredSegmentOrder: ['opening', 'main_topic', 'interaction', 'closing']
    },
    mystery: {
        type: 'mystery',
        talkRatio: [75, 88],
        musicRatio: [12, 25],
        musicPurpose: 'background',
        requiredTools: ['check_duplicate', 'search_knowledge', 'search_music', 'submit_show'],
        optionalTools: ['search_quotes'],
        promptTemplate: 'story',
        preferredSegmentOrder: ['opening', 'main_topic', 'music_break', 'closing']
    },
    nighttalk: {
        type: 'nighttalk',
        talkRatio: [70, 85],
        musicRatio: [15, 30],
        musicPurpose: 'main',
        requiredTools: ['check_duplicate', 'search_music', 'check_artist_diversity', 'submit_show'],
        optionalTools: ['search_quotes', 'fetch_weather'],
        promptTemplate: 'talk',
        preferredSegmentOrder: ['opening', 'interaction', 'main_topic', 'music_break', 'closing']
    },
    music: {
        type: 'music',
        talkRatio: [40, 60],
        musicRatio: [40, 60],
        musicPurpose: 'main',
        requiredTools: ['check_duplicate', 'search_music', 'check_artist_diversity', 'submit_show'],
        optionalTools: ['get_lyrics', 'search_knowledge'],
        promptTemplate: 'music',
        preferredSegmentOrder: ['opening', 'main_topic', 'music_break', 'interaction', 'closing']
    }
};

export function getShowConfig(type: ShowType): ShowConfig {
    return SHOW_CONFIGS[type] || SHOW_CONFIGS.talk;
}
