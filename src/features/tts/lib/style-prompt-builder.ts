/**
 * Style Prompt Builder - TTS 风格提示构建
 * 基于 Google 官方推荐的 TTS 提示结构
 */

import {
    VOICE_PROFILES,
    SpeakerId,
    MoodType
} from '@shared/types/radio-core';

// ================== Character Profiles ==================

/**
 * 角色详细配置（通用模板，不绑定具体名字）
 */
export const CHARACTER_PROFILES: Record<string, {
    name: string;
    role: string;
    personality: string;
    accent: string;
    scene: string;
}> = {
    host1: {
        name: '女主持人',
        role: '电台女主持人',
        personality: '温柔知性，声音清澈，带着让人放松的治愈感',
        accent: '标准普通话，自然流畅',
        scene: '电台直播间，柔和的灯光，轻松的氛围'
    },
    host2: {
        name: '男主持人',
        role: '电台男主持人',
        personality: '阳光开朗，声音有磁性，幽默风趣又不失专业',
        accent: '标准普通话，清晰利落',
        scene: '电台直播间，与搭档主持，气氛轻松愉快'
    },
    guest: {
        name: '嘉宾',
        role: '电台访谈嘉宾',
        personality: '专业、有见解，说话有条理',
        accent: '标准普通话',
        scene: '电台访谈室，接受采访'
    },
    news: {
        name: '新闻播报员',
        role: '整点新闻播报员',
        personality: '专业稳重，客观中立',
        accent: '标准新闻播音腔',
        scene: '新闻直播间，正式的播报环境'
    },
    announcer: {
        name: '报时员',
        role: '整点报时播报员',
        personality: '专业严肃，声音沉稳有力',
        accent: '标准播音腔，清晰准确',
        scene: '电台报时间隙，庄重的报时环境'
    }
};

// ================== Mood Descriptions ==================

const MOOD_DESCRIPTIONS: Record<MoodType, string> = {
    cheerful: '开朗愉快，带着微笑的语气，让听众感到快乐',
    calm: '平静舒缓，像轻柔的夜风，让人感到放松',
    excited: '兴奋激动，语速略快，充满热情和感染力',
    serious: '严肃认真，专业可信，语调沉稳',
    warm: '温暖亲切，像老朋友一样，充满关怀',
    playful: '俏皮活泼，带点调侃，语调上扬',
    melancholy: '略带忧郁，深情款款，声音轻柔',
    mysterious: '神秘莫测，引人入胜，语速放慢'
};

// ================== Style Prompt Builder ==================

/**
 * 构建 TTS 风格提示（Google 官方推荐结构）
 * 
 * 结构：
 * 1. AUDIO PROFILE - 角色身份和原型
 * 2. THE SCENE - 场景和氛围
 * 3. DIRECTOR'S NOTES - 风格、节奏、口音指导
 */
export function buildStylePrompt(
    speaker: SpeakerId,
    mood?: MoodType,
    customStyle?: string
): string {
    const profile = VOICE_PROFILES[speaker];
    const character = CHARACTER_PROFILES[speaker] || CHARACTER_PROFILES.host1;

    let prompt = `# AUDIO PROFILE: ${character.name}
## "${character.role}"

${character.personality}

## THE SCENE: 深夜电台直播间
${character.scene}。红色的 "ON AIR" 指示灯亮着，话筒前的主持人正准备开口。

### DIRECTOR'S NOTES
Style: ${profile.style}`;

    if (mood) {
        prompt += `
Mood: ${MOOD_DESCRIPTIONS[mood]}`;
    }

    prompt += `
Pacing: 适中舒缓，像深夜电台主持人一样，不急不慢
Accent: ${character.accent}`;

    if (customStyle) {
        prompt += `
Special Instructions: ${customStyle}`;
    }

    prompt += `

### PERFORMANCE GUIDANCE
- 声音要有"微笑感"，让听众感受到温暖
- 语调自然起伏，避免机械朗读
- 适当停顿，让内容更有节奏感`;

    return prompt;
}

/**
 * 判断是否为标准 SpeakerId
 */
export function isStandardSpeaker(speaker: string): speaker is SpeakerId {
    return ['host1', 'host2', 'guest', 'news', 'announcer'].includes(speaker);
}
