import * as pdfjs from 'pdfjs-dist';

/**
 * Извлекает текст из PDF на клиенте (pdfjs-dist).
 * В браузере требуется настроить GlobalWorkerOptions.workerSrc в точке входа
 * приложения; в Node pdfjs работает в режиме fake worker без настройки.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const parts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      let line = '';
      for (const item of content.items) {
        if ('str' in item && typeof item.str === 'string') {
          line += item.str;
          line += item.hasEOL ? '\n' : ' ';
        }
      }
      parts.push(line.trimEnd());
    }
    return parts
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    await doc.destroy();
  }
}
