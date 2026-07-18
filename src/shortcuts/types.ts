/** Surfaces that host the root shortcut router. */
export type ShortcutSurface = 'dashboard' | 'workspace';

/**
 * Caption / tip identifiers for Focus, Loop, and other sibling surfaces.
 * Import these rather than hard-coding tip strings.
 */
export type TipId =
    | 'next-unknown'
    | 'park'
    | 'reopen'
    | 'evidence'
    | 'follow-up'
    | 'stance'
    | 'priority'
    | 'relationship-hinges'
    | 'relationship-breaks'
    | 'resolve'
    | 'focus-answer'
    | 'focus-title'
    | 'focus-outcome'
    | 'parked-section'
    | 'help'
    | 'back'
    | 'theme'
    | 'import'
    | 'view-tabs'
    | 'cycle-region'
    | 'export-memo'
    | 'backup-json'
    | 'copy-memo'
    | 'record-decision'
    | 'delete-focused'
    | 'evidence-polarity'
    | 'cancel-evidence';

/** Stable action ids used by the router and help sheet. */
export type ActionId =
    | 'nextUnknown'
    | 'park'
    | 'reopen'
    | 'toggleEvidence'
    | 'focusFollowUp'
    | 'setStance'
    | 'cyclePriority'
    | 'setRelationshipHinges'
    | 'setRelationshipBreaks'
    | 'resolve'
    | 'focusAnswer'
    | 'focusTitle'
    | 'focusOutcome'
    | 'toggleParkedSection'
    | 'openHelp'
    | 'closeHelp'
    | 'back'
    | 'toggleTheme'
    | 'import'
    | 'viewTab'
    | 'cycleRegion'
    | 'exportMemo'
    | 'backupJson'
    | 'copyMemo'
    | 'recordDecision'
    | 'deleteFocused'
    | 'evidencePolarity'
    | 'cancelEvidence'
    | 'escapeCascade';

export type BindingScope =
    | 'idle'
    | 'typing'
    | 'always'
    | 'dashboard'
    | 'workspace'
    | 'evidence';

export interface KeyChord {
    /** Physical / logical key from KeyboardEvent.key (normalized). */
    key: string;
    mod?: boolean;
    alt?: boolean;
    shift?: boolean;
}

export interface ShortcutBinding {
    id: ActionId;
    tipId?: TipId;
    /** Human label for help / captions. */
    label: string;
    /** Short description for the help sheet. */
    description: string;
    chords: KeyChord[];
    /** Preformatted display labels, e.g. ["N"] or ["⌘", "["]. */
    displayKeys: string[];
    scope: BindingScope;
    /** Day-1 caption set — prefer these in Focus/Loop tip UI. */
    day1?: boolean;
    surfaces?: ShortcutSurface[];
}
