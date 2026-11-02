/**
 * Каноническое преобразование HTML в текст. Используется и в браузере
 * (клиентское извлечение), и в CLI-скрипте (scripts/extract.mjs) —
 * реализация одна, дублирования нет.
 */

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&laquo;': '«',
  '&raquo;': '»',
  '&mdash;': '—',
  '&ndash;': '–',
  '&sect;': '§',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&hellip;': '…',
};

function decodeEntities(text: string): string {
  let out = text;
  for (const [key, value] of Object.entries(ENTITIES)) {
    out = out.split(key).join(value);
  }
  return out.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([!?,.;:»])/g, '$1')
    .replace(/([«])\s+/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
