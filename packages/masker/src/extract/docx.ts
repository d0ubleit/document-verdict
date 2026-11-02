import mammoth from 'mammoth';

/**
 * Извлекает текст из DOCX (mammoth) — работает и в браузере, и в Node.
 * ВАЖНО: Node-билд mammoth принимает options.buffer, браузерный билд
 * (который подставляет Vite через browser-поле) — options.arrayBuffer.
 * Передаём оба ключа — в каждой среде сработает свой.
 */
export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({
    arrayBuffer: data,
    buffer: new Uint8Array(data) as unknown as Buffer,
  } as Parameters<typeof mammoth.extractRawText>[0]);
  return result.value.trim();
}
