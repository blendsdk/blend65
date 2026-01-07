/**
 * White-box tests validating diagnostic helper emitters are invoked correctly
 * by the parser scaffolding. These tests ensure Task 2.2.2 wiring is complete.
 */

import { describe, expect, it } from 'vitest';
import { ParserDiagnosticCode } from '../../parser/diagnostics.js';
import {
  reportDuplicateExportedMain,
  reportDuplicateModule,
  reportEmptyImportList,
  reportImplicitMainExport,
  reportMissingEndEnum,
  reportMissingEndFunction,
  reportMissingFromClause,
  type ParserDiagnosticSink,
} from '../../parser/diagnostic-emitters.js';
import { createSourceSpan } from '../../parser/source.js';

/**
 * Helper to create a zero-offset source span for testing.
 * Keeps test setup DRY while ensuring all emitters receive valid span data.
 */
function createTestSpan() {
  return createSourceSpan(
    { line: 1, column: 1, offset: 0 },
    { line: 1, column: 10, offset: 10 }
  );
}

describe('reportDuplicateModule', () => {
  it('emits duplicate module diagnostic with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportDuplicateModule(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.DuplicateModuleDeclaration);
    expect(sink[0].severity).toBe('Error');
    expect(sink[0].message).toContain('one module declaration');
    expect(sink[0].span).toBe(span);
  });

  it('includes related information when first module span is provided', () => {
    const sink: ParserDiagnosticSink = [];
    const duplicateSpan = createTestSpan();
    const firstSpan = createTestSpan();

    reportDuplicateModule(sink, duplicateSpan, firstSpan);

    expect(sink[0].relatedInformation).toBeDefined();
    expect(sink[0].relatedInformation).toHaveLength(1);
    expect(sink[0].relatedInformation![0].span).toBe(firstSpan);
    expect(sink[0].relatedInformation![0].message).toContain('First module');
  });

  it('omits related information when first module span is not provided', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportDuplicateModule(sink, span);

    expect(sink[0].relatedInformation).toBeUndefined();
  });
});

describe('reportMissingFromClause', () => {
  it('emits missing from clause diagnostic with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportMissingFromClause(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.MissingFromClause);
    expect(sink[0].severity).toBe('Error');
    expect(sink[0].message).toContain("'from' clause");
    expect(sink[0].span).toBe(span);
  });

  it('produces descriptive message explaining why from clause is required', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportMissingFromClause(sink, span);

    expect(sink[0].message).toContain('source module');
  });
});

describe('reportEmptyImportList', () => {
  it('emits empty import list diagnostic with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportEmptyImportList(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.EmptyImportList);
    expect(sink[0].severity).toBe('Error');
    expect(sink[0].message).toContain('at least one binding');
    expect(sink[0].span).toBe(span);
  });
});

describe('reportImplicitMainExport', () => {
  it('emits implicit main export warning with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportImplicitMainExport(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.ImplicitMainExport);
    expect(sink[0].severity).toBe('Warning');
    expect(sink[0].message).toContain('automatically exported');
    expect(sink[0].span).toBe(span);
  });

  it('provides actionable guidance in message text', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportImplicitMainExport(sink, span);

    expect(sink[0].message).toContain("add 'export'");
  });
});

describe('reportMissingEndFunction', () => {
  it('emits missing end function diagnostic with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportMissingEndFunction(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.MissingEndFunction);
    expect(sink[0].severity).toBe('Error');
    expect(sink[0].message).toContain('end function');
    expect(sink[0].span).toBe(span);
  });

  it('explains that function must be terminated', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportMissingEndFunction(sink, span);

    expect(sink[0].message).toContain('terminated');
  });
});

describe('reportMissingEndEnum', () => {
  it('emits missing end enum diagnostic with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportMissingEndEnum(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.MissingEndEnum);
    expect(sink[0].severity).toBe('Error');
    expect(sink[0].message).toContain('end enum');
    expect(sink[0].span).toBe(span);
  });

  it('explains that enum must be terminated', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportMissingEndEnum(sink, span);

    expect(sink[0].message).toContain('terminated');
  });
});

describe('reportDuplicateExportedMain', () => {
  it('emits duplicate exported main diagnostic with correct code and severity', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportDuplicateExportedMain(sink, span);

    expect(sink).toHaveLength(1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.DuplicateExportedMain);
    expect(sink[0].severity).toBe('Error');
    expect(sink[0].message).toContain('one exported');
    expect(sink[0].span).toBe(span);
  });

  it('includes related information when first main span is provided', () => {
    const sink: ParserDiagnosticSink = [];
    const duplicateSpan = createTestSpan();
    const firstSpan = createTestSpan();

    reportDuplicateExportedMain(sink, duplicateSpan, firstSpan);

    expect(sink[0].relatedInformation).toBeDefined();
    expect(sink[0].relatedInformation).toHaveLength(1);
    expect(sink[0].relatedInformation![0].span).toBe(firstSpan);
    expect(sink[0].relatedInformation![0].message).toContain('First exported main');
  });

  it('omits related information when first main span is not provided', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportDuplicateExportedMain(sink, span);

    expect(sink[0].relatedInformation).toBeUndefined();
  });

  it('explains entry-point determinism requirement', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    reportDuplicateExportedMain(sink, span);

    expect(sink[0].message).toContain("'main'");
    expect(sink[0].message).toContain('program');
  });
});

describe('Helper emitter integration', () => {
  it('all helpers mutate the provided sink without returning values', () => {
    const sink: ParserDiagnosticSink = [];
    const span = createTestSpan();

    const result1 = reportDuplicateModule(sink, span);
    const result2 = reportMissingFromClause(sink, span);
    const result3 = reportEmptyImportList(sink, span);
    const result4 = reportImplicitMainExport(sink, span);
    const result5 = reportMissingEndFunction(sink, span);
    const result6 = reportMissingEndEnum(sink, span);
    const result7 = reportDuplicateExportedMain(sink, span);

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
    expect(result3).toBeUndefined();
    expect(result4).toBeUndefined();
    expect(result5).toBeUndefined();
    expect(result6).toBeUndefined();
    expect(result7).toBeUndefined();
    expect(sink).toHaveLength(7);
  });

  it('preserves existing diagnostics when new ones are added', () => {
    const sink: ParserDiagnosticSink = [];
    const span1 = createTestSpan();
    const span2 = createTestSpan();

    reportDuplicateModule(sink, span1);
    const firstCount = sink.length;

    reportMissingFromClause(sink, span2);

    expect(sink.length).toBe(firstCount + 1);
    expect(sink[0].code).toBe(ParserDiagnosticCode.DuplicateModuleDeclaration);
    expect(sink[1].code).toBe(ParserDiagnosticCode.MissingFromClause);
  });
});
