import { PromptTemplateContext, getBasePrompt } from './base';

export function getStoryPrompt(context: PromptTemplateContext): string {
    const isDrama = context.showType === 'drama';

    const storySection = `
## 📚 故事叙事专项要求
1. 采用“起因 → 发展 → 转折 → 回响”结构推进。
2. 讲故事时要有画面细节，不只总结结论。
3. 历史/科普内容需兼顾准确性与可听性。

## ✅ 正面示例
- 先给背景，再抛出冲突，最后给当代关联。
- 每段叙述都有可感知细节（时间、地点、人物动作）。

## ❌ 反面示例
- 像百科词条一样堆信息，没有情绪节奏。
- 只给结果，不讲关键过程与因果关系。
- 用“总之很厉害”替代具体证据。

## 🧾 密度要求
- 全期口播总句数建议 8-12 句以上。
- 每个主叙事段至少 3 句，至少包含 1 个转折点。
`.trim();

    const dramaSection = isDrama
        ? `
## 🎭 广播剧增强要求
1. 至少包含 3 个角色（可含旁白），角色说话风格必须可区分。
2. 冲突与反转要明确，避免“流水账式对白”。
3. 可选使用 \`soundEffects\` 字段描述音效提示（如门响、雨声、脚步）。
4. 若使用音效字段，请写成结构化数组，系统会在不支持时自动降级忽略。

### soundEffects 示例
"soundEffects": [
  {"cue": "雨声渐强", "position": "underlay", "volume": 0.25},
  {"cue": "木门被推开", "position": "before", "volume": 0.4}
]
`
        : '';

    return getBasePrompt({
        ...context,
        extraSections: [...(context.extraSections || []), storySection, dramaSection].filter(Boolean)
    });
}
