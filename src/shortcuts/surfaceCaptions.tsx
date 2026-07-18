/**
 * Surface Captions — muted footnotes on existing controls.
 *
 * Keyboard agents dismiss captions by dispatching:
 *   window.dispatchEvent(new CustomEvent('ideamap:shortcut', {
 *     detail: { action: string }
 *   }))
 *
 * Event name: `ideamap:shortcut`
 * Detail shape: `{ action: string }`
 *
 * Preferred action names (also accept short aliases):
 *   begin | next | nextUnknown | park | resolve | stance | setStance |
 *   evidence | toggleEvidence | follow-up | focusFollowUp | stage |
 *   escape | loop-select | loop-focus | outline-move | outline-open |
 *   outline-back | help | openHelp
 */

import {
    useSyncExternalStore,
    type ReactNode,
} from 'react';
import { isTypingTarget } from './isTypingTarget';

export const SURFACE_CAPTIONS_STORAGE_KEY = 'ideamap.surfaceCaptions.v1';
export const SHORTCUT_EVENT = 'ideamap:shortcut';

export type SurfaceCaptionId =
    | 'dashboard.begin'
    | 'focus.answer'
    | 'focus.stance'
    | 'focus.evidence'
    | 'focus.followUp'
    | 'focus.resolve'
    | 'loop.heading'
    | 'loop.next'
    | 'outline.heading';

/** Maps shortcut action names → caption id(s) to dismiss. */
const ACTION_TO_CAPTIONS: Record<string, SurfaceCaptionId[]> = {
    begin: ['dashboard.begin'],
    resolve: ['focus.resolve', 'focus.answer'],
    stance: ['focus.stance', 'focus.answer'],
    setStance: ['focus.stance', 'focus.answer'],
    evidence: ['focus.evidence'],
    toggleEvidence: ['focus.evidence'],
    'follow-up': ['focus.followUp'],
    focusFollowUp: ['focus.followUp'],
    stage: ['focus.followUp'],
    escape: ['focus.followUp', 'focus.answer'],
    escapeCascade: ['focus.followUp', 'focus.answer'],
    next: ['loop.next', 'loop.heading'],
    nextUnknown: ['loop.next', 'loop.heading'],
    park: ['loop.heading'],
    'loop-select': ['loop.heading'],
    'loop-focus': ['loop.heading'],
    'outline-move': ['outline.heading'],
    'outline-open': ['outline.heading'],
    'outline-back': ['outline.heading'],
    back: ['outline.heading'],
};

type StoredState = { dismissed: string[] };

let dismissedIds = new Set<string>(loadDismissed());
const listeners = new Set<() => void>();

function loadDismissed(): string[] {
    try {
        const raw = localStorage.getItem(SURFACE_CAPTIONS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        if (!Array.isArray(parsed.dismissed)) return [];
        return parsed.dismissed.filter((id): id is string => typeof id === 'string');
    } catch {
        return [];
    }
}

function persist() {
    try {
        const payload: StoredState = { dismissed: [...dismissedIds] };
        localStorage.setItem(SURFACE_CAPTIONS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Quota / private mode — keep in-memory dismissals for the session.
    }
}

function emit() {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getDismissedSnapshot(): Set<string> {
    return dismissedIds;
}

function getServerSnapshot(): Set<string> {
    return dismissedIds;
}

function dismissCaption(id: string) {
    if (dismissedIds.has(id)) return;
    dismissedIds = new Set(dismissedIds);
    dismissedIds.add(id);
    persist();
    emit();
}

function dismissForAction(action: string) {
    const ids = ACTION_TO_CAPTIONS[action];
    if (!ids?.length) return;
    let changed = false;
    const next = new Set(dismissedIds);
    for (const id of ids) {
        if (!next.has(id)) {
            next.add(id);
            changed = true;
        }
    }
    if (!changed) return;
    dismissedIds = next;
    persist();
    emit();
}

/** Clear all dismissed surface captions (Keys sheet “Show captions again”). */
export function resetSurfaceCaptions() {
    if (dismissedIds.size === 0) return;
    dismissedIds = new Set();
    try {
        localStorage.removeItem(SURFACE_CAPTIONS_STORAGE_KEY);
    } catch {
        // ignore
    }
    emit();
}

function resetCaptions() {
    resetSurfaceCaptions();
}

/** Dispatch a successful shortcut so captions can dismiss without merge-fighting key routers. */
export function announceShortcut(action: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(SHORTCUT_EVENT, { detail: { action } }),
    );
}

let typingListenersAttached = false;
let isTypingNow = false;
const typingListeners = new Set<() => void>();

function refreshTyping() {
    const next = isTypingTarget(document.activeElement);
    if (next === isTypingNow) return;
    isTypingNow = next;
    typingListeners.forEach((listener) => listener());
}

function subscribeTyping(listener: () => void): () => void {
    typingListeners.add(listener);
    if (!typingListenersAttached && typeof document !== 'undefined') {
        typingListenersAttached = true;
        document.addEventListener('focusin', refreshTyping, true);
        document.addEventListener('focusout', refreshTyping, true);
        refreshTyping();
    }
    return () => {
        typingListeners.delete(listener);
    };
}

function getTypingSnapshot(): boolean {
    return isTypingNow;
}

function getTypingServerSnapshot(): boolean {
    return false;
}

// Global dismiss bridge — one listener for the whole app.
if (typeof window !== 'undefined') {
    window.addEventListener(SHORTCUT_EVENT, ((event: Event) => {
        const detail = (event as CustomEvent<{ action?: string }>).detail;
        const action = detail?.action;
        if (typeof action === 'string' && action.length > 0) {
            dismissForAction(action);
        }
    }) as EventListener);
}

export function useSurfaceCaptions() {
    const dismissed = useSyncExternalStore(
        subscribe,
        getDismissedSnapshot,
        getServerSnapshot,
    );
    const isTyping = useSyncExternalStore(
        subscribeTyping,
        getTypingSnapshot,
        getTypingServerSnapshot,
    );

    const show = (id: SurfaceCaptionId | string): boolean => !dismissed.has(id);
    const isDismissed = (id: SurfaceCaptionId | string): boolean => dismissed.has(id);

    return {
        show,
        dismiss: dismissCaption,
        reset: resetCaptions,
        isTyping,
        isDismissed,
    };
}

export function Caption({
    id,
    children,
    className,
}: {
    id: SurfaceCaptionId;
    children: ReactNode;
    className?: string;
}) {
    const { show } = useSurfaceCaptions();
    if (!show(id)) return null;
    return (
        <span
            className={className ? `surface-caption ${className}` : 'surface-caption'}
            aria-hidden="true"
        >
            {children}
        </span>
    );
}

export function ModeCaption({
    id,
    idle,
    typing,
    className,
}: {
    id: SurfaceCaptionId;
    idle: ReactNode;
    typing: ReactNode;
    className?: string;
}) {
    const { show, isTyping } = useSurfaceCaptions();
    if (!show(id)) return null;
    return (
        <span
            className={className ? `surface-caption ${className}` : 'surface-caption'}
            aria-hidden="true"
        >
            <span className="surface-caption__flip">
                <span className={isTyping ? 'is-inactive' : undefined}>{idle}</span>
                <span className={!isTyping ? 'is-inactive' : undefined}>{typing}</span>
            </span>
        </span>
    );
}
