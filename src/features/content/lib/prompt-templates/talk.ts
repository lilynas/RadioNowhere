import { PromptTemplateContext, getBasePrompt } from './base';

export function getTalkPrompt(context: PromptTemplateContext): string {
    const styleSection = `
## 🎙️ 对话模式引导
你可以混合以下模式，让节目更像真实电台：
1. 辩论式：两位主持人从不同立场切入同一问题，再寻找共识。
2. 叙事接力：一人讲经历，另一人补充反转或旁观者视角。
3. 吐槽式：先轻松吐槽再进入深层原因分析，避免纯段子化。

## ✅ 正面示例
- A 先提出“年轻人为何总觉得时间不够用”，B 不直接附和，而是给出反例与个人经历。
- 在第三轮对话引入具体场景（通勤、加班、社交媒体），并给出可执行建议。

## ❌ 反面示例
- 只会“我同意你”“你说得对”。
- 只讲感受，不给任何事实、案例或方法。
- 每句都很短，缺少完整表达链条。

## 🧾 密度要求
- 全期核心对话总句数建议 8-12 句以上。
- 每个 talk block 至少 3 句，不少于 2 个来回。
`.trim();

    return getBasePrompt({
        ...context,
        extraSections: [...(context.extraSections || []), styleSection]
    });
}
