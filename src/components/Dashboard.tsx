import { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    CircleHelp,
    FileUp,
    Moon,
    Sun,
    Trash2,
} from 'lucide-react';
import {
    getOpenQuestions,
    getResolvedQuestions,
    getRootQuestion,
    MAX_INQUIRY_JSON_CHARS,
    stanceLabel,
} from '../inquiry';
import { ShortcutSheet, useAppShortcuts } from '../shortcuts';
import type { Inquiry } from '../types';
import { announceShortcut, Caption } from '../shortcuts/surfaceCaptions';

interface DashboardProps {
    inquiries: Inquiry[];
    isDarkMode: boolean;
    onCreate: (question: string, desiredOutcome: string) => void;
    onOpen: (inquiryId: string) => void;
    onDelete: (inquiryId: string) => void;
    onImport: (raw: string) => void;
    onToggleTheme: () => void;
}

const formatUpdatedAt = (value: string): string => {
    const date = new Date(value);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return isToday
        ? `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const autosizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, element.clientHeight)}px`;
};

export function Dashboard({
    inquiries,
    isDarkMode,
    onCreate,
    onOpen,
    onDelete,
    onImport,
    onToggleTheme,
}: DashboardProps) {
    const [question, setQuestion] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [showOutcome, setShowOutcome] = useState(false);
    const [importError, setImportError] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [helpOpen, setHelpOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const questionRef = useRef<HTMLTextAreaElement>(null);
    const outcomeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        autosizeTextarea(questionRef.current);
    }, [question]);

    useEffect(() => {
        if (showOutcome) {
            outcomeRef.current?.focus();
        }
    }, [showOutcome]);

    const handleCreate = () => {
        if (!question.trim()) return;
        onCreate(question.trim(), desiredOutcome.trim());
        setQuestion('');
        setDesiredOutcome('');
        setShowOutcome(false);
        setAnnouncement('Decision started');
    };

    useAppShortcuts({
        enabled: true,
        surface: 'dashboard',
        helpOpen,
        setHelpOpen,
        onToggleTheme,
        onImport: () => fileInputRef.current?.click(),
        onFocusOutcome: () => {
            setShowOutcome(true);
            requestAnimationFrame(() => outcomeRef.current?.focus());
        },
        onOpenFocused: () => {
            const active = document.activeElement;
            const row = active instanceof Element
                ? active.closest<HTMLElement>('[data-inquiry-id]')
                : null;
            const inquiryId = row?.dataset.inquiryId;
            if (inquiryId) onOpen(inquiryId);
        },
        onDeleteFocused: () => {
            const active = document.activeElement;
            const row = active instanceof Element
                ? active.closest<HTMLElement>('[data-inquiry-id]')
                : null;
            const inquiryId = row?.dataset.inquiryId;
            if (!inquiryId) return;
            const inquiry = inquiries.find((item) => item.id === inquiryId);
            if (!inquiry) return;
            if (window.confirm(`Delete “${inquiry.title}” and its full reasoning history? This cannot be undone.`)) {
                onDelete(inquiry.id);
                setAnnouncement(`Deleted ${inquiry.title}`);
            }
        },
    });

    const handleImport = async (file: File | undefined) => {
        if (!file) return;
        setImportError('');
        if (file.size > MAX_INQUIRY_JSON_CHARS) {
            setImportError(
                `This file is too large to import. Maximum size is ${MAX_INQUIRY_JSON_CHARS.toLocaleString()} bytes.`,
            );
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        try {
            onImport(await file.text());
            setAnnouncement(`Imported ${file.name}`);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'The inquiry could not be imported.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const inquiryIndex = (
        <section className="inquiry-index" aria-labelledby="inquiries-heading">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Pick up where you stopped</p>
                    <h2 id="inquiries-heading">Recent decisions</h2>
                </div>
                <span role="status" aria-live="polite" aria-label="Recent decisions status">
                    {inquiries.length} {inquiries.length === 1 ? 'decision' : 'decisions'}
                </span>
            </div>

            {inquiries.length === 0 ? (
                <div className="empty-inquiries">
                    <span className="empty-inquiries__line" aria-hidden="true" />
                    <div>
                        <h3>Your first decision starts above.</h3>
                        <p>Write the call you would make today. Then name what could change it.</p>
                    </div>
                </div>
            ) : (
                <div className="inquiry-list">
                    {inquiries.map((inquiry, index) => {
                        const root = getRootQuestion(inquiry);
                        const openQuestions = getOpenQuestions(inquiry);
                        const openCount = openQuestions.length;
                        const resolvedCount = getResolvedQuestions(inquiry).length;
                        const nextPriorityUnknown = openQuestions.find(
                            (item) => item.priority === 'blocking' || item.priority === 'high',
                        );
                        return (
                            <article
                                className="inquiry-row"
                                key={inquiry.id}
                                data-inquiry-id={inquiry.id}
                                aria-labelledby={`inquiry-title-${inquiry.id}`}
                            >
                                <button
                                    className="inquiry-row__main"
                                    type="button"
                                    onClick={() => onOpen(inquiry.id)}
                                    aria-label={`Open ${inquiry.title}`}
                                >
                                    <span className="inquiry-row__number" aria-hidden="true">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="inquiry-row__copy">
                                        <strong id={`inquiry-title-${inquiry.id}`}>{inquiry.title}</strong>
                                        <span>
                                            {nextPriorityUnknown
                                                ? `Next ${nextPriorityUnknown.priority}: ${nextPriorityUnknown.text}`
                                                : root.answer || inquiry.desiredOutcome || 'No provisional answer yet'}
                                        </span>
                                    </span>
                                    <span className="inquiry-row__meta">
                                        <span className={`stance stance--${root.stance}`}>{stanceLabel[root.stance]}</span>
                                        <span>{openCount} unknown · {resolvedCount} resolved</span>
                                        <span>
                                            <time dateTime={inquiry.updatedAt}>{formatUpdatedAt(inquiry.updatedAt)}</time>
                                        </span>
                                    </span>
                                    <ArrowRight className="inquiry-row__arrow" size={20} aria-hidden="true" />
                                </button>
                                <button
                                    className="icon-button inquiry-row__delete"
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Delete “${inquiry.title}” and its full reasoning history? This cannot be undone.`)) {
                                            onDelete(inquiry.id);
                                            setAnnouncement(`Deleted ${inquiry.title}`);
                                        }
                                    }}
                                    aria-label={`Delete ${inquiry.title}`}
                                >
                                    <Trash2 size={17} aria-hidden="true" />
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );

    return (
        <main className="dashboard">
            <div
                className="visually-hidden"
                role="status"
                aria-label="Dashboard notifications"
                aria-live="polite"
                aria-atomic="true"
            >
                {announcement}
            </div>

            <header className="dashboard__header">
                <a className="brand" href="/" onClick={(event) => event.preventDefault()} aria-label="IdeaMap home">
                    <span className="brand__mark" aria-hidden="true">
                        <img src="/logo.svg" alt="" width={34} height={34} />
                    </span>
                    <span>IdeaMap</span>
                </a>
                <div className="header-actions">
                    <input
                        ref={fileInputRef}
                        id="import-inquiry"
                        className="visually-hidden"
                        type="file"
                        accept=".json,application/json"
                        tabIndex={-1}
                        onChange={(event) => void handleImport(event.target.files?.[0])}
                        aria-label="Import inquiry JSON file"
                        aria-invalid={importError ? true : undefined}
                        aria-describedby={importError ? 'import-inquiry-error' : undefined}
                    />
                    <button
                        className="button button--quiet"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-controls="import-inquiry"
                        aria-describedby={importError ? 'import-inquiry-error' : undefined}
                    >
                        <FileUp size={17} aria-hidden="true" /> Import
                    </button>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={() => setHelpOpen((value) => !value)}
                        aria-label="Keyboard shortcuts"
                        aria-expanded={helpOpen}
                        title="Keyboard shortcuts (?)"
                    >
                        <CircleHelp size={19} aria-hidden="true" />
                    </button>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={onToggleTheme}
                        aria-label={isDarkMode ? 'Use light theme' : 'Use dark theme'}
                    >
                        {isDarkMode
                            ? <Sun size={19} aria-hidden="true" />
                            : <Moon size={19} aria-hidden="true" />}
                    </button>
                </div>
            </header>

            {inquiries.length > 0 && inquiryIndex}

            <section className="dashboard__hero" aria-labelledby="dashboard-title">
                <p className="eyebrow">Private decision workspace</p>
                <h1 id="dashboard-title">What decision is blocking the team?</h1>
                <p className="dashboard__intro">
                    Start with the decision. Work through the unknown that could change it.
                </p>

                <div className="new-inquiry">
                    <label className="visually-hidden" htmlFor="root-question">Decision or difficult question</label>
                    <textarea
                        ref={questionRef}
                        id="root-question"
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === 'Enter'
                                && !event.shiftKey
                                && !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault();
                                if (question.trim()) {
                                    announceShortcut('begin');
                                    handleCreate();
                                }
                            }
                        }}
                        placeholder="Should we focus the next six months on self-serve teams?"
                        rows={2}
                        autoFocus={inquiries.length === 0}
                    />
                    {showOutcome && (
                        <div className="new-inquiry__outcome">
                            <label htmlFor="desired-outcome">What should the decision memo make clear?</label>
                            <input
                                ref={outcomeRef}
                                id="desired-outcome"
                                value={desiredOutcome}
                                onChange={(event) => setDesiredOutcome(event.target.value)}
                                placeholder="A decision we can explain to the team"
                                aria-label="What should this inquiry produce? — decision memo outcome"
                            />
                        </div>
                    )}
                    <div className="new-inquiry__footer">
                        <button
                            className="text-button"
                            type="button"
                            onClick={() => setShowOutcome((value) => !value)}
                            aria-expanded={showOutcome}
                            aria-controls={showOutcome ? 'desired-outcome' : undefined}
                        >
                            {showOutcome ? 'Remove memo outcome' : 'Add an intended outcome'}
                        </button>
                        <div className="new-inquiry__footer-action">
                            <Caption id="dashboard.begin"><kbd>Enter</kbd></Caption>
                            <button
                                className="button button--primary"
                                type="button"
                                disabled={!question.trim()}
                                onClick={handleCreate}
                            >
                                Begin inquiry <ArrowRight size={17} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
                {importError && (
                    <p id="import-inquiry-error" className="form-error" role="alert">
                        {importError}
                    </p>
                )}
            </section>

            {inquiries.length === 0 && inquiryIndex}

            <footer className="dashboard__footer">
                <span><CheckCircle2 size={15} aria-hidden="true" /> Strategy stays on this device</span>
                <span>Saved locally · no account</span>
            </footer>

            <ShortcutSheet
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
                surface="dashboard"
            />
        </main>
    );
}
