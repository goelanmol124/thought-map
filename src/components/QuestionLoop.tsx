import {
    forwardRef,
    useEffect,
    useId,
    useImperativeHandle,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { ArrowUpRight, Pause, Play, ShieldAlert } from 'lucide-react';
import { getOpenQuestions } from '../inquiry';
import type { Inquiry, InquiryQuestion } from '../types';
import { announceShortcut, Caption } from '../shortcuts/surfaceCaptions';

export interface QuestionLoopHandle {
    toggleParkedSection: () => void;
    getRovingOpenId: () => string | null;
    getFocusedParkedId: () => string | null;
    focusLandmark: () => void;
}

interface QuestionLoopProps {
    inquiry: Inquiry;
    activeQuestionId: string | null;
    onSelect: (questionId: string) => void;
    onUpdateQuestion: (questionId: string, patch: Partial<InquiryQuestion>) => boolean;
    onPark?: (questionId: string) => void;
    onReopen?: (questionId: string) => void;
    onNextUnknown?: () => void;
}

export const QuestionLoop = forwardRef<QuestionLoopHandle, QuestionLoopProps>(function QuestionLoop({
    inquiry,
    activeQuestionId,
    onSelect,
    onUpdateQuestion,
    onPark,
    onReopen,
    onNextUnknown,
}, ref) {
    const headingId = useId();
    const openQuestions = getOpenQuestions(inquiry);
    const openQuestionIds = openQuestions.map((question) => question.id).join('|');
    const parkedQuestions = inquiry.questions.filter((question) => question.state === 'parked');
    const nextQuestion = openQuestions.find((question) => question.id !== activeQuestionId) ?? null;
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const parkedDetailsRef = useRef<HTMLDetailsElement>(null);
    const landmarkRef = useRef<HTMLElement>(null);
    const [focusIndex, setFocusIndex] = useState(0);
    const [focusedParkedId, setFocusedParkedId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const rovingFocusIndex = Math.max(0, Math.min(focusIndex, openQuestions.length - 1));

    useEffect(() => {
        const ids = openQuestionIds ? openQuestionIds.split('|') : [];
        const activeIndex = ids.indexOf(activeQuestionId ?? '');
        setFocusIndex(activeIndex >= 0 ? activeIndex : 0);
    }, [activeQuestionId, openQuestionIds]);

    useImperativeHandle(ref, () => ({
        toggleParkedSection: () => {
            const details = parkedDetailsRef.current;
            if (!details) {
                setAnnouncement('No parked unknowns');
                return;
            }
            details.open = !details.open;
            setAnnouncement(details.open ? 'Parked section open' : 'Parked section closed');
        },
        getRovingOpenId: () => openQuestions[rovingFocusIndex]?.id ?? null,
        getFocusedParkedId: () => focusedParkedId,
        focusLandmark: () => {
            landmarkRef.current?.focus({ preventScroll: true });
        },
    }), [openQuestions, rovingFocusIndex, focusedParkedId]);

    const moveFocus = (nextIndex: number) => {
        if (openQuestions.length === 0) return;
        const clamped = Math.max(0, Math.min(nextIndex, openQuestions.length - 1));
        setFocusIndex(clamped);
        itemRefs.current[clamped]?.focus();
    };

    const parkQuestion = (question: InquiryQuestion) => {
        if (question.id === inquiry.rootQuestionId) {
            setAnnouncement('Root unknown cannot be parked');
            return;
        }
        if (onPark) {
            onPark(question.id);
            return;
        }
        if (onUpdateQuestion(question.id, { state: 'parked' })) {
            setAnnouncement(`Parked: ${question.text}`);
        }
    };

    const reopenQuestion = (question: InquiryQuestion) => {
        if (onReopen) {
            onReopen(question.id);
            return;
        }
        if (onUpdateQuestion(question.id, { state: 'open' })) {
            setAnnouncement(`Reopened: ${question.text}`);
        }
    };

    const onItemKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        currentIndex: number,
    ) => {
        if (openQuestions.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            announceShortcut('loop-select');
            moveFocus(currentIndex + 1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            announceShortcut('loop-select');
            moveFocus(currentIndex - 1);
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            announceShortcut('loop-select');
            moveFocus(0);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            announceShortcut('loop-select');
            moveFocus(openQuestions.length - 1);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            announceShortcut('loop-focus');
            onSelect(openQuestions[currentIndex].id);
        }
    };

    return (
        <aside
            ref={landmarkRef}
            className="question-loop"
            aria-label="Question loop — Unknowns"
            tabIndex={-1}
            aria-keyshortcuts="n p o Shift+P ArrowUp ArrowDown Home End Enter"
        >
            <div
                className="visually-hidden"
                role="status"
                aria-label="Unknowns notifications"
                aria-live="polite"
                aria-atomic="true"
            >
                {announcement}
            </div>

            <div className="panel-heading">
                <div className="panel-heading__lead">
                    <p className="eyebrow" id={headingId}>Unknowns</p>
                    <Caption id="loop.heading" className="surface-caption--footnote">
                        <kbd>N</kbd> next · <kbd>P</kbd> park · <kbd>↑↓</kbd> select · <kbd>Enter</kbd> focus
                    </Caption>
                </div>
                <span
                    role="status"
                    aria-label="Unknowns queue status"
                    aria-live="polite"
                >
                    {openQuestions.length} unresolved
                </span>
            </div>

            {nextQuestion && (
                <button
                    className="next-question"
                    type="button"
                    onClick={() => {
                        if (onNextUnknown) onNextUnknown();
                        else onSelect(nextQuestion.id);
                    }}
                    aria-label={`Next best question: ${nextQuestion.text}`}
                    aria-keyshortcuts="n"
                >
                    <span className="next-question__eyebrow">
                        Next ranked unknown
                        <Caption id="loop.next" className="surface-caption--corner">
                            <kbd>N</kbd>
                        </Caption>
                    </span>
                    <strong>{nextQuestion.text}</strong>
                    <small>
                        {nextQuestion.priority === 'blocking'
                            ? <><ShieldAlert size={13} aria-hidden="true" /> Blocking the decision</>
                            : nextQuestion.priority === 'high'
                                ? 'High-leverage unknown'
                                : 'Next by priority and age'}
                    </small>
                    <ArrowUpRight size={18} aria-hidden="true" />
                </button>
            )}

            <div
                className="loop-list"
                role="list"
                aria-labelledby={headingId}
                aria-label="Open questions"
            >
                {openQuestions.map((question, index) => {
                    const isActive = activeQuestionId === question.id;
                    return (
                        <div
                            className={`loop-item ${isActive ? 'loop-item--active' : ''}`}
                            key={question.id}
                            role="listitem"
                        >
                            <button
                                ref={(element) => {
                                    itemRefs.current[index] = element;
                                }}
                                type="button"
                                tabIndex={index === rovingFocusIndex ? 0 : -1}
                                onClick={() => onSelect(question.id)}
                                onFocus={() => setFocusIndex(index)}
                                onKeyDown={(event) => onItemKeyDown(event, index)}
                                aria-keyshortcuts="ArrowUp ArrowDown Home End Enter"
                                aria-current={isActive ? 'true' : undefined}
                                aria-label={`${question.text} ${question.priority === 'normal' ? 'open question · unknown' : question.priority}`}
                            >
                                <span
                                    className={`priority-dot priority-dot--${question.priority}`}
                                    aria-hidden="true"
                                />
                                <span>
                                    <strong>{question.text}</strong>
                                    <small>
                                        {question.priority === 'normal' ? 'unknown' : question.priority}
                                    </small>
                                </span>
                            </button>
                            {question.id !== inquiry.rootQuestionId && (
                                <button
                                    className="icon-button icon-button--small"
                                    type="button"
                                    onClick={() => parkQuestion(question)}
                                    aria-label={`Park question: ${question.text}`}
                                    title="Park for later"
                                    aria-keyshortcuts="p"
                                >
                                    <Pause size={14} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    );
                })}
                {openQuestions.length === 0 && (
                    <div className="loop-empty" role="status">
                        <strong>No unresolved unknowns.</strong>
                        <p>Review the decision memo, then save a checkpoint when the call is ready to share.</p>
                    </div>
                )}
            </div>

            {parkedQuestions.length > 0 && (
                <details ref={parkedDetailsRef} className="parked-questions">
                    <summary aria-keyshortcuts="Shift+P">
                        {parkedQuestions.length} parked for later
                    </summary>
                    {parkedQuestions.map((question) => (
                        <div key={question.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(question.id)}
                                onFocus={() => setFocusedParkedId(question.id)}
                            >
                                {question.text}
                            </button>
                            <button
                                className="icon-button icon-button--small"
                                type="button"
                                onClick={() => reopenQuestion(question)}
                                onFocus={() => setFocusedParkedId(question.id)}
                                aria-label={`Reopen question: ${question.text}`}
                                aria-keyshortcuts="o"
                            >
                                <Play size={13} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </details>
            )}
        </aside>
    );
});
