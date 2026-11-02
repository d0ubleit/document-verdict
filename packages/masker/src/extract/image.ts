import type { OcrFn } from './types.ts';

/**
 * Распознавание текста со сканов/фото (tesseract.js, языки rus+eng).
 * Модель данных скачивается один раз и кэшируется; модуль грузится лениво.
 * Для тестов и альтернативных движков OCR можно передать свою реализацию
 * через extractText(file, { ocr }).
 */
let ocrPromise: Promise<OcrFn> | null = null;

async function defaultOcr(): Promise<OcrFn> {
  if (!ocrPromise) {
    ocrPromise = import('tesseract.js').then(async (mod) => {
      const worker = await mod.default.createWorker('rus+eng');
      return async (data: ArrayBuffer) => {
        // tesseract типизирован под Node Buffer; в браузере Uint8Array
        // принимается так же — каст нужен только для типов.
        const result = await worker.recognize(new Uint8Array(data) as unknown as Buffer);
        return result.data.text.trim();
      };
    });
  }
  return ocrPromise;
}

export async function extractImageText(data: ArrayBuffer, ocr?: OcrFn): Promise<string> {
  const run = ocr ?? (await defaultOcr());
  return run(data);
}
