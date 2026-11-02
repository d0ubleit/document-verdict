import { extractPdfText } from './pdf.ts';
import { extractDocxText } from './docx.ts';
import { extractImageText } from './image.ts';
import { htmlToText } from './html.ts';
import { formatFromFileName } from './format.ts';
import type { ExtractedDocument, OcrFn } from './types.ts';

export type { ExtractedDocument, DocumentFormat, OcrFn } from './types.ts';
export { formatFromFileName } from './format.ts';
export { htmlToText } from './html.ts';

/** Минимальный интерфейс файла (совместим с File из браузера). */
export interface SourceFile {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ExtractOptions {
  /** Своя реализация OCR (тесты, альтернативные движки). */
  ocr?: OcrFn;
}

/**
 * Единая точка входа: определяет формат по расширению и извлекает текст
 * полностью на устройстве пользователя — на сервер ничего не уходит.
 */
export async function extractText(
  file: SourceFile,
  opts: ExtractOptions = {},
): Promise<ExtractedDocument> {
  const format = formatFromFileName(file.name);
  const data = await file.arrayBuffer();
  let text: string;
  switch (format) {
    case 'pdf':
      text = await extractPdfText(data);
      break;
    case 'docx':
      text = await extractDocxText(data);
      break;
    case 'image':
      text = await extractImageText(data, opts.ocr);
      break;
    case 'html':
      text = htmlToText(new TextDecoder().decode(data));
      break;
    case 'text':
      text = new TextDecoder().decode(data);
      break;
    default:
      throw new Error(`Unsupported file format: ${file.name}`);
  }
  return { fileName: file.name, format, text };
}
