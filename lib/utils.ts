import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * eBayの出品URLから数値のItemIDを取り出す。
 * 例: https://www.ebay.com/itm/123456789012
 *     https://www.ebay.com/itm/Some-Title/123456789012
 *     https://www.ebay.com/itm/123456789012?hash=...
 * 取り出せなければ null。
 */
export function extractEbayItemId(ebayUrl?: string | null): string | null {
  if (!ebayUrl || typeof ebayUrl !== 'string') return null
  const m = ebayUrl.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/)
  if (m) return m[1]
  const nums = ebayUrl.match(/\d{9,15}/g)
  if (nums && nums.length) return nums.sort((a, b) => b.length - a.length)[0]
  return null
}
