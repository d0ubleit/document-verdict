#!/usr/bin/env node
/**
 * Builds self-contained, fictional fixtures for the extractor tests:
 * a minimal DOCX (zip, store method) and a minimal PDF. This keeps the
 * public repository free of third-party documents and real contacts.
 * Run: node scripts/make-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'packages/masker/tests/fixtures');
mkdirSync(OUT, { recursive: true });

// ---------- CRC32 + minimal ZIP writer (store, no compression) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuf);

    offset += header.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuf, eocd]);
}

// ---------- DOCX ----------

const DOCX_PARAGRAPHS = [
  'Договор микрозайма № 12-2026',
  'Заёмщик: Иванова Мария Петровна, паспорт 4500 123456.',
  'Общество с ограниченной ответственностью «Ромашка».',
  'Телефон: +7 900 000-00-00, email: info@example.com.',
  'Сумма займа: 50 000 руб. Срок: 12 месяцев.',
];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${DOCX_PARAGRAPHS.map((p) => `    <w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('\n')}
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docx = makeZip([
  { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
  { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
  { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
]);
writeFileSync(join(OUT, 'dogovor-mikrozaim.docx'), docx);

// ---------- PDF (ASCII text, correct xref offsets) ----------

const PDF_TEXT = [
  'Public offer of the Romashka school',
  'Phone: +7 900 000-00-00, email: info@example.com',
  'The offer is valid until December 2026.',
];

function makePdf(lines) {
  const content = ['BT', '/F1 12 Tf', '72 720 Td'];
  lines.forEach((line, i) => {
    const escaped = line.replace(/[()\\]/g, (m) => `\\${m}`);
    content.push(i === 0 ? `(${escaped}) Tj` : `0 -18 Td (${escaped}) Tj`);
  });
  content.push('ET');
  const stream = content.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

// Uint8Array (not Buffer): pdfjs transfers the underlying ArrayBuffer, and
// pooled Buffer memory is not transferable.
writeFileSync(join(OUT, 'oferta-romashka.pdf'), new Uint8Array(makePdf(PDF_TEXT)));

// ---------- HTML ----------

const html = `<!doctype html>
<html lang="ru">
  <head><meta charset="utf-8" /><title>Публичная оферта</title></head>
  <body>
    <h1>Публичная оферта школы «Ромашка»</h1>
    <p>Телефон: +7 900 000-00-00, email: info@example.com</p>
    <p>Оферта действует до 31 декабря 2026 года.</p>
  </body>
</html>`;
writeFileSync(join(OUT, 'oferta-romashka.html'), html, 'utf8');

console.log(`fixtures written to ${OUT}`);
