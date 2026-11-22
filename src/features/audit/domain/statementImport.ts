import {
  advanceOverdueBillingDate,
  daysInMonth,
  daysUntilRenewal,
  getTodayIso,
  parseIsoDate,
  stepBillingDate,
  toIsoDate,
  type CalendarDate,
} from '../../../core/utils/dateMath';
import { parseDecimalToMinorUnits } from '../../../core/utils/moneyFormatter';
import {
  inferCategoryFromMerchantName,
  matchCatalogByMerchant,
  type ServiceCatalogEntry,
} from '../../catalog/domain/serviceCatalog';
import {
  CURRENCY_CODES,
  type BillingCycle,
  type CurrencyCode,
  type Subscription,
  type SubscriptionCategory,
} from '../../cashflow/domain/subscription';

export type DateOrder = 'DMY' | 'MDY';
export type ImportConfidence = 'high' | 'likely' | 'oneOff';

export interface StatementImportCandidate {
  readonly tempId: string;
  readonly name: string;
  readonly catalogId?: string;
  readonly amountMinorUnits: number;
  readonly previousAmountMinorUnits?: number;
  readonly currency: CurrencyCode;
  readonly cycle: BillingCycle;
  readonly category: SubscriptionCategory;
  readonly lastChargeDate: string;
  readonly nextBillingDate: string;
  readonly billingDay: number;
  readonly startDate: string;
  readonly dateEstimated: boolean;
  readonly confidence: ImportConfidence;
  readonly chargeCount: number;
  readonly matchedExistingId: string | null;
  readonly detectedPriceHikeMinorUnits: number;
}

export interface StatementImportResult {
  readonly subscriptions: readonly StatementImportCandidate[];
  readonly oneOffCharges: readonly StatementImportCandidate[];
  readonly detectedDateOrder: DateOrder;
  readonly dateOrderAutoSwitched: boolean;
  readonly skippedCount: number;
}

export interface ParseStatementOptions {
  readonly preferredDateOrder?: DateOrder;
  readonly defaultCurrency?: CurrencyCode;
  readonly todayIso?: string;
}

export const SAMPLE_STATEMENT_CSV = `Date,Description,Debit,Credit
2026-09-05,NETFLIX.COM,15.49,
2026-09-10,SPOTIFY USA,11.99,
2026-09-12,WHOLE FOODS GROCERY,84.20,
2026-09-14,SHELL PETROL STATION,45.00,
2026-09-18,OPENAI *CHATGPT SUBSCR,20.00,
2026-09-20,ATM CASH WITHDRAWAL,100.00,
2026-09-22,IRONWORKS GYM MONTHLY,38.00,
2026-09-30,EMPLOYER SALARY DEPOSIT,,4500.00
2026-10-05,NETFLIX.COM,15.49,
2026-10-10,SPOTIFY USA,11.99,
2026-10-18,OPENAI *CHATGPT SUBSCR,20.00,
2026-10-22,IRONWORKS GYM MONTHLY,38.00,
2026-11-05,NETFLIX.COM,17.99,
2026-11-10,SPOTIFY USA,11.99,
2026-11-18,OPENAI *CHATGPT SUBSCR,20.00,
2026-11-22,IRONWORKS GYM MONTHLY,38.00,`;

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const BRAND_CASING: Record<string, string> = {
  chatgpt: 'ChatGPT',
  openai: 'OpenAI',
  icloud: 'iCloud',
  'icloud+': 'iCloud+',
  youtube: 'YouTube',
  github: 'GitHub',
  aws: 'AWS',
  ptcl: 'PTCL',
  vpn: 'VPN',
  ai: 'AI',
  pro: 'Pro',
  tv: 'TV',
  '2tb': '2TB',
  '1tb': '1TB',
  '4k': '4K',
};

const CREDIT_PATTERNS =
  /\b(credit|credited|refund|refunded|reversal|reversed|cashback|received|deposit|salary|payroll|wages|dividend|interest earned|incoming)\b/i;

const NON_SUBSCRIPTION_PATTERNS: readonly RegExp[] = [
  /\b(atm|cash\s*withdrawal|cash\s*dispense|cdm\s*deposit|cash\s*out)\b/i,
  /\b(ibft|raast|wire\s*transfer|bank\s*transfer|fund\s*transfer|funds\s*transfer|transfer\s+to|transfer\s+from|interbank|neft|imps|rtgs|zelle|venmo|interac)\b/i,
  /\b(salary|payroll|wages|direct\s*deposit|bonus\s*payout)\b/i,
  /\b(fuel|petrol|diesel|pso\b|shell\b|total\s*parco|attock\s*petroleum|hascol|caltex|chevron|exxon|mobil\s*mart|bp\s*station|gas\s*station|filling\s*station)\b/i,
  /\b(grocery|groceries|supermarket|hypermarket|\bmart\b|imtiaz|carrefour|metro\s*cash|alfatah|al-fatah|chase\s*up|naheed|whole\s*foods|trader\s*joe|kroger|safeway|aldi|lidl|tesco|sainsbury|walmart\s*supercenter)\b/i,
];

interface RawTransaction {
  readonly dateIso: string | null;
  readonly rawDescription: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly cycleHint: BillingCycle | null;
}

function makeValidCalendarDate(year: number, month: number, day: number): CalendarDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1970 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

interface CsvHeaderMap {
  readonly delimiter: ',' | ';';
  readonly dateIdx: number;
  readonly descriptionIdx: number;
  readonly amountIdx: number;
  readonly debitIdx: number;
  readonly creditIdx: number;
  readonly currencyIdx: number;
}

function detectCsvHeader(firstLine: string): CsvHeaderMap | null {
  for (const delimiter of [',', ';'] as const) {
    const cols = parseCsvLine(firstLine, delimiter).map((c) =>
      c
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' '),
    );
    if (cols.length < 2) continue;

    const findCol = (patterns: readonly RegExp[]) =>
      cols.findIndex((col) => patterns.some((re) => re.test(col)));

    const dateIdx = findCol([
      /^date$/,
      /\b(trans|transaction|posting|posted|value|txn)\s*date\b/,
      /^posted$/,
    ]);
    const descriptionIdx = findCol([
      /^(description|merchant|narration|particulars|details|payee|memo|transaction|name)$/,
      /\b(merchant|description|narration|particulars)\b/,
    ]);
    const debitIdx = findCol([/^(debit|debits|withdrawal|withdrawals|dr|out|spent|paid out)$/]);
    const creditIdx = findCol([/^(credit|credits|deposit|deposits|cr|in|paid in)$/]);
    const amountIdx = findCol([/^(amount|value|total|transaction amount|sum|price)$/]);
    const currencyIdx = findCol([/^(currency|ccy|curr)$/]);

    if (descriptionIdx >= 0 && (amountIdx >= 0 || debitIdx >= 0)) {
      return {
        delimiter,
        dateIdx,
        descriptionIdx,
        amountIdx,
        debitIdx,
        creditIdx,
        currencyIdx,
      };
    }
  }
  return null;
}

const SUPPORTED_CURRENCY_SET = new Set<string>(CURRENCY_CODES);
const CURRENCY_CODE_PATTERN =
  'USD|PKR|EUR|GBP|AED|INR|SAR|QAR|CAD|AUD|SGD|MYR|BDT|TRY|NGN|ZAR';

function detectCurrencyFromText(text: string, fallback: CurrencyCode): CurrencyCode {
  if (/€|\bEUR\b/i.test(text)) return 'EUR';
  if (/£|\bGBP\b/i.test(text)) return 'GBP';
  if (/₹|\bINR\b/i.test(text)) return 'INR';
  if (/৳|\bBDT\b/i.test(text)) return 'BDT';
  if (/₺|\bTRY\b/i.test(text)) return 'TRY';
  if (/₦|\bNGN\b/i.test(text)) return 'NGN';
  if (/\bPKR\b|\bRs\.?\s*[\d,]/i.test(text) || /[\d,]+\s*PKR\b/i.test(text)) return 'PKR';
  if (/\bAED\b|\bDHS?\b/i.test(text)) return 'AED';
  if (/\bSAR\b/i.test(text)) return 'SAR';
  if (/\bQAR\b/i.test(text)) return 'QAR';
  if (/\bCAD\b|CA\$/i.test(text)) return 'CAD';
  if (/\bAUD\b|A\$/i.test(text)) return 'AUD';
  if (/\bSGD\b|S\$/i.test(text)) return 'SGD';
  if (/\bMYR\b|\bRM\s*[\d,]/i.test(text)) return 'MYR';
  if (/\bZAR\b/i.test(text)) return 'ZAR';
  if (/\$|\bUSD\b/i.test(text)) return 'USD';
  return fallback;
}

function parseExplicitCurrencyCode(raw: string, fallback: CurrencyCode): CurrencyCode {
  const upper = raw.trim().toUpperCase();
  if (SUPPORTED_CURRENCY_SET.has(upper)) {
    return upper as CurrencyCode;
  }
  return detectCurrencyFromText(raw, fallback);
}

/**
 * Scans raw statement lines to see if any numeric DD/MM or MM/DD date unambiguously
 * proves the date order (e.g., 25/11 -> DMY, 11/25 -> MDY).
 */
function inferEffectiveDateOrder(
  lines: readonly string[],
  preferred: DateOrder,
): { readonly order: DateOrder; readonly autoSwitched: boolean } {
  let dmyEvidence = 0;
  let mdyEvidence = 0;

  const numDateRegex = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g;

  for (const line of lines) {
    // Skip ISO dates (YYYY-MM-DD) by masking them first
    const withoutIso = line.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
    let match: RegExpExecArray | null;
    while ((match = numDateRegex.exec(withoutIso)) !== null) {
      const first = Number.parseInt(match[1], 10);
      const second = Number.parseInt(match[2], 10);
      if (first > 12 && first <= 31 && second >= 1 && second <= 12) {
        dmyEvidence += 1;
      } else if (second > 12 && second <= 31 && first >= 1 && first <= 12) {
        mdyEvidence += 1;
      }
    }
  }

  if (dmyEvidence > 0 && mdyEvidence === 0) {
    return { order: 'DMY', autoSwitched: preferred !== 'DMY' };
  }
  if (mdyEvidence > 0 && dmyEvidence === 0) {
    return { order: 'MDY', autoSwitched: preferred !== 'MDY' };
  }
  return { order: preferred, autoSwitched: false };
}

function extractDateFromText(text: string, dateOrder: DateOrder): CalendarDate | null {
  // 1. ISO YYYY-MM-DD
  const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (isoMatch) {
    const dt = makeValidCalendarDate(
      Number.parseInt(isoMatch[1], 10),
      Number.parseInt(isoMatch[2], 10),
      Number.parseInt(isoMatch[3], 10),
    );
    if (dt) return dt;
  }

  // 2. DD-Mon-YYYY or DD-Mon-YY (with dash or space)
  const dMonYMatch = /\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2}|\d{4})\b/.exec(text);
  if (dMonYMatch) {
    const month = MONTH_NAME_MAP[dMonYMatch[2].toLowerCase()];
    if (month) {
      const rawYear = Number.parseInt(dMonYMatch[3], 10);
      const year = dMonYMatch[3].length === 2 ? 2000 + rawYear : rawYear;
      const dt = makeValidCalendarDate(year, month, Number.parseInt(dMonYMatch[1], 10));
      if (dt) return dt;
    }
  }

  // 3. "Mon DD, YYYY" or "Mon DD YYYY"
  const monDYMatch = /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
  if (monDYMatch) {
    const month = MONTH_NAME_MAP[monDYMatch[1].toLowerCase()];
    if (month) {
      const dt = makeValidCalendarDate(
        Number.parseInt(monDYMatch[3], 10),
        month,
        Number.parseInt(monDYMatch[2], 10),
      );
      if (dt) return dt;
    }
  }

  // 4. Numeric DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, MM-DD-YYYY (2- or 4-digit year)
  const numMatch = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/.exec(text);
  if (numMatch) {
    const first = Number.parseInt(numMatch[1], 10);
    const second = Number.parseInt(numMatch[2], 10);
    const rawYear = Number.parseInt(numMatch[3], 10);
    const year = numMatch[3].length === 2 ? 2000 + rawYear : rawYear;

    // Respect obvious single-value overrides too
    const useMdy = second > 12 ? true : first > 12 ? false : dateOrder === 'MDY';
    const month = useMdy ? first : second;
    const day = useMdy ? second : first;
    const dt = makeValidCalendarDate(year, month, day);
    if (dt) return dt;
  }

  return null;
}

interface ParsedAmountCell {
  readonly amountMinorUnits: number;
  readonly signed: 'negative' | 'positive' | 'neutral';
  readonly marker: 'dr' | 'cr' | null;
  readonly currency: CurrencyCode;
}

function parseAmountCell(raw: string, fallbackCurrency: CurrencyCode): ParsedAmountCell | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isCr = /\bCR\b/i.test(trimmed);
  const isDr = /\bDR\b/i.test(trimmed);
  const isParenNegative = /^\(.*\)$/.test(trimmed);
  const leadStripRe = new RegExp(`^(?:${CURRENCY_CODE_PATTERN}|Rs\\.?|RM|CA\\$|A\\$|S\\$|[$€£₹৳₺₦])\\s*`, 'i');
  const hasLeadingMinus = /^[-−]/.test(trimmed.replace(leadStripRe, ''));
  const hasLeadingPlus = /^\+/.test(trimmed.replace(leadStripRe, ''));

  const numMatch = trimmed.match(/([\d,]+(?:\.\d{1,2})?)/);
  if (!numMatch) return null;
  const minor = parseDecimalToMinorUnits(numMatch[1]);
  if (minor === null || minor <= 0) return null;

  const currency = detectCurrencyFromText(trimmed, fallbackCurrency);
  const signed: 'negative' | 'positive' | 'neutral' =
    isParenNegative || hasLeadingMinus ? 'negative' : hasLeadingPlus ? 'positive' : 'neutral';

  return {
    amountMinorUnits: minor,
    signed,
    marker: isCr ? 'cr' : isDr ? 'dr' : null,
    currency,
  };
}

function extractAmountFromFreeformLine(
  line: string,
  fallbackCurrency: CurrencyCode,
): { readonly amountMinorUnits: number; readonly currency: CurrencyCode; readonly isCredit: boolean } | null {
  // Ignore obvious credit markers right next to amount or in SMS text
  const hasCrMarker = /\bCR\b/i.test(line) || CREDIT_PATTERNS.test(line);

  // Prefix currency symbol/code: "$15.49", "PKR 5,850.00", "Rs. 1,100", "-$11.99"
  // Require sign not to be attached to a preceding word (e.g. "ICLOUD+ $2.99" is not "+$2.99")
  const prefixRe = new RegExp(
    `(?:^|[\\s|,;:(])([+-]?)\\s*(?:([$€£₹৳₺₦]|CA\\$|A\\$|S\\$)|\\b(${CURRENCY_CODE_PATTERN}|Rs\\.?|RM))\\s*([+-]?)\\s*([\\d,]+(?:\\.\\d{1,2})?)(?:\\s*(DR|CR)\\b)?`,
    'i',
  );
  const prefixMatch = line.match(prefixRe);
  if (prefixMatch) {
    const minor = parseDecimalToMinorUnits(prefixMatch[5]);
    if (minor !== null && minor > 0) {
      const signStr = prefixMatch[1] || prefixMatch[4];
      const drcr = prefixMatch[6]?.toUpperCase();
      const isCredit = drcr === 'CR' || (drcr !== 'DR' && (signStr === '+' || hasCrMarker));
      return {
        amountMinorUnits: minor,
        currency: detectCurrencyFromText(prefixMatch[0], fallbackCurrency),
        isCredit,
      };
    }
  }

  // Suffix currency code: "5,850.00 PKR", "15.49 USD", "1,200 Rs"
  const suffixRe = new RegExp(
    `(?:^|[\\s|,;:(])([+-]?)\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*(${CURRENCY_CODE_PATTERN}|Rs\\.?|RM|[$€£₹৳₺₦])(?:\\s*(DR|CR)\\b)?`,
    'i',
  );
  const suffixMatch = line.match(suffixRe);
  if (suffixMatch) {
    const minor = parseDecimalToMinorUnits(suffixMatch[2]);
    if (minor !== null && minor > 0) {
      const drcr = suffixMatch[4]?.toUpperCase();
      const isCredit = drcr === 'CR' || (drcr !== 'DR' && (suffixMatch[1] === '+' || hasCrMarker));
      return {
        amountMinorUnits: minor,
        currency: detectCurrencyFromText(suffixMatch[0], fallbackCurrency),
        isCredit,
      };
    }
  }

  // Plain decimal with optional Dr/Cr: "1,100.00 Dr" or "-15.99"
  const plainMatch = line.match(/(?:^|[\s|,;:(])([+-]?)\b([\d,]+\.\d{2})\b(?:\s*(DR|CR)\b)?/i);
  if (plainMatch) {
    const minor = parseDecimalToMinorUnits(plainMatch[2]);
    if (minor !== null && minor > 0) {
      const drcr = plainMatch[3]?.toUpperCase();
      const isCredit = drcr === 'CR' || (drcr !== 'DR' && (plainMatch[1] === '+' || hasCrMarker));
      return {
        amountMinorUnits: minor,
        currency: detectCurrencyFromText(line, fallbackCurrency),
        isCredit,
      };
    }
  }

  return null;
}

function isNonSubscriptionDescription(description: string): boolean {
  if (CREDIT_PATTERNS.test(description)) return true;
  return NON_SUBSCRIPTION_PATTERNS.some((re) => re.test(description));
}

function extractSmsMerchantClause(raw: string): string {
  // Card SMS pattern: "PKR 5,850.00 charged on card ending 1234 at OPENAI *CHATGPT SUBSCR on 18-11-2026"
  const smsAtMatch = /\b(?:charged|spent|debited|used|paid|purchase|transaction)\b.*?\bat\s+(.+?)(?:\s+\bon\s+\d|\s+\bfor\s+|\s+\bvia\s+|\s*\.|$)/i.exec(
    raw,
  );
  if (smsAtMatch && smsAtMatch[1].trim().length >= 2) {
    return smsAtMatch[1].trim();
  }
  return raw;
}

/**
 * Normalizes a raw bank statement / card SMS merchant string:
 * uppercases, strips card numbers, reference numbers, dates, amounts, city/country suffixes,
 * "*", POS/PURCHASE/ONLINE noise, and payment processor prefixes (PAYPAL *, SQ *, GOOGLE *, etc.).
 */
export function normalizeMerchantText(raw: string): {
  readonly normalizedUpper: string;
  readonly displayName: string;
  readonly catalogEntry: ServiceCatalogEntry | null;
} {
  const clause = extractSmsMerchantClause(raw);

  // Strip dates, currency amounts, card & ref numbers first
  let cleaned = clause
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
    .replace(
      /\b\d{1,2}[-\s](?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[-\s](?:\d{2}|\d{4})\b/gi,
      ' ',
    )
    .replace(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi,
      ' ',
    )
    .replace(/\b(?:card\s*(?:ending|no\.?|number)?\s*(?:in\s*)?[*xX#]*\d{4}|[*xX]{4,}\d{4})\b/gi, ' ')
    .replace(/\b(?:ref|txn|auth|id|trace|inv)\s*[:#-]?\s*[a-z0-9-]{4,}\b/gi, ' ')
    .replace(
      new RegExp(`(?:[$€£₹৳₺₦]|CA\\$|A\\$|S\\$|${CURRENCY_CODE_PATTERN}|Rs\\.?|RM)\\s*[+-]?[\\d,]+(?:\\.\\d{1,2})?`, 'gi'),
      ' ',
    )
    .replace(
      new RegExp(`[+-]?[\\d,]+(?:\\.\\d{1,2})?\\s*(?:${CURRENCY_CODE_PATTERN}|Rs\\.?|RM)\\b`, 'gi'),
      ' ',
    )
    .replace(/\b[\d,]+\.\d{2}\b/g, ' ')
    .replace(/\b(?:DR|CR)\b/gi, ' ')
    .toUpperCase();

  // Check catalog BEFORE stripping processor prefixes like "GOOGLE *" so "GOOGLE *YOUTUBE" matches YouTube
  const preStripMatch = matchCatalogByMerchant(cleaned);

  // Strip processor prefixes (PAYPAL *, SQ *, GOOGLE *, STRIPE *, PADDLE *, FS *)
  cleaned = cleaned
    .replace(/^\s*(?:PAYPAL|PP|SQ|SQUARE|STRIPE|PADDLE(?:\.NET)?|FS|SP|TST|CLD|GOOGLE)\s*\*\s*/g, '')
    .replace(/\b(?:PAYPAL|SQ|STRIPE)\s*\*\s*/g, ' ')
    .replace(/\*/g, ' ')
    .replace(/\b(?:POS|PURCHASE|ONLINE|DEBIT|CARD|PAYMENT|AUTOPAY|RECURRING|SUBSCR|SUBSCRIPTION|BILLING|MONTHLY|ANNUAL|YEARLY|WEEKLY|MEMBERSHIP)\b/g, ' ')
    .replace(/\b\d{5,}\b/g, ' ')
    // Strip trailing city / state / country codes
    .replace(
      /\b(?:SAN FRANCISCO|LOS GATOS|MENLO PARK|MOUNTAIN VIEW|REDMOND|SEATTLE|NEW YORK|LONDON|DUBLIN|AMSTERDAM|KARACHI|LAHORE|ISLAMABAD|RAWALPINDI|DUBAI|SINGAPORE)\b/g,
      ' ',
    )
    .replace(/\b(?:USA|US|UK|GB|CA|NY|TX|WA|PK|PAK|AE|UAE|IE|IRL|NL|DE|FR|SG)\s*$/g, ' ')
    .replace(/[|,;:\-–—/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const catalogEntry = preStripMatch ?? matchCatalogByMerchant(cleaned);
  if (catalogEntry) {
    return {
      normalizedUpper: catalogEntry.name.toUpperCase(),
      displayName: catalogEntry.name,
      catalogEntry,
    };
  }

  const displayName = cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (BRAND_CASING[lower]) return BRAND_CASING[lower];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  return {
    normalizedUpper: cleaned,
    displayName,
    catalogEntry: null,
  };
}

function detectCycleHintFromText(text: string): BillingCycle | null {
  if (/\b(annual|yearly|\/yr|12\s*months?)\b/i.test(text)) return 'yearly';
  if (/\b(quarterly|\/qtr|3\s*months?)\b/i.test(text)) return 'quarterly';
  if (/\b(weekly|\/wk)\b/i.test(text)) return 'weekly';
  return null;
}

function parseRawTransactions(
  rawText: string,
  dateOrder: DateOrder,
  defaultCurrency: CurrencyCode,
): { readonly transactions: RawTransaction[]; readonly skippedCount: number } {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return { transactions: [], skippedCount: 0 };
  }

  const header = detectCsvHeader(rawLines[0]);
  const transactions: RawTransaction[] = [];
  let skippedCount = 0;

  if (header) {
    const dataRows = rawLines.slice(1).map((line) => parseCsvLine(line, header.delimiter));

    // If using a single Amount column (no separate Debit/Credit), detect whether debits are negative
    let negativeCount = 0;
    let positiveCount = 0;
    if (header.debitIdx < 0 && header.amountIdx >= 0) {
      for (const cols of dataRows) {
        const parsed = parseAmountCell(cols[header.amountIdx] ?? '', defaultCurrency);
        if (!parsed) continue;
        if (parsed.signed === 'negative') negativeCount += 1;
        else positiveCount += 1;
      }
    }
    const usesNegativeDebits = header.debitIdx < 0 && negativeCount > 0 && positiveCount > 0;

    for (const cols of dataRows) {
      const desc = (cols[header.descriptionIdx] ?? '').trim();
      if (!desc) continue;

      if (isNonSubscriptionDescription(desc)) {
        skippedCount += 1;
        continue;
      }

      const rowCurrency =
        header.currencyIdx >= 0 && cols[header.currencyIdx]
          ? parseExplicitCurrencyCode(cols[header.currencyIdx], defaultCurrency)
          : defaultCurrency;

      let amountMinorUnits: number | null = null;
      let currency: CurrencyCode = rowCurrency;

      if (header.debitIdx >= 0) {
        const debitParsed = parseAmountCell(cols[header.debitIdx] ?? '', rowCurrency);
        const creditParsed =
          header.creditIdx >= 0
            ? parseAmountCell(cols[header.creditIdx] ?? '', rowCurrency)
            : null;

        if (!debitParsed) {
          if (creditParsed) skippedCount += 1;
          continue;
        }
        amountMinorUnits = debitParsed.amountMinorUnits;
        currency = debitParsed.currency;
      } else if (header.amountIdx >= 0) {
        const amtParsed = parseAmountCell(cols[header.amountIdx] ?? '', rowCurrency);
        if (!amtParsed) continue;
        if (amtParsed.marker === 'cr') {
          skippedCount += 1;
          continue;
        }
        if (usesNegativeDebits && amtParsed.signed !== 'negative' && amtParsed.marker !== 'dr') {
          skippedCount += 1;
          continue;
        }
        amountMinorUnits = amtParsed.amountMinorUnits;
        currency = amtParsed.currency;
      }

      if (amountMinorUnits === null || amountMinorUnits <= 0) continue;

      const dateCell = header.dateIdx >= 0 ? cols[header.dateIdx] ?? '' : '';
      const parsedDate =
        extractDateFromText(dateCell, dateOrder) ?? extractDateFromText(desc, dateOrder);
      const dateIso = parsedDate ? toIsoDate(parsedDate.year, parsedDate.month, parsedDate.day) : null;

      transactions.push({
        dateIso,
        rawDescription: desc,
        amountMinorUnits,
        currency,
        cycleHint: detectCycleHintFromText(desc),
      });
    }

    return { transactions, skippedCount };
  }

  // Fallback: line-by-line parsing (card SMS, pasted bank lines)
  for (const line of rawLines) {
    if (line.length < 4) continue;
    if (isNonSubscriptionDescription(line)) {
      skippedCount += 1;
      continue;
    }

    const extractedAmount = extractAmountFromFreeformLine(line, defaultCurrency);
    if (!extractedAmount) continue;
    if (extractedAmount.isCredit) {
      skippedCount += 1;
      continue;
    }

    const parsedDate = extractDateFromText(line, dateOrder);
    const dateIso = parsedDate ? toIsoDate(parsedDate.year, parsedDate.month, parsedDate.day) : null;

    transactions.push({
      dateIso,
      rawDescription: line,
      amountMinorUnits: extractedAmount.amountMinorUnits,
      currency: extractedAmount.currency,
      cycleHint: detectCycleHintFromText(line),
    });
  }

  return { transactions, skippedCount };
}

function detectRepeatCycleFromGaps(gaps: readonly number[]): BillingCycle | null {
  if (gaps.length === 0) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  if (median >= 5 && median <= 9) return 'weekly';
  if (median >= 26 && median <= 34) return 'monthly';
  if (median >= 84 && median <= 98) return 'quarterly';
  if (median >= 355 && median <= 375) return 'yearly';
  return null;
}

function isWithinAmountTolerance(a: number, b: number, maxRatio = 0.15): boolean {
  const high = Math.max(a, b);
  if (high <= 0) return false;
  return Math.abs(a - b) / high <= maxRatio;
}

function normalizeExistingName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findExactExistingMatch(
  existingSubscriptions: readonly Subscription[],
  catalogEntry: ServiceCatalogEntry | null,
  normalizedUpper: string,
): Subscription | null {
  if (catalogEntry) {
    const byCatalogId = existingSubscriptions.find((s) => s.catalogId === catalogEntry.id);
    if (byCatalogId) return byCatalogId;

    const catalogNameNorm = normalizeExistingName(catalogEntry.name);
    const byExactCatalogName = existingSubscriptions.find(
      (s) => normalizeExistingName(s.name) === catalogNameNorm,
    );
    if (byExactCatalogName) return byExactCatalogName;
  }

  const targetNorm = normalizeExistingName(normalizedUpper);
  if (!targetNorm) return null;
  return (
    existingSubscriptions.find((s) => normalizeExistingName(s.name) === targetNorm) ?? null
  );
}

/**
 * Pure, offline Statement Import V2 parser.
 * Supports CSV (comma/semicolon, header detection, debit/credit columns, quoted fields)
 * and pasted bank lines / card SMS alerts. Never uploads anything.
 */
export function parseStatementImport(
  rawText: string,
  existingSubscriptions: readonly Subscription[],
  options?: ParseStatementOptions,
): StatementImportResult {
  const todayIso = options?.todayIso ?? getTodayIso();
  const preferredDateOrder: DateOrder = options?.preferredDateOrder ?? 'DMY';
  const defaultCurrency: CurrencyCode = options?.defaultCurrency ?? 'USD';

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const { order: effectiveDateOrder, autoSwitched } = inferEffectiveDateOrder(
    rawLines,
    preferredDateOrder,
  );

  const { transactions, skippedCount: initialSkipped } = parseRawTransactions(
    rawText,
    effectiveDateOrder,
    defaultCurrency,
  );

  let skippedCount = initialSkipped;

  interface MerchantGroup {
    readonly key: string;
    readonly displayName: string;
    readonly normalizedUpper: string;
    readonly catalogEntry: ServiceCatalogEntry | null;
    readonly items: RawTransaction[];
  }

  const groups = new Map<string, MerchantGroup>();

  for (const tx of transactions) {
    const { normalizedUpper, displayName, catalogEntry } = normalizeMerchantText(tx.rawDescription);
    if (!displayName || displayName.length < 2) continue;

    const key = catalogEntry ? `cat:${catalogEntry.id}` : `raw:${normalizedUpper}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(tx);
    } else {
      groups.set(key, {
        key,
        displayName,
        normalizedUpper,
        catalogEntry,
        items: [tx],
      });
    }
  }

  const subscriptions: StatementImportCandidate[] = [];
  const oneOffCharges: StatementImportCandidate[] = [];
  let idxCounter = 0;

  for (const group of groups.values()) {
    // Sort chronologically (items without date stay at the end in input order)
    const sorted = [...group.items].sort((a, b) => {
      if (a.dateIso && b.dateIso) return a.dateIso.localeCompare(b.dateIso);
      if (a.dateIso) return -1;
      if (b.dateIso) return 1;
      return 0;
    });

    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];

    // Check consecutive date gaps for repeat detection
    const dated = sorted.filter((t): t is RawTransaction & { readonly dateIso: string } =>
      Boolean(t.dateIso),
    );
    const gaps: number[] = [];
    for (let i = 1; i < dated.length; i++) {
      const gap = daysUntilRenewal(dated[i].dateIso, dated[i - 1].dateIso);
      if (gap > 0) gaps.push(gap);
    }

    const detectedCycle = detectRepeatCycleFromGaps(gaps);

    // Check amount consistency across charges
    let consistentAmounts = true;
    let irregularSteps = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (!isWithinAmountTolerance(sorted[i - 1].amountMinorUnits, sorted[i].amountMinorUnits, 0.15)) {
        consistentAmounts = false;
        irregularSteps += 1;
      }
    }

    // Check if an earlier charge was strictly lower than the latest charge (price hike!)
    let previousAmountMinorUnits: number | undefined;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i].amountMinorUnits < latest.amountMinorUnits) {
        previousAmountMinorUnits = sorted[i].amountMinorUnits;
        break;
      }
    }

    // Variable bill filter: non-catalog merchant with 2+ charges whose amount changes >15% every month
    // (except a single clean step-up where all other charges match)
    if (
      !group.catalogEntry &&
      sorted.length >= 2 &&
      !consistentAmounts &&
      (sorted.length === 2 || irregularSteps >= 2 || previousAmountMinorUnits === undefined)
    ) {
      skippedCount += sorted.length;
      continue;
    }

    // Determine confidence and cycle
    let confidence: ImportConfidence;
    let cycle: BillingCycle;

    if (sorted.length >= 2 && detectedCycle && (consistentAmounts || group.catalogEntry)) {
      confidence = 'high';
      cycle = detectedCycle;
    } else if (group.catalogEntry) {
      confidence = 'likely';
      cycle = latest.cycleHint ?? group.catalogEntry.defaultCycle;
    } else {
      confidence = 'oneOff';
      cycle = latest.cycleHint ?? 'monthly';
    }

    const dateEstimated = latest.dateIso === null;
    const lastChargeDate = latest.dateIso ?? todayIso;
    const startDate = earliest.dateIso ?? lastChargeDate;
    const billingDay = parseIsoDate(lastChargeDate)?.day ?? parseIsoDate(todayIso)?.day ?? 1;

    // Step lastChargeDate forward by cycle until today or later
    const nextBillingDate = dateEstimated
      ? stepBillingDate(todayIso, cycle, billingDay)
      : advanceOverdueBillingDate(
          stepBillingDate(lastChargeDate, cycle, billingDay),
          cycle,
          todayIso,
          billingDay,
        );

    const matchedExisting = findExactExistingMatch(
      existingSubscriptions,
      group.catalogEntry,
      group.normalizedUpper,
    );

    const detectedPriceHikeMinorUnits =
      matchedExisting &&
      matchedExisting.currency === latest.currency &&
      latest.amountMinorUnits > matchedExisting.amountMinorUnits
        ? latest.amountMinorUnits - matchedExisting.amountMinorUnits
        : previousAmountMinorUnits !== undefined
          ? latest.amountMinorUnits - previousAmountMinorUnits
          : 0;

    const category = group.catalogEntry
      ? group.catalogEntry.category
      : inferCategoryFromMerchantName(group.displayName);

    const candidate: StatementImportCandidate = {
      tempId: `imp_${idxCounter++}_${group.key.replace(/[^a-z0-9]/gi, '')}`,
      name: group.displayName,
      ...(group.catalogEntry ? { catalogId: group.catalogEntry.id } : {}),
      amountMinorUnits: latest.amountMinorUnits,
      ...(previousAmountMinorUnits !== undefined ? { previousAmountMinorUnits } : {}),
      currency: latest.currency,
      cycle,
      category,
      lastChargeDate,
      nextBillingDate,
      billingDay,
      startDate,
      dateEstimated,
      confidence,
      chargeCount: sorted.length,
      matchedExistingId: matchedExisting?.id ?? null,
      detectedPriceHikeMinorUnits,
    };

    if (confidence === 'oneOff') {
      oneOffCharges.push(candidate);
    } else {
      subscriptions.push(candidate);
    }
  }

  // Sort high confidence before likely, then descending amount
  subscriptions.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === 'high' ? -1 : 1;
    }
    return b.amountMinorUnits - a.amountMinorUnits;
  });

  oneOffCharges.sort((a, b) => b.amountMinorUnits - a.amountMinorUnits);

  return {
    subscriptions,
    oneOffCharges,
    detectedDateOrder: effectiveDateOrder,
    dateOrderAutoSwitched: autoSwitched,
    skippedCount,
  };
}
