/**
 * Cast System - 动态演员拼凑系统
 * 类似有声书配音，支持多角色动态组合
 */

import { ALL_VOICES, VoiceName } from './types/radio_types';

// ================== Types ==================

/** 节目类型 */
export type ShowType = 'talk' | 'interview' | 'news' | 'drama' | 'entertainment' | 'story';

/** 角色定义 */
export interface RoleDefinition {
    id: string;              // speaker id，如 "host1", "guest1", "narrator"
    name: string;            // 角色名称，如 "阿静"
    voiceTraits: {
        gender?: 'male' | 'female' | 'neutral';
        style?: string[];    // 期望风格: ["warm", "mature"]
        lang?: string;       // 语言偏好
    };
    personality: string;     // 人设描述
}

/** 节目模板 */
export interface ShowTemplate {
    type: ShowType;
    name: string;
    description: string;
    castSize: [number, number]; // [最少, 最多] 演员数
    roles: RoleDefinition[];
}

/** 演员阵容成员 */
export interface CastMember {
    roleId: string;          // 角色 ID
    roleName: string;        // 角色名称
    voiceName: VoiceName;    // 分配的音色
    personality: string;     // 人设描述
}

/** 完整演员阵容 */
export interface Cast {
    showType: ShowType;
    showName: string;
    members: CastMember[];
}

// ================== Show Templates ==================

export const SHOW_TEMPLATES: ShowTemplate[] = [
    {
        type: 'talk',
        name: '脱口秀',
        description: '双人闲聊节目，轻松有趣',
        castSize: [2, 2],
        roles: [
            {
                id: 'host1',
                name: '主持A',
                voiceTraits: { gender: 'female', style: ['warm', 'gentle'] },
                personality: '温柔知性，善于倾听和引导话题'
            },
            {
                id: 'host2',
                name: '主持B',
                voiceTraits: { gender: 'male', style: ['friendly', 'upbeat'] },
                personality: '幽默随和，擅长活跃气氛'
            }
        ]
    },
    {
        type: 'interview',
        name: '访谈节目',
        description: '深度对话，有主持人和嘉宾',
        castSize: [2, 4],
        roles: [
            {
                id: 'host',
                name: '主持人',
                voiceTraits: { gender: 'female', style: ['professional', 'warm'] },
                personality: '专业稳重，善于提问和引导'
            },
            {
                id: 'guest1',
                name: '嘉宾',
                voiceTraits: { gender: 'male', style: ['mature', 'knowledgeable'] },
                personality: '某领域专家，分享见解和经历'
            },
            {
                id: 'narrator',
                name: '旁白',
                voiceTraits: { gender: 'neutral', style: ['calm', 'informative'] },
                personality: '客观中立，负责介绍和过渡'
            }
        ]
    },
    {
        type: 'news',
        name: '新闻播报',
        description: '专业新闻资讯节目',
        castSize: [1, 3],
        roles: [
            {
                id: 'anchor',
                name: '主播',
                voiceTraits: { gender: 'female', style: ['firm', 'professional'] },
                personality: '专业权威，播报清晰准确'
            },
            {
                id: 'reporter',
                name: '记者',
                voiceTraits: { gender: 'male', style: ['energetic', 'informative'] },
                personality: '现场感强，报道生动'
            }
        ]
    },
    {
        type: 'drama',
        name: '广播剧',
        description: '有声小说/广播剧，多角色演绎',
        castSize: [3, 6],
        roles: [
            {
                id: 'narrator',
                name: '旁白',
                voiceTraits: { gender: 'neutral', style: ['smooth', 'mature'] },
                personality: '娓娓道来，富有故事感'
            },
            {
                id: 'char1',
                name: '角色一',
                voiceTraits: { gender: 'female', style: ['youthful', 'bright'] },
                personality: '女主角，活泼可爱'
            },
            {
                id: 'char2',
                name: '角色二',
                voiceTraits: { gender: 'male', style: ['deep', 'confident'] },
                personality: '男主角，沉稳可靠'
            },
            {
                id: 'char3',
                name: '角色三',
                voiceTraits: { gender: 'female', style: ['mature', 'elegant'] },
                personality: '配角，成熟优雅'
            },
            {
                id: 'char4',
                name: '角色四',
                voiceTraits: { gender: 'male', style: ['excitable', 'friendly'] },
                personality: '配角，热情开朗'
            }
        ]
    },
    {
        type: 'entertainment',
        name: '娱乐综艺',
        description: '轻松娱乐节目，多人互动',
        castSize: [3, 4],
        roles: [
            {
                id: 'mc',
                name: 'MC',
                voiceTraits: { gender: 'male', style: ['upbeat', 'energetic'] },
                personality: '主持控场，活力四射'
            },
            {
                id: 'panelist1',
                name: '嘉宾A',
                voiceTraits: { gender: 'female', style: ['playful', 'bright'] },
                personality: '话多有梗，反应快'
            },
            {
                id: 'panelist2',
                name: '嘉宾B',
                voiceTraits: { gender: 'male', style: ['casual', 'friendly'] },
                personality: '接梗王，幽默搞笑'
            },
            {
                id: 'panelist3',
                name: '嘉宾C',
                voiceTraits: { gender: 'female', style: ['warm', 'gentle'] },
                personality: '温柔吐槽，冷幽默'
            }
        ]
    },
    {
        type: 'story',
        name: '故事电台',
        description: '讲故事/读信节目',
        castSize: [1, 2],
        roles: [
            {
                id: 'storyteller',
                name: '讲述者',
                voiceTraits: { gender: 'female', style: ['warm', 'gentle', 'soft'] },
                personality: '声音温柔，娓娓道来，有画面感'
            },
            {
                id: 'commentator',
                name: '点评',
                voiceTraits: { gender: 'male', style: ['calm', 'thoughtful'] },
                personality: '偶尔点评，画龙点睛'
            }
        ]
    }
];

// ================== Cast Director ==================

export class CastDirector {
    private usedVoices: Set<VoiceName> = new Set();

    /**
     * 为节目选角
     */
    selectCast(showType: ShowType, customRoleCount?: number): Cast {
        const template = SHOW_TEMPLATES.find(t => t.type === showType) || SHOW_TEMPLATES[0];
        this.usedVoices.clear();

        // 确定实际角色数量
        const [minCast, maxCast] = template.castSize;
        const roleCount = customRoleCount
            ? Math.min(Math.max(customRoleCount, minCast), maxCast)
            : Math.min(template.roles.length, maxCast);

        // 为每个角色分配音色
        const members: CastMember[] = [];
        for (let i = 0; i < roleCount && i < template.roles.length; i++) {
            const role = template.roles[i];
            const voice = this.matchVoice(role.voiceTraits);

            members.push({
                roleId: role.id,
                roleName: role.name,
                voiceName: voice,
                personality: role.personality
            });
        }

        return {
            showType,
            showName: template.name,
            members
        };
    }

    /**
     * 根据角色特征匹配音色
     */
    private matchVoice(traits: RoleDefinition['voiceTraits']): VoiceName {
        const voiceEntries = Object.entries(ALL_VOICES) as [VoiceName, typeof ALL_VOICES[VoiceName]][];

        // 筛选可用音色（排除已使用的）
        const available = voiceEntries.filter(([name]) => !this.usedVoices.has(name));

        // 评分系统
        const scored = available.map(([name, info]) => {
            let score = 0;

            // 性别匹配 (+10)
            if (traits.gender && info.gender === traits.gender) {
                score += 10;
            }

            // 语言匹配 (+5)
            if (traits.lang) {
                if (info.lang === traits.lang || info.lang === 'multi') {
                    score += 5;
                }
            } else {
                // 默认偏好中文
                if (info.lang === 'zh' || info.lang === 'multi') {
                    score += 3;
                }
            }

            // 风格匹配 (+3 each)
            if (traits.style) {
                const styleStr = info.style.toLowerCase();
                traits.style.forEach(s => {
                    if (styleStr.includes(s.toLowerCase())) {
                        score += 3;
                    }
                });
            }

            // 随机因素避免总是选同一个
            score += Math.random() * 2;

            return { name, score };
        });

        // 选择得分最高的
        scored.sort((a, b) => b.score - a.score);
        const selected = scored[0]?.name || 'Aoede';

        this.usedVoices.add(selected);
        return selected;
    }

    /**
     * 随机选择节目类型
     */
    randomShowType(): ShowType {
        const hour = new Date().getHours();

        // 根据时段偏好不同节目类型
        if (hour >= 6 && hour < 9) {
            // 早间：新闻、脱口秀
            return Math.random() > 0.5 ? 'news' : 'talk';
        } else if (hour >= 9 && hour < 18) {
            // 白天：多种类型
            const types: ShowType[] = ['talk', 'interview', 'entertainment'];
            return types[Math.floor(Math.random() * types.length)];
        } else if (hour >= 18 && hour < 22) {
            // 傍晚：娱乐、访谈
            return Math.random() > 0.5 ? 'entertainment' : 'interview';
        } else {
            // 深夜/凌晨：故事、脱口秀
            return Math.random() > 0.3 ? 'story' : 'talk';
        }
    }

    /**
     * 生成演员阵容描述（用于 AI prompt）
     */
    getCastDescription(cast: Cast): string {
        const lines = [`节目类型：${cast.showName}`, '', '演员阵容：'];

        cast.members.forEach(member => {
            lines.push(`- ${member.roleId} (${member.roleName})：${member.personality}`);
        });

        lines.push('', '请使用以上 speaker id 编写台本。');
        return lines.join('\n');
    }
}

// 单例导出
export const castDirector = new CastDirector();
