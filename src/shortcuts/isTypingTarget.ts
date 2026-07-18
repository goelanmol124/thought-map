const NON_TEXT_INPUT_TYPES = new Set([
    'button',
    'checkbox',
    'radio',
    'submit',
    'reset',
    'file',
    'color',
    'range',
    'image',
    'hidden',
]);

/**
 * True when keyboard input should go to the focused control rather than
 * bare letter/digit app shortcuts. Mod/Alt chords may still fire.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;

    const element = target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    );
    if (!element) return false;

    if (element instanceof HTMLInputElement) {
        if (element.disabled) return false;
        const type = (element.type || 'text').toLowerCase();
        if (NON_TEXT_INPUT_TYPES.has(type)) return false;
        return true;
    }

    if (element instanceof HTMLTextAreaElement) {
        return !element.disabled;
    }

    if (element instanceof HTMLSelectElement) {
        return !element.disabled;
    }

    if (element instanceof HTMLElement && element.isContentEditable) {
        return true;
    }

    if (element.getAttribute('role') === 'textbox') {
        return true;
    }

    return false;
}

/** Blur the active element when it is a typing target (Escape cascade step). */
export function blurTypingTarget(): boolean {
    const active = document.activeElement;
    if (!isTypingTarget(active)) return false;
    if (active instanceof HTMLElement) {
        active.blur();
        return true;
    }
    return false;
}
