export type {
    ActionId,
    BindingScope,
    KeyChord,
    ShortcutBinding,
    ShortcutSurface,
    TipId,
} from './types';

export {
    altChordLabel,
    altKeyLabel,
    altLabel,
    hasForeignMod,
    hasMod,
    isApplePlatform,
    isMac,
    modEnterLabel,
    modKey,
    modKeyLabel,
} from './platform';

export { blurTypingTarget, isTypingTarget } from './isTypingTarget';

export {
    formatBindingCaption,
    formatBindingKeys,
    getBindingForTip,
    getBindings,
    getBindingsForSurface,
    getDay1Bindings,
    getHelpRows,
} from './bindings';

export {
    useAppShortcuts,
    type AppShortcutHandlers,
} from './useAppShortcuts';

export { ShortcutSheet } from './ShortcutSheet';

export {
    announceShortcut,
    Caption,
    ModeCaption,
    resetSurfaceCaptions,
    SHORTCUT_EVENT,
    SURFACE_CAPTIONS_STORAGE_KEY,
    useSurfaceCaptions,
    type SurfaceCaptionId,
} from './surfaceCaptions';

/** Stance index 1–5 → Stance union (Focus panel order). */
export const STANCE_BY_INDEX = [
    'unknown',
    'leaning',
    'supported',
    'decided',
    'disputed',
] as const;

/** Evidence polarity index 1–3. */
export const EVIDENCE_POLARITY_BY_INDEX = [
    'supports',
    'weakens',
    'context',
] as const;

/** Priority cycle order for [ ] shortcuts. */
export const PRIORITY_CYCLE = ['blocking', 'high', 'normal'] as const;

export function stanceFromIndex(n: 1 | 2 | 3 | 4 | 5) {
    return STANCE_BY_INDEX[n - 1];
}

export function evidencePolarityFromIndex(n: 1 | 2 | 3) {
    return EVIDENCE_POLARITY_BY_INDEX[n - 1];
}

export function cyclePriority(
    current: (typeof PRIORITY_CYCLE)[number],
    dir: 1 | -1,
): (typeof PRIORITY_CYCLE)[number] {
    const index = PRIORITY_CYCLE.indexOf(current);
    const safe = index < 0 ? 0 : index;
    const next = (safe + dir + PRIORITY_CYCLE.length) % PRIORITY_CYCLE.length;
    return PRIORITY_CYCLE[next];
}
