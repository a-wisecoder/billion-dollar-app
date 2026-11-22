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
  sm: 'w-9 h-9 rounded-lg text-sm',
  md: 'w-10 h-10 rounded-xl text-[15px]',
  lg: 'w-11 h-11 rounded-xl text-base',
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
        className={`${sizeClass} shrink-0 overflow-hidden inline-flex items-center justify-center bg-subtle`}
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
      className={`${sizeClass} shrink-0 inline-flex items-center justify-center font-bold`}
      style={{
        backgroundColor: `${visual.color}1F`,
        color: visual.color,
      }}
    >
      {initialLetter}
    </span>
  );
};
