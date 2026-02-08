import { PromptTemplateContext, getBasePrompt } from './base';

export function getMusicPrompt(context: PromptTemplateContext): string {
    const musicSection = `
## 🎵 音乐专题专项要求
1. 主线是“为什么推荐这首歌/这位歌手”，不是单纯报歌单。
2. 介绍音乐时要连接情绪、时代或场景。
3. 至少给出 2 次“讲解 → 放歌 → 回收点评”的闭环。

## ✅ 正面示例
- 主持人先讲某首歌诞生背景，再解释它为何适合当前时段。
- 放歌后回到对话，补充歌词意象或编曲亮点。

## ❌ 反面示例
- 连续报歌名，不讲关联理由。
- 把音乐段塞满，talk 段只剩一句过场。
- 所有推荐都来自同类艺人，缺乏多样性。

## 🧾 密度要求
- 全期口播总句数建议 8-12 句以上。
- 每次放歌前后至少各 1 句解释，避免“无理由切歌”。
`.trim();

    return getBasePrompt({
        ...context,
        extraSections: [...(context.extraSections || []), musicSection]
    });
}
