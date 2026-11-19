/**
 * lib/market-data/gold.ts
 * Pure TypeScript gold conversion math, canonical ticker normalization, and display helpers.
 * Supports:
 * - Dime! Gold 99.99% (XAU, USD / troy oz)
 * - Thai Gold Bar 96.5% (GOLD965, THB / 15.244g Thai baht-gold)
 */

export const GRAMS_PER_TROY_OZ = 31.1034768
export const GRAMS_PER_THAI_BAHT_BAR = 15.244
export const THAI_965_PURITY = 0.965
// Effective troy ounces of pure gold in 1 Thai 96.5% baht-gold bar (~0.472952 oz)
export const THAI_BAHT_965_OZ_FACTOR = (GRAMS_PER_THAI_BAHT_BAR / GRAMS_PER_TROY_OZ) * THAI_965_PURITY

const GOLD_SPOT_ALIASES = new Set([
  'XAU',
  'XAUUSD',
  'XAU/USD',
  'GC=F',
  'GC.F',
  'GOLD9999',
  'GOLD-9999',
  'DIME-GOLD',
  'DIMEGOLD',
  'XAU-USD',
])

export function isThai965GoldTicker(ticker?: string | null): boolean {
  const clean = String(ticker || '').trim().toUpperCase()
  return clean === 'GOLD965' || clean === 'GOLD-965'
}

export function isGoldTicker(ticker?: string | null, assetType?: string | null): boolean {
  if (assetType?.toLowerCase() === 'gold') return true
  const clean = String(ticker || '').trim().toUpperCase()
  return GOLD_SPOT_ALIASES.has(clean) || isThai965GoldTicker(clean)
}

export function normalizeGoldTicker(
  rawTicker: string,
  assetType?: string | null,
  currency?: string | null
): {
  ticker: string
  market: 'US' | 'TH'
  currency: 'USD' | 'THB'
  assetName: string
} | null {
  const clean = String(rawTicker || '').trim().toUpperCase()
  const isGold = isGoldTicker(clean, assetType)
  if (!isGold) return null

  // Do not hijack NYSE stock Barrick Gold ('GOLD') unless caller explicitly marks assetType === 'gold'
  const currUpper = String(currency || '').trim().toUpperCase()

  if (
    isThai965GoldTicker(clean) ||
    (clean === 'GOLD' && currUpper === 'THB' && assetType?.toLowerCase() === 'gold')
  ) {
    return {
      ticker: 'GOLD965',
      market: 'TH',
      currency: 'THB',
      assetName: 'ทองคำแท่งไทย 96.5% (THB/บาททอง)',
    }
  }

  return {
    ticker: 'XAU',
    market: 'US',
    currency: 'USD',
    assetName: 'Dime! Gold 99.99% (USD/oz)',
  }
}

export function ozToGrams(oz: number): number {
  if (!Number.isFinite(oz) || oz <= 0) return 0
  return oz * GRAMS_PER_TROY_OZ
}

export function gramsToOz(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0
  return grams / GRAMS_PER_TROY_OZ
}

export function ozToThaiBahtGold(oz: number): number {
  if (!Number.isFinite(oz) || oz <= 0) return 0
  return (oz * GRAMS_PER_TROY_OZ) / GRAMS_PER_THAI_BAHT_BAR
}

export function calculateThai965PricePerBaht(xauUsdPerOz: number, usdThbRate: number): number {
  if (!Number.isFinite(xauUsdPerOz) || xauUsdPerOz <= 0 || !Number.isFinite(usdThbRate) || usdThbRate <= 0) {
    return 0
  }
  return Math.round(xauUsdPerOz * usdThbRate * THAI_BAHT_965_OZ_FACTOR)
}

export function getAssetUnitLabel(ticker?: string | null, assetType?: string | null): string {
  const typeLower = assetType?.toLowerCase()
  if (isThai965GoldTicker(ticker)) return 'บาททอง'
  if (isGoldTicker(ticker, typeLower)) return 'oz'
  if (typeLower === 'crypto') return 'เหรียญ'
  if (typeLower === 'fund') return 'หน่วย'
  return 'หุ้น'
}

export function formatGoldWeightSublabel(
  quantity: number,
  ticker?: string | null,
  assetType?: string | null
): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!isGoldTicker(ticker, assetType)) return null

  if (isThai965GoldTicker(ticker)) {
    const grams = quantity * GRAMS_PER_THAI_BAHT_BAR
    return `≈ ${grams.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} กรัม (96.5%)`
  }

  const grams = ozToGrams(quantity)
  const bahtGold = ozToThaiBahtGold(quantity)
  return `≈ ${grams.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} กรัม (${bahtGold.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} บาททอง)`
}
