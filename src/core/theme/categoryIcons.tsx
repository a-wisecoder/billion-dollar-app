import { Cloud, Heart, PlayCircle, Wifi, Zap, type LucideIcon } from 'lucide-react';
import {
  CATEGORIES,
  type SubscriptionCategory,
} from '../../features/cashflow/domain/subscription';

export interface CategoryVisual {
  readonly label: string;
  readonly color: string;
  readonly Icon: LucideIcon;
}

const ICONS: Record<SubscriptionCategory, LucideIcon> = {
  aiAndCloud: Cloud,
  streaming: PlayCircle,
  productivity: Zap,
  utilities: Wifi,
  health: Heart,
};

export function getCategoryVisual(category: SubscriptionCategory): CategoryVisual {
  const meta = CATEGORIES[category];
  return {
    label: meta.label,
    color: meta.color,
    Icon: ICONS[category],
  };
}
