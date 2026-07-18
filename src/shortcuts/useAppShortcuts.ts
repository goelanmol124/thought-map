import { useEffect } from 'react';
import { blurTypingTarget, isTypingTarget } from './isTypingTarget';
import { hasForeignMod, hasMod } from './platform';
import { announceShortcut } from './surfaceCaptions';
import type { ShortcutSurface } from './types';

export interface AppShortcutHandlers {
    enabled?: boolean;
    surface: ShortcutSurface;
    onBack?: () => void;
    onToggleTheme?: () => void;
    onImport?: () => void;
    /** Dashboard: open the focused inquiry row. */
    onOpenFocused?: () => void;
    onNextUnknown?: () => void;
    onPark?: () => void;
    onReopen?: () => void;
    onToggleEvidence?: () => void;
    onFocusFollowUp?: () => void;
    onSetStance?: (stance: 1 | 2 | 3 | 4 | 5) => void;
    onCyclePriority?: (dir: 1 | -1) => void;
    onSetRelationship?: (rel: 'hinges-on' | 'breaks-into') => void;
    onResolve?: () => void;
    onFocusAnswer?: () => void;
    onFocusTitle?: () => void;
    onFocusOutcome?: () => void;
    onToggleParkedSection?: () => void;
    onCycleRegion?: (dir: 1 | -1) => void;
    onViewTab?: (index: number) => void;
    onRecordDecision?: () => void;
    onExportMemo?: () => void;
    onBackupJson?: () => void;
    onCopyMemo?: () => void;
    onDeleteFocused?: () => void;
    evidenceOpen?: boolean;
    onEvidencePolarity?: (n: 1 | 2 | 3) => void;
    onCancelEvidence?: () => void;
    helpOpen: boolean;
    setHelpOpen: (v: boolean) => void;
}

const digitFromKey = (key: string): number | null => {
    if (key.length === 1 && key >= '1' && key <= '5') return Number(key);
    return null;
};

const isPlainKey = (event: KeyboardEvent): boolean =>
    !event.altKey && !event.shiftKey && !hasMod(event) && !hasForeignMod(event);

/**
 * Root keyboard router for IdeaMap.
 * Registers a window keydown listener and dispatches to host callbacks.
 * Bare letters/digits never fire while focus is in a typing target.
 */
export function useAppShortcuts(handlers: AppShortcutHandlers): void {
    const {
        enabled = true,
        surface,
        helpOpen,
        setHelpOpen,
        evidenceOpen = false,
        onBack,
        onToggleTheme,
        onImport,
        onOpenFocused,
        onNextUnknown,
        onPark,
        onReopen,
        onToggleEvidence,
        onFocusFollowUp,
        onSetStance,
        onCyclePriority,
        onSetRelationship,
        onResolve,
        onFocusAnswer,
        onFocusTitle,
        onFocusOutcome,
        onToggleParkedSection,
        onCycleRegion,
        onViewTab,
        onRecordDecision,
        onExportMemo,
        onBackupJson,
        onCopyMemo,
        onDeleteFocused,
        onEvidencePolarity,
        onCancelEvidence,
    } = handlers;

    useEffect(() => {
        if (!enabled) return;

        const handleEscape = (): boolean => {
            // Cascade: close help → cancel evidence → blur follow-up/field → stop.
            if (helpOpen) {
                setHelpOpen(false);
                return true;
            }
            if (evidenceOpen) {
                onCancelEvidence?.();
                return true;
            }
            if (blurTypingTarget()) return true;
            return false;
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.isComposing || event.key === 'Process') return;
            // Respect handlers that already claimed the event (e.g. FocusPanel Mod+Enter).
            if (event.defaultPrevented) return;

            const typing = isTypingTarget(event.target);
            const mod = hasMod(event);
            const foreign = hasForeignMod(event);
            const key = event.key;
            const lower = key.length === 1 ? key.toLowerCase() : key;

            const take = (fn: (() => void) | undefined, action?: string): boolean => {
                if (!fn) return false;
                event.preventDefault();
                fn();
                if (action) announceShortcut(action);
                return true;
            };

            // --- Escape (always; never navigates back) ---
            if (key === 'Escape' && !mod && !event.altKey) {
                if (handleEscape()) {
                    event.preventDefault();
                    announceShortcut('escape');
                }
                return;
            }

            // --- Help: Mod+/ (always) ---
            if (mod && !event.altKey && !event.shiftKey && key === '/') {
                take(() => setHelpOpen(!helpOpen), 'help');
                return;
            }

            // --- Theme: Mod+Shift+L ---
            if (mod && event.shiftKey && !event.altKey && lower === 'l') {
                take(onToggleTheme, 'theme');
                return;
            }

            // --- Back: Mod+[ (workspace) ---
            if (
                surface === 'workspace'
                && mod
                && !event.shiftKey
                && !event.altKey
                && key === '['
            ) {
                take(onBack, 'back');
                return;
            }

            // --- Import: Mod+O (dashboard) ---
            if (
                surface === 'dashboard'
                && mod
                && !event.shiftKey
                && !event.altKey
                && lower === 'o'
            ) {
                take(onImport, 'import');
                return;
            }

            // --- Delete: Mod+Backspace ---
            if (mod && !event.shiftKey && !event.altKey && key === 'Backspace') {
                take(onDeleteFocused, 'delete');
                return;
            }

            if (surface === 'workspace') {
                // Mod+Enter → resolve (Focus) or record (Memo); host wires the callback.
                if (mod && !event.altKey && !event.shiftKey && key === 'Enter') {
                    if (onResolve) {
                        take(onResolve, 'resolve');
                    } else {
                        take(onRecordDecision, 'resolve');
                    }
                    return;
                }

                // Mod+1..4 view tabs
                if (mod && !event.altKey && !event.shiftKey && !foreign) {
                    const digit = digitFromKey(key);
                    if (digit !== null && digit >= 1 && digit <= 4 && onViewTab) {
                        take(() => onViewTab(digit - 1), 'view-tab');
                        return;
                    }
                }

                // Mod+↑/↓ cycle regions
                if (mod && !event.altKey && !event.shiftKey && onCycleRegion) {
                    if (key === 'ArrowUp') {
                        take(() => onCycleRegion(-1), 'cycle-region');
                        return;
                    }
                    if (key === 'ArrowDown') {
                        take(() => onCycleRegion(1), 'cycle-region');
                        return;
                    }
                }

                // Export / backup / copy
                if (mod && !event.altKey && lower === 's') {
                    if (event.shiftKey) {
                        take(onBackupJson, 'backup');
                    } else {
                        take(onExportMemo, 'export');
                    }
                    return;
                }
                if (mod && event.shiftKey && !event.altKey && lower === 'c') {
                    take(onCopyMemo, 'copy');
                    return;
                }

                // --- Alt chords (work while typing) ---
                if (event.altKey && !mod) {
                    const digit = digitFromKey(key);
                    if (digit !== null && digit >= 1 && digit <= 5 && onSetStance) {
                        take(() => onSetStance(digit as 1 | 2 | 3 | 4 | 5), 'stance');
                        return;
                    }
                    if (lower === 'e' && !event.shiftKey) {
                        take(onToggleEvidence, 'evidence');
                        return;
                    }
                    if (lower === 'f' && !event.shiftKey) {
                        take(onFocusFollowUp, 'follow-up');
                        return;
                    }
                    if (key === ']' && !event.shiftKey) {
                        take(onNextUnknown, 'next');
                        return;
                    }
                    if (lower === 'p' && !event.shiftKey) {
                        take(onPark, 'park');
                        return;
                    }
                    if (lower === 'o' && event.shiftKey) {
                        take(onReopen, 'reopen');
                        return;
                    }
                    if (event.shiftKey && (key === '[' || key === ']') && onCyclePriority) {
                        take(() => onCyclePriority(key === ']' ? 1 : -1), 'priority');
                        return;
                    }
                }
            }

            // Alt+O — focus/toggle outcome (dashboard + workspace); not Alt+Shift+O.
            if (
                event.altKey
                && !mod
                && !event.shiftKey
                && lower === 'o'
                && onFocusOutcome
            ) {
                take(onFocusOutcome, 'outcome');
                return;
            }

            // Typing guard: bare letters/digits never fire in fields.
            // Evidence polarity 1–3 is idle-only while the form is open (below).
            if (typing) return;
            if (foreign) return;

            // Idle help: ?
            if (isPlainKey(event) && key === '?') {
                take(() => setHelpOpen(true), 'help');
                return;
            }

            // Dashboard: o opens the focused inquiry row
            if (surface === 'dashboard' && isPlainKey(event) && lower === 'o') {
                take(onOpenFocused, 'open');
                return;
            }

            if (surface !== 'workspace') return;
            if (mod || event.altKey) return;

            // F2 title
            if (key === 'F2' && !event.shiftKey) {
                take(onFocusTitle, 'title');
                return;
            }

            // Shift+P parked section
            if (event.shiftKey && lower === 'p') {
                take(onToggleParkedSection, 'parked-section');
                return;
            }

            if (event.shiftKey) return;

            // Digits: evidence polarity when open, else stance
            const digit = digitFromKey(key);
            if (digit !== null) {
                if (evidenceOpen) {
                    if (digit >= 1 && digit <= 3 && onEvidencePolarity) {
                        take(() => onEvidencePolarity(digit as 1 | 2 | 3), 'evidence');
                    }
                    return;
                }
                if (onSetStance) {
                    take(() => onSetStance(digit as 1 | 2 | 3 | 4 | 5), 'stance');
                }
                return;
            }

            if (key === '[' && onCyclePriority) {
                take(() => onCyclePriority(-1), 'priority');
                return;
            }
            if (key === ']' && onCyclePriority) {
                take(() => onCyclePriority(1), 'priority');
                return;
            }

            switch (lower) {
                case 'n':
                    take(onNextUnknown, 'next');
                    break;
                case 'p':
                    take(onPark, 'park');
                    break;
                case 'o':
                    take(onReopen, 'reopen');
                    break;
                case 'e':
                    take(onToggleEvidence, 'evidence');
                    break;
                case 'f':
                    take(onFocusFollowUp, 'follow-up');
                    break;
                case 'a':
                    take(onFocusAnswer, 'answer');
                    break;
                case 'r':
                    take(onResolve, 'resolve');
                    break;
                case 'h':
                    if (onSetRelationship) {
                        take(() => onSetRelationship('hinges-on'), 'relationship');
                    }
                    break;
                case 'b':
                    if (onSetRelationship) {
                        take(() => onSetRelationship('breaks-into'), 'relationship');
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [
        enabled,
        surface,
        helpOpen,
        setHelpOpen,
        evidenceOpen,
        onBack,
        onToggleTheme,
        onImport,
        onOpenFocused,
        onNextUnknown,
        onPark,
        onReopen,
        onToggleEvidence,
        onFocusFollowUp,
        onSetStance,
        onCyclePriority,
        onSetRelationship,
        onResolve,
        onFocusAnswer,
        onFocusTitle,
        onFocusOutcome,
        onToggleParkedSection,
        onCycleRegion,
        onViewTab,
        onRecordDecision,
        onExportMemo,
        onBackupJson,
        onCopyMemo,
        onDeleteFocused,
        onEvidencePolarity,
        onCancelEvidence,
    ]);
}
