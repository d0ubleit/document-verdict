import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractText, formatFromFileName, htmlToText } from '../src/extract/index.ts';
import type { SourceFile } from '../src/extract/index.ts';

const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

function fileFromBuffer(name: string, data: Uint8Array): SourceFile {
  return {
    name,
    // Slice the exact range: small Node Buffers share a pooled ArrayBuffer,
    // which pdfjs cannot transfer.
    arrayBuffer: async () =>
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  };
}

function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURES_DIR + name));
}

describe('formatFromFileName', () => {
  it('detects pdf', () => {
    expect(formatFromFileName('dogovor.pdf')).toBe('pdf');
  });

  it('detects docx', () => {
    expect(formatFromFileName('dogovor.docx')).toBe('docx');
  });

  it('detects images', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'bmp']) {
      expect(formatFromFileName(`scan.${ext}`)).toBe('image');
    }
  });

  it('detects html and htm', () => {
    expect(formatFromFileName('page.html')).toBe('html');
    expect(formatFromFileName('page.htm')).toBe('html');
  });

  it('detects text files', () => {
    expect(formatFromFileName('contract.txt')).toBe('text');
    expect(formatFromFileName('contract.md')).toBe('text');
  });

  it('returns unknown for unsupported extensions', () => {
    expect(formatFromFileName('contract.xyz')).toBe('unknown');
    expect(formatFromFileName('noextension')).toBe('unknown');
  });
});

describe('htmlToText', () => {
  it('strips tags but keeps Cyrillic text', () => {
    expect(htmlToText('<p>Привет, <b>мир</b>!</p>')).toBe('Привет, мир!');
  });

  it('removes script and style blocks', () => {
    const html = '<script>var x = 1;</script><style>p { color: red }</style><p>Текст</p>';
    expect(htmlToText(html)).toBe('Текст');
  });

  it('decodes entities', () => {
    expect(htmlToText('&laquo;Кавычки&raquo; &mdash; тире&nbsp;и&nbsp;пробел')).toBe(
      '«Кавычки» — тире и пробел',
    );
  });

  it('decodes numeric entities', () => {
    expect(htmlToText('&#1058;&#1077;&#1089;&#1090;')).toBe('Тест');
  });

  it('turns br into a newline', () => {
    expect(htmlToText('Строка 1<br>Строка 2')).toBe('Строка 1\nСтрока 2');
  });
});

describe('extractText', () => {
  it('returns plain text as is for .txt', async () => {
    const file = fileFromBuffer('contract.txt', new TextEncoder().encode('Договор ГПХ\nпункт 1'));
    const doc = await extractText(file);
    expect(doc.format).toBe('text');
    expect(doc.text).toContain('Договор ГПХ');
  });

  it('extracts text from an HTML page (fictional fixture)', async () => {
    const file = fileFromBuffer('oferta-romashka.html', readFixture('oferta-romashka.html'));
    const doc = await extractText(file);
    expect(doc.format).toBe('html');
    expect(doc.text).toContain('Публичная оферта');
    expect(doc.text).toContain('info@example.com');
  });

  it('extracts text from a DOCX contract (fictional fixture)', async () => {
    const file = fileFromBuffer('dogovor-mikrozaim.docx', readFixture('dogovor-mikrozaim.docx'));
    const doc = await extractText(file);
    expect(doc.format).toBe('docx');
    expect(doc.text).toContain('Договор микрозайма');
    expect(doc.text).toContain('Иванова');
  });

  it('extracts text from a PDF offer (fictional fixture)', async () => {
    const file = fileFromBuffer('oferta-romashka.pdf', readFixture('oferta-romashka.pdf'));
    const doc = await extractText(file);
    expect(doc.format).toBe('pdf');
    expect(doc.text.toLowerCase()).toContain('public offer');
  });

  it('runs OCR through the injected extractor for images', async () => {
    const fakeOcr = async () => 'Распознанный текст со скана';
    const file = fileFromBuffer('scan.png', new Uint8Array([1, 2, 3]));
    const doc = await extractText(file, { ocr: fakeOcr });
    expect(doc.format).toBe('image');
    expect(doc.text).toBe('Распознанный текст со скана');
  });

  it('throws for unsupported file formats', async () => {
    const file = fileFromBuffer('contract.xyz', new Uint8Array([1]));
    await expect(extractText(file)).rejects.toThrow(/Unsupported file format/);
  });
});
