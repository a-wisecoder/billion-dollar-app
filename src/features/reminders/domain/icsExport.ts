import { addDaysIso, getTodayIso, parseIsoDate } from '../../../core/utils/dateMath';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import { getCatalogEntryById } from '../../catalog/domain/serviceCatalog';
import {
  BILLING_CYCLES,
  ZERO_DECIMAL_DISPLAY_CURRENCIES,
  type Subscription,
  type VaultSettings,
} from '../../cashflow/domain/subscription';

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;
const UTF8_ENCODER = new TextEncoder();

/**
 * Formats a YYYY-MM-DD local date into an RFC 5545 DATE value (YYYYMMDD).
 */
export function formatIcsDate(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return isoDate.replace(/-/g, '').slice(0, 8);
  }
  const yyyy = String(parsed.year).padStart(4, '0');
  const mm = String(parsed.month).padStart(2, '0');
  const dd = String(parsed.day).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Formats an ISO timestamp or YYYY-MM-DD string into an RFC 5545 UTC DTSTAMP (YYYYMMDDTHHMMSSZ).
 */
export function formatIcsUtcTimestamp(nowIso?: string): string {
  if (nowIso && /^\d{4}-\d{2}-\d{2}$/.test(nowIso)) {
    return `${formatIcsDate(nowIso)}T000000Z`;
  }
  const ms = nowIso ? Date.parse(nowIso) : Date.now();
  const dt = Number.isFinite(ms) ? new Date(ms) : new Date();
  const yyyy = String(dt.getUTCFullYear()).padStart(4, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const min = String(dt.getUTCMinutes()).padStart(2, '0');
  const ss = String(dt.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

/**
 * Escapes RFC 5545 TEXT values: backslashes, semicolons, commas, and newlines.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Folds a single RFC 5545 content line so no line exceeds 75 UTF-8 octets.
 * Never splits multi-byte UTF-8 characters. Continuation lines begin with a single space.
 */
export function foldIcsLine(line: string, maxOctets: number = MAX_LINE_OCTETS): string {
  if (UTF8_ENCODER.encode(line).length <= maxOctets) {
    return line;
  }

  const outputLines: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of line) {
    const chBytes = UTF8_ENCODER.encode(ch).length;
    if (currentBytes + chBytes > maxOctets && current.length > 0) {
      outputLines.push(current);
      current = ` ${ch}`;
      currentBytes = 1 + chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }

  if (current.length > 0) {
    outputLines.push(current);
  }

  return outputLines.join(CRLF);
}

/**
 * Computes the VALARM TRIGGER duration for an all-day event (midnight local time)
 * so the alarm fires at 09:00 local time `leadDays` days before renewal.
 * 1 day -> -PT15H, 2 days -> -PT39H, 3 days -> -PT63H.
 */
export function triggerForLeadDays(leadDays: number): string {
  const safeDays = Math.max(1, Math.round(leadDays));
  const hoursBeforeMidnight = 24 * safeDays - 9;
  return `-PT${hoursBeforeMidnight}H`;
}

/**
 * Builds the RFC 5545 RRULE value for a subscription, or null for free trials.
 * For billingDay 29, 30, or 31, uses BYMONTHDAY=28..billingDay;BYSETPOS=-1
 * so short months bill on their last day instead of being skipped.
 */
export function buildRrule(sub: Subscription): string | null {
  if (sub.isFreeTrial) {
    return null;
  }

  const parsedStart = parseIsoDate(sub.nextBillingDate);
  const anchorDay = sub.billingDay ?? parsedStart?.day ?? 1;

  const buildMonthEndSuffix = (): string => {
    if (anchorDay < 29 || anchorDay > 31) return '';
    const days: number[] = [];
    for (let d = 28; d <= anchorDay; d++) {
      days.push(d);
    }
    return `;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
  };

  switch (sub.cycle) {
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'monthly':
      return `FREQ=MONTHLY${buildMonthEndSuffix()}`;
    case 'quarterly':
      return `FREQ=MONTHLY;INTERVAL=3${buildMonthEndSuffix()}`;
    case 'yearly': {
      const monthPart = parsedStart ? `;BYMONTH=${parsedStart.month}` : '';
      return `FREQ=YEARLY${monthPart}${buildMonthEndSuffix()}`;
    }
  }
}

function resolveCancelUrl(sub: Subscription): string | undefined {
  if (sub.cancelUrl && sub.cancelUrl.trim().length > 0) {
    return sub.cancelUrl.trim();
  }
  if (sub.catalogId) {
    return getCatalogEntryById(sub.catalogId)?.cancelUrl;
  }
  return undefined;
}

function formatSubscriptionAmountForIcs(sub: Subscription): string {
  return formatMinorUnits(sub.amountMinorUnits, sub.currency, {
    showDecimals: !ZERO_DECIMAL_DISPLAY_CURRENCIES.has(sub.currency),
  });
}

function buildAlarmLines(trigger: string, description: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${trigger}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VALARM',
  ];
}

/**
 * Generates an RFC 5545 (.ics) calendar string for all active (non-archived) subscriptions.
 */
export function buildIcs(
  subscriptions: readonly Subscription[],
  settings: Pick<VaultSettings, 'reminderLeadDays'>,
  nowIso: string = getTodayIso(),
): string {
  const dtStamp = formatIcsUtcTimestamp(nowIso);
  const active = subscriptions.filter((sub) => !sub.isArchived);
  const leadDays = settings.reminderLeadDays ?? 2;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VaultFlow//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Subscription renewals',
  ];

  for (const sub of active) {
    const amountLabel = formatSubscriptionAmountForIcs(sub);
    const dtStart = formatIcsDate(sub.nextBillingDate);
    const dtEnd = formatIcsDate(addDaysIso(sub.nextBillingDate, 1));
    const summary = sub.isFreeTrial
      ? `${sub.name} free trial ends — cancel or pay ${amountLabel}`
      : `${sub.name} renews · ${amountLabel}`;

    const cycleLabel = BILLING_CYCLES[sub.cycle].label;
    const cancelUrl = resolveCancelUrl(sub);
    const descriptionParts: string[] = [
      sub.isFreeTrial
        ? `Free trial (${cycleLabel} after trial: ${amountLabel})`
        : `Billing cycle: ${cycleLabel} (${amountLabel})`,
    ];
    if (cancelUrl) {
      descriptionParts.push(`Cancel or manage: ${cancelUrl}`);
    }
    if (sub.notes && sub.notes.trim().length > 0) {
      descriptionParts.push(`Notes: ${sub.notes.trim()}`);
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${sub.id}@vaultflow`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);

    const rrule = buildRrule(sub);
    if (rrule) {
      lines.push(`RRULE:${rrule}`);
    }

    const primaryTrigger = triggerForLeadDays(leadDays);
    lines.push(...buildAlarmLines(primaryTrigger, summary));

    if (sub.isFreeTrial) {
      // Trials get a second alarm the day before (09:00 local).
      // If leadDays is already 1 (-PT15H), add a morning-of alarm (PT9H) so trials always have 2 alarms.
      const dayBeforeTrigger = triggerForLeadDays(1);
      const secondTrigger = primaryTrigger === dayBeforeTrigger ? 'PT9H' : dayBeforeTrigger;
      const secondDesc =
        secondTrigger === dayBeforeTrigger
          ? `Tomorrow: ${summary}`
          : `Today: ${summary}`;
      lines.push(...buildAlarmLines(secondTrigger, secondDesc));
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map((line) => foldIcsLine(line)).join(CRLF) + CRLF;
}

export function slugifyIcsFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug ? `${slug}-renewal.ics` : 'subscription-renewal.ics';
}
