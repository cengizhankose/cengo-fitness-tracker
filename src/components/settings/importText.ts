import { MAX_FILE_BYTES, formatBytes } from '@/lib/backup/format'
import type { ImportErrorCode } from '@/lib/backup/format'
import { formatShortDate, toLocalISODate } from '@/lib/dates'

/** The backup libs speak English; the screen shows these instead, keyed by error code. */
export const IMPORT_ERROR_TEXT: Record<ImportErrorCode, string> = {
  E_NOT_JSON: 'Bu dosya bir Cengo Cut yedeği değil.',
  E_BAD_MAGIC: 'Bu dosya bir Cengo Cut yedeği değil.',
  E_FORMAT_NEWER: 'Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Uygulamayı güncelleyip tekrar dene.',
  E_FORMAT_UNSUPPORTED: 'Bu yedek biçimi desteklenmiyor.',
  E_SCHEMA_MISMATCH: 'Bu yedek bu sürümle uyumlu değil.',
  E_FILE_TOO_LARGE: `Dosya çok büyük; sınır ${formatBytes(MAX_FILE_BYTES)}.`,
  E_TOO_LARGE: 'Yedekte çok fazla kayıt ya da fotoğraf var.',
  E_INVALID: 'Yedek bozuk.',
  E_QUOTA: 'Depolama alanı yetmedi.',
  E_APPLY_FAILED: 'Geri yükleme başarısız oldu.',
}

/** "Pzt 16 Kas 14:05" for an ISO instant, in local time; "—" for an unreadable one. */
export function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatShortDate(toLocalISODate(d))} ${hh}:${mm}`
}

/**
 * Typed confirmations compare loosely on case and Turkish dotted/dotless letters, so
 * "değiştir", "DEGISTIR" and "DEĞİŞTİR" all count — the guard is the deliberate typing.
 */
export function confirmWordMatches(typed: string, word: string): boolean {
  const fold = (s: string) =>
    s
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
  return fold(typed) === fold(word)
}
