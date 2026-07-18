import { altLabel, modKey } from './platform';
import type { ActionId, ShortcutBinding, TipId } from './types';

const mod = (): string => modKey();
const alt = (): string => altLabel();

/** Build all binding metadata. Labels refresh with the current platform. */
export function getBindings(): ShortcutBinding[] {
    const m = mod();
    const a = alt();

    return [
        // --- Idle bare keys (workspace) ---
        {
            id: 'nextUnknown',
            tipId: 'next-unknown',
            label: 'Next unknown',
            description: 'Jump to the next ranked open unknown',
            chords: [{ key: 'n' }],
            displayKeys: ['N'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'park',
            tipId: 'park',
            label: 'Park',
            description: 'Park the focused unknown for later',
            chords: [{ key: 'p' }],
            displayKeys: ['P'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'reopen',
            tipId: 'reopen',
            label: 'Reopen',
            description: 'Reopen a parked unknown',
            chords: [{ key: 'o' }],
            displayKeys: ['O'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'toggleEvidence',
            tipId: 'evidence',
            label: 'Evidence',
            description: 'Toggle the evidence form',
            chords: [{ key: 'e' }],
            displayKeys: ['E'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'focusFollowUp',
            tipId: 'follow-up',
            label: 'Follow-up',
            description: 'Focus the follow-up composer',
            chords: [{ key: 'f' }],
            displayKeys: ['F'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'focusAnswer',
            tipId: 'focus-answer',
            label: 'Focus answer',
            description: 'Move focus to the answer field',
            chords: [{ key: 'a' }],
            displayKeys: ['A'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'resolve',
            tipId: 'resolve',
            label: 'Resolve',
            description: 'Resolve the active unknown (alias for Mod+Enter)',
            chords: [{ key: 'r' }],
            displayKeys: ['R'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'setStance',
            tipId: 'stance',
            label: 'Stance 1–5',
            description: 'Set stance, or evidence polarity 1–3 when the form is open',
            chords: [
                { key: '1' },
                { key: '2' },
                { key: '3' },
                { key: '4' },
                { key: '5' },
            ],
            displayKeys: ['1–5'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'cyclePriority',
            tipId: 'priority',
            label: 'Priority',
            description: 'Cycle priority down / up',
            chords: [{ key: '[' }, { key: ']' }],
            displayKeys: ['[', ']'],
            scope: 'idle',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'setRelationshipHinges',
            tipId: 'relationship-hinges',
            label: 'Hinges on',
            description: 'Set relationship to hinges-on',
            chords: [{ key: 'h' }],
            displayKeys: ['H'],
            scope: 'idle',
            surfaces: ['workspace'],
        },
        {
            id: 'setRelationshipBreaks',
            tipId: 'relationship-breaks',
            label: 'Breaks into',
            description: 'Set relationship to breaks-into',
            chords: [{ key: 'b' }],
            displayKeys: ['B'],
            scope: 'idle',
            surfaces: ['workspace'],
        },
        {
            id: 'toggleParkedSection',
            tipId: 'parked-section',
            label: 'Parked section',
            description: 'Expand or collapse parked unknowns',
            chords: [{ key: 'p', shift: true }],
            displayKeys: ['⇧', 'P'],
            scope: 'idle',
            surfaces: ['workspace'],
        },
        {
            id: 'openHelp',
            tipId: 'help',
            label: 'Keyboard help',
            description: 'Open the shortcut sheet',
            chords: [{ key: '?' }],
            displayKeys: ['?'],
            scope: 'idle',
            day1: true,
            surfaces: ['dashboard', 'workspace'],
        },
        {
            id: 'focusTitle',
            tipId: 'focus-title',
            label: 'Focus title',
            description: 'Edit the inquiry title',
            chords: [{ key: 'F2' }],
            displayKeys: ['F2'],
            scope: 'idle',
            surfaces: ['workspace'],
        },

        // --- Typing-safe Alt chords ---
        {
            id: 'setStance',
            tipId: 'stance',
            label: 'Stance (while typing)',
            description: 'Set stance without leaving the field',
            chords: [
                { key: '1', alt: true },
                { key: '2', alt: true },
                { key: '3', alt: true },
                { key: '4', alt: true },
                { key: '5', alt: true },
            ],
            displayKeys: [a, '1–5'],
            scope: 'typing',
            surfaces: ['workspace'],
        },
        {
            id: 'toggleEvidence',
            tipId: 'evidence',
            label: 'Evidence (while typing)',
            description: 'Toggle evidence form',
            chords: [{ key: 'e', alt: true }],
            displayKeys: [a, 'E'],
            scope: 'typing',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'focusFollowUp',
            tipId: 'follow-up',
            label: 'Follow-up (while typing)',
            description: 'Focus the follow-up composer',
            chords: [{ key: 'f', alt: true }],
            displayKeys: [a, 'F'],
            scope: 'typing',
            surfaces: ['workspace'],
        },
        {
            id: 'nextUnknown',
            tipId: 'next-unknown',
            label: 'Next unknown (while typing)',
            description: 'Jump to the next ranked open unknown',
            chords: [{ key: ']', alt: true }],
            displayKeys: [a, ']'],
            scope: 'typing',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'park',
            tipId: 'park',
            label: 'Park (while typing)',
            description: 'Park the focused unknown',
            chords: [{ key: 'p', alt: true }],
            displayKeys: [a, 'P'],
            scope: 'typing',
            surfaces: ['workspace'],
        },
        {
            id: 'reopen',
            tipId: 'reopen',
            label: 'Reopen (while typing)',
            description: 'Reopen a parked unknown',
            chords: [{ key: 'o', alt: true, shift: true }],
            displayKeys: [a, '⇧', 'O'],
            scope: 'typing',
            surfaces: ['workspace'],
        },
        {
            id: 'focusOutcome',
            tipId: 'focus-outcome',
            label: 'Focus outcome',
            description: 'Focus the intended outcome field',
            chords: [{ key: 'o', alt: true }],
            displayKeys: [a, 'O'],
            scope: 'typing',
            surfaces: ['workspace'],
        },
        {
            id: 'cyclePriority',
            tipId: 'priority',
            label: 'Priority (while typing)',
            description: 'Cycle priority while typing',
            chords: [
                { key: '[', alt: true, shift: true },
                { key: ']', alt: true, shift: true },
            ],
            displayKeys: [a, '⇧', '[ / ]'],
            scope: 'typing',
            surfaces: ['workspace'],
        },

        // --- Always / mod chords ---
        {
            id: 'resolve',
            tipId: 'resolve',
            label: 'Resolve / record',
            description: 'Resolve unknown (Focus) or record decision (Memo) — host decides',
            chords: [{ key: 'Enter', mod: true }],
            displayKeys: [m, 'Enter'],
            scope: 'always',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'escapeCascade',
            tipId: 'cancel-evidence',
            label: 'Escape',
            description: 'Close help → cancel evidence → blur field (never goes back)',
            chords: [{ key: 'Escape' }],
            displayKeys: ['Esc'],
            scope: 'always',
            day1: true,
            surfaces: ['dashboard', 'workspace'],
        },
        {
            id: 'back',
            tipId: 'back',
            label: 'Back',
            description: 'Return to all inquiries',
            chords: [{ key: '[', mod: true }],
            displayKeys: [m, '['],
            scope: 'always',
            day1: true,
            surfaces: ['workspace'],
        },
        {
            id: 'toggleTheme',
            tipId: 'theme',
            label: 'Theme',
            description: 'Toggle light / dark theme',
            chords: [{ key: 'l', mod: true, shift: true }],
            displayKeys: [m, '⇧', 'L'],
            scope: 'always',
            surfaces: ['dashboard', 'workspace'],
        },
        {
            id: 'import',
            tipId: 'import',
            label: 'Import',
            description: 'Import an inquiry JSON file',
            chords: [{ key: 'o', mod: true }],
            displayKeys: [m, 'O'],
            scope: 'always',
            surfaces: ['dashboard'],
        },
        {
            id: 'openHelp',
            tipId: 'help',
            label: 'Keyboard help',
            description: 'Open the shortcut sheet',
            chords: [{ key: '/', mod: true }],
            displayKeys: [m, '/'],
            scope: 'always',
            day1: true,
            surfaces: ['dashboard', 'workspace'],
        },
        {
            id: 'cycleRegion',
            tipId: 'cycle-region',
            label: 'Cycle regions',
            description: 'Move between Path / Answer / Unknowns / Memo',
            chords: [
                { key: 'ArrowUp', mod: true },
                { key: 'ArrowDown', mod: true },
            ],
            displayKeys: [m, '↑ / ↓'],
            scope: 'always',
            surfaces: ['workspace'],
        },
        {
            id: 'viewTab',
            tipId: 'view-tabs',
            label: 'View tabs',
            description: 'Switch to Path, Answer, Unknowns, or Memo',
            chords: [
                { key: '1', mod: true },
                { key: '2', mod: true },
                { key: '3', mod: true },
                { key: '4', mod: true },
            ],
            displayKeys: [m, '1–4'],
            scope: 'always',
            surfaces: ['workspace'],
        },
        {
            id: 'deleteFocused',
            tipId: 'delete-focused',
            label: 'Delete focused',
            description: 'Delete the focused inquiry or question (context-dependent)',
            chords: [{ key: 'Backspace', mod: true }],
            displayKeys: [m, '⌫'],
            scope: 'always',
            surfaces: ['dashboard', 'workspace'],
        },
        {
            id: 'exportMemo',
            tipId: 'export-memo',
            label: 'Export memo',
            description: 'Download the decision memo as Markdown',
            chords: [{ key: 's', mod: true }],
            displayKeys: [m, 'S'],
            scope: 'always',
            surfaces: ['workspace'],
        },
        {
            id: 'backupJson',
            tipId: 'backup-json',
            label: 'Backup JSON',
            description: 'Download a full inquiry JSON backup',
            chords: [{ key: 's', mod: true, shift: true }],
            displayKeys: [m, '⇧', 'S'],
            scope: 'always',
            surfaces: ['workspace'],
        },
        {
            id: 'copyMemo',
            tipId: 'copy-memo',
            label: 'Copy memo',
            description: 'Copy the decision memo Markdown to the clipboard',
            chords: [{ key: 'c', mod: true, shift: true }],
            displayKeys: [m, '⇧', 'C'],
            scope: 'always',
            surfaces: ['workspace'],
        },
        {
            id: 'recordDecision',
            tipId: 'record-decision',
            label: 'Record decision',
            description: 'Capture a decision snapshot from the memo view',
            chords: [{ key: 'Enter', mod: true }],
            displayKeys: [m, 'Enter'],
            scope: 'always',
            surfaces: ['workspace'],
        },
        {
            id: 'evidencePolarity',
            tipId: 'evidence-polarity',
            label: 'Evidence polarity',
            description: 'Set polarity 1–3 while the evidence form is open',
            chords: [{ key: '1' }, { key: '2' }, { key: '3' }],
            displayKeys: ['1–3'],
            scope: 'evidence',
            surfaces: ['workspace'],
        },
        {
            id: 'cancelEvidence',
            tipId: 'cancel-evidence',
            label: 'Cancel evidence',
            description: 'Close the evidence form (Escape cascade)',
            chords: [{ key: 'Escape' }],
            displayKeys: ['Esc'],
            scope: 'evidence',
            surfaces: ['workspace'],
        },
    ];
}

/** Day-1 caption bindings (deduped by tip id, idle + always day1 preferred). */
export function getDay1Bindings(): ShortcutBinding[] {
    const seen = new Set<TipId>();
    const result: ShortcutBinding[] = [];
    for (const binding of getBindings()) {
        if (!binding.day1 || !binding.tipId) continue;
        if (seen.has(binding.tipId)) continue;
        seen.add(binding.tipId);
        result.push(binding);
    }
    return result;
}

/** Lookup the first binding for a tip — for Focus/Loop caption components. */
export function getBindingForTip(tipId: TipId): ShortcutBinding | undefined {
    return getBindings().find((binding) => binding.tipId === tipId);
}

/** Format a binding’s keys as a single caption string, e.g. "⌘+Enter" or "N". */
export function formatBindingKeys(binding: ShortcutBinding): string {
    return binding.displayKeys.join(binding.displayKeys.length > 2 ? '' : '+')
        .replace(/\+\+/g, '+');
}

/** Compact join for caption chips: "⌘ Enter" or "N". */
export function formatBindingCaption(binding: ShortcutBinding): string {
    if (binding.displayKeys.length === 1) return binding.displayKeys[0];
    return binding.displayKeys.join(' ');
}

export function getBindingsForSurface(
    surface: 'dashboard' | 'workspace',
): ShortcutBinding[] {
    return getBindings().filter(
        (binding) => !binding.surfaces || binding.surfaces.includes(surface),
    );
}

/** Unique help rows — one row per action id (prefer idle/day1 presentation). */
export function getHelpRows(surface: 'dashboard' | 'workspace'): ShortcutBinding[] {
    const preferred = new Map<ActionId, ShortcutBinding>();
    for (const binding of getBindingsForSurface(surface)) {
        if (binding.id === 'escapeCascade' || binding.id === 'closeHelp') continue;
        if (binding.id === 'recordDecision') continue; // folded into resolve row
        if (binding.id === 'evidencePolarity' || binding.id === 'cancelEvidence') continue;
        const existing = preferred.get(binding.id);
        if (!existing) {
            preferred.set(binding.id, binding);
            continue;
        }
        // Prefer day1 / idle labels for the sheet.
        if (binding.day1 && !existing.day1) preferred.set(binding.id, binding);
        else if (binding.scope === 'idle' && existing.scope !== 'idle') {
            preferred.set(binding.id, binding);
        }
    }
    return [...preferred.values()];
}
