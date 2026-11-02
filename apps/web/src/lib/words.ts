// "Total Amount Requested (In Words)" on the DRIC forms is generated from the
// figure, e.g. 12500.5 GHS → "Twelve Thousand Five Hundred Ghana Cedis and
// Fifty Pesewas".

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion']

const CURRENCY_WORDS: Record<string, [major: string, minor: string]> = {
  GHS: ['Ghana Cedis', 'Pesewas'],
  USD: ['US Dollars', 'Cents'],
  EUR: ['Euros', 'Cents'],
  GBP: ['Pounds Sterling', 'Pence'],
  CAD: ['Canadian Dollars', 'Cents'],
  AUD: ['Australian Dollars', 'Cents'],
  CHF: ['Swiss Francs', 'Centimes'],
  SEK: ['Swedish Kronor', 'Öre'],
  NOK: ['Norwegian Kroner', 'Øre'],
  DKK: ['Danish Kroner', 'Øre'],
  JPY: ['Japanese Yen', 'Sen'],
  CNY: ['Chinese Yuan', 'Fen'],
  ZAR: ['South African Rand', 'Cents'],
  NGN: ['Nigerian Naira', 'Kobo'],
  KES: ['Kenyan Shillings', 'Cents'],
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: Array<string> = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) {
    const words = rest < 20 ? ONES[rest]! : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`
    parts.push(hundreds ? `and ${words}` : words)
  }
  return parts.join(' ')
}

export function integerToWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'Zero'
  const groups: Array<string> = []
  let scale = 0
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000
    if (chunk) groups.unshift(`${underThousand(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`)
    n = Math.floor(n / 1000)
    scale++
  }
  return groups.join(', ')
}

export function amountInWords(amount: number | string | null | undefined, currency = 'GHS'): string {
  const value = Math.round(Math.abs(Number(amount ?? 0)) * 100) / 100
  const [major, minor] = CURRENCY_WORDS[currency] ?? [currency, 'Cents']
  const whole = Math.floor(value)
  const cents = Math.round((value - whole) * 100)
  let words = `${integerToWords(whole)} ${major}`
  if (cents) words += ` and ${integerToWords(cents)} ${minor}`
  return `${words} Only`
}
