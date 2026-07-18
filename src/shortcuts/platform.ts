/** Platform-aware shortcut detection and label glyphs. */

/** True when the platform uses Meta as the primary modifier (macOS). */
export const isMac = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const platform = navigator.platform ?? '';
    const ua = navigator.userAgent ?? '';
    const uaData = (navigator as Navigator & {
        userAgentData?: { platform?: string };
    }).userAgentData;
    const hint = uaData?.platform ?? platform;
    return /Mac|iPhone|iPad|iPod/i.test(hint) || /Mac OS X/.test(ua);
};

/** Alias used by surface captions. */
export const isApplePlatform = (): boolean => isMac();

/** Primary modifier key label for captions and help (⌘ / Ctrl). */
export const modKey = (): string => (isMac() ? '⌘' : 'Ctrl');

/** Alias used by surface captions. */
export const modKeyLabel = (): string => modKey();

/** Alt / Option key label for captions and help. */
export const altLabel = (): string => (isMac() ? '⌥' : 'Alt');

/** Alias used by surface captions. */
export const altKeyLabel = (): string => altLabel();

/** e.g. ⌘↵ on Apple, Ctrl+Enter elsewhere */
export function modEnterLabel(): string {
    return isMac() ? '⌘↵' : 'Ctrl+Enter';
}

/** e.g. ⌥E or Alt+E */
export function altChordLabel(key: string): string {
    const glyph = altLabel();
    return glyph === '⌥' ? `${glyph}${key}` : `${glyph}+${key}`;
}

/** Whether the event carries the platform Mod key (Ctrl on Win/Linux, Meta on macOS). */
export const hasMod = (event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>): boolean =>
    isMac() ? event.metaKey : event.ctrlKey;

/** True when the non-primary modifier of the pair is held (avoid treating Ctrl as Mod on Mac). */
export const hasForeignMod = (event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>): boolean =>
    isMac() ? event.ctrlKey : event.metaKey;
