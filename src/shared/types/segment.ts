import { TimelineBlock } from './radio-core';

export type SegmentType =
    | 'opening'
    | 'main_topic'
    | 'music_break'
    | 'interaction'
    | 'closing';

export interface ShowSegment {
    type: SegmentType;
    durationHint: [number, number];
    blocks?: TimelineBlock[];
    description?: string;
}

export type SegmentShowType =
    | 'talk'
    | 'interview'
    | 'news'
    | 'drama'
    | 'entertainment'
    | 'story'
    | 'history'
    | 'science'
    | 'mystery'
    | 'nighttalk'
    | 'music';

export const SHOW_SEGMENT_STRUCTURES: Record<SegmentShowType, ShowSegment[]> = {
    talk: [
        { type: 'opening', durationHint: [20, 40], description: '电台开场 + 话题抛出' },
        { type: 'main_topic', durationHint: [80, 160], description: '双人观点碰撞' },
        { type: 'interaction', durationHint: [30, 80], description: '听众反馈或问题回应' },
        { type: 'music_break', durationHint: [40, 80], description: '主题关联音乐' },
        { type: 'closing', durationHint: [20, 40], description: '总结与下期预告' }
    ],
    interview: [
        { type: 'opening', durationHint: [20, 40], description: '主持人与嘉宾介绍' },
        { type: 'main_topic', durationHint: [90, 180], description: '主访谈与深挖提问' },
        { type: 'interaction', durationHint: [20, 60], description: '快问快答或听众问题' },
        { type: 'closing', durationHint: [20, 40], description: '嘉宾金句总结 + 收尾' }
    ],
    news: [
        { type: 'opening', durationHint: [15, 30], description: '头条总览' },
        { type: 'main_topic', durationHint: [100, 200], description: '2-4 条核心新闻播报' },
        { type: 'interaction', durationHint: [20, 50], description: '简短评论与影响解读' },
        { type: 'closing', durationHint: [15, 30], description: '结束语 + 过渡音乐提示' }
    ],
    drama: [
        { type: 'opening', durationHint: [20, 40], description: '旁白立场与场景建立' },
        { type: 'main_topic', durationHint: [120, 220], description: '多角色冲突与剧情推进' },
        { type: 'music_break', durationHint: [20, 60], description: '氛围铺垫或场景切换' },
        { type: 'closing', durationHint: [20, 40], description: '剧情钩子或温和收束' }
    ],
    entertainment: [
        { type: 'opening', durationHint: [20, 40], description: '综艺感开场' },
        { type: 'interaction', durationHint: [40, 90], description: '互动游戏或榜单' },
        { type: 'main_topic', durationHint: [70, 140], description: '热点梗或话题展开' },
        { type: 'music_break', durationHint: [30, 70], description: '氛围强化音乐' },
        { type: 'closing', durationHint: [20, 40], description: '趣味收尾' }
    ],
    story: [
        { type: 'opening', durationHint: [20, 40], description: '故事引子' },
        { type: 'main_topic', durationHint: [110, 220], description: '叙事推进与转折' },
        { type: 'music_break', durationHint: [25, 60], description: '情绪过渡' },
        { type: 'closing', durationHint: [20, 40], description: '回响与金句' }
    ],
    history: [
        { type: 'opening', durationHint: [20, 35], description: '历史背景导入' },
        { type: 'main_topic', durationHint: [120, 230], description: '事件经过 + 关键人物' },
        { type: 'closing', durationHint: [20, 40], description: '当代启示与收尾' }
    ],
    science: [
        { type: 'opening', durationHint: [20, 35], description: '问题引入' },
        { type: 'main_topic', durationHint: [110, 210], description: '科学原理拆解' },
        { type: 'interaction', durationHint: [25, 60], description: '误区纠正与问答' },
        { type: 'closing', durationHint: [20, 35], description: '实践建议与过渡' }
    ],
    mystery: [
        { type: 'opening', durationHint: [20, 35], description: '悬念设置' },
        { type: 'main_topic', durationHint: [110, 210], description: '线索拼接与推理' },
        { type: 'music_break', durationHint: [25, 60], description: '悬疑氛围强化' },
        { type: 'closing', durationHint: [20, 40], description: '留白式收束' }
    ],
    nighttalk: [
        { type: 'opening', durationHint: [20, 40], description: '情绪安抚开场' },
        { type: 'interaction', durationHint: [35, 90], description: '来信与共鸣' },
        { type: 'main_topic', durationHint: [70, 140], description: '深度对谈' },
        { type: 'music_break', durationHint: [30, 70], description: '深夜陪伴音乐' },
        { type: 'closing', durationHint: [20, 40], description: '晚安式收尾' }
    ],
    music: [
        { type: 'opening', durationHint: [20, 35], description: '专题引入' },
        { type: 'main_topic', durationHint: [60, 130], description: '音乐背景与故事讲解' },
        { type: 'music_break', durationHint: [80, 180], description: '核心放歌段落' },
        { type: 'interaction', durationHint: [20, 60], description: '听众反馈或选曲说明' },
        { type: 'closing', durationHint: [20, 35], description: '总结 + 过渡音乐' }
    ]
};
