import type { DocumentFormat } from './types.ts';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'heic']);

/**
 * Определяет формат документа по расширению имени файла.
 * Используется единой точкой входа extractText.
 */
export function formatFromFileName(fileName: string): DocumentFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'html':
    case 'htm':
      return 'html';
    case 'txt':
    case 'md':
    case 'text':
      return 'text';
    default:
      return IMAGE_EXTENSIONS.has(ext) ? 'image' : 'unknown';
  }
}
