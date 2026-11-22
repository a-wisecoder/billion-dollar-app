import type { CurrencyCode } from '../../cashflow/domain/subscription';

const EUROZONE_TIMEZONES = new Set<string>([
  'Europe/Amsterdam',
  'Europe/Andorra',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Busingen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Lisbon',
  'Europe/Ljubljana',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Monaco',
  'Europe/Nicosia',
  'Europe/Paris',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/San_Marino',
  'Europe/Tallinn',
  'Europe/Vatican',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Zagreb',
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Atlantic/Azores',
]);

const EUROZONE_REGIONS = new Set<string>([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
]);

/**
 * Preselects the user's most likely currency from their browser time zone and language:
 * Asia/Karachi -> PKR, Asia/Dubai -> AED, Europe/London -> GBP, eurozone -> EUR, else USD.
 */
export function detectCurrencyFromLocale(
  timeZone?: string,
  language?: string,
): CurrencyCode {
  const tz =
    timeZone ??
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : '');
  const lang =
    language ??
    (typeof navigator !== 'undefined' ? navigator.language : '');

  if (tz === 'Asia/Karachi') return 'PKR';
  if (tz === 'Asia/Dubai') return 'AED';
  if (tz === 'Europe/London') return 'GBP';
  if (tz && EUROZONE_TIMEZONES.has(tz)) return 'EUR';
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'INR';
  if (tz === 'Asia/Riyadh') return 'SAR';
  if (tz === 'Asia/Qatar') return 'QAR';
  if (tz === 'Asia/Singapore') return 'SGD';
  if (tz === 'Asia/Kuala_Lumpur' || tz === 'Asia/Kuching') return 'MYR';
  if (tz === 'Asia/Dhaka') return 'BDT';
  if (tz === 'Europe/Istanbul' || tz === 'Asia/Istanbul') return 'TRY';
  if (tz === 'Africa/Lagos') return 'NGN';
  if (tz === 'Africa/Johannesburg') return 'ZAR';
  if (tz.startsWith('Australia/')) return 'AUD';
  if (
    tz === 'America/Toronto' ||
    tz === 'America/Vancouver' ||
    tz === 'America/Edmonton' ||
    tz === 'America/Winnipeg' ||
    tz === 'America/Halifax' ||
    tz === 'America/Montreal'
  ) {
    return 'CAD';
  }

  const normalizedLang = lang.replace('_', '-');
  const region = normalizedLang.split('-')[1]?.toUpperCase();
  if (region === 'PK') return 'PKR';
  if (region === 'AE') return 'AED';
  if (region === 'GB') return 'GBP';
  if (region && EUROZONE_REGIONS.has(region)) return 'EUR';
  if (region === 'IN') return 'INR';
  if (region === 'SA') return 'SAR';
  if (region === 'QA') return 'QAR';
  if (region === 'CA') return 'CAD';
  if (region === 'AU') return 'AUD';
  if (region === 'SG') return 'SGD';
  if (region === 'MY') return 'MYR';
  if (region === 'BD') return 'BDT';
  if (region === 'TR') return 'TRY';
  if (region === 'NG') return 'NGN';
  if (region === 'ZA') return 'ZAR';

  return 'USD';
}

/**
 * Infers default numeric date ordering (DMY vs MDY) from browser locale.
 */
export function detectDefaultDateOrder(language?: string): 'DMY' | 'MDY' {
  const lang = (
    language ??
    (typeof navigator !== 'undefined' ? navigator.language : '')
  ).replace('_', '-');
  const region = lang.split('-')[1]?.toUpperCase();
  if (region === 'US' || region === 'PH' || region === 'FM' || region === 'PW' || region === 'MH') {
    return 'MDY';
  }
  return 'DMY';
}
