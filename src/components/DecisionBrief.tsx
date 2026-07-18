import { useEffect, useId, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FileJson,
    History,
} from 'lucide-react';
import {
    buildDecisionMarkdown,
    getDecisionReadiness,
    getEvidenceUrlHostname,
    getKeyEvidence,
    getOpenQuestions,
    getResolvedQuestions,
    getRootQuestion,
    sanitizeEvidenceUrl,
    stanceLabel,
} from '../inquiry';
import type { Inquiry, InquiryStatus } from '../types';

interface DecisionBriefProps {
    inquiry: Inquiry;
    onUpdateSynthesis: (synthesis: string) => void;
    onUpdateStatus: (status: InquiryStatus) => void;
    onUpdateReviewAt: (reviewAt: string | null) => void;
    onUpdateReviewTrigger: (reviewTrigger: string) => void;
    onCaptureSnapshot: () => boolean;
    onExportMarkdown: () => void;
    onExportJson: () => void;
}

const autosizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
};

const copyText = async (value: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // Fall through to the local selection-based copy path.
        }
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.readOnly = true;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard unavailable');
};

export function DecisionBrief({
    inquiry,
    onUpdateSynthesis,
    onUpdateStatus,
    onUpdateReviewAt,
    onUpdateReviewTrigger,
    onCaptureSnapshot,
    onExportMarkdown,
    onExportJson,
}: DecisionBriefProps) {
    const synthesisId = useId();
    const root = getRootQuestion(inquiry);
    const openQuestions = getOpenQuestions(inquiry);
    const resolvedQuestions = getResolvedQuestions(inquiry);
    const blockers = openQuestions.filter((question) => question.priority === 'blocking');
    const readiness = getDecisionReadiness(inquiry);
    const keyEvidence = getKeyEvidence(inquiry);
    const evidenceCount = inquiry.questions.reduce((total, question) => total + question.evidence.length, 0);
    const [announcement, setAnnouncement] = useState('');
    const synthesisRef = useRef<HTMLTextAreaElement>(null);
    const snapshotCountRef = useRef(inquiry.snapshots.length);

    useEffect(() => {
        autosizeTextarea(synthesisRef.current);
    }, [inquiry.synthesis]);

    useEffect(() => {
        if (inquiry.snapshots.length > snapshotCountRef.current) {
            setAnnouncement('Decision recorded');
        }
        snapshotCountRef.current = inquiry.snapshots.length;
    }, [inquiry.snapshots.length]);

    const handleCaptureSnapshot = () => {
        if (!readiness.ready) {
            setAnnouncement(`Decision is not ready: ${readiness.missing.join('. ')}`);
            return;
        }
        if (!onCaptureSnapshot()) {
            setAnnouncement('Decision could not be recorded. Your memo is still saved.');
        }
    };

    const handleCopyMemo = async () => {
        try {
            await copyText(buildDecisionMarkdown(inquiry));
            setAnnouncement('Decision memo copied to clipboard');
        } catch {
            setAnnouncement('Could not copy the decision memo. Export it instead.');
        }
    };

    return (
        <section className="decision-brief" aria-labelledby="decision-brief-heading">
            <div
                className="visually-hidden"
                role="status"
                aria-label="Decision memo notifications"
                aria-live="polite"
                aria-atomic="true"
            >
                {announcement}
            </div>

            <header className="decision-brief__header">
                <div>
                    <p className="eyebrow">Ready to share when you are</p>
                    <h2 id="decision-brief-heading" aria-label="Decision memo (decision brief)">Decision memo</h2>
                </div>
                <div className="decision-brief__actions">
                    <button className="button button--quiet" type="button" onClick={() => void handleCopyMemo()}>
                        <Copy size={16} aria-hidden="true" /> Copy memo
                    </button>
                    <button className="button button--quiet" type="button" onClick={onExportJson}>
                        <FileJson size={16} aria-hidden="true" /> Backup
                    </button>
                    <button
                        className="button button--secondary"
                        type="button"
                        onClick={onExportMarkdown}
                        aria-label="Export brief — decision memo"
                    >
                        <Download size={16} aria-hidden="true" /> Export memo
                    </button>
                </div>
            </header>

            <div className="decision-summary">
                <div className="decision-summary__question">
                    <span>Root question · decision</span>
                    <h3>{root.text}</h3>
                </div>
                <div className="decision-summary__answer">
                    <span>Current call</span>
                    <p>{root.answer || 'The provisional answer has not been written yet.'}</p>
                </div>
                <div className="decision-summary__status">
                    <label>
                        Decision status
                        <select
                            value={inquiry.status}
                            onChange={(event) => onUpdateStatus(event.target.value as InquiryStatus)}
                            aria-label="Inquiry state — decision status"
                        >
                            <option value="exploring">Exploring</option>
                            <option value="blocked">Blocked</option>
                            <option value="decided">Decided</option>
                            <option value="monitoring">Monitoring</option>
                            <option value="archived">Archived</option>
                        </select>
                    </label>
                    <span className={`stance stance--${root.stance}`}>{stanceLabel[root.stance]}</span>
                </div>
            </div>

            <div className="brief-metrics" aria-label="Inquiry progress">
                <div>
                    <strong>{resolvedQuestions.length}</strong>
                    <span>unknowns resolved</span>
                </div>
                <div>
                    <strong>{openQuestions.length}</strong>
                    <span>unknowns open</span>
                </div>
                <div>
                    <strong>{evidenceCount}</strong>
                    <span>evidence items</span>
                </div>
                <div>
                    <strong>{blockers.length}</strong>
                    <span>decision blockers</span>
                </div>
            </div>

            <div className="synthesis-editor">
                <div className="subsection-heading">
                    <div>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <h3 id={synthesisId}>Decision memo</h3>
                    </div>
                    <span>Write only what the team needs</span>
                </div>
                <textarea
                    ref={synthesisRef}
                    aria-labelledby={synthesisId}
                    value={inquiry.synthesis}
                    onChange={(event) => onUpdateSynthesis(event.target.value)}
                    rows={12}
                    placeholder="The call, why now, what could change it, and when to revisit."
                />
            </div>

            <div className="open-risks">
                <div className="subsection-heading">
                    <div>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <h3>Evidence basis</h3>
                    </div>
                    <span>Most recent support and challenge</span>
                </div>
                <ul>
                    {(['supports', 'weakens'] as const).map((polarity) => {
                        const evidence = keyEvidence[polarity];
                        const href = evidence ? sanitizeEvidenceUrl(evidence.url) : null;
                        const sourceLabel = evidence
                            ? evidence.source.trim() || getEvidenceUrlHostname(evidence.url) || 'Open source'
                            : '';
                        return (
                            <li key={polarity}>
                                <strong>{polarity === 'supports' ? 'Supports' : 'Weakens'}</strong>
                                <span>{evidence?.note || 'None recorded yet.'}</span>
                                {evidence && (evidence.source || href) && (
                                    href
                                        ? (
                                            <a href={href} target="_blank" rel="noopener noreferrer">
                                                {sourceLabel}{' '}
                                                <ExternalLink size={12} aria-hidden="true" />
                                                <span className="visually-hidden">(opens in a new tab)</span>
                                            </a>
                                        )
                                        : <small>{evidence.source}</small>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="synthesis-editor">
                <div className="subsection-heading">
                    <div>
                        <History size={16} aria-hidden="true" />
                        <h3>Review date and trigger</h3>
                    </div>
                    <span>When should this call be reopened?</span>
                </div>
                <div className="evidence-form__source">
                    <label>
                        Review date
                        <input
                            type="date"
                            value={inquiry.reviewAt ?? ''}
                            onChange={(event) => onUpdateReviewAt(event.target.value || null)}
                        />
                    </label>
                    <label>
                        Review trigger
                        <input
                            value={inquiry.reviewTrigger ?? ''}
                            onChange={(event) => onUpdateReviewTrigger(event.target.value)}
                            placeholder="e.g. churn exceeds 4% or three target customers ask"
                        />
                    </label>
                </div>
            </div>

            {openQuestions.length > 0 && (
                <div className="open-risks">
                    <div className="subsection-heading">
                        <div>
                            <AlertTriangle size={16} aria-hidden="true" />
                            <h3>Open blockers and risks</h3>
                        </div>
                    </div>
                    <ul>
                        {openQuestions.map((question) => (
                            <li key={question.id}>
                                <span
                                    className={`priority-dot priority-dot--${question.priority}`}
                                    aria-hidden="true"
                                />
                                <span>{question.text}</span>
                                <small>{question.priority}</small>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="snapshot-section">
                <div>
                    <p className="eyebrow">Decision history</p>
                    <h3>Record this decision</h3>
                    <p>
                        Stores the current call, stance, authored memo, and remaining non-blocking unknowns.
                        It does not include composer drafts.
                    </p>
                    <p id="decision-readiness" role="status" aria-label="Decision readiness">
                        {readiness.ready
                            ? 'Ready to record. The decision will be marked decided.'
                            : `Not ready: ${readiness.missing.join(' · ')}.`}
                    </p>
                </div>
                <button
                    className="button button--secondary"
                    type="button"
                    onClick={handleCaptureSnapshot}
                    disabled={!readiness.ready}
                    aria-describedby="decision-readiness"
                >
                    <History size={16} aria-hidden="true" /> Record decision
                </button>
            </div>

            {inquiry.snapshots.length > 0 && (
                <ol className="snapshot-timeline" aria-label="Recorded decisions">
                    {[...inquiry.snapshots].reverse().map((snapshot) => (
                        <li key={snapshot.id}>
                            <span aria-hidden="true" />
                            <div>
                                <strong>
                                    <time dateTime={snapshot.createdAt}>
                                        {new Date(snapshot.createdAt).toLocaleString()}
                                    </time>
                                </strong>
                                <p>{snapshot.answer}</p>
                                <small>
                                    {stanceLabel[snapshot.stance]} · {snapshot.openRisks.length} open unknowns
                                </small>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
