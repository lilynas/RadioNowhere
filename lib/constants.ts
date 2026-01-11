/**
 * Radio Nowhere - 全局常量配置
 * 所有可调参数集中管理
 */

// ================== 音频配置 ==================

export const AUDIO = {
    // 音量
    MUSIC_DEFAULT_VOLUME: 0.9,        // 音乐默认音量
    VOICE_DEFAULT_VOLUME: 1.0,        // 语音默认音量
    MASTER_DEFAULT_VOLUME: 0.85,      // 主音量
    MUSIC_DURING_VOICE: 0.15,         // 语音播放时音乐音量
    MUSIC_FADE_LOW: 0.1,              // 音乐最低淡入淡出音量

    // 淡入淡出时长 (ms)
    FADE_DURATION_QUICK: 500,         // 快速淡入淡出
    FADE_DURATION_NORMAL: 1000,       // 正常淡入淡出
    FADE_DURATION_SLOW: 2000,         // 慢速淡入淡出

    // 超时设置 (ms)
    MUSIC_LOAD_TIMEOUT: 15000,        // 音乐加载超时
    TTS_TIMEOUT: 30000,               // TTS 生成超时
};

// ================== Agent 配置 ==================

export const AGENT = {
    // Writer Agent
    MAX_REACT_LOOPS: 10,              // ReAct 最大循环次数
    MAX_PARSE_RETRIES: 3,             // 解析重试次数

    // Director Agent
    PRELOAD_BLOCKS_DEFAULT: 3,        // 默认预加载块数

    // TTS Agent
    MAX_CONCURRENT_TTS: 3,            // TTS 最大并发数
    API_RETRY_COUNT: 3,               // API 重试次数
    API_RETRY_BASE_DELAY: 1000,       // API 重试基础延迟 (ms)
};

// ================== 历史记录配置 ==================

export const HISTORY = {
    MAX_RECENT_SHOWS: 20,             // 最大近期节目记录数
    MAX_RECENT_SONGS: 50,             // 最大近期歌曲记录数
    DUPLICATE_CHECK_HOURS: 1,         // 重复检查时间范围（小时）
};

// ================== UI 配置 ==================

export const UI = {
    SUBTITLE_VISIBLE_DURATION: 5000,  // 字幕显示时长 (ms)
    AGENT_MONITOR_MAX_LOGS: 30,       // Agent Monitor 最大日志数
    AGENT_MONITOR_MAX_THOUGHTS: 20,   // Agent Monitor 最大思考数
};

// ================== 音乐服务配置 ==================

export const MUSIC_SERVICE = {
    DEFAULT_SEARCH_COUNT: 10,         // 默认搜索结果数
    DEFAULT_BITRATE: 320,             // 默认音质
    API_BASE_URL: 'https://music-api.gdstudio.xyz/api.php',
};
