import { PromptTemplateContext, getBasePrompt } from './base';

export function getEntertainmentPrompt(context: PromptTemplateContext): string {
    const entertainmentSection = `
## 🎪 娱乐综艺专项要求
1. 节目氛围要轻松，但信息与观点不能空洞。
2. 可加入互动段（投票、快问快答、听众观点模拟）。
3. 节奏上要有“抛梗 → 展开 → 回扣”的完整闭环。

## ✅ 正面示例
- 先抛一个有趣问题，再由两位主持人给出不同立场。
- 用一个小游戏或榜单环节承接话题，再自然切入音乐。

## ❌ 反面示例
- 只靠“哈哈哈”或口头禅堆时长。
- 一直开玩笑却没有主题推进。
- 互动环节只有标题，没有可播报台词。

## 🧾 密度要求
- 全期核心台词建议 8-12 句以上。
- 每个互动段至少 2 轮来回，避免“一问一答就结束”。
`.trim();

    return getBasePrompt({
        ...context,
        extraSections: [...(context.extraSections || []), entertainmentSection]
    });
}
