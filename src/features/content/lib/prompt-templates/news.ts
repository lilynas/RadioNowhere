import { PromptTemplateContext, getBasePrompt } from './base';

export function getNewsPrompt(context: PromptTemplateContext): string {
    const newsSection = `
## 🗞️ 新闻播报专项要求
1. 先概述重点，再展开 2-4 条新闻事实。
2. 每条新闻尽量包含“事件 + 影响 + 观点”三层信息。
3. 评论要克制，避免阴谋论和未经证实的断言。

## ✅ 正面示例
- 先给一句总览：“今天有三件值得关注的事”，再分条播报。
- 在评论时给出可验证的背景信息，而不是情绪化判断。

## ❌ 反面示例
- 只有标题复读，不解释缘由。
- 把猜测写成事实，或夸张煽动。
- 全程没有主持人口播节奏，像复制新闻网页。

## 🧾 密度要求
- 全期口播总句数建议 8-12 句以上。
- 每条核心新闻至少给出 2 句可播报内容。
`.trim();

    return getBasePrompt({
        ...context,
        extraSections: [...(context.extraSections || []), newsSection]
    });
}
