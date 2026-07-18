import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { formatBindingCaption, getHelpRows } from './bindings';
import { resetSurfaceCaptions } from './surfaceCaptions';
import type { ShortcutSurface } from './types';

export interface ShortcutSheetProps {
    open: boolean;
    onClose: () => void;
    surface?: ShortcutSurface;
}

/**
 * Day-1 keys strip — floating panel opened by `?` / Mod+/ / header help.
 */
export function ShortcutSheet({
    open,
    onClose,
    surface = 'workspace',
}: ShortcutSheetProps) {
    const titleId = useId();
    const closeRef = useRef<HTMLButtonElement>(null);
    const rows = getHelpRows(surface).filter((row) => row.day1 || surface === 'dashboard');

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        requestAnimationFrame(() => closeRef.current?.focus());
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <aside
            className="shortcut-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <header className="shortcut-sheet__header">
                <div>
                    <h2 id={titleId}>Keys</h2>
                    <p className="shortcut-sheet__intro">
                        Bare letters work when you are not typing. Hold Alt for the same chords in a field.
                    </p>
                </div>
                <button
                    ref={closeRef}
                    className="icon-button icon-button--small"
                    type="button"
                    onClick={onClose}
                    aria-label="Close keyboard shortcuts"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            </header>
            <ul className="shortcut-sheet__list">
                {rows.map((row) => (
                    <li key={row.id}>
                        <span className="shortcut-sheet__keys" aria-hidden="true">
                            {row.displayKeys.map((key) => (
                                <kbd key={key} className="kbd">{key}</kbd>
                            ))}
                        </span>
                        <span className="shortcut-sheet__copy">
                            <strong>{row.label}</strong>
                            <small>{row.description}</small>
                            <span className="visually-hidden">
                                {formatBindingCaption(row)}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="shortcut-sheet__footnote">
                Press <kbd className="kbd">?</kbd> or <kbd className="kbd">Esc</kbd> to dismiss.
                {' '}
                <button
                    className="text-button"
                    type="button"
                    onClick={() => resetSurfaceCaptions()}
                >
                    Show captions again
                </button>
            </p>
        </aside>
    );
}
