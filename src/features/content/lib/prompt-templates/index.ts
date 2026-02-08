import { ShowType } from '../cast-system';
import { ShowConfig } from '../show-config';
import { getBasePrompt, PromptTemplateContext } from './base';
import { getTalkPrompt } from './talk';
import { getNewsPrompt } from './news';
import { getStoryPrompt } from './story';
import { getMusicPrompt } from './music';
import { getEntertainmentPrompt } from './entertainment';

export type PromptTemplateType = 'base' | 'talk' | 'news' | 'story' | 'music' | 'entertainment';

type PromptTemplateBuilder = (context: PromptTemplateContext) => string;

const TEMPLATE_BUILDERS: Record<PromptTemplateType, PromptTemplateBuilder> = {
    base: getBasePrompt,
    talk: getTalkPrompt,
    news: getNewsPrompt,
    story: getStoryPrompt,
    music: getMusicPrompt,
    entertainment: getEntertainmentPrompt
};

export function resolvePromptTemplateType(showType: ShowType, config?: ShowConfig): PromptTemplateType {
    const configured = config?.promptTemplate as PromptTemplateType | undefined;
    if (configured && TEMPLATE_BUILDERS[configured]) {
        return configured;
    }

    switch (showType) {
        case 'talk':
        case 'interview':
        case 'nighttalk':
            return 'talk';
        case 'news':
            return 'news';
        case 'story':
        case 'history':
        case 'science':
        case 'mystery':
        case 'drama':
            return 'story';
        case 'music':
            return 'music';
        case 'entertainment':
            return 'entertainment';
        default:
            return 'base';
    }
}

export function getPromptTemplate(type: PromptTemplateType): PromptTemplateBuilder {
    return TEMPLATE_BUILDERS[type] || TEMPLATE_BUILDERS.base;
}

export function buildPromptByType(
    showType: ShowType,
    context: PromptTemplateContext,
    config?: ShowConfig
): string {
    const templateType = resolvePromptTemplateType(showType, config);
    return getPromptTemplate(templateType)(context);
}

