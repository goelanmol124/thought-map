import { describe, expect, it } from 'vitest';
import {
  buildDecisionMarkdown,
  createEvidence,
  createInquiry,
  createQuestion,
  createSnapshot,
  getChildQuestions,
  getDecisionReadiness,
  getInquiryProgress,
  getNextQuestion,
  getOpenQuestions,
  getQuestion,
  getResolvedQuestions,
  getRootQuestion,
  parseInquiryFile,
  sanitizeEvidenceUrl,
  serializeInquiry,
} from '../src/inquiry';
import type { Evidence, Inquiry } from '../src/types';

const evidenceUrlError = /Evidence URL must be a valid http\(s\) link without credentials/i;

/** Wrap an inquiry as a v1 IdeaMap file payload (optionally mutating nested evidence). */
function inquiryFileJson(
  inquiry: Inquiry,
  mutate?: (inquiry: Inquiry) => Inquiry,
): string {
  const payload = mutate ? mutate(structuredClone(inquiry)) : inquiry;
  return JSON.stringify({
    format: 'ideamap-inquiry',
    version: 1,
    exportedAt: '2026-07-18T00:00:00.000Z',
    inquiry: payload,
  });
}

function withRootEvidence(inquiry: Inquiry, evidence: Evidence[]): Inquiry {
  const root = getRootQuestion(inquiry);
  return {
    ...inquiry,
    questions: inquiry.questions.map((question) =>
      question.id === root.id ? { ...question, evidence } : question,
    ),
  };
}

describe('createInquiry / createQuestion', () => {
  it('creates an exploring inquiry with an open blocking root question', () => {
    const inquiry = createInquiry('  Should we expand?  ', '  A clear go/no-go  ');

    expect(inquiry.schemaVersion).toBe(1);
    expect(inquiry.title).toBe('Should we expand?');
    expect(inquiry.desiredOutcome).toBe('A clear go/no-go');
    expect(inquiry.status).toBe('exploring');
    expect(inquiry.id).toMatch(/^inquiry_/);
    expect(inquiry.currentQuestionId).toBeNull();
    expect(inquiry.questions).toHaveLength(1);

    const root = getRootQuestion(inquiry);
    expect(root.text).toBe('Should we expand?');
    expect(root.parentId).toBeNull();
    expect(root.state).toBe('open');
    expect(root.priority).toBe('blocking');
    expect(root.stance).toBe('unknown');
    expect(root.evidence).toEqual([]);
  });

  it('creates child questions with relationships and priorities', () => {
    const child = createQuestion('What is the cost?', 'parent_1', 'hinges-on', 'high');

    expect(child.id).toMatch(/^question_/);
    expect(child.parentId).toBe('parent_1');
    expect(child.relationship).toBe('hinges-on');
    expect(child.priority).toBe('high');
    expect(child.state).toBe('open');
    expect(child.answer).toBe('');
  });
});

describe('question selectors', () => {
  const base = (): Inquiry => {
    const inquiry = createInquiry('Root decision?');
    const root = getRootQuestion(inquiry);
    const blocking = createQuestion('Blocking unknown?', root.id, 'breaks-into', 'blocking');
    const high = createQuestion('High leverage unknown?', root.id, 'breaks-into', 'high');
    const normal = createQuestion('Normal unknown?', root.id, 'breaks-into', 'normal');
    const resolved = {
      ...createQuestion('Already settled?', root.id),
      state: 'resolved' as const,
      answer: 'Yes',
      stance: 'supported' as const,
      resolvedAt: new Date().toISOString(),
    };

    // Force deterministic createdAt ordering for priority ties.
    blocking.createdAt = '2026-01-01T00:00:00.000Z';
    high.createdAt = '2026-01-02T00:00:00.000Z';
    normal.createdAt = '2026-01-03T00:00:00.000Z';

    return {
      ...inquiry,
      questions: [root, blocking, high, normal, resolved],
      currentQuestionId: root.id,
    };
  };

  it('reads root, children, open, resolved, and next questions in priority order', () => {
    const inquiry = base();
    const root = getRootQuestion(inquiry);

    expect(getQuestion(inquiry, root.id)?.text).toBe('Root decision?');
    expect(getQuestion(inquiry, null)).toBeNull();
    expect(getChildQuestions(inquiry, root.id).map((q) => q.text)).toEqual([
      'Blocking unknown?',
      'High leverage unknown?',
      'Normal unknown?',
      'Already settled?',
    ]);
    // Blocking questions first, then older createdAt within the same priority.
    expect(getOpenQuestions(inquiry).map((q) => q.text)).toEqual([
      'Blocking unknown?',
      'Root decision?',
      'High leverage unknown?',
      'Normal unknown?',
    ]);
    expect(getResolvedQuestions(inquiry)).toHaveLength(1);
    expect(getNextQuestion(inquiry)?.text).toBe('Blocking unknown?');
  });

  it('never counts a resolved root as an open unknown', () => {
    const inquiry = base();
    const root = getRootQuestion(inquiry);
    const withResolvedRoot: Inquiry = {
      ...inquiry,
      questions: inquiry.questions.map((question) =>
        question.id === root.id
          ? { ...question, state: 'resolved', answer: 'Proceed' }
          : question,
      ),
    };

    const progress = getInquiryProgress(withResolvedRoot);
    expect(progress.openQuestions.map((question) => question.text)).toEqual([
      'Blocking unknown?',
      'High leverage unknown?',
      'Normal unknown?',
    ]);
    expect(progress.openCount).toBe(3);
    expect(progress.resolvedCount).toBe(2);
    expect(getDecisionReadiness(withResolvedRoot).blockingQuestions).toEqual(
      progress.blockingQuestions,
    );
  });
});

describe('evidence and snapshots', () => {
  it('creates trimmed evidence and decision snapshots of open risks', () => {
    const inquiry = createInquiry('Ship the redesign?');
    const root = getRootQuestion(inquiry);
    root.answer = 'Yes, behind a flag';
    root.stance = 'leaning';

    const followUp = createQuestion('Will support load spike?', root.id, 'breaks-into', 'blocking');
    const withFollowUp: Inquiry = {
      ...inquiry,
      synthesis: 'Ship behind a flag and watch support.',
      questions: [{ ...root, state: 'resolved' }, followUp],
      currentQuestionId: followUp.id,
    };

    const evidence = createEvidence('  Support tickets rose 12%  ', 'weakens', '  Ops note  ', '  https://example.com  ');
    expect(evidence.id).toMatch(/^evidence_/);
    expect(evidence.note).toBe('Support tickets rose 12%');
    expect(evidence.source).toBe('Ops note');
    expect(evidence.url).toBe('https://example.com');
    expect(evidence.polarity).toBe('weakens');

    const snapshot = createSnapshot(withFollowUp);
    expect(snapshot.id).toMatch(/^snapshot_/);
    expect(snapshot.answer).toBe('Yes, behind a flag');
    expect(snapshot.stance).toBe('leaning');
    expect(snapshot.synthesis).toBe('Ship behind a flag and watch support.');
    expect(snapshot.openRisks).toEqual(['Will support load spike?']);
  });

  it('requires a call, authored memo, and no blocking unknown before recording', () => {
    const inquiry = createInquiry('Record this decision?');
    expect(getDecisionReadiness(inquiry)).toMatchObject({
      ready: false,
      missing: ['Write the current call', 'Write the decision memo', 'Resolve 1 blocking unknown'],
    });

    const root = getRootQuestion(inquiry);
    const ready = {
      ...inquiry,
      synthesis: 'Proceed because the reversible path is cheaper.',
      questions: [{ ...root, answer: 'Proceed with a two-week pilot.', state: 'resolved' as const }],
    };
    expect(getDecisionReadiness(ready)).toMatchObject({ ready: true, missing: [] });
  });

  it('rejects credential-bearing and non-http(s) evidence URLs', () => {
    const unsafe = [
      'https://user:pass@evil.example/path',
      'https://trusted@evil.example',
      'http://alice:secret@example.com',
      'javascript:alert(1)',
      'data:text/html,hi',
      'ftp://files.example.com/report',
      'file:///etc/passwd',
      'not a url',
    ];

    for (const url of unsafe) {
      expect(() => createEvidence('Note', 'supports', 'Source', url)).toThrow(evidenceUrlError);
      expect(sanitizeEvidenceUrl(url)).toBeNull();
    }
  });

  it('normalizes safe http(s) evidence URLs and allows empty URLs', () => {
    expect(createEvidence('Note', 'context', 'Src', '').url).toBe('');
    expect(createEvidence('Note', 'context', 'Src', '   ').url).toBe('');

    expect(createEvidence('Note', 'supports', 'Src', '  https://example.com  ').url)
      .toBe('https://example.com');
    expect(createEvidence('Note', 'supports', 'Src', 'https://example.com/').url)
      .toBe('https://example.com');
    expect(createEvidence('Note', 'supports', 'Src', 'http://example.com/path?q=1#hash').url)
      .toBe('http://example.com/path?q=1#hash');

    expect(sanitizeEvidenceUrl('HTTPS://Example.COM/docs')).toBe('https://example.com/docs');
  });
});

describe('JSON import/export validation', () => {
  it('round-trips a valid inquiry file', () => {
    const inquiry = createInquiry('Should we hire?', 'A hiring decision');
    const raw = serializeInquiry(inquiry);
    const parsedFile = JSON.parse(raw) as {
      format: string;
      version: number;
      exportedAt: string;
      inquiry: Inquiry;
    };

    expect(parsedFile.format).toBe('ideamap-inquiry');
    expect(parsedFile.version).toBe(1);
    expect(typeof parsedFile.exportedAt).toBe('string');
    expect(parseInquiryFile(raw)).toEqual(inquiry);
  });

  it('rejects invalid payloads', () => {
    expect(() => parseInquiryFile('{"format":"other"}')).toThrow(
      /not a valid IdeaMap inquiry file/i,
    );
    expect(() => parseInquiryFile('{"format":"ideamap-inquiry","version":2,"inquiry":{}}')).toThrow(
      /not a valid IdeaMap inquiry file/i,
    );
    expect(() => parseInquiryFile('not-json')).toThrow();
  });

  it('still imports legacy thought-map-inquiry files', () => {
    const inquiry = createInquiry('Legacy format import?');
    const raw = JSON.stringify({
      format: 'thought-map-inquiry',
      version: 1,
      exportedAt: '2026-07-18T00:00:00.000Z',
      inquiry,
    });
    expect(parseInquiryFile(raw)).toEqual(inquiry);
  });

  it('rejects inquiries that lack a resolvable root question', () => {
    const inquiry = createInquiry('Broken root?');
    const raw = serializeInquiry({
      ...inquiry,
      rootQuestionId: 'missing_root',
    });
    expect(() => parseInquiryFile(raw)).toThrow(/not a valid IdeaMap inquiry file/i);
  });

  it('rejects unsafe nested evidence URLs and normalizes safe ones on import', () => {
    const inquiry = createInquiry('Import evidence safety?');
    const stamped: Evidence = {
      id: 'evidence_unsafe',
      note: 'Phish',
      source: 'Link',
      url: 'https://user:pass@evil.example/docs',
      polarity: 'supports',
      createdAt: '2026-07-18T00:00:00.000Z',
    };

    expect(() =>
      parseInquiryFile(inquiryFileJson(inquiry, (value) => withRootEvidence(value, [stamped]))),
    ).toThrow(/Invalid evidence URL/i);

    expect(() =>
      parseInquiryFile(
        inquiryFileJson(inquiry, (value) =>
          withRootEvidence(value, [{ ...stamped, url: 'javascript:void(0)' }]),
        ),
      ),
    ).toThrow(/Invalid evidence URL/i);

    const imported = parseInquiryFile(
      inquiryFileJson(inquiry, (value) =>
        withRootEvidence(value, [{
          ...stamped,
          id: 'evidence_safe',
          note: 'Safe note',
          url: '  https://vendor.example/  ',
        }]),
      ),
    );
    expect(getRootQuestion(imported).evidence[0]?.url).toBe('https://vendor.example');
  });
});

describe('Markdown export', () => {
  it('renders title, answer, evidence, follow-ups, and open questions', () => {
    const inquiry = createInquiry('Adopt the new vendor?');
    const root = getRootQuestion(inquiry);
    root.answer = 'Provisionally yes';
    root.stance = 'leaning';
    root.evidence = [
      createEvidence('Pricing beats incumbent', 'supports', 'Proposal', 'https://vendor.example/pricing'),
    ];

    const child = createQuestion('Can we exit in 12 months?', root.id, 'hinges-on', 'blocking');
    const withTree: Inquiry = {
      ...inquiry,
      desiredOutcome: 'A contract decision',
      synthesis: 'Move forward with exit clauses.',
      questions: [{ ...root, state: 'resolved' }, child],
      currentQuestionId: child.id,
      snapshots: [createSnapshot({
        ...inquiry,
        questions: [{ ...root, state: 'resolved' }, child],
        currentQuestionId: child.id,
        synthesis: 'Move forward with exit clauses.',
      })],
    };

    const markdown = buildDecisionMarkdown(withTree);

    expect(markdown).toContain('# Adopt the new vendor?');
    expect(markdown).toContain('**Status:** exploring');
    expect(markdown).toContain('**Stance:** leaning');
    expect(markdown).toContain('## Intended outcome');
    expect(markdown).toContain('A contract decision');
    expect(markdown).toContain('## Current answer');
    expect(markdown).toContain('Provisionally yes');
    expect(markdown).toContain('## Decision memo');
    expect(markdown).toContain('Move forward with exit clauses.');
    expect(markdown).toContain('## Evidence basis');
    expect(markdown).toContain('## Reasoning');
    expect(markdown).toContain('_supports:_ Pricing beats incumbent');
    expect(markdown).toContain('[Proposal](https://vendor.example/pricing)');
    expect(markdown).toContain('Can we exit in 12 months?');
    expect(markdown).toContain('## Open blockers and risks');
    expect(markdown).toMatch(/- \[ \] Can we exit in 12 months\? _\(blocking\)/);
    expect(markdown).toContain('Last recorded decision:');
  });

  it('escapes markdown-sensitive characters in titles and notes', () => {
    const inquiry = createInquiry('Decide on *bold* [link]?');
    const root = getRootQuestion(inquiry);
    root.answer = 'Use \\ carefully';
    root.evidence = [createEvidence('Note with *stars*', 'context', 'Src [x]')];

    const markdown = buildDecisionMarkdown({
      ...inquiry,
      questions: [root],
    });

    expect(markdown).toContain('\\*bold\\*');
    expect(markdown).toContain('\\[link\\]');
    expect(markdown).toContain('\\*stars\\*');
    expect(markdown).toContain('Src \\[x\\]');
  });
});
