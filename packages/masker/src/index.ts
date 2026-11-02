export { maskText, normalize, findCandidates, applyCandidates } from './mask.ts';
export { computeProtectedSpans, isProtected } from './protect.ts';
export { RULES } from './rules.ts';
export { PLACEHOLDER_BY_TYPE, placeholderFor, ALL_PLACEHOLDER_TYPES } from './placeholders.ts';
export { nerCandidates, warmUpNer } from './ner.ts';
export { extractText, formatFromFileName, htmlToText } from './extract/index.ts';
export type { ExtractedDocument, DocumentFormat, OcrFn, SourceFile } from './extract/index.ts';
export type {
  MaskOptions,
  MaskResult,
  MaskReview,
  Replacement,
  Candidate,
  ProtectedSpan,
  PlaceholderType,
} from './types.ts';
