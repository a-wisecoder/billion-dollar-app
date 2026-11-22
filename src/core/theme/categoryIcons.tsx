import {
  Cloud,
  Gamepad2,
  GraduationCap,
  Heart,
  Landmark,
  Music,
  Newspaper,
  PlayCircle,
  ShoppingBag,
  Smartphone,
  Tag,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
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
  music: Music,
  productivity: Zap,
  gaming: Gamepad2,
  news: Newspaper,
  education: GraduationCap,
  health: Heart,
  phoneInternet: Smartphone,
  utilities: Wifi,
  shopping: ShoppingBag,
  food: Utensils,
  finance: Landmark,
  other: Tag,
};

export function getCategoryVisual(category: SubscriptionCategory): CategoryVisual {
  const meta = CATEGORIES[category] ?? CATEGORIES.other;
  return {
    label: meta.label,
    color: meta.color,
    Icon: ICONS[category] ?? Tag,
  };
}
