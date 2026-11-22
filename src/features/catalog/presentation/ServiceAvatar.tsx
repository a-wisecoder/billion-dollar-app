import React, { useEffect, useState } from 'react';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import type { SubscriptionCategory } from '../../cashflow/domain/subscription';
import { LOCAL_LOGO_IDS, matchCatalogByMerchant } from '../domain/serviceCatalog';

interface ServiceAvatarProps {
  readonly name: string;
  readonly category: SubscriptionCategory;
  readonly catalogId?: string;
  readonly size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-9 h-9 rounded-[10px] text-[13px]',
  md: 'w-10 h-10 rounded-[12px] text-[15px]',
  lg: 'w-12 h-12 rounded-[14px] text-lg',
};

export const ServiceAvatar: React.FC<ServiceAvatarProps> = ({
  name,
  category,
  catalogId,
  size = 'md',
}) => {
  const visual = getCategoryVisual(category);
  const resolvedId =
    catalogId && LOCAL_LOGO_IDS.has(catalogId)
      ? catalogId
      : (() => {
          const matched = matchCatalogByMerchant(name);
          return matched && LOCAL_LOGO_IDS.has(matched.id) ? matched.id : null;
        })();

  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    setFailedId(null);
  }, [resolvedId]);

  const sizeClass = SIZE_CLASSES[size];

  if (resolvedId && failedId !== resolvedId) {
    return (
      <span
        aria-hidden="true"
        className={`${sizeClass} shrink-0 overflow-hidden inline-flex items-center justify-center bg-subtle ring-1 ring-inset ring-black/[0.08] dark:ring-white/[0.1] shadow-[0_1px_2px_rgba(0,0,0,0.06)]`}
      >
        <img
          src={`/logos/${resolvedId}.svg`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedId(resolvedId)}
          className="w-full h-full object-cover"
        />
      </span>
    );
  }

  const initialLetter = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} shrink-0 inline-flex items-center justify-center font-display font-bold ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]`}
      style={{
        background: `linear-gradient(145deg, ${visual.color}24, ${visual.color}12)`,
        color: visual.color,
      }}
    >
      {initialLetter}
    </span>
  );
};
