/** Типы модуля извлечения текста. */

export type DocumentFormat = 'pdf' | 'docx' | 'image' | 'html' | 'text' | 'unknown';

export interface ExtractedDocument {
  fileName: string;
  format: DocumentFormat;
  text: string;
}

/** Функция распознавания текста по изображению (по умолчанию — tesseract.js). */
export type OcrFn = (data: ArrayBuffer) => Promise<string>;
