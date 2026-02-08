# RadioNowhere 节目丰富度优化路线图

## 现状分析

### 已有的良好基础

| 模块 | 现状 | 评价 |
|------|------|------|
| 节目类型定义 | 11 种（talk, interview, news, drama, entertainment, story, history, science, mystery, nighttalk, music） | 丰富但利用不足 |
| 角色系统 | 动态选角 + 30 种音色 | 优秀 |
| 时长配置 | MAIN_DURATION = 480s（8分钟） | 合理但可扩展 |
| 音乐多样性 | ReAct 工具链 + 多样性检查 | 成熟 |

### 核心问题定位

**问题 1：节目类型未被充分使用**
```typescript
// cast-system.ts:455-458
// 实际 regularPool 排除了 news 和 drama
const regularPool: ShowType[] = [
    'talk', 'interview', 'story', 'history',
    'science', 'mystery', 'entertainment', 'music'
];
```

**问题 2：Prompt 对内容深度引导不足**
```typescript
// writer-agent.ts:734
// 只要求 3-5 句台词，内容自然偏浅
"每个 talk 块至少 3-5 句台词"
```

**问题 3：缺乏节目环节结构**
- 当前只有 Block 概念（talk/music/control）
- 没有"开场 → 主体环节 → 互动 → 结尾"的节目流程设计

**问题 4：生成的"脱口秀"本质是"鸡汤文+音乐"**
- AI 缺乏具体的对话模式指导
- 没有冲突、互动、观点碰撞的引导

---

## 优化方向

### 方向 1：引入节目环节（Segment）系统

**概念设计**：在 Block 之上增加 Segment 层级，定义节目的结构化流程。

```typescript
// 新增类型定义
interface ShowSegment {
    type: SegmentType;
    name: string;
    durationHint: [number, number]; // [最短, 最长] 秒
    blocks: TimelineBlock[];
}

type SegmentType =
    | 'opening'       // 开场白
    | 'main_topic'    // 主话题讨论
    | 'sub_topic'     // 子话题/延伸
    | 'interaction'   // 互动环节（问答/来信/猜谜）
    | 'music_break'   // 音乐间歇
    | 'story_time'    // 故事时间
    | 'news_flash'    // 新闻快讯
    | 'closing';      // 结尾

// 节目模板示例
const TALK_SHOW_STRUCTURE: SegmentType[] = [
    'opening',        // 30-60s  开场
    'main_topic',     // 180-300s 主话题深入讨论
    'music_break',    // 180-240s 音乐
    'sub_topic',      // 120-180s 延伸话题
    'interaction',    // 60-120s  听众互动
    'music_break',    // 180-240s 音乐
    'closing'         // 30-60s  结尾
];
```

**实现路径**：
1. 在 `radio-core.ts` 增加 Segment 类型定义
2. 修改 `writer-agent.ts` 的 Prompt，按 Segment 引导生成
3. 可选：增加 `segment-templates.ts` 预设不同节目类型的环节结构

---

### 方向 2：丰富对话模式模板

**问题**：当前 AI 生成的对话趋于单一，缺乏真实对话的多样性。

**解决方案**：在 Prompt 中注入对话模式示例。

```typescript
const DIALOGUE_PATTERNS = {
    // 辩论模式
    debate: `
        A: 提出观点
        B: 提出反对意见
        A: 用例子反驳
        B: 承认部分道理，但补充新角度
        A+B: 达成某种共识或保留分歧
    `,

    // 叙事接力
    storytelling: `
        A: 开始讲一个故事/经历
        B: 插入提问或惊叹
        A: 继续故事
        B: 联想到自己的类似经历
        A: 回应B的经历，引出感悟
    `,

    // 知识问答
    teacherStudent: `
        A: 提出一个问题/好奇
        B: 解释原理
        A: 追问"为什么"
        B: 深入解释
        A: 用生活例子确认理解
        B: 补充有趣的延伸知识
    `,

    // 吐槽模式
    roast: `
        A: 描述一个现象/事件
        B: 犀利吐槽
        A: 补充更多槽点
        B: 升华吐槽（从个例到普遍）
        A: 反转/自嘲
    `,

    // 深夜倾诉
    confession: `
        A: 抛出一个深夜话题
        B: 共情回应
        A: 分享个人故事
        B: 温柔点评
        A+B: 一起感慨
    `
};
```

**实现位置**：`writer-agent.ts` 的 `buildReActSystemPrompt()` 方法，根据节目类型注入对应模式。

---

### 方向 3：启用 News 和 Drama 类型

**当前限制**：
```typescript
// cast-system.ts:455-456
// 排除 news（低频）和 drama（复杂度高）
```

**解除限制步骤**：

#### 3.1 News 新闻播报

**依赖**：已有 `NEWS_SERVICE` 配置 (constants.ts:122-128)

**实现方案**：
1. 创建 `news-agent.ts`，调用新闻 API 获取实时新闻
2. 增加 `NewsBlock` 类型，或在 TalkBlock 中标记 `isNews: true`
3. 在 `writer-agent.ts` 中增加新闻获取工具

```typescript
// 新工具定义
{
    name: 'fetch_news',
    description: '获取最新新闻摘要',
    args: { count: number, category?: string }
}
```

#### 3.2 Drama 广播剧

**挑战**：多角色、剧本结构复杂、需要音效

**渐进实现**：
1. **Phase 1**：微型广播剧（2-3 分钟片段）
   - 限制 2-3 个角色
   - 简单的场景描述
   - 无需复杂音效

2. **Phase 2**：系列广播剧
   - 引入"剧集"概念，跨多期播出
   - 增加 `previousContext` 存储剧情进展

3. **Phase 3**：完整广播剧
   - 音效支持（脚步声、门声等）
   - 多声道混音

---

### 方向 4：增加纯文本属性节目

**需求**：脱口秀、吐槽大会、新闻播报等以对话/独白为主的节目形式。

**实现方案**：引入"节目风格"配置。

```typescript
interface ShowStyle {
    type: ShowType;
    musicRatio: number;      // 音乐占比 0-1
    talkDepth: 'shallow' | 'medium' | 'deep';
    interactionLevel: 'none' | 'low' | 'high';
    pacing: 'fast' | 'medium' | 'slow';
}

const SHOW_STYLES: Record<ShowType, ShowStyle> = {
    talk: { musicRatio: 0.3, talkDepth: 'medium', interactionLevel: 'low', pacing: 'medium' },
    entertainment: { musicRatio: 0.2, talkDepth: 'shallow', interactionLevel: 'high', pacing: 'fast' },
    news: { musicRatio: 0.1, talkDepth: 'shallow', interactionLevel: 'none', pacing: 'fast' },
    nighttalk: { musicRatio: 0.4, talkDepth: 'deep', interactionLevel: 'medium', pacing: 'slow' },
    history: { musicRatio: 0.2, talkDepth: 'deep', interactionLevel: 'none', pacing: 'medium' },
    mystery: { musicRatio: 0.3, talkDepth: 'deep', interactionLevel: 'none', pacing: 'slow' },
    // ...
};
```

**Prompt 调整**：根据 `talkDepth` 调整对话要求。

```typescript
const DEPTH_REQUIREMENTS = {
    shallow: '每个话题点到为止，保持节奏明快',
    medium: '每个话题展开 2-3 个层面，有一定深度',
    deep: '深入探讨话题的多个维度，包括背景、原因、影响、个人感受等'
};
```

---

### 方向 5：增强节目时长和内容密度

**当前配置**：
```typescript
SHOW.MAIN_DURATION: 480  // 8分钟
```

**优化建议**：

#### 5.1 可变时长支持

```typescript
// 根据节目类型自动调整时长
const SHOW_DURATIONS: Record<ShowType, [number, number]> = {
    talk: [360, 600],      // 6-10分钟
    news: [180, 300],      // 3-5分钟
    history: [480, 720],   // 8-12分钟
    drama: [300, 600],     // 5-10分钟
    mystery: [480, 720],   // 8-12分钟
    // ...
};
```

#### 5.2 内容密度控制

```typescript
// 根据节目类型调整台词要求
const SCRIPT_DENSITY = {
    talk: { minLinesPerBlock: 5, minWordsPerLine: 20 },
    history: { minLinesPerBlock: 8, minWordsPerLine: 30 },
    news: { minLinesPerBlock: 3, minWordsPerLine: 40 },
    entertainment: { minLinesPerBlock: 6, minWordsPerLine: 15 },
};
```

---

### 方向 6：真实感增强

**问题**：节目缺乏真实电台的"呼吸感"。

**解决方案**：

#### 6.1 增加自然过渡元素

```typescript
// 新增过渡类型
interface TransitionElement {
    type: 'jingle' | 'station_id' | 'time_check' | 'weather' | 'ad_break';
    duration: number;
    content?: string;
}
```

#### 6.2 整点报时增强（已有基础）

当前 `time-announcement` 服务已实现，可扩展为：
- 增加天气播报
- 增加"下期预告"
- 增加"听众互动提示"

#### 6.3 口语化处理

在 TTS 前对文本进行口语化处理：

```typescript
const oralizeText = (text: string): string => {
    return text
        .replace(/。/g, '。…')  // 添加自然停顿
        .replace(/，/g, '，')
        .replace(/！/g, '！…')
        // 添加语气词
        .replace(/^/gm, (match) => Math.random() > 0.7 ? '嗯，' : match)
        // ...
};
```

---

### 方向 7：听众互动增强

**现有基础**：`mailQueue` 收集用户消息

**扩展方向**：

#### 7.1 互动类型多样化

```typescript
type InteractionType =
    | 'letter_reading'   // 读信
    | 'song_request'     // 点歌
    | 'question'         // 问答
    | 'story_share'      // 故事分享
    | 'topic_vote';      // 话题投票
```

#### 7.2 虚拟互动（无真实用户时）

AI 生成虚拟听众互动：

```typescript
// 在 Prompt 中引导生成虚拟互动
`偶尔可以模拟听众互动，如：
- "刚才有听众发来消息说..."
- "有朋友问到..."
- "看到弹幕里有人提到..."
这样可以增加节目的真实感和互动感。`
```

---

## 实施优先级

### Phase 1：低成本高收益（1-2 周）

| 优化项 | 改动范围 | 预期效果 |
|--------|----------|----------|
| 启用更多节目类型 | cast-system.ts | 节目多样性 +50% |
| 丰富对话模式模板 | writer-agent.ts | 对话质量 +30% |
| 调整内容深度要求 | writer-agent.ts | 内容密度 +40% |

### Phase 2：结构性改进（2-4 周）

| 优化项 | 改动范围 | 预期效果 |
|--------|----------|----------|
| Segment 环节系统 | radio-core.ts, writer-agent.ts | 节目结构专业度 +60% |
| 节目风格配置 | 新文件 + writer-agent.ts | 节目特色差异化 |
| 可变时长支持 | constants.ts, director-agent.ts | 节目节奏自然度 +30% |

### Phase 3：功能扩展（4-8 周）

| 优化项 | 改动范围 | 预期效果 |
|--------|----------|----------|
| News 新闻播报 | 新增 news-agent.ts | 新节目类型 |
| Drama 广播剧 | 多文件改动 | 新节目类型 |
| 听众互动增强 | mail-queue 扩展 | 互动感 +50% |

---

## 快速起步：Phase 1 实施清单

### 任务 1：启用全部节目类型

**文件**：`src/features/content/lib/cast-system.ts`

```typescript
// 修改 randomShowType() 方法
randomShowType(): ShowType {
    // 移除类型限制，让所有类型都有机会出现
    const allTypes: ShowType[] = [
        'talk', 'interview', 'news', 'drama', 'entertainment',
        'story', 'history', 'science', 'mystery', 'nighttalk', 'music'
    ];

    // 权重配置（可调）
    const weights: Record<ShowType, number> = {
        talk: 15,
        interview: 10,
        news: 5,          // 较低频率
        drama: 5,         // 较低频率
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

### 任务 2：增强对话模式引导

**文件**：`src/features/content/lib/writer-agent.ts`

在 `buildReActSystemPrompt()` 中增加：

```typescript
private getDialogueGuidance(showType: ShowType): string {
    const patterns: Record<string, string> = {
        talk: `
## 对话模式指南
请使用以下对话模式之一（随机选择或混合使用）：

**辩论式**：A提观点 → B反驳 → A举例 → B让步但补充 → 达成共识
**叙事接力**：A讲故事 → B插话 → A继续 → B分享类似经历 → 共同感慨
**吐槽式**：A描述现象 → B吐槽 → A补充槽点 → B升华 → A自嘲

每个对话回合至少 8-10 句，要有来有往，不要一人独白太久。
        `,
        history: `
## 叙事指南
- 使用生动的细节描述历史场景
- 穿插历史人物的"独白"或"对话"演绎
- 用现代视角点评历史事件
- 每个历史故事至少讲 3-5 分钟
        `,
        entertainment: `
## 娱乐节目指南
- 节奏快，互动多
- 多用"接梗"、"反转"、"夸张"的表达
- 可以设计小游戏或问答环节
- 保持轻松搞笑的氛围
        `,
        mystery: `
## 悬疑叙事指南
- 营造神秘氛围（语速放慢，用词考究）
- 设置悬念，分阶段揭示
- 可以有"当事人"第一人称叙述
- 结尾可以保留开放性
        `,
        // ... 其他类型
    };

    return patterns[showType] || patterns.talk;
}
```

### 任务 3：调整内容密度要求

**文件**：`src/features/content/lib/writer-agent.ts`

修改 `getOutputFormatExample()` 中的示例和要求：

```typescript
## 内容密度要求

### Talk Block 要求
- **最少台词数**：8-12 句（不是 3-5 句！）
- **单句长度**：15-50 字
- **对话节奏**：不超过 3 句连续由同一人说

### 内容深度要求
- 每个话题展开至少 2-3 个层面
- 包含具体的例子或故事
- 有个人观点和感受的表达
- 避免空洞的鸡汤式表达

### 禁止的表达模式
❌ "生活就是这样"
❌ "我们要积极向上"
❌ 没有具体内容的抒情
❌ 一个人说超过 5 句

### 期望的表达模式
✅ 具体的故事或经历
✅ 有观点碰撞的对话
✅ 幽默或机智的表达
✅ 意料之外的转折
```

---

## 总结

RadioNowhere 已具备良好的技术基础，主要问题在于**内容生成策略过于保守**和**Prompt 引导不够具体**。通过以上优化方向，可以显著提升节目的丰富度和真实感，让它真正像一个有趣的网络电台，而不是"AI 读鸡汤配音乐"。

核心改进思路：
1. **放开节目类型限制** → 多样性
2. **注入对话模式模板** → 对话质量
3. **提高内容密度要求** → 信息量
4. **引入环节结构** → 专业感
5. **增加过渡元素** → 真实感
