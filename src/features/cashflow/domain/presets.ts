import { addDaysIso, getTodayIso } from '../../../core/utils/dateMath';
import type {
  BillingCycle,
  CurrencyCode,
  Subscription,
  SubscriptionCategory,
} from './subscription';

export interface ServicePreset {
  readonly name: string;
  readonly category: SubscriptionCategory;
  readonly cycle: BillingCycle;
  readonly suggestedAmountMinorUnits: number;
  readonly currency: CurrencyCode;
}

export const SERVICE_PRESETS: readonly ServicePreset[] = [
  {
    name: 'Netflix',
    category: 'streaming',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 1599,
    currency: 'USD',
  },
  {
    name: 'Spotify',
    category: 'streaming',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 1199,
    currency: 'USD',
  },
  {
    name: 'ChatGPT Plus',
    category: 'aiAndCloud',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 2000,
    currency: 'USD',
  },
  {
    name: 'Claude Pro',
    category: 'aiAndCloud',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 2000,
    currency: 'USD',
  },
  {
    name: 'iCloud+',
    category: 'aiAndCloud',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 299,
    currency: 'USD',
  },
  {
    name: 'AWS Cloud',
    category: 'aiAndCloud',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 1850,
    currency: 'USD',
  },
  {
    name: 'YouTube Premium',
    category: 'streaming',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 1399,
    currency: 'USD',
  },
  {
    name: 'Gym & Recovery',
    category: 'health',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 3800,
    currency: 'USD',
  },
  {
    name: 'Fiber Wi-Fi',
    category: 'utilities',
    cycle: 'monthly',
    suggestedAmountMinorUnits: 4500,
    currency: 'USD',
  },
];

export function createSeedSubscriptions(todayIso: string = getTodayIso()): Subscription[] {
  return [
    {
      id: 'sub_cloud_ai',
      name: 'Cloud GPU & AI Pro',
      amountMinorUnits: 2000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'aiAndCloud',
      nextBillingDate: addDaysIso(todayIso, 2),
      isFreeTrial: true,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'rarely',
      cancelUrl: 'https://billing.stripe.com',
      notes: '14-day Pro compute trial — cancel before renewal if unused.',
    },
    {
      id: 'sub_gym',
      name: 'Gym & Recovery Club',
      amountMinorUnits: 3800,
      currency: 'USD',
      cycle: 'monthly',
      category: 'health',
      nextBillingDate: addDaysIso(todayIso, 1),
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'weekly',
      notes: 'Monthly athletic club membership.',
    },
    {
      id: 'sub_fiber',
      name: 'Fiber Gigabit Internet',
      amountMinorUnits: 4500,
      previousAmountMinorUnits: 4000,
      currency: 'USD',
      cycle: 'monthly',
      category: 'utilities',
      nextBillingDate: addDaysIso(todayIso, 5),
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'daily',
      notes: 'Home 1Gbps broadband — promo rate expired (+$5/mo increase).',
    },
    {
      id: 'sub_aws',
      name: 'AWS Staging Cluster',
      amountMinorUnits: 1850,
      currency: 'USD',
      cycle: 'monthly',
      category: 'aiAndCloud',
      nextBillingDate: addDaysIso(todayIso, 6),
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'daily',
      notes: 'EC2 + RDS staging environment.',
    },
    {
      id: 'sub_cinema',
      name: '4K Cinema Stream',
      amountMinorUnits: 1799,
      previousAmountMinorUnits: 1549,
      currency: 'USD',
      cycle: 'monthly',
      category: 'streaming',
      nextBillingDate: addDaysIso(todayIso, 11),
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'unused',
      notes: 'Ultra HD family tier — haven’t watched since last month.',
    },
    {
      id: 'sub_workspace',
      name: 'Figma & Workspace Suite',
      amountMinorUnits: 14400,
      currency: 'USD',
      cycle: 'yearly',
      category: 'productivity',
      nextBillingDate: addDaysIso(todayIso, 22),
      isFreeTrial: false,
      isSimulatedPaused: false,
      isArchived: false,
      usageFrequency: 'daily',
      notes: 'Annual design & productivity seat.',
    },
  ];
}
