import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
    ArrowLeft,
    CheckCircle2,
    FileText,
    ListTodo,
    Map,
    Moon,
    Sun,
    Target,
} from 'lucide-react';
import {
    buildDecisionMarkdown,
    getInquiryProgress,
    getOpenQuestions,
    getQuestion,
    getRootQuestion,
    serializeInquiry,
    stanceLabel,
} from '../inquiry';
import type { EvidenceDraft, FollowUpDraft } from '../hooks/useInquiries';
import {
    ShortcutSheet,
    cyclePriority,
    stanceFromIndex,
    useAppShortcuts,
} from '../shortcuts';
import type {
    Inquiry,
    InquiryQuestion,
    InquiryStatus,
    QuestionPriority,
    Stance,
} from '../types';
import { DecisionBrief } from './DecisionBrief';
import { FocusPanel, type FocusPanelHandle } from './FocusPanel';
import { QuestionLoop, type QuestionLoopHandle } from './QuestionLoop';
import { ReasoningOutline } from './ReasoningOutline';

type WorkspaceView = 'outline' | 'focus' | 'loop' | 'brief';

interface InquiryWorkspaceProps {
    inquiry: Inquiry;
    focusedQuestionId: string | null;
    isDarkMode: boolean;
    onHome: () => void;
    onToggleTheme: () => void;
    onSelectQuestion: (questionId: string) => void;
    onUpdateInquiry: (patch: Partial<Pick<
        Inquiry,
        'title' | 'desiredOutcome' | 'status' | 'reviewAt' | 'reviewTrigger'
    >>) => boolean;
    onUpdateQuestion: (questionId: string, patch: Partial<InquiryQuestion>) => boolean;
    onResolveQuestion: (
        questionId: string,
        answer: string,
        stance: Stance,
        followUps: FollowUpDraft[],
    ) => boolean;
    onAddEvidence: (questionId: string, draft: EvidenceDraft) => boolean;
    onRemoveEvidence: (questionId: string, evidenceId: string) => void;
    onDeleteQuestion: (questionId: string) => void;
    onUpdateSynthesis: (synthesis: string) => void;
    onCaptureSnapshot: () => boolean;
}

const downloadText = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // Revoke after the browser has begun the download; synchronous revoke can cancel it.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const safeFilename = (value: string): string =>
    value.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();

const useIsNarrowWorkspace = (): boolean => {
    const [isNarrow, setIsNarrow] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : true,
    );

    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const onChange = () => setIsNarrow(media.matches);
        onChange();
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    return isNarrow;
};

export function InquiryWorkspace({
    inquiry,
    focusedQuestionId,
    isDarkMode,
    onHome,
    onToggleTheme,
    onSelectQuestion,
    onUpdateInquiry,
    onUpdateQuestion,
    onResolveQuestion,
    onAddEvidence,
    onRemoveEvidence,
    onDeleteQuestion,
    onUpdateSynthesis,
    onCaptureSnapshot,
}: InquiryWorkspaceProps) {
    const [view, setView] = useState<WorkspaceView>('focus');
    const [title, setTitle] = useState(inquiry.title);
    const [outcome, setOutcome] = useState(inquiry.desiredOutcome);
    const [announcement, setAnnouncement] = useState('');
    const [helpOpen, setHelpOpen] = useState(false);
    const [evidenceOpen, setEvidenceOpen] = useState(false);
    const [desktopRegion, setDesktopRegion] = useState<'outline' | 'focus' | 'loop'>('focus');
    const isNarrow = useIsNarrowWorkspace();
    const mainRef = useRef<HTMLDivElement>(null);
    const shouldFocusMainRef = useRef(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const outcomeInputRef = useRef<HTMLInputElement>(null);
    const focusPanelRef = useRef<FocusPanelHandle>(null);
    const loopRef = useRef<QuestionLoopHandle>(null);
    const outlineLandmarkRef = useRef<HTMLDivElement>(null);
    const focusLandmarkRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const inquiryTabId = useId();
    const briefTabId = useId();
    const outlinePanelId = useId();
    const focusPanelId = useId();
    const loopPanelId = useId();
    const briefPanelId = useId();
    const mobileTabBaseId = useId();

    useEffect(() => {
        setTitle(inquiry.title);
        setOutcome(inquiry.desiredOutcome);
    }, [inquiry.id, inquiry.title, inquiry.desiredOutcome]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [inquiry.id]);

    useEffect(() => {
        if (!isNarrow && (view === 'outline' || view === 'loop')) {
            setView('focus');
        }
    }, [isNarrow, view]);

    const root = getRootQuestion(inquiry);
    const progress = getInquiryProgress(inquiry);
    const activeQuestion = getQuestion(inquiry, focusedQuestionId)
        ?? progress.openQuestions[0]
        ?? root;
    const openCount = progress.openCount;
    const resolvedCount = progress.resolvedCount;
    const activeQuestionId = activeQuestion?.id ?? null;

    useEffect(() => {
        if (!isNarrow || !shouldFocusMainRef.current) return;
        shouldFocusMainRef.current = false;
        // FocusPanel owns focus when entering the answer surface.
        if (view === 'focus') return;
        requestAnimationFrame(() => {
            mainRef.current?.focus({ preventScroll: true });
        });
    }, [view, isNarrow]);

    const returnSummary = useMemo(() => {
        const hours = Math.round((Date.now() - new Date(inquiry.updatedAt).getTime()) / 3_600_000);
        if (hours < 1) return 'Working now';
        if (hours < 24) return `Last changed ${hours}h ago`;
        const days = Math.round(hours / 24);
        return `Returned after ${days} ${days === 1 ? 'day' : 'days'}`;
    }, [inquiry.updatedAt]);

    const effectiveView: WorkspaceView = !isNarrow && (view === 'outline' || view === 'loop')
        ? 'focus'
        : view;
    const panelIds: Record<WorkspaceView, string> = {
        outline: outlinePanelId,
        focus: focusPanelId,
        loop: loopPanelId,
        brief: briefPanelId,
    };
    const activePanelId = panelIds[effectiveView];
    const mobileTabId = (workspaceView: WorkspaceView) =>
        `${mobileTabBaseId}-${workspaceView}`;

    const selectQuestionAndFocus = (questionId: string) => {
        onSelectQuestion(questionId);
        if (isNarrow) setView('focus');
    };

    const goNextUnknown = () => {
        const open = getOpenQuestions(inquiry);
        const next = open.find((item) => item.id !== activeQuestionId) ?? null;
        if (!next) {
            setAnnouncement('No other open unknowns');
            return;
        }
        selectQuestionAndFocus(next.id);
        setAnnouncement(`Next unknown: ${next.text}`);
    };

    const parkQuestionId = (questionId: string | null | undefined) => {
        if (!questionId || questionId === inquiry.rootQuestionId) {
            setAnnouncement('Root unknown cannot be parked');
            return;
        }
        const target = getQuestion(inquiry, questionId);
        if (!target || target.state === 'parked') return;
        if (onUpdateQuestion(questionId, { state: 'parked' })) {
            setAnnouncement(`Parked: ${target.text}`);
        }
    };

    const reopenQuestionId = (questionId: string | null | undefined) => {
        if (!questionId) return;
        const target = getQuestion(inquiry, questionId);
        if (!target || target.state !== 'parked') return;
        if (onUpdateQuestion(questionId, { state: 'open' })) {
            onSelectQuestion(questionId);
            setAnnouncement(`Reopened: ${target.text}`);
        }
    };

    const focusDesktopRegion = (region: 'outline' | 'focus' | 'loop') => {
        setDesktopRegion(region);
        requestAnimationFrame(() => {
            if (region === 'outline') {
                outlineLandmarkRef.current?.focus({ preventScroll: true });
                setAnnouncement('Decision path');
            } else if (region === 'focus') {
                focusLandmarkRef.current?.focus({ preventScroll: true });
                focusPanelRef.current?.focusAnswer();
                setAnnouncement('Active unknown');
            } else {
                loopRef.current?.focusLandmark();
                setAnnouncement('Unknowns');
            }
        });
    };

    const setWorkspaceView = (next: WorkspaceView) => {
        shouldFocusMainRef.current = true;
        setView(next);
        const labels: Record<WorkspaceView, string> = {
            outline: 'Decision path view',
            focus: 'Active unknown view',
            loop: 'Unknowns view',
            brief: 'Decision memo view',
        };
        setAnnouncement(labels[next]);
    };

    const onModeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setWorkspaceView(effectiveView === 'brief' ? 'focus' : 'brief');
    };

    const mobileViews: WorkspaceView[] = ['outline', 'focus', 'loop', 'brief'];
    const onMobileTabKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        current: WorkspaceView,
    ) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const currentIndex = mobileViews.indexOf(current);
        const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? mobileViews.length - 1
                : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + mobileViews.length)
                    % mobileViews.length;
        const next = mobileViews[nextIndex];
        setWorkspaceView(next);
        requestAnimationFrame(() => {
            document.getElementById(mobileTabId(next))?.focus();
        });
    };

    const renderMainView = () => {
        if (effectiveView === 'brief') {
            return (
                <DecisionBrief
                    inquiry={inquiry}
                    onUpdateSynthesis={onUpdateSynthesis}
                    onUpdateStatus={(status: InquiryStatus) => onUpdateInquiry({ status })}
                    onUpdateReviewAt={(reviewAt) => onUpdateInquiry({ reviewAt })}
                    onUpdateReviewTrigger={(reviewTrigger) => onUpdateInquiry({ reviewTrigger })}
                    onCaptureSnapshot={onCaptureSnapshot}
                    onExportMarkdown={() => downloadText(
                        `${safeFilename(inquiry.title)}.md`,
                        buildDecisionMarkdown(inquiry),
                        'text/markdown;charset=utf-8',
                    )}
                    onExportJson={() => downloadText(
                        `${safeFilename(inquiry.title)}.thoughtmap.json`,
                        serializeInquiry(inquiry),
                        'application/json;charset=utf-8',
                    )}
                />
            );
        }

        if (effectiveView === 'outline') {
            return (
                <div className="mobile-panel">
                    <ReasoningOutline
                        inquiry={inquiry}
                        activeQuestionId={activeQuestionId}
                        onSelect={selectQuestionAndFocus}
                    />
                </div>
            );
        }

        if (effectiveView === 'loop') {
            return (
                <div className="mobile-panel">
                    <QuestionLoop
                        ref={isNarrow ? loopRef : undefined}
                        inquiry={inquiry}
                        activeQuestionId={activeQuestionId}
                        onSelect={selectQuestionAndFocus}
                        onUpdateQuestion={onUpdateQuestion}
                        onPark={parkQuestionId}
                        onReopen={reopenQuestionId}
                        onNextUnknown={goNextUnknown}
                    />
                </div>
            );
        }

        return (
            <FocusPanel
                ref={focusPanelRef}
                inquiry={inquiry}
                question={activeQuestion}
                onUpdateQuestion={onUpdateQuestion}
                onResolve={onResolveQuestion}
                onAddEvidence={onAddEvidence}
                onRemoveEvidence={onRemoveEvidence}
                onDeleteQuestion={onDeleteQuestion}
                onEvidenceOpenChange={setEvidenceOpen}
            />
        );
    };

    const inquirySelected = effectiveView !== 'brief';

    const exportMemo = useCallback(() => {
        downloadText(
            `${safeFilename(inquiry.title)}.md`,
            buildDecisionMarkdown(inquiry),
            'text/markdown;charset=utf-8',
        );
        setAnnouncement('Exported decision memo');
    }, [inquiry]);

    const backupJson = useCallback(() => {
        downloadText(
            `${safeFilename(inquiry.title)}.thoughtmap.json`,
            serializeInquiry(inquiry),
            'application/json;charset=utf-8',
        );
        setAnnouncement('Exported inquiry backup');
    }, [inquiry]);

    const copyMemo = useCallback(async () => {
        const markdown = buildDecisionMarkdown(inquiry);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(markdown);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = markdown;
                textarea.readOnly = true;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }
            setAnnouncement('Decision memo copied');
        } catch {
            setAnnouncement('Could not copy decision memo');
        }
    }, [inquiry]);

    useAppShortcuts({
        enabled: true,
        surface: 'workspace',
        helpOpen,
        setHelpOpen,
        evidenceOpen,
        onBack: onHome,
        onToggleTheme,
        onNextUnknown: goNextUnknown,
        onPark: () => {
            const activeEl = document.activeElement;
            const inLoop = activeEl instanceof Element && Boolean(activeEl.closest('.question-loop'));
            const loopId = inLoop ? loopRef.current?.getRovingOpenId() : null;
            parkQuestionId(loopId ?? activeQuestionId);
        },
        onReopen: () => {
            const focusedParked = loopRef.current?.getFocusedParkedId();
            if (focusedParked) {
                reopenQuestionId(focusedParked);
                return;
            }
            if (activeQuestion?.state === 'parked') {
                reopenQuestionId(activeQuestion.id);
                return;
            }
            const parked = inquiry.questions.find((item) => item.state === 'parked');
            reopenQuestionId(parked?.id);
        },
        onSetStance: (index) => {
            if (focusPanelRef.current) {
                focusPanelRef.current.setStanceByIndex(index);
                return;
            }
            if (!activeQuestion) return;
            const next = stanceFromIndex(index) as Stance;
            if (onUpdateQuestion(activeQuestion.id, { stance: next })) {
                setAnnouncement(`Stance: ${stanceLabel[next]}`);
            }
        },
        onCyclePriority: (dir) => {
            if (focusPanelRef.current) {
                focusPanelRef.current.cycleQuestionPriority(dir);
                return;
            }
            if (!activeQuestion) return;
            const next = cyclePriority(activeQuestion.priority as QuestionPriority, dir);
            if (onUpdateQuestion(activeQuestion.id, { priority: next })) {
                setAnnouncement(`Priority: ${next}`);
            }
        },
        onSetRelationship: (rel) => {
            if (focusPanelRef.current) {
                focusPanelRef.current.setRelationship(rel);
                return;
            }
            if (!activeQuestion?.parentId) return;
            if (onUpdateQuestion(activeQuestion.id, { relationship: rel })) {
                setAnnouncement(`Relationship: ${rel}`);
            }
        },
        onResolve: () => {
            if (effectiveView === 'brief') {
                if (onCaptureSnapshot()) {
                    setAnnouncement('Decision recorded');
                } else {
                    setAnnouncement('Decision is not ready to record');
                }
                return;
            }
            focusPanelRef.current?.resolve();
        },
        onFocusAnswer: () => focusPanelRef.current?.focusAnswer(),
        onFocusFollowUp: () => focusPanelRef.current?.focusFollowUp(),
        onFocusTitle: () => {
            if (effectiveView !== 'brief' && focusPanelRef.current) {
                focusPanelRef.current.focusQuestionTitle();
                return;
            }
            titleInputRef.current?.focus();
        },
        onFocusOutcome: () => outcomeInputRef.current?.focus(),
        onToggleParkedSection: () => loopRef.current?.toggleParkedSection(),
        onToggleEvidence: () => focusPanelRef.current?.toggleEvidence(),
        onCancelEvidence: () => focusPanelRef.current?.cancelEvidence(),
        onEvidencePolarity: (n) => focusPanelRef.current?.setEvidencePolarity(n),
        onCycleRegion: (dir) => {
            if (isNarrow) {
                const order: WorkspaceView[] = ['outline', 'focus', 'loop', 'brief'];
                const currentIndex = Math.max(0, order.indexOf(effectiveView));
                const next = order[(currentIndex + dir + order.length) % order.length];
                setWorkspaceView(next);
                return;
            }
            if (effectiveView === 'brief') {
                setWorkspaceView('focus');
                focusDesktopRegion('focus');
                return;
            }
            const order: Array<'outline' | 'focus' | 'loop'> = ['outline', 'focus', 'loop'];
            const currentIndex = Math.max(0, order.indexOf(desktopRegion));
            const next = order[(currentIndex + dir + order.length) % order.length];
            focusDesktopRegion(next);
        },
        onViewTab: (index) => {
            if (isNarrow) {
                const tabs: WorkspaceView[] = ['outline', 'focus', 'loop', 'brief'];
                const next = tabs[Math.max(0, Math.min(index, tabs.length - 1))];
                setWorkspaceView(next);
                return;
            }
            if (index === 0) {
                setWorkspaceView('focus');
                focusDesktopRegion('focus');
                return;
            }
            if (index === 1) {
                setWorkspaceView('brief');
                return;
            }
            if (index === 2) {
                focusDesktopRegion('loop');
                return;
            }
            if (index === 3) {
                focusDesktopRegion('outline');
            }
        },
        onExportMemo: exportMemo,
        onBackupJson: backupJson,
        onCopyMemo: () => {
            void copyMemo();
        },
        onDeleteFocused: () => {
            if (focusPanelRef.current) {
                focusPanelRef.current.deleteWithConfirm();
                return;
            }
            if (!activeQuestion || activeQuestion.id === inquiry.rootQuestionId) return;
            if (window.confirm(`Delete “${activeQuestion.text}” and its follow-ups? This cannot be undone.`)) {
                onDeleteQuestion(activeQuestion.id);
                setAnnouncement(`Deleted ${activeQuestion.text}`);
            }
        },
    });

    return (
        <main className="workspace">
            <h1 className="visually-hidden">{inquiry.title}</h1>
            <div className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</div>

            <header className="workspace-header">
                <div className="workspace-header__start">
                    <button className="icon-button" type="button" onClick={onHome} aria-label="Back to all inquiries">
                        <ArrowLeft size={19} aria-hidden="true" />
                    </button>
                    <div className="workspace-title">
                        <input
                            ref={titleInputRef}
                            id={titleId}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            onBlur={() => {
                                if (title.trim() && title.trim() !== inquiry.title) {
                                    onUpdateInquiry({ title: title.trim() });
                                } else {
                                    setTitle(inquiry.title);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.currentTarget.blur();
                                }
                            }}
                            aria-label="Inquiry title"
                            title={title}
                        />
                        <span>
                            <CheckCircle2 size={12} aria-hidden="true" /> local-only workspace
                            {' · '}Status: {inquiry.status} · {returnSummary}
                            {' · '}{openCount} unknown{openCount === 1 ? '' : 's'} · {resolvedCount} resolved
                        </span>
                    </div>
                </div>

                <div
                    className="workspace-mode"
                    role="tablist"
                    aria-label="Decision workspace view"
                    aria-hidden={isNarrow}
                    inert={isNarrow ? true : undefined}
                    onKeyDown={onModeKeyDown}
                >
                    <button
                        id={inquiryTabId}
                        className={inquirySelected ? 'is-active' : ''}
                        type="button"
                        onClick={() => setWorkspaceView('focus')}
                        role="tab"
                        aria-selected={inquirySelected}
                        aria-controls={focusPanelId}
                        tabIndex={!isNarrow && inquirySelected ? 0 : -1}
                    >
                        Unknowns
                    </button>
                    <button
                        id={briefTabId}
                        className={effectiveView === 'brief' ? 'is-active' : ''}
                        type="button"
                        onClick={() => setWorkspaceView('brief')}
                        role="tab"
                        aria-selected={effectiveView === 'brief'}
                        aria-controls={briefPanelId}
                        tabIndex={!isNarrow && effectiveView === 'brief' ? 0 : -1}
                        aria-label="Decision memo (decision brief)"
                    >
                        Decision memo
                    </button>
                </div>

                <div className="workspace-header__end">
                    <span
                        className={`stance stance--${root.stance}`}
                        aria-label={`Root stance: ${stanceLabel[root.stance]}`}
                        title={`Root stance: ${stanceLabel[root.stance]}`}
                    >
                        Stance: {stanceLabel[root.stance]}
                    </span>
                    <button
                        className="workspace-header__keys"
                        type="button"
                        onClick={() => setHelpOpen((value) => !value)}
                        aria-label="Keyboard shortcuts"
                        aria-expanded={helpOpen}
                        title="Keyboard shortcuts (?)"
                    >
                        ?
                    </button>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={onToggleTheme}
                        aria-label={isDarkMode ? 'Use light theme' : 'Use dark theme'}
                    >
                        {isDarkMode
                            ? <Sun size={18} aria-hidden="true" />
                            : <Moon size={18} aria-hidden="true" />}
                    </button>
                </div>
            </header>

            <div className="outcome-strip">
                <Target size={15} aria-hidden="true" />
                <input
                    ref={outcomeInputRef}
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value)}
                    onBlur={() => {
                        if (outcome.trim() !== inquiry.desiredOutcome) {
                            onUpdateInquiry({ desiredOutcome: outcome.trim() });
                        }
                    }}
                    placeholder="What should the decision memo make clear?"
                    aria-label="Intended outcome"
                />
            </div>

            <div className={`workspace-grid ${effectiveView === 'brief' ? 'workspace-grid--brief' : ''}`}>
                <div
                    ref={outlineLandmarkRef}
                    className="workspace-grid__outline"
                    aria-hidden={isNarrow || effectiveView === 'brief'}
                    inert={isNarrow || effectiveView === 'brief' ? true : undefined}
                    tabIndex={-1}
                >
                    <ReasoningOutline
                        inquiry={inquiry}
                        activeQuestionId={activeQuestionId}
                        onSelect={onSelectQuestion}
                    />
                </div>
                <div
                    id={activePanelId}
                    className="workspace-grid__main"
                    ref={(node) => {
                        mainRef.current = node;
                        focusLandmarkRef.current = node;
                    }}
                    role="tabpanel"
                    aria-labelledby={
                        isNarrow
                            ? mobileTabId(effectiveView)
                            : inquirySelected ? inquiryTabId : briefTabId
                    }
                    tabIndex={-1}
                >
                    {renderMainView()}
                </div>
                {mobileViews
                    .filter((workspaceView) => panelIds[workspaceView] !== activePanelId)
                    .map((workspaceView) => (
                        <div
                            key={workspaceView}
                            id={panelIds[workspaceView]}
                            role="tabpanel"
                            aria-labelledby={[
                                workspaceView === 'focus' ? inquiryTabId : '',
                                workspaceView === 'brief' ? briefTabId : '',
                                mobileTabId(workspaceView),
                            ].filter(Boolean).join(' ')}
                            hidden
                        />
                    ))}
                <div
                    className="workspace-grid__loop"
                    aria-hidden={isNarrow || effectiveView === 'brief'}
                    inert={isNarrow || effectiveView === 'brief' ? true : undefined}
                >
                    <QuestionLoop
                        ref={isNarrow ? undefined : loopRef}
                        inquiry={inquiry}
                        activeQuestionId={activeQuestionId}
                        onSelect={onSelectQuestion}
                        onUpdateQuestion={onUpdateQuestion}
                        onPark={parkQuestionId}
                        onReopen={reopenQuestionId}
                        onNextUnknown={goNextUnknown}
                    />
                </div>
            </div>

            <nav className="mobile-nav" aria-label="Inquiry views">
                <div role="tablist" aria-label="Mobile inquiry view" style={{ display: 'contents' }}>
                    {([
                        ['outline', Map, 'Path'],
                        ['focus', Target, 'Answer'],
                        ['loop', ListTodo, 'Unknowns'],
                        ['brief', FileText, 'Memo'],
                    ] as const).map(([value, Icon, label]) => {
                    const isActive = effectiveView === value;
                    const legacyViewLabel: Partial<Record<WorkspaceView, string>> = {
                        focus: 'Focus',
                        loop: 'Loop',
                        brief: 'Brief',
                    };
                    const baseAccessibleLabel = legacyViewLabel[value]
                        ? `${label} (${legacyViewLabel[value]})`
                        : label;
                    const accessibleLabel = value === 'loop' && openCount > 0
                        ? `${baseAccessibleLabel}, ${openCount} open`
                        : baseAccessibleLabel;
                    return (
                        <button
                            id={mobileTabId(value)}
                            className={isActive ? 'is-active' : ''}
                            key={value}
                            type="button"
                            onClick={() => setWorkspaceView(value)}
                            onKeyDown={(event) => onMobileTabKeyDown(event, value)}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={panelIds[value]}
                            tabIndex={isNarrow && isActive ? 0 : -1}
                            aria-label={accessibleLabel}
                        >
                            <Icon size={18} aria-hidden="true" />
                            <span aria-hidden="true">{label}</span>
                            {value === 'loop' && openCount > 0 && (
                                <small aria-hidden="true">{openCount}</small>
                            )}
                        </button>
                    );
                    })}
                </div>
            </nav>

            <ShortcutSheet
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
                surface="workspace"
            />
        </main>
    );
}
