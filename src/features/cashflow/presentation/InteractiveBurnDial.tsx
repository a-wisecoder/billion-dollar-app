import React, { useCallback, useRef } from 'react';
import { useAnimatedNumber } from '../../../core/hooks/useAnimatedNumber';
import { getCategoryVisual } from '../../../core/theme/categoryIcons';
import { formatMinorUnits } from '../../../core/utils/moneyFormatter';
import type { DialSegment } from '../domain/cashflowEngine';
import type { CurrencyCode, SubscriptionCategory } from '../domain/subscription';

interface InteractiveBurnDialProps {
  readonly segments: readonly DialSegment[];
  readonly selectedCategory: SubscriptionCategory | null;
  readonly totalBaseMinorUnits: number;
  readonly baseCurrency: CurrencyCode;
  readonly showAnnual: boolean;
  readonly onSelectCategory: (category: SubscriptionCategory | null) => void;
  readonly onTogglePeriod: () => void;
  readonly onAddFirst?: () => void;
}

const DIAL_SIZE = 276;
const CENTER = DIAL_SIZE / 2;
const BASE_RADIUS = 108;
const INNER_CORE_RADIUS = 76;

function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  // Full circle special case (avoid degenerate SVG arc where start == end)
  if (sweep >= Math.PI * 2 - 0.01) {
    const mid = startAngle + Math.PI;
    const p1 = polarToCartesian(cx, cy, radius, startAngle);
    const p2 = polarToCartesian(cx, cy, radius, mid);
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${radius} ${radius} 0 1 1 ${p2.x} ${p2.y}`,
      `A ${radius} ${radius} 0 1 1 ${p1.x} ${p1.y}`,
    ].join(' ');
  }
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = sweep > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export const InteractiveBurnDial: React.FC<InteractiveBurnDialProps> = ({
  segments,
  selectedCategory,
  totalBaseMinorUnits,
  baseCurrency,
  showAnnual,
  onSelectCategory,
  onTogglePeriod,
  onAddFirst,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastScrubCategoryRef = useRef<SubscriptionCategory | null>(selectedCategory);

  const activeSegment =
    selectedCategory === null
      ? null
      : (segments.find((s) => s.category === selectedCategory) ?? null);

  const targetDisplayAmount = activeSegment
    ? activeSegment.amountBaseMinorUnits
    : totalBaseMinorUnits;
  const animatedAmount = useAnimatedNumber(targetDisplayAmount);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
  };

  const resolveCategoryAtPoint = useCallback(
    (clientX: number, clientY: number, isClick: boolean) => {
      if (segments.length === 0 || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scale = DIAL_SIZE / rect.width;
      const localX = (clientX - rect.left) * scale;
      const localY = (clientY - rect.top) * scale;

      const dx = localX - CENTER;
      const dy = localY - CENTER;
      const distance = Math.hypot(dx, dy);

      if (distance < INNER_CORE_RADIUS || distance > CENTER + 8) {
        return;
      }

      // Clockwise angle starting from 12 o'clock (0..2*PI)
      let touchAngle = Math.atan2(dy, dx) + Math.PI / 2;
      if (touchAngle < 0) touchAngle += Math.PI * 2;

      let cursor = 0;
      for (const segment of segments) {
        const sweep = segment.fraction * Math.PI * 2;
        if (touchAngle >= cursor && touchAngle <= cursor + sweep) {
          if (isClick && selectedCategory === segment.category) {
            triggerHaptic();
            lastScrubCategoryRef.current = null;
            onSelectCategory(null);
          } else if (selectedCategory !== segment.category) {
            triggerHaptic();
            lastScrubCategoryRef.current = segment.category;
            onSelectCategory(segment.category);
          }
          return;
        }
        cursor += sweep;
      }
    },
    [segments, selectedCategory, onSelectCategory],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (segments.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = DIAL_SIZE / rect.width;
    const dx = (e.clientX - rect.left) * scale - CENTER;
    const dy = (e.clientY - rect.top) * scale - CENTER;
    const dist = Math.hypot(dx, dy);
    if (dist < INNER_CORE_RADIUS) return;

    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    resolveCategoryAtPoint(e.clientX, e.clientY, true);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    resolveCategoryAtPoint(e.clientX, e.clientY, false);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleCenterClick = () => {
    triggerHaptic();
    if (selectedCategory !== null) {
      onSelectCategory(null);
    } else {
      onTogglePeriod();
    }
  };

  // Precompute arc geometry
  const gap = segments.length > 1 ? 0.08 : 0;
  let runningAngle = -Math.PI / 2;
  const computedArcs = segments.map((segment) => {
    const rawSweep = segment.fraction * Math.PI * 2;
    const sweep = Math.max(0.03, rawSweep - gap);
    const startAngle = runningAngle + gap / 2;
    const endAngle = startAngle + sweep;
    runningAngle += rawSweep;
    const visual = getCategoryVisual(segment.category);
    const isSelected = selectedCategory === segment.category;
    const isDimmed = selectedCategory !== null && !isSelected;
    return {
      segment,
      visual,
      startAngle,
      endAngle,
      isSelected,
      isDimmed,
    };
  });

  const displayTitle = activeSegment
    ? getCategoryVisual(activeSegment.category).label
    : showAnnual
      ? 'Annual burn'
      : 'Monthly burn';

  const displaySub = activeSegment
    ? `${Math.round(activeSegment.fraction * 100)}% of active spend`
    : segments.length === 0
      ? 'No active bills'
      : `Tap for ${showAnnual ? 'monthly' : 'annual'} view`;

  return (
    <div
      className="flex flex-col items-center"
      data-testid="interactive-burn-dial"
      data-period={showAnnual ? 'annual' : 'monthly'}
      data-selected-category={selectedCategory ?? 'all'}
    >
      <div className="relative flex items-center justify-center w-[276px] h-[276px] select-none touch-none">
        <svg
          ref={svgRef}
          width={DIAL_SIZE}
          height={DIAL_SIZE}
          viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
          className="overflow-visible cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Interactive burn rate dial. Drag around the ring to inspect spending categories."
          role="img"
        >
          <defs>
            <filter id="vault-arc-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Calm OLED background track */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={BASE_RADIUS}
            fill="none"
            stroke="#1A2234"
            strokeWidth={18}
          />

          {/* Multi-segment active arcs */}
          {computedArcs.map(({ segment, visual, startAngle, endAngle, isSelected, isDimmed }) => {
            const radius = isSelected ? BASE_RADIUS + 5 : BASE_RADIUS;
            const strokeWidth = isSelected ? 24 : 18;
            const pathD = describeArc(CENTER, CENTER, radius, startAngle, endAngle);

            return (
              <g key={segment.category} className="transition-all duration-200 ease-out">
                {!isDimmed && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={visual.color}
                    strokeWidth={strokeWidth + 4}
                    strokeLinecap="round"
                    opacity={isSelected ? 0.36 : 0.14}
                    filter="url(#vault-arc-glow)"
                  />
                )}
                <path
                  d={pathD}
                  fill="none"
                  stroke={visual.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  opacity={isDimmed ? 0.22 : 1}
                />
              </g>
            );
          })}
        </svg>

        {/* Interactive center readout core */}
        <button
          type="button"
          onClick={handleCenterClick}
          aria-label={
            selectedCategory
              ? `Reset ${displayTitle} filter and show all categories`
              : `Switch to ${showAnnual ? 'monthly' : 'annual'} burn view`
          }
          className="absolute inset-0 m-auto w-[156px] h-[156px] rounded-full flex flex-col items-center justify-center text-center px-3 bg-[#0B101B]/90 border border-[#232D42]/80 hover:border-[#6366F1]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1] transition-colors cursor-pointer"
        >
          <span
            className="text-xs font-semibold tracking-wide transition-colors"
            style={{
              color: activeSegment
                ? getCategoryVisual(activeSegment.category).color
                : '#94A3B8',
            }}
          >
            {displayTitle}
          </span>
          <span
            className="mt-1 font-mono tabular-nums text-[26px] leading-tight font-bold tracking-tight text-[#F8FAFC] max-w-full truncate"
            data-testid="burn-dial-total"
          >
            {formatMinorUnits(animatedAmount, baseCurrency, {
              showDecimals: baseCurrency !== 'PKR',
            })}
          </span>
          <span className="mt-1.5 text-[11px] font-medium text-[#94A3B8]">
            {displaySub}
          </span>
        </button>
      </div>

      {/* Zero-data helper action */}
      {segments.length === 0 && onAddFirst ? (
        <button
          type="button"
          onClick={onAddFirst}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-[#6366F1] text-white hover:bg-[#5558E6] transition-colors whitespace-nowrap"
        >
          Add a recurring bill
        </button>
      ) : (
        /* Synchronized category filter segmented buttons */
        <div
          className="mt-5 flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="Filter subscriptions by category"
        >
          {segments.map((seg) => {
            const visual = getCategoryVisual(seg.category);
            const isSelected = selectedCategory === seg.category;
            return (
              <button
                key={seg.category}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  triggerHaptic();
                  onSelectCategory(isSelected ? null : seg.category);
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6366F1] ${
                  isSelected
                    ? 'bg-[#1A2234] text-[#F8FAFC]'
                    : 'bg-[#111623] text-[#94A3B8] border-[#232D42] hover:text-[#F8FAFC] hover:border-[#334155]'
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: visual.color,
                        backgroundColor: `${visual.color}1F`,
                      }
                    : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: visual.color }}
                  aria-hidden="true"
                />
                <span>{visual.label}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  {Math.round(seg.fraction * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
