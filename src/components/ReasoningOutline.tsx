import { useId, type CSSProperties, type KeyboardEvent } from 'react';
import {
    Check,
    Circle,
    GitBranch,
    Link2,
    Pause,
    X,
} from 'lucide-react';
import { getChildQuestions, getInquiryProgress, getRootQuestion } from '../inquiry';
import type { Inquiry, InquiryQuestion, QuestionState } from '../types';
import { modKeyLabel } from '../shortcuts/platform';
import { announceShortcut, Caption } from '../shortcuts/surfaceCaptions';

interface ReasoningOutlineProps {
    inquiry: Inquiry;
    activeQuestionId: string | null;
    onSelect: (questionId: string) => void;
}

interface OutlineBranchProps extends ReasoningOutlineProps {
    question: InquiryQuestion;
    depth: number;
    visited: Set<string>;
    treeId: string;
    onTreeKeyDown: (event: KeyboardEvent<HTMLButtonElement>, questionId: string) => void;
}

const stateLabel: Record<QuestionState, string> = {
    open: 'Open',
    active: 'Active',
    resolved: 'Resolved',
    parked: 'Parked',
    invalidated: 'Invalidated',
};

const StateIcon = ({ question }: { question: InquiryQuestion }) => {
    if (question.state === 'resolved') return <Check size={13} aria-hidden="true" />;
    if (question.state === 'parked') return <Pause size={13} aria-hidden="true" />;
    if (question.state === 'invalidated') return <X size={13} aria-hidden="true" />;
    return <Circle size={11} aria-hidden="true" />;
};

const collectVisibleIds = (
    inquiry: Inquiry,
    question: InquiryQuestion,
    visited: Set<string>,
    result: string[],
): void => {
    if (visited.has(question.id)) return;
    visited.add(question.id);
    result.push(question.id);
    getChildQuestions(inquiry, question.id).forEach((child) => {
        collectVisibleIds(inquiry, child, visited, result);
    });
};

function OutlineBranch({
    inquiry,
    question,
    activeQuestionId,
    onSelect,
    depth,
    visited,
    treeId,
    onTreeKeyDown,
}: OutlineBranchProps) {
    if (visited.has(question.id)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(question.id);
    const children = getChildQuestions(inquiry, question.id);
    const isActive = activeQuestionId === question.id;

    return (
        <li role="none" className="outline-branch">
            <button
                id={`${treeId}-node-${question.id}`}
                data-question-id={question.id}
                className={`outline-node ${isActive ? 'outline-node--active' : ''}`}
                style={{ '--outline-depth': depth } as CSSProperties}
                type="button"
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={isActive}
                aria-expanded={children.length > 0 ? true : undefined}
                aria-current={isActive ? 'true' : undefined}
                tabIndex={isActive || (!activeQuestionId && depth === 0) ? 0 : -1}
                onClick={() => onSelect(question.id)}
                onKeyDown={(event) => onTreeKeyDown(event, question.id)}
            >
                <span
                    className={`outline-node__state outline-node__state--${question.state}`}
                    aria-label={stateLabel[question.state]}
                >
                    <StateIcon question={question} />
                </span>
                <span className="outline-node__copy">
                    <span>{question.text}</span>
                    {question.parentId && (
                        <small>
                            {question.relationship === 'hinges-on'
                                ? <><Link2 size={11} aria-hidden="true" /> hinges on</>
                                : <><GitBranch size={11} aria-hidden="true" /> breaks into</>}
                        </small>
                    )}
                </span>
            </button>
            {children.length > 0 && (
                <ul role="group">
                    {children.map((child) => (
                        <OutlineBranch
                            key={child.id}
                            inquiry={inquiry}
                            question={child}
                            activeQuestionId={activeQuestionId}
                            onSelect={onSelect}
                            depth={depth + 1}
                            visited={nextVisited}
                            treeId={treeId}
                            onTreeKeyDown={onTreeKeyDown}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

export function ReasoningOutline({ inquiry, activeQuestionId, onSelect }: ReasoningOutlineProps) {
    const treeId = useId();
    const headingId = `${treeId}-heading`;
    const root = getRootQuestion(inquiry);
    const { openCount } = getInquiryProgress(inquiry);
    const orderedIds: string[] = [];
    collectVisibleIds(inquiry, root, new Set(), orderedIds);

    const focusQuestionButton = (questionId: string) => {
        const button = document.getElementById(`${treeId}-node-${questionId}`);
        if (button instanceof HTMLButtonElement) button.focus();
    };

    const onTreeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, questionId: string) => {
        const index = orderedIds.indexOf(questionId);
        if (index < 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            announceShortcut('outline-move');
            focusQuestionButton(orderedIds[Math.min(index + 1, orderedIds.length - 1)]);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            announceShortcut('outline-move');
            focusQuestionButton(orderedIds[Math.max(index - 1, 0)]);
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            announceShortcut('outline-move');
            focusQuestionButton(orderedIds[0]);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            announceShortcut('outline-move');
            focusQuestionButton(orderedIds[orderedIds.length - 1]);
            return;
        }
        if (event.key === 'Enter') {
            announceShortcut('outline-open');
            // Default button activation selects; caption dismisses on successful shortcut.
        }
    };

    const mod = modKeyLabel();

    return (
        <nav className="reasoning-outline" aria-label="Reasoning outline">
            <div className="panel-heading">
                <div className="panel-heading__lead">
                    <p className="eyebrow" id={headingId}>Decision path</p>
                    <Caption id="outline.heading" className="surface-caption--footnote">
                        <kbd>↑↓</kbd> move · <kbd>Enter</kbd> open · <kbd>{mod}+[</kbd> back
                    </Caption>
                </div>
                <span>{openCount} unknown{openCount === 1 ? '' : 's'}</span>
            </div>
            <ul
                className="outline-tree"
                role="tree"
                aria-labelledby={headingId}
            >
                <OutlineBranch
                    inquiry={inquiry}
                    question={root}
                    activeQuestionId={activeQuestionId}
                    onSelect={onSelect}
                    depth={0}
                    visited={new Set()}
                    treeId={treeId}
                    onTreeKeyDown={onTreeKeyDown}
                />
            </ul>
        </nav>
    );
}
