import {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ArrowRight,
    BookOpen,
    ExternalLink,
    GitBranch,
    Link2,
    Plus,
    RotateCcw,
    Trash2,
    X,
} from 'lucide-react';
import {
    getEvidenceUrlHostname,
    getOpenQuestions,
    getQuestion,
    sanitizeEvidenceUrl,
    stanceLabel,
} from '../inquiry';
import type { EvidenceDraft, FollowUpDraft } from '../hooks/useInquiries';
import type {
    Inquiry,
    InquiryQuestion,
    QuestionPriority,
    RelationshipType,
    Stance,
} from '../types';
import { altChordLabel, altKeyLabel, modEnterLabel } from '../shortcuts/platform';
import {
    announceShortcut,
    Caption,
    ModeCaption,
} from '../shortcuts/surfaceCaptions';
import {
    cyclePriority,
    evidencePolarityFromIndex,
    stanceFromIndex,
} from '../shortcuts';

export interface FocusPanelHandle {
    toggleEvidence: () => void;
    focusFollowUp: () => void;
    setStanceByIndex: (n: 1 | 2 | 3 | 4 | 5) => void;
    cycleQuestionPriority: (dir: 1 | -1) => void;
    setRelationship: (rel: RelationshipType) => void;
    resolve: () => void;
    focusAnswer: () => void;
    focusQuestionTitle: () => void;
    cancelEvidence: () => void;
    setEvidencePolarity: (n: 1 | 2 | 3) => void;
    deleteWithConfirm: () => void;
    isEvidenceOpen: () => boolean;
}

interface FocusPanelProps {
    inquiry: Inquiry;
    question: InquiryQuestion | null;
    onUpdateQuestion: (questionId: string, patch: Partial<InquiryQuestion>) => boolean;
    onResolve: (
        questionId: string,
        answer: string,
        stance: Stance,
        followUps: FollowUpDraft[],
    ) => boolean;
    onAddEvidence: (questionId: string, draft: EvidenceDraft) => boolean;
    onRemoveEvidence: (questionId: string, evidenceId: string) => void;
    onDeleteQuestion: (questionId: string) => void;
    onEvidenceOpenChange?: (open: boolean) => void;
}

interface StagedFollowUp extends FollowUpDraft {
    key: string;
}

const stances: Stance[] = ['unknown', 'leaning', 'supported', 'decided', 'disputed'];
const relationships: RelationshipType[] = ['breaks-into', 'hinges-on'];
const priorities: QuestionPriority[] = ['blocking', 'high', 'normal'];
const evidencePolarities = ['supports', 'weakens', 'context'] as const;
const COMPOSER_DRAFT_PREFIX = 'thought-map:composer-draft:v1:';

interface ComposerDraft {
    followUps: StagedFollowUp[];
    followUpText: string;
    relationship: RelationshipType;
    priority: QuestionPriority;
    showEvidenceForm: boolean;
    evidenceDraft: EvidenceDraft;
}

const emptyEvidenceDraft = (): EvidenceDraft => ({
    note: '',
    source: '',
    url: '',
    polarity: 'supports',
});

const emptyComposerDraft = (): ComposerDraft => ({
    followUps: [],
    followUpText: '',
    relationship: 'breaks-into',
    priority: 'normal',
    showEvidenceForm: false,
    evidenceDraft: emptyEvidenceDraft(),
});

const composerDraftKey = (inquiryId: string, questionId: string): string =>
    `${COMPOSER_DRAFT_PREFIX}${encodeURIComponent(inquiryId)}:${encodeURIComponent(questionId)}`;

const readComposerDraft = (key: string): ComposerDraft | null => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw || raw.length > 250_000) return null;
        const value = JSON.parse(raw) as Partial<ComposerDraft>;
        if (!Array.isArray(value.followUps)
            || typeof value.followUpText !== 'string'
            || !relationships.includes(value.relationship as RelationshipType)
            || !priorities.includes(value.priority as QuestionPriority)
            || typeof value.showEvidenceForm !== 'boolean'
            || !value.evidenceDraft
            || typeof value.evidenceDraft.note !== 'string'
            || typeof value.evidenceDraft.source !== 'string'
            || typeof value.evidenceDraft.url !== 'string'
            || !evidencePolarities.includes(value.evidenceDraft.polarity)) {
            return null;
        }
        const followUps = value.followUps.filter((item): item is StagedFollowUp =>
            typeof item === 'object'
            && item !== null
            && typeof item.key === 'string'
            && typeof item.text === 'string'
            && relationships.includes(item.relationship)
            && priorities.includes(item.priority));
        return {
            followUps,
            followUpText: value.followUpText,
            relationship: value.relationship as RelationshipType,
            priority: value.priority as QuestionPriority,
            showEvidenceForm: value.showEvidenceForm,
            evidenceDraft: value.evidenceDraft,
        };
    } catch {
        return null;
    }
};

const getBreadcrumbs = (inquiry: Inquiry, question: InquiryQuestion): InquiryQuestion[] => {
    const result: InquiryQuestion[] = [];
    const visited = new Set<string>();
    let current: InquiryQuestion | null = question;
    while (current && !visited.has(current.id)) {
        result.unshift(current);
        visited.add(current.id);
        current = getQuestion(inquiry, current.parentId);
    }
    return result;
};

const INVALID_EVIDENCE_URL =
    'Enter a valid http:// or https:// link without usernames or passwords.';

const autosizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
};

const createStageKey = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `follow-up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const FocusPanel = forwardRef<FocusPanelHandle, FocusPanelProps>(function FocusPanel({
    inquiry,
    question,
    onUpdateQuestion,
    onResolve,
    onAddEvidence,
    onRemoveEvidence,
    onDeleteQuestion,
    onEvidenceOpenChange,
}, ref) {
    const formId = useId();
    const answerId = `${formId}-answer`;
    const questionFieldId = `${formId}-question`;
    const headingId = `${formId}-heading`;
    const [answer, setAnswer] = useState('');
    const [stance, setStance] = useState<Stance>('unknown');
    const [questionText, setQuestionText] = useState('');
    const [followUps, setFollowUps] = useState<StagedFollowUp[]>([]);
    const [followUpText, setFollowUpText] = useState('');
    const [relationship, setRelationship] = useState<RelationshipType>('breaks-into');
    const [priority, setPriority] = useState<QuestionPriority>('normal');
    const [showEvidenceForm, setShowEvidenceForm] = useState(false);
    const [evidenceUrlError, setEvidenceUrlError] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [saveMessage, setSaveMessage] = useState('Committed work and composer drafts stay on this device');
    const [answerFocused, setAnswerFocused] = useState(false);
    const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft>(emptyEvidenceDraft);
    const altLabel = altKeyLabel();
    const modEnter = modEnterLabel();
    const answerRef = useRef<HTMLTextAreaElement>(null);
    const questionRef = useRef<HTMLTextAreaElement>(null);
    const evidenceNoteRef = useRef<HTMLInputElement>(null);
    const evidenceUrlRef = useRef<HTMLInputElement>(null);
    const addEvidenceButtonRef = useRef<HTMLButtonElement>(null);
    const followUpInputRef = useRef<HTMLInputElement>(null);
    const evidenceUrlErrorId = `${formId}-evidence-url-error`;
    const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
    const previousQuestionIdRef = useRef<string | null>(null);
    const updateQuestionRef = useRef(onUpdateQuestion);
    const answerSaveTimerRef = useRef<number | null>(null);
    const workingAnswerRef = useRef<{
        questionId: string;
        answer: string;
        persistedAnswer: string;
    } | null>(null);
    const composerKeyRef = useRef<string | null>(null);
    const composerDraftRef = useRef<ComposerDraft>(emptyComposerDraft());

    updateQuestionRef.current = onUpdateQuestion;

    const clearAnswerSaveTimer = useCallback(() => {
        if (answerSaveTimerRef.current !== null) {
            window.clearTimeout(answerSaveTimerRef.current);
            answerSaveTimerRef.current = null;
        }
    }, []);

    const flushWorkingAnswer = useCallback(() => {
        clearAnswerSaveTimer();
        const draft = workingAnswerRef.current;
        if (!draft || draft.answer === draft.persistedAnswer) return;
        if (updateQuestionRef.current(draft.questionId, { answer: draft.answer })) {
            draft.persistedAnswer = draft.answer;
            setSaveMessage('Answer, stance, and composer drafts are saved on this device');
            setAnnouncement('Working answer saved on this device');
        } else {
            setSaveMessage('Save failed — keep this tab open and try again');
            setAnnouncement('Working answer could not be saved');
        }
    }, [clearAnswerSaveTimer]);

    const storeComposerDraft = useCallback((next: ComposerDraft) => {
        composerDraftRef.current = next;
        const key = composerKeyRef.current;
        if (!key) return false;
        try {
            localStorage.setItem(key, JSON.stringify(next));
            setSaveMessage('Answer, stance, and composer drafts are saved on this device');
            return true;
        } catch {
            setSaveMessage('Composer draft save failed — keep this tab open');
            setAnnouncement('Composer draft could not be saved');
            return false;
        }
    }, []);

    const clearStoredComposerDraft = useCallback(() => {
        const key = composerKeyRef.current;
        if (!key) return;
        try {
            localStorage.removeItem(key);
        } catch {
            setSaveMessage('Composer draft cleanup failed, but committed work is saved');
        }
    }, []);

    const updateComposerDraft = useCallback((patch: Partial<ComposerDraft>) => {
        storeComposerDraft({ ...composerDraftRef.current, ...patch });
    }, [storeComposerDraft]);

    useEffect(() => () => {
        flushWorkingAnswer();
    }, [flushWorkingAnswer]);

    useEffect(() => {
        if (!question) {
            flushWorkingAnswer();
            workingAnswerRef.current = null;
            composerKeyRef.current = null;
            if (previousQuestionIdRef.current !== null) {
                previousQuestionIdRef.current = null;
                setAnnouncement('Decision work complete. There is no active unknown.');
                requestAnimationFrame(() => emptyHeadingRef.current?.focus());
            }
            return;
        }

        if (previousQuestionIdRef.current === question.id) {
            const draft = workingAnswerRef.current;
            if (draft && draft.answer === draft.persistedAnswer && question.answer !== draft.persistedAnswer) {
                draft.answer = question.answer;
                draft.persistedAnswer = question.answer;
                setAnswer(question.answer);
            }
            return;
        }

        flushWorkingAnswer();
        previousQuestionIdRef.current = question.id;
        workingAnswerRef.current = {
            questionId: question.id,
            answer: question.answer,
            persistedAnswer: question.answer,
        };
        const key = composerDraftKey(inquiry.id, question.id);
        const storedComposer = readComposerDraft(key);
        const recoveredComposer = storedComposer ?? emptyComposerDraft();
        composerKeyRef.current = key;
        composerDraftRef.current = recoveredComposer;

        setAnswer(question.answer);
        setStance(question.stance);
        setQuestionText(question.text);
        setFollowUps(recoveredComposer.followUps);
        setFollowUpText(recoveredComposer.followUpText);
        setRelationship(recoveredComposer.relationship);
        setPriority(recoveredComposer.priority);
        setShowEvidenceForm(recoveredComposer.showEvidenceForm);
        setEvidenceUrlError('');
        setEvidenceDraft(recoveredComposer.evidenceDraft);
        setSaveMessage(
            storedComposer
                ? 'Recovered composer draft from this device'
                : 'Committed work and composer drafts stay on this device',
        );
        setAnnouncement(
            question.state === 'resolved'
                ? `Reviewing resolved unknown: ${question.text}`
                : `Now working on: ${question.text}`,
        );
        requestAnimationFrame(() => {
            answerRef.current?.focus();
            autosizeTextarea(answerRef.current);
            autosizeTextarea(questionRef.current);
        });
    }, [question, inquiry.id, flushWorkingAnswer]);

    useEffect(() => {
        autosizeTextarea(questionRef.current);
    }, [questionText]);

    useEffect(() => {
        autosizeTextarea(answerRef.current);
    }, [answer]);

    useEffect(() => {
        if (showEvidenceForm) {
            evidenceNoteRef.current?.focus();
        }
    }, [showEvidenceForm]);

    useEffect(() => {
        onEvidenceOpenChange?.(showEvidenceForm);
        return () => onEvidenceOpenChange?.(false);
    }, [showEvidenceForm, onEvidenceOpenChange]);

    useEffect(() => {
        if (question) setStance(question.stance);
    }, [question?.id, question?.stance]);

    const breadcrumbs = useMemo(
        () => question ? getBreadcrumbs(inquiry, question) : [],
        [inquiry, question],
    );

    const stageFollowUp = () => {
        if (!followUpText.trim()) return;
        const nextFollowUps = [...followUps, {
            key: createStageKey(),
            text: followUpText.trim(),
            relationship,
            priority,
        }];
        setFollowUps(nextFollowUps);
        setFollowUpText('');
        setRelationship('breaks-into');
        setPriority('normal');
        updateComposerDraft({
            followUps: nextFollowUps,
            followUpText: '',
            relationship: 'breaks-into',
            priority: 'normal',
        });
        setAnnouncement('Follow-up staged and saved on this device');
    };

    const saveAndContinue = () => {
        if (!question) return;
        clearAnswerSaveTimer();
        const stagedDrafts: FollowUpDraft[] = followUpText.trim()
            ? [...followUps, { text: followUpText.trim(), relationship, priority }]
            : followUps;
        if (!answer.trim()) {
            answerRef.current?.focus();
            setAnnouncement('Add an answer before resolving');
            return;
        }
        if (workingAnswerRef.current?.questionId === question.id) {
            workingAnswerRef.current.answer = answer;
            workingAnswerRef.current.persistedAnswer = answer;
        }
        const resolved = onResolve(question.id, answer, stance, stagedDrafts.map(({ text, relationship: rel, priority: pri }) => ({
            text,
            relationship: rel,
            priority: pri,
        })));
        if (!resolved) {
            setSaveMessage('Resolve failed — your local draft is still available');
            setAnnouncement('Question could not be resolved');
            return;
        }
        const nextComposer = {
            ...composerDraftRef.current,
            followUps: [],
            followUpText: '',
            relationship: 'breaks-into' as const,
            priority: 'normal' as const,
        };
        composerDraftRef.current = nextComposer;
        if (nextComposer.evidenceDraft.note
            || nextComposer.evidenceDraft.source
            || nextComposer.evidenceDraft.url
            || nextComposer.showEvidenceForm) {
            storeComposerDraft(nextComposer);
        } else {
            clearStoredComposerDraft();
        }
        setAnnouncement(`Resolved: ${question.text}`);
    };

    const addEvidence = () => {
        if (!question || !evidenceDraft.note.trim()) return;
        const trimmedUrl = evidenceDraft.url.trim();
        const href = trimmedUrl ? sanitizeEvidenceUrl(trimmedUrl) : '';
        if (trimmedUrl && !href) {
            setEvidenceUrlError(INVALID_EVIDENCE_URL);
            setAnnouncement(INVALID_EVIDENCE_URL);
            requestAnimationFrame(() => evidenceUrlRef.current?.focus());
            return;
        }
        setEvidenceUrlError('');
        const added = onAddEvidence(question.id, {
            ...evidenceDraft,
            url: href || '',
        });
        if (!added) {
            setSaveMessage('Evidence save failed — your local draft is still available');
            setAnnouncement('Evidence could not be added');
            return;
        }
        const clearedEvidence = emptyEvidenceDraft();
        setEvidenceDraft(clearedEvidence);
        setShowEvidenceForm(false);
        const nextComposer = {
            ...composerDraftRef.current,
            showEvidenceForm: false,
            evidenceDraft: clearedEvidence,
        };
        composerDraftRef.current = nextComposer;
        if (nextComposer.followUps.length > 0 || nextComposer.followUpText.trim()) {
            storeComposerDraft(nextComposer);
        } else {
            clearStoredComposerDraft();
        }
        setAnnouncement('Evidence added to reasoning');
        requestAnimationFrame(() => addEvidenceButtonRef.current?.focus());
    };

    const removeEvidence = (evidenceId: string, note: string) => {
        if (!question) return;
        if (!window.confirm(`Remove this evidence?\n\n“${note}”`)) return;
        onRemoveEvidence(question.id, evidenceId);
        setAnnouncement('Evidence removed');
        requestAnimationFrame(() => addEvidenceButtonRef.current?.focus());
    };

    const setShowEvidenceFormTracked = (next: boolean) => {
        setShowEvidenceForm(next);
        updateComposerDraft({ showEvidenceForm: next });
    };

    const cancelEvidence = () => {
        if (!showEvidenceForm) return;
        setEvidenceUrlError('');
        setShowEvidenceFormTracked(false);
        setAnnouncement('Evidence form closed');
        requestAnimationFrame(() => {
            addEvidenceButtonRef.current?.focus();
        });
    };

    const applyStanceIndex = (n: 1 | 2 | 3 | 4 | 5) => {
        if (!question) return;
        const next = stanceFromIndex(n);
        if (onUpdateQuestion(question.id, { stance: next })) {
            setStance(next);
            setSaveMessage('Answer, stance, and composer drafts are saved on this device');
            setAnnouncement(`Stance saved: ${stanceLabel[next]}`);
        } else {
            setSaveMessage('Stance save failed — keep this tab open');
            setAnnouncement('Stance could not be saved');
        }
    };

    const applyEvidencePolarity = (n: 1 | 2 | 3) => {
        if (!showEvidenceForm) return;
        const polarity = evidencePolarityFromIndex(n);
        const next = { ...evidenceDraft, polarity };
        setEvidenceDraft(next);
        updateComposerDraft({ evidenceDraft: next });
        setAnnouncement(`Evidence polarity: ${polarity}`);
    };

    const deleteWithConfirm = () => {
        if (!question || question.id === inquiry.rootQuestionId) return;
        if (window.confirm('Delete this question and every question beneath it? This cannot be undone.')) {
            onDeleteQuestion(question.id);
            setAnnouncement('Question deleted');
        }
    };

    useImperativeHandle(ref, () => ({
        toggleEvidence: () => {
            if (!question) return;
            if (showEvidenceForm) {
                evidenceNoteRef.current?.focus();
                return;
            }
            setShowEvidenceFormTracked(true);
        },
        focusFollowUp: () => {
            followUpInputRef.current?.focus();
        },
        setStanceByIndex: applyStanceIndex,
        cycleQuestionPriority: (dir) => {
            if (!question) return;
            const next = cyclePriority(question.priority, dir);
            if (onUpdateQuestion(question.id, { priority: next })) {
                setAnnouncement(`Priority: ${next}`);
            }
        },
        setRelationship: (rel) => {
            if (!question?.parentId) return;
            if (onUpdateQuestion(question.id, { relationship: rel })) {
                setAnnouncement(`Relationship: ${rel}`);
            }
        },
        resolve: () => {
            saveAndContinue();
        },
        focusAnswer: () => {
            answerRef.current?.focus();
        },
        focusQuestionTitle: () => {
            questionRef.current?.focus();
        },
        cancelEvidence,
        setEvidencePolarity: applyEvidencePolarity,
        deleteWithConfirm,
        isEvidenceOpen: () => showEvidenceForm,
    }), [
        question,
        showEvidenceForm,
        evidenceDraft,
        inquiry.rootQuestionId,
        onUpdateQuestion,
        onDeleteQuestion,
        answer,
        stance,
        followUps,
        followUpText,
        relationship,
        priority,
        updateComposerDraft,
    ]);

    if (!question) {
        return (
            <section className="focus-panel focus-panel--empty" aria-labelledby="focus-empty-heading">
                <div
                    className="visually-hidden"
                    role="status"
                    aria-label="Focus panel notifications"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {announcement}
                </div>
                <div>
                    <p className="eyebrow">Unknowns cleared</p>
                    <h2 id="focus-empty-heading" ref={emptyHeadingRef} tabIndex={-1}>
                        There is no active unknown.
                    </h2>
                    <p>Open the decision memo to capture the call, or reopen an unknown from the map.</p>
                </div>
            </section>
        );
    }

    const isRankedFirst = getOpenQuestions(inquiry)[0]?.id === question.id;

    return (
        <section
            className="focus-panel"
            aria-labelledby={headingId}
            aria-keyshortcuts="Control+Enter Meta+Enter Alt+1 Alt+2 Alt+3 Alt+4 Alt+5"
        >
            <div
                className="visually-hidden"
                role="status"
                aria-label="Focus panel notifications"
                aria-live="polite"
                aria-atomic="true"
            >
                {announcement}
            </div>

            <nav className="focus-panel__breadcrumbs" aria-label="Question context">
                {breadcrumbs.slice(0, -1).map((item) => (
                    <span key={item.id}>{item.text}</span>
                ))}
            </nav>

            <div className="focus-panel__heading">
                <div>
                    <p className="eyebrow">
                        {question.state === 'resolved'
                            ? 'Resolved unknown'
                            : isRankedFirst
                                ? 'Next ranked unknown'
                                : 'Selected unknown'}
                    </p>
                    <h2 id={headingId} className="visually-hidden">
                        {questionText || 'Active question'}
                    </h2>
                    <textarea
                        ref={questionRef}
                        id={questionFieldId}
                        className="question-title"
                        value={questionText}
                        rows={1}
                        onChange={(event) => setQuestionText(event.target.value)}
                        onBlur={() => {
                            if (questionText.trim() && questionText.trim() !== question.text) {
                                onUpdateQuestion(question.id, { text: questionText.trim() });
                            }
                        }}
                        aria-label="Question"
                    />
                </div>
                {question.id !== inquiry.rootQuestionId && (
                    <button
                        className="icon-button"
                        type="button"
                        onClick={deleteWithConfirm}
                        aria-label={`Delete question and follow-ups: ${question.text}`}
                    >
                        <Trash2 size={17} aria-hidden="true" />
                    </button>
                )}
            </div>

            <div className="question-controls">
                <label>
                    Priority
                    <select
                        value={question.priority}
                        onChange={(event) => onUpdateQuestion(question.id, {
                            priority: event.target.value as QuestionPriority,
                        })}
                        aria-label="Active question priority"
                    >
                        <option value="blocking">Blocking</option>
                        <option value="high">High leverage</option>
                        <option value="normal">Normal</option>
                    </select>
                </label>
                {question.parentId && (
                    <label>
                        Relationship
                        <select
                            value={question.relationship}
                            onChange={(event) => onUpdateQuestion(question.id, {
                                relationship: event.target.value as RelationshipType,
                            })}
                            aria-label="Active question relationship"
                        >
                            <option value="breaks-into">Breaks into</option>
                            <option value="hinges-on">Hinges on</option>
                        </select>
                    </label>
                )}
                {question.state === 'parked' && (
                    <button
                        className="button button--quiet"
                        type="button"
                        onClick={() => onUpdateQuestion(question.id, { state: 'open' })}
                    >
                        <RotateCcw size={15} aria-hidden="true" /> Reopen
                    </button>
                )}
            </div>

            <div className="answer-field">
                <label htmlFor={answerId}>Your best answer right now</label>
                <textarea
                    ref={answerRef}
                    id={answerId}
                    value={answer}
                    onChange={(event) => {
                        const nextAnswer = event.target.value;
                        setAnswer(nextAnswer);
                        if (workingAnswerRef.current?.questionId === question.id) {
                            workingAnswerRef.current.answer = nextAnswer;
                        } else {
                            workingAnswerRef.current = {
                                questionId: question.id,
                                answer: nextAnswer,
                                persistedAnswer: question.answer,
                            };
                        }
                        clearAnswerSaveTimer();
                        answerSaveTimerRef.current = window.setTimeout(flushWorkingAnswer, 650);
                    }}
                    onFocus={() => setAnswerFocused(true)}
                    onBlur={() => {
                        setAnswerFocused(false);
                        flushWorkingAnswer();
                    }}
                    onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            announceShortcut('resolve');
                            saveAndContinue();
                        }
                    }}
                    rows={7}
                    placeholder="Write the call you would make with today’s evidence. It can change."
                />
                <span
                    role="status"
                    aria-label="Draft save status"
                    aria-live="polite"
                >
                    {saveMessage} · resolving is separate
                    {answerFocused && (
                        <Caption id="focus.answer" className="surface-caption--inline">
                            {' · '}stance <kbd>{altChordLabel('1–5')}</kbd>
                            {' · '}<kbd>Esc</kbd>
                            {' · '}<kbd>{modEnter}</kbd> resolve
                        </Caption>
                    )}
                </span>
            </div>

            <fieldset className="stance-field">
                <legend>Current stance</legend>
                <div>
                    {stances.map((value, index) => {
                        const digit = String(index + 1);
                        return (
                            <button
                                className={stance === value ? 'stance-option stance-option--active' : 'stance-option'}
                                key={value}
                                type="button"
                                onClick={() => {
                                    if (onUpdateQuestion(question.id, { stance: value })) {
                                        setStance(value);
                                        setSaveMessage('Answer, stance, and composer drafts are saved on this device');
                                        setAnnouncement(`Stance saved: ${stanceLabel[value]}`);
                                    } else {
                                        setSaveMessage('Stance save failed — keep this tab open');
                                        setAnnouncement('Stance could not be saved');
                                    }
                                }}
                                aria-pressed={stance === value}
                            >
                                <span className="stance-option__label">{stanceLabel[value]}</span>
                                <ModeCaption
                                    id="focus.stance"
                                    className="surface-caption--stance"
                                    idle={<kbd>{digit}</kbd>}
                                    typing={<kbd>{altLabel === '⌥' ? `${altLabel}${digit}` : `${altLabel}+${digit}`}</kbd>}
                                />
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            <div className="evidence-section">
                <div className="subsection-heading">
                    <div>
                        <BookOpen size={16} aria-hidden="true" />
                        <h3>Evidence</h3>
                        <span aria-label={`${question.evidence.length} pieces`}>{question.evidence.length}</span>
                        <ModeCaption
                            id="focus.evidence"
                            idle={<kbd>E</kbd>}
                            typing={<kbd>{altChordLabel('E')}</kbd>}
                        />
                    </div>
                    <button
                        ref={addEvidenceButtonRef}
                        className="text-button"
                        type="button"
                        onClick={() => setShowEvidenceFormTracked(!showEvidenceForm)}
                        aria-expanded={showEvidenceForm}
                        aria-keyshortcuts="e Alt+e"
                    >
                        <Plus size={14} aria-hidden="true" /> Add evidence (optional)
                    </button>
                </div>

                {question.evidence.length > 0 && (
                    <div className="evidence-list">
                        {question.evidence.map((evidence) => {
                            const href = sanitizeEvidenceUrl(evidence.url);
                            const hostname = getEvidenceUrlHostname(evidence.url);
                            const linkLabel = evidence.source.trim() || hostname || 'Open source';
                            return (
                                <div className={`evidence-chip evidence-chip--${evidence.polarity}`} key={evidence.id}>
                                    <span>{evidence.polarity}</span>
                                    <p>{evidence.note}</p>
                                    {(evidence.source || href) && (
                                        href
                                            ? (
                                                <a href={href} target="_blank" rel="noopener noreferrer">
                                                    {linkLabel}{' '}
                                                    <ExternalLink size={12} aria-hidden="true" />
                                                    <span className="visually-hidden">(opens in a new tab)</span>
                                                </a>
                                            )
                                            : <small>{evidence.source}</small>
                                    )}
                                    <button
                                        className="icon-button icon-button--small"
                                        type="button"
                                        onClick={() => removeEvidence(evidence.id, evidence.note)}
                                        aria-label={`Remove evidence: ${evidence.note}`}
                                    >
                                        <X size={12} aria-hidden="true" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {showEvidenceForm && (
                    <div className="evidence-form" role="group" aria-label="Add evidence">
                        <div className="evidence-form__polarity" role="group" aria-label="Evidence polarity">
                            {(['supports', 'weakens', 'context'] as const).map((value) => (
                                <button
                                    className={evidenceDraft.polarity === value ? 'is-active' : ''}
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                        const next = { ...evidenceDraft, polarity: value };
                                        setEvidenceDraft(next);
                                        updateComposerDraft({ evidenceDraft: next });
                                    }}
                                    aria-pressed={evidenceDraft.polarity === value}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                        <input
                            ref={evidenceNoteRef}
                            value={evidenceDraft.note}
                            onChange={(event) => {
                                const next = { ...evidenceDraft, note: event.target.value };
                                setEvidenceDraft(next);
                                updateComposerDraft({ evidenceDraft: next });
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addEvidence();
                                }
                            }}
                            placeholder="Paste the useful fact or signal"
                            aria-label="Evidence note"
                        />
                        <div className="evidence-form__source">
                            <input
                                value={evidenceDraft.source}
                                onChange={(event) => {
                                    const next = { ...evidenceDraft, source: event.target.value };
                                    setEvidenceDraft(next);
                                    updateComposerDraft({ evidenceDraft: next });
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addEvidence();
                                    }
                                }}
                                placeholder="Source (optional)"
                                aria-label="Source name"
                            />
                            <input
                                ref={evidenceUrlRef}
                                value={evidenceDraft.url}
                                onChange={(event) => {
                                    setEvidenceUrlError('');
                                    const next = { ...evidenceDraft, url: event.target.value };
                                    setEvidenceDraft(next);
                                    updateComposerDraft({ evidenceDraft: next });
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addEvidence();
                                    }
                                }}
                                placeholder="https://"
                                type="url"
                                inputMode="url"
                                aria-label="Source URL"
                                aria-invalid={evidenceUrlError ? true : undefined}
                                aria-describedby={evidenceUrlError ? evidenceUrlErrorId : undefined}
                            />
                        </div>
                        {evidenceUrlError && (
                            <p id={evidenceUrlErrorId} className="form-error" role="alert">
                                {evidenceUrlError}
                            </p>
                        )}
                        <div className="evidence-form__actions">
                            <button
                                className="button button--quiet"
                                type="button"
                                onClick={cancelEvidence}
                            >
                                Cancel
                            </button>
                            <button
                                className="button button--secondary"
                                type="button"
                                onClick={addEvidence}
                                disabled={!evidenceDraft.note.trim()}
                                aria-label="Add to reasoning — evidence"
                            >
                                Add evidence
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="follow-up-section">
                <div className="subsection-heading">
                    <div>
                        <GitBranch size={16} aria-hidden="true" />
                        <h3>What could change this call?</h3>
                    </div>
                    <ModeCaption
                        id="focus.followUp"
                        className="surface-caption--follow-up"
                        idle={
                            <>
                                <kbd>Enter</kbd> stages · <kbd>F</kbd> opens · <kbd>Esc</kbd> cancels
                            </>
                        }
                        typing={
                            <>
                                <kbd>Enter</kbd> stages · <kbd>{altChordLabel('F')}</kbd> opens · <kbd>Esc</kbd> cancels
                            </>
                        }
                    />
                </div>

                {followUps.length > 0 && (
                    <div className="staged-follow-ups" aria-label="Staged follow-up questions">
                        {followUps.map((draft) => (
                            <div key={draft.key}>
                                {draft.relationship === 'hinges-on'
                                    ? <Link2 size={13} aria-hidden="true" />
                                    : <GitBranch size={13} aria-hidden="true" />}
                                <span>{draft.text}</span>
                                <small>{draft.priority}</small>
                                <button
                                    className="icon-button icon-button--small"
                                    type="button"
                                    onClick={() => {
                                        const next = followUps.filter((item) => item.key !== draft.key);
                                        setFollowUps(next);
                                        updateComposerDraft({ followUps: next });
                                    }}
                                    aria-label={`Remove staged follow-up: ${draft.text}`}
                                >
                                    <X size={12} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="follow-up-composer">
                    <input
                        ref={followUpInputRef}
                        value={followUpText}
                        onChange={(event) => {
                            setFollowUpText(event.target.value);
                            updateComposerDraft({ followUpText: event.target.value });
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                if (followUpText.trim()) {
                                    announceShortcut('stage');
                                    stageFollowUp();
                                }
                            }
                        }}
                        placeholder="Add the next unknown"
                        aria-label="Follow-up question"
                    />
                    <select
                        value={relationship}
                        onChange={(event) => {
                            const next = event.target.value as RelationshipType;
                            setRelationship(next);
                            updateComposerDraft({ relationship: next });
                        }}
                        aria-label="Follow-up relationship"
                    >
                        <option value="breaks-into">Breaks into</option>
                        <option value="hinges-on">Hinges on</option>
                    </select>
                    <select
                        value={priority}
                        onChange={(event) => {
                            const next = event.target.value as QuestionPriority;
                            setPriority(next);
                            updateComposerDraft({ priority: next });
                        }}
                        aria-label="Follow-up priority"
                    >
                        <option value="normal">Normal</option>
                        <option value="high">High leverage</option>
                        <option value="blocking">Blocking</option>
                    </select>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={stageFollowUp}
                        disabled={!followUpText.trim()}
                        aria-label={
                            followUpText.trim()
                                ? `Stage follow-up question: ${followUpText.trim()}`
                                : 'Stage follow-up question'
                        }
                    >
                        <Plus size={17} aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="focus-panel__footer">
                <Caption id="focus.resolve">
                    <kbd>{modEnter}</kbd>
                </Caption>
                <span className="visually-hidden">
                    Keyboard shortcut: {modEnter} to resolve and continue
                </span>
                <button
                    className="button button--primary"
                    type="button"
                    onClick={saveAndContinue}
                    disabled={!answer.trim()}
                >
                    Resolve & continue <ArrowRight size={17} aria-hidden="true" />
                </button>
            </div>
        </section>
    );
});
