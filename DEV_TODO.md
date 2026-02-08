# RadioNowhere 开发 TODO 报告

> 综合 Bug 修复、节目丰富度优化、音乐多样性改进的完整开发计划

---

## 一、Bug 修复 (P0)

### 1.1 台词展开状态异常

**问题**：Talk block 展开时切换到 music block，UI 进入异常状态

**文件**：`src/widgets/radio-player/ui/SubtitleDisplay.tsx`

**修复**：
```typescript
// 在第 101 行 useEffect 后添加
useEffect(() => {
    if (displayInfo.type !== 'talk' && isExpanded) {
        onExpandChange(false);
    }
}, [displayInfo.type, isExpanded, onExpandChange]);
```

- [ ] 添加 useEffect 自动收起非 talk 类型的展开状态
- [ ] 测试：talk → music 切换时验证自动收起

---

### 1.2 手机窄屏输入框适配

**问题**：320px 屏幕上 MailboxDrawer 输入框和按钮被挤压

**文件**：`src/widgets/radio-player/ui/MailboxDrawer.tsx`

**修复**：
```typescript
// 第 36 行
className="mt-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto"

// 第 73, 86 行按钮
className="p-2 sm:p-2.5 rounded-xl ..."

// 第 78, 88 行图标
<Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
```

- [ ] 修改容器宽度为响应式
- [ ] 修改按钮 padding 为响应式
- [ ] 修改图标尺寸为响应式
- [ ] 测试：320px、375px、414px 屏幕宽度

---

### 1.3 批量 TTS 台词显示同步

**问题**：Gemini 批量 TTS 时，前端只显示最后一句台词

**文件**：`src/widgets/radio-player/ui/SubtitleDisplay.tsx`

**修复**：处理 `isBatched` 和 `batchScripts` 字段

```typescript
// 在 useEffect 中处理批量脚本
if (currentLine?.isBatched && currentLine.batchScripts) {
    const hostNames: Record<string, string> = { ... };
    setDisplayInfo({
        type: 'talk',
        speaker: currentLine.batchScripts.map(s => s.speaker).join(' & '),
        displayName: '对话中',
        subtitle: currentLine.batchScripts.map(s =>
            `${hostNames[s.speaker] || s.speaker}：${s.text}`
        ).join('\n\n')
    });
    return;
}
```

- [ ] 修改 SubtitleDisplay 处理 batchScripts
- [ ] 测试：Gemini TTS 批量对话显示

---

## 二、节目丰富度优化 (P1)

### 2.1 启用全部节目类型

**问题**：`randomShowType()` 排除了 news 和 drama

**文件**：`src/features/content/lib/cast-system.ts`

**修复**：
```typescript
randomShowType(): ShowType {
    const weights: Record<ShowType, number> = {
        talk: 15,
        interview: 10,
        news: 8,          // 启用
        drama: 5,         // 启用（低权重）
        entertainment: 12,
        story: 10,
        history: 10,
        science: 10,
        mystery: 10,
        nighttalk: 8,
        music: 5
    };

    // 加权随机选择
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return type as ShowType;
    }

    return 'talk';
}
```

- [ ] 修改 randomShowType() 使用加权随机
- [ ] 启用 news 和 drama 类型
- [ ] 测试：多次调用验证类型分布

---

### 2.2 增加对话模式引导

**问题**：AI 生成的对话趋于单一，缺乏真实对话的多样性

**文件**：`src/features/content/lib/writer-agent.ts`

**新增方法**：
```typescript
private getDialogueGuidance(showType: ShowType): string {
    const patterns: Record<string, string> = {
        talk: `
## 对话模式指南
请使用以下对话模式之一：

**辩论式**：A提观点 → B反驳 → A举例 → B让步但补充 → 达成共识
**叙事接力**：A讲故事 → B插话 → A继续 → B分享类似经历 → 共同感慨
**吐槽式**：A描述现象 → B犀利吐槽 → A补充槽点 → B升华 → A自嘲

每个对话回合至少 8-10 句，要有来有往！
        `,
        entertainment: `
## 娱乐节目指南
- 节奏快，互动多，多用"接梗"、"反转"
- 可以设计小游戏或问答环节
- 保持轻松搞笑的氛围
        `,
        // ... 其他类型
    };
    return patterns[showType] || patterns.talk;
}
```

- [ ] 新增 `getDialogueGuidance()` 方法
- [ ] 在 `buildReActSystemPrompt()` 中调用
- [ ] 为每种节目类型编写对话指南

---

### 2.3 提高内容密度要求

**问题**：Prompt 只要求 3-5 句台词，内容偏浅

**文件**：`src/features/content/lib/writer-agent.ts`

**修改 Prompt**：
```typescript
// 在 buildReActSystemPrompt() 中修改

## 内容密度要求

### Talk Block 要求
- **最少台词数**：8-12 句（不是 3-5 句！）
- **单句长度**：15-50 字
- **对话节奏**：不超过 3 句连续由同一人说

### 禁止的表达模式
❌ "生活就是这样"（空洞鸡汤）
❌ "我们要积极向上"（说教）
❌ 一个人说超过 5 句（独白）

### 期望的表达模式
✅ 具体的故事或经历
✅ 有观点碰撞的对话
✅ 幽默或机智的表达
✅ 意料之外的转折
```

- [ ] 修改台词数量要求（3-5 → 8-12）
- [ ] 添加禁止表达模式清单
- [ ] 添加期望表达模式示例

---

## 三、音乐多样性改进 (P1)

### 3.1 核心思路：曲风维度驱动

**问题**：AI 总是偏好固定歌手（房东的猫、陈某某等）

**新思路**：与其限制歌手，不如从**曲风/流派/时期/文化**维度引导选歌，让 AI 自然探索不同风格。

**音乐多样性维度**：
| 维度 | 选项示例 |
|------|----------|
| 流派 | 民谣、摇滚、爵士、电子、古典、嘻哈、R&B、金属、朋克、蓝调 |
| 年代 | 60s、70s、80s、90s、2000s、2010s、2020s |
| 文化/地域 | 华语、欧美、日韩、拉丁、非洲、印度、中东、北欧 |
| 情绪 | 欢快、忧郁、激昂、平静、浪漫、神秘、怀旧 |
| 场景 | 晨间、午后、深夜、派对、独处、工作、运动 |

---

### 3.2 曲风轮盘系统

**新增文件**：`src/features/music-search/lib/genre-wheel.ts`

```typescript
/**
 * 曲风轮盘 - 确保音乐多样性
 * 每期节目必须覆盖不同的曲风维度
 */

export interface GenreDimension {
    name: string;
    options: string[];
}

export const GENRE_DIMENSIONS: GenreDimension[] = [
    {
        name: '流派',
        options: [
            '民谣/Folk', '独立摇滚/Indie Rock', '电子/Electronic',
            '爵士/Jazz', '古典/Classical', 'R&B/Soul',
            '嘻哈/Hip-Hop', '金属/Metal', '朋克/Punk',
            '蓝调/Blues', '雷鬼/Reggae', '新世纪/New Age',
            '后摇/Post-Rock', '氛围/Ambient', '世界音乐/World'
        ]
    },
    {
        name: '年代',
        options: [
            '60年代经典', '70年代复古', '80年代怀旧',
            '90年代金曲', '2000年代流行', '2010年代热门',
            '2020年代新声'
        ]
    },
    {
        name: '文化',
        options: [
            '华语流行', '华语独立', '粤语经典',
            '欧美流行', '英伦摇滚', '美国乡村',
            '日本City Pop', '日本动漫', 'K-Pop',
            '拉丁节奏', '法语香颂', '北欧民谣',
            '非洲节奏', '印度音乐', '中东风情'
        ]
    },
    {
        name: '氛围',
        options: [
            '治愈温暖', '激情澎湃', '忧郁感伤',
            '轻松愉快', '神秘悬疑', '浪漫甜蜜',
            '怀旧复古', '前卫实验', '清新自然'
        ]
    }
];

// 记录最近使用的曲风（避免连续重复）
const recentGenres: Map<string, string[]> = new Map();
const MAX_RECENT = 5;

/**
 * 获取本期节目的曲风建议
 * 确保与最近节目不重复
 */
export function getGenreSuggestions(): {
    required: string[];      // 必须包含的维度
    suggestions: string[];   // 具体建议
    avoid: string[];         // 避免的曲风
} {
    const required: string[] = [];
    const suggestions: string[] = [];
    const avoid: string[] = [];

    // 从每个维度随机选一个
    for (const dimension of GENRE_DIMENSIONS) {
        const recent = recentGenres.get(dimension.name) || [];
        const available = dimension.options.filter(o => !recent.includes(o));

        if (available.length > 0) {
            const selected = available[Math.floor(Math.random() * available.length)];
            suggestions.push(`${dimension.name}：${selected}`);
        }

        // 最近用过的要避免
        avoid.push(...recent.slice(0, 2));
    }

    // 必须跨越至少 2 个不同维度
    required.push('至少 2 种不同流派');
    required.push('至少 2 种不同文化背景');

    return { required, suggestions, avoid };
}

/**
 * 记录已使用的曲风
 */
export function recordUsedGenre(dimension: string, genre: string): void {
    const recent = recentGenres.get(dimension) || [];
    recent.unshift(genre);
    recentGenres.set(dimension, recent.slice(0, MAX_RECENT));
}

/**
 * 生成曲风探索 Prompt
 */
export function getGenrePromptSection(): string {
    const { required, suggestions, avoid } = getGenreSuggestions();

    return `
## 🎵 曲风多样性要求（核心！）

### 选歌思路
不要从"我知道哪个歌手"出发，而是从"这期节目需要什么风格"出发！

### 本期建议探索的方向
${suggestions.map(s => `- ${s}`).join('\n')}

### 必须满足
${required.map(r => `✓ ${r}`).join('\n')}

### 近期已使用，请避免
${avoid.length > 0 ? avoid.map(a => `✗ ${a}`).join('\n') : '（无限制）'}

### 曲风搜索技巧
搜索时可以用"曲风+关键词"组合，例如：
- "80年代迪斯科" → 张蔷、费翔
- "北欧民谣" → Sigur Rós、Ólafur Arnalds
- "City Pop" → 竹内玛利亚、山下达郎
- "法国电子" → Daft Punk、Air
- "非洲节奏" → Fela Kuti、Angelique Kidjo
- "拉丁爵士" → Buena Vista Social Club
- "英伦摇滚" → Oasis、Radiohead
- "美国乡村" → John Denver、Taylor Swift 早期

### 评分标准
- 3 首歌来自同一曲风 = ❌ 不合格
- 2 首歌来自同一文化 + 1 首不同 = ⚠️ 勉强
- 每首歌来自不同曲风/文化 = ✅ 优秀
`;
}
```

- [ ] 创建 `genre-wheel.ts` 曲风轮盘系统
- [ ] 定义多维度曲风分类
- [ ] 实现曲风建议生成
- [ ] 实现最近使用记录

---

### 3.3 修改 Prompt 使用曲风引导

**文件**：`src/features/content/lib/writer-agent.ts`

**修改 buildReActSystemPrompt()**：
```typescript
import { getGenrePromptSection } from '@features/music-search/lib/genre-wheel';

// 在 buildReActSystemPrompt 中替换原有的音乐多样性部分
private buildReActSystemPrompt(...) {
    // ...
    const genreSection = getGenrePromptSection();

    return `${getRadioSetting()}
${this.getTimeContext()}
${genreSection}
// ... 其他部分
`;
}
```

- [ ] 引入 genre-wheel
- [ ] 替换原有的音乐多样性 Prompt
- [ ] 删除歌手黑名单方式（改用曲风引导）

---

### 3.4 增强多样性评分（曲风维度）

**文件**：`src/features/music-search/lib/diversity-manager.ts`

**修改 analyzeDiversity()**：
```typescript
export function analyzeDiversity(artists: string[], genres?: string[]): {
    score: number;
    feedback: string[];
    violations: string[];
} {
    // ... 现有逻辑 ...

    // 新增：曲风多样性评分
    if (genres && genres.length > 0) {
        const uniqueGenres = new Set(genres.map(g => g.toLowerCase()));

        if (uniqueGenres.size >= 3) {
            score += 30;
            feedback.push(`✓ 曲风多样性优秀：${uniqueGenres.size}种不同风格`);
        } else if (uniqueGenres.size === 2) {
            score += 15;
            feedback.push(`⚠️ 曲风多样性一般：仅${uniqueGenres.size}种风格`);
        } else {
            feedback.push(`✗ 曲风单一：需要更多样的音乐风格`);
        }
    }

    return { score: Math.max(0, Math.min(100, score)), feedback, violations };
}
```

- [ ] 增加 genres 参数
- [ ] 添加曲风多样性评分逻辑
- [ ] 调整总评分权重

---

### 3.5 搜索工具增加曲风提示

**文件**：`src/features/content/lib/writer-tools.ts`

**修改 search_music 工具**：
```typescript
{
    name: 'search_music',
    description: '搜索歌曲。支持多种搜索方式：
1. 曲风搜索（推荐）："80年代迪斯科"、"北欧民谣"、"City Pop"
2. 歌手搜索："张学友"、"Adele"
3. 歌名搜索："Shape of You"

⚠️ 优先使用曲风搜索，探索不同风格！',
    parameters: [
        { name: 'query', type: 'string', description: '搜索关键词（曲风/歌手/歌名）', required: true },
        { name: 'genre_hint', type: 'string', description: '期望的曲风（如：爵士、摇滚、民谣）', required: false }
    ]
}
```

**修改 executeSearchMusic()**：
```typescript
async function executeSearchMusic(query: string, genreHint?: string): Promise<ToolResult> {
    // ... 现有逻辑 ...

    return {
        success: true,
        data: {
            query,
            results,
            genreHint,
            note: genreHint
                ? `找到 ${results.length} 首「${genreHint}」风格的歌曲`
                : `找到 ${results.length} 首歌曲。下次尝试用曲风搜索，发现更多风格！`
        }
    };
}
```

- [ ] 修改工具描述，推广曲风搜索
- [ ] 增加 genre_hint 参数
- [ ] 在返回结果中提示曲风探索

---

### 3.6 禁止列表持久化（保留）

**文件**：`src/features/music-search/lib/diversity-manager.ts`

```typescript
const STORAGE_KEY = 'radio_prohibited_artists';

function loadProhibitedArtists(): Array<{ artist: string; timestamp: number }> {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveProhibitedArtists(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prohibitedArtists));
    } catch {
        // ignore
    }
}

// 修改 addProhibitedArtist
export function addProhibitedArtist(artist: string): void {
    if (!prohibitedArtists.some(a => a.artist === artist)) {
        prohibitedArtists.push({ artist, timestamp: Date.now() });
        saveProhibitedArtists(); // 新增
    }
}
```

- [ ] 添加 localStorage 持久化
- [ ] SSR 兼容处理

---

### 3.7 未来：用户偏好系统（P3）

**概念设计**：允许用户设置个人音乐偏好

```typescript
interface UserMusicPreference {
    favoriteGenres: string[];      // 喜欢的曲风
    dislikedGenres: string[];      // 不喜欢的曲风
    favoriteEras: string[];        // 喜欢的年代
    favoriteCultures: string[];    // 喜欢的音乐文化
    explorationLevel: 'conservative' | 'balanced' | 'adventurous'; // 探索意愿
}

// 默认模式 = adventurous（最大多样性）
// 用户可自定义 = 根据偏好调整
```

- [ ] (P3) 设计用户偏好数据结构
- [ ] (P3) 创建偏好设置 UI
- [ ] (P3) 根据偏好调整曲风权重

---

## 四、Agent 系统优化 (P2)

### 4.1 核心思路：职责分离 + 节目类型专业化

**现状问题**：
- 单一 WriterAgent 处理所有节目类型
- Prompt 过长，信息过载
- 音乐节目和纯文本节目用同样的生成逻辑

**新架构**：类似"领导分配任务"模式

```
┌─────────────────────────────────────────────────────┐
│                   DirectorAgent                      │
│            (总导演：调度、决策、协调)                  │
└─────────────────────┬───────────────────────────────┘
                      │ 根据节目类型分配
        ┌─────────────┼─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ TalkWriter│ │NewsWriter │ │StoryWriter│ │MusicWriter│
│  脱口秀   │ │  新闻播报  │ │  故事/历史 │ │  音乐专题  │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
     │             │             │             │
     ▼             ▼             ▼             ▼
  专属Prompt    专属Prompt    专属Prompt    专属Prompt
  专属工具      专属工具       专属工具      专属工具
```

---

### 4.2 节目类型配比表

**核心理念**：节目类型决定内容配比，不是所有节目都需要大量音乐

| 节目类型 | 对话占比 | 音乐占比 | 音乐用途 | 专属工具 |
|----------|----------|----------|----------|----------|
| talk/entertainment | 60-70% | 30-40% | 背景+过渡 | 无特殊 |
| news | 80-90% | 10-20% | 仅过渡 | fetch_news |
| history/science | 70-80% | 20-30% | 氛围+过渡 | search_knowledge |
| mystery | 75-85% | 15-25% | 氛围烘托 | 无特殊 |
| story/nighttalk | 65-75% | 25-35% | 情感渲染 | 无特殊 |
| music | 30-40% | 60-70% | 主体内容 | 曲风轮盘 |
| drama | 85-95% | 5-15% | 场景+过渡 | sound_effects(未来) |

**实现**：
```typescript
// src/features/content/lib/show-config.ts
export interface ShowConfig {
    type: ShowType;
    talkRatio: [number, number];     // [min, max] 对话占比
    musicRatio: [number, number];    // [min, max] 音乐占比
    musicPurpose: 'main' | 'background' | 'transition_only';
    requiredTools: string[];
    optionalTools: string[];
    promptTemplate: string;          // 专属 Prompt 模板
}

export const SHOW_CONFIGS: Record<ShowType, ShowConfig> = {
    news: {
        type: 'news',
        talkRatio: [0.8, 0.9],
        musicRatio: [0.1, 0.2],
        musicPurpose: 'transition_only',
        requiredTools: ['fetch_news'],
        optionalTools: [],
        promptTemplate: 'news-writer-prompt'
    },
    music: {
        type: 'music',
        talkRatio: [0.3, 0.4],
        musicRatio: [0.6, 0.7],
        musicPurpose: 'main',
        requiredTools: ['search_music', 'get_lyrics'],
        optionalTools: ['check_artist_diversity'],
        promptTemplate: 'music-writer-prompt'
    },
    // ...
};
```

- [ ] 创建 `show-config.ts` 节目配置
- [ ] 定义各类型的对话/音乐配比
- [ ] 定义各类型的专属工具

---

### 4.3 专属 Prompt 模板系统

**文件**：`src/features/content/lib/prompt-templates/`

**目录结构**：
```
prompt-templates/
├── base.ts           # 基础模板（电台身份、输出格式）
├── talk.ts           # 脱口秀/闲聊
├── news.ts           # 新闻播报
├── story.ts          # 故事/历史/科普
├── music.ts          # 音乐专题
├── entertainment.ts  # 娱乐综艺
└── index.ts          # 模板选择器
```

**示例：新闻播报专属 Prompt**
```typescript
// prompt-templates/news.ts
export const NEWS_PROMPT = `
## 📰 新闻播报节目

### 节目结构
1. 开场（10-15秒）：主播问候 + 今日概览
2. 主体（3-5分钟）：逐条播报新闻
3. 点评（30-60秒）：简短评论或总结
4. 结尾（10秒）：预告下期 + 过渡音乐

### 播报风格
- 专业、客观、简洁
- 每条新闻 30-60 秒
- 适当加入主播的简短点评
- 语速适中，节奏明快

### 音乐使用
- 仅在结尾使用 1 首过渡音乐（30-45秒）
- 不需要背景音乐
- 过渡音乐选择：轻音乐、钢琴曲、纯音乐

### 必须调用工具
1. fetch_news - 获取今日新闻
2. submit_show - 提交节目
`;
```

**示例：脱口秀专属 Prompt**
```typescript
// prompt-templates/talk.ts
export const TALK_PROMPT = `
## 🎤 脱口秀/闲聊节目

### 对话模式（必选其一）
1. **辩论式**：A提观点 → B反驳 → A举例 → B让步 → 共识
2. **叙事接力**：A讲故事 → B插话 → A继续 → B分享类似经历
3. **吐槽式**：A描述现象 → B吐槽 → A补充 → B升华 → A自嘲

### 对话要求
- 每个话题 8-12 句对话
- 不超过 3 句连续同一人说
- 具体例子 > 空洞道理
- 幽默 > 说教

### 音乐使用
- 1-2 首歌曲穿插
- 可作为话题引子或情绪过渡
- 结尾必须有过渡音乐

### 禁止内容
❌ "生活就是这样"
❌ "我们要积极向上"
❌ 一人独白超过 5 句
❌ 没有具体内容的抒情
`;
```

- [ ] 创建 prompt-templates 目录
- [ ] 编写各类型专属 Prompt
- [ ] 实现模板选择器

---

### 4.4 工具系统扩展

**现有工具**：
- `search_music` - 搜索音乐
- `get_lyrics` - 获取歌词
- `fetch_news` - 获取新闻
- `check_duplicate` - 检查重复
- `check_artist_diversity` - 检查多样性
- `submit_show` - 提交节目

**新增工具**：

```typescript
// 知识搜索（历史/科普节目）
{
    name: 'search_knowledge',
    description: '搜索知识/百科内容。用于历史故事、科普节目等需要事实依据的内容。',
    parameters: [
        { name: 'query', type: 'string', description: '搜索关键词', required: true },
        { name: 'type', type: 'string', description: '类型：history/science/culture', required: false }
    ]
}

// 名言/金句搜索（深夜心声）
{
    name: 'search_quotes',
    description: '搜索名人名言、经典语录。用于深夜心声、情感节目等需要引用的内容。',
    parameters: [
        { name: 'theme', type: 'string', description: '主题：love/life/growth/wisdom', required: true }
    ]
}

// 热点话题（脱口秀/娱乐）
{
    name: 'fetch_trending',
    description: '获取当前热门话题/热搜。用于脱口秀、娱乐节目需要时事话题。',
    parameters: [
        { name: 'platform', type: 'string', description: '平台：weibo/zhihu/douyin', required: false }
    ]
}

// 天气查询（早间节目）
{
    name: 'fetch_weather',
    description: '获取天气信息。用于早间节目、日间节目的开场。',
    parameters: [
        { name: 'city', type: 'string', description: '城市名', required: false }
    ]
}
```

**工具与节目类型映射**：
| 工具 | 适用节目类型 |
|------|--------------|
| search_music | music, talk, story |
| fetch_news | news, talk |
| search_knowledge | history, science |
| search_quotes | nighttalk, story |
| fetch_trending | talk, entertainment |
| fetch_weather | talk (早间) |

- [ ] 设计新工具接口
- [ ] 实现 search_knowledge（可对接维基百科API）
- [ ] 实现 fetch_trending（可对接微博热搜API）
- [ ] 工具与节目类型自动绑定

---

### 4.5 WriterAgent 重构

**当前**：单一 WriterAgent 处理所有类型

**重构方案**：

```typescript
// src/features/content/lib/writer-agent.ts
export class WriterAgent {
    private promptTemplates: Map<ShowType, string>;
    private showConfigs: Map<ShowType, ShowConfig>;

    async generateTimeline(duration: number, showType?: ShowType, ...): Promise<ShowTimeline> {
        // 1. 确定节目类型
        const type = showType || castDirector.randomShowType();

        // 2. 获取专属配置
        const config = this.showConfigs.get(type);

        // 3. 获取专属 Prompt
        const prompt = this.buildPromptForType(type, config, duration);

        // 4. 仅加载该类型需要的工具
        const tools = this.getToolsForType(type, config);

        // 5. 执行生成
        return this.executeGeneration(prompt, tools);
    }

    private buildPromptForType(type: ShowType, config: ShowConfig, duration: number): string {
        const basePrompt = getBasePrompt();           // 电台身份、输出格式
        const typePrompt = getTypePrompt(type);       // 节目类型专属
        const toolsPrompt = getToolsPrompt(config.requiredTools);

        return `${basePrompt}

${typePrompt}

## 内容配比要求
- 对话内容：${config.talkRatio[0] * 100}% - ${config.talkRatio[1] * 100}%
- 音乐内容：${config.musicRatio[0] * 100}% - ${config.musicRatio[1] * 100}%
- 音乐用途：${config.musicPurpose === 'main' ? '主体内容' : config.musicPurpose === 'background' ? '背景+过渡' : '仅过渡'}

${toolsPrompt}
`;
    }

    private getToolsForType(type: ShowType, config: ShowConfig): ToolDefinition[] {
        // 只返回该类型需要的工具，减少 AI 的选择负担
        return WRITER_TOOLS.filter(t =>
            config.requiredTools.includes(t.name) ||
            config.optionalTools.includes(t.name) ||
            t.name === 'submit_show'  // 必须
        );
    }
}
```

- [ ] 重构 WriterAgent 支持类型专业化
- [ ] 实现 buildPromptForType
- [ ] 实现 getToolsForType

---

### 4.6 节目环节（Segment）系统

**新增文件**：`src/shared/types/segment.ts`

```typescript
export type SegmentType =
    | 'opening'       // 开场白
    | 'main_topic'    // 主话题
    | 'music_break'   // 音乐间歇
    | 'interaction'   // 互动环节
    | 'closing';      // 结尾

export interface ShowSegment {
    type: SegmentType;
    name: string;
    durationHint: [number, number]; // [最短, 最长] 秒
    blocks: TimelineBlock[];
}

export const SHOW_STRUCTURES: Record<ShowType, SegmentType[]> = {
    talk: ['opening', 'main_topic', 'music_break', 'interaction', 'closing'],
    news: ['opening', 'main_topic', 'music_break', 'closing'],
    history: ['opening', 'main_topic', 'main_topic', 'music_break', 'closing'],
    // ...
};
```

- [ ] 创建 segment.ts 类型定义
- [ ] 定义各节目类型的环节结构
- [ ] 修改 writer-agent 按环节生成

---

### 4.2 内存泄漏修复

**已完成**：`director-agent.ts` 已添加 `cleanupOldCaches()`

- [x] 添加 cleanupOldCaches 方法
- [x] 在 timeline 完成后调用清理
- [ ] 验证长时间运行内存稳定

---

### 4.3 Timeline 历史标记优化

**已完成**：`useRadioPlayer.ts` 已优化历史标记逻辑

- [x] 使用 currentBlockIdRef 避免闭包问题
- [x] 正确处理当前播放 block 不被标记为历史
- [ ] 验证快速切换 timeline 时状态正确

---

## 五、测试清单

### 5.1 Bug 修复测试

| 测试项 | 预期结果 | 状态 |
|--------|----------|------|
| Talk 展开 → Music 切换 | 自动收起 | [ ] |
| 320px 屏幕 MailboxDrawer | 完整显示 | [ ] |
| Gemini 批量 TTS 显示 | 多人对话格式 | [ ] |

### 5.2 节目丰富度测试

| 测试项 | 预期结果 | 状态 |
|--------|----------|------|
| 10 次 randomShowType() | 至少 5 种不同类型 | [ ] |
| 生成的对话长度 | 每 block 8+ 句 | [ ] |
| 对话模式多样性 | 不全是"温馨鸡汤" | [ ] |

### 5.3 音乐多样性测试

| 测试项 | 预期结果 | 状态 |
|--------|----------|------|
| 连续 3 期节目 | 无重复歌手 | [ ] |
| 禁止列表持久化 | 刷新后仍有效 | [ ] |
| 安全区歌手惩罚 | 评分降低 | [ ] |

---

## 六、实施优先级

### Phase 1：紧急修复（1-3天）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 1.1 展开状态修复 | SubtitleDisplay.tsx | 低 |
| 1.2 窄屏适配 | MailboxDrawer.tsx | 低 |
| 3.6 禁止列表持久化 | diversity-manager.ts | 低 |

### Phase 2：核心优化（1-2周）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 2.1 启用全部节目类型 | cast-system.ts | 低 |
| 4.2 节目类型配比表 | 新增 show-config.ts | 低 |
| 4.3 专属 Prompt 模板 | 新增 prompt-templates/ | 中 |
| 2.2 对话模式引导 | prompt-templates/talk.ts | 中 |
| 2.3 内容密度要求 | prompt-templates/*.ts | 低 |
| 1.3 批量 TTS 显示 | SubtitleDisplay.tsx | 中 |

### Phase 3：Agent 系统升级（2-4周）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 4.5 WriterAgent 重构 | writer-agent.ts | 高 |
| 4.4 工具系统扩展 | writer-tools.ts | 中 |
| 3.2 曲风轮盘系统 | 新增 genre-wheel.ts | 中 |
| 4.6 Segment 环节系统 | 新增 segment.ts | 高 |

### Phase 4：功能扩展（4-8周）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| search_knowledge 工具 | writer-tools.ts + API | 中 |
| fetch_trending 工具 | writer-tools.ts + API | 中 |
| Drama 广播剧完整支持 | 多文件 | 高 |
| 3.7 用户偏好系统 | 新增多文件 | 高 |

---

## 七、快速启动命令

```bash
# 查看需要修改的文件
cat << 'EOF'
Phase 1 修改文件列表：
1. src/widgets/radio-player/ui/SubtitleDisplay.tsx
2. src/widgets/radio-player/ui/MailboxDrawer.tsx
3. src/features/music-search/lib/diversity-manager.ts
4. src/features/content/lib/writer-agent.ts
5. src/features/content/lib/cast-system.ts
EOF
```

---

## 八、成功指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 节目类型使用率 | 3-4 种 | 8+ 种 |
| 每期平均台词数 | 15-20 句 | 40+ 句 |
| 曲风多样性（连续3期）| 2-3 种 | 8+ 种 |
| 歌手重复率（连续3期）| 50%+ | <10% |
| 文化背景覆盖 | 1-2 种 | 4+ 种 |
| 用户反馈"鸡汤感" | 高 | 低 |
| 窄屏可用性 | 差 | 良好 |

---

*最后更新：2026-02-08*
