import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'motion/react';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap shrink-0 transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.985] cursor-pointer disabled:opacity-45 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-white hover:bg-brand-hover shadow-[0_1px_2px_rgba(11,86,67,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]',
        secondary:
          'bg-card text-text-primary border border-border hover:border-border-strong hover:bg-subtle/60 shadow-[0_1px_2px_rgba(15,26,23,0.04)]',
        subtle:
          'bg-subtle text-text-primary border border-transparent hover:border-border hover:bg-subtle/80',
        soft:
          'bg-brand-soft text-brand-text border border-brand-border hover:brightness-[0.97]',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-subtle/75',
        danger:
          'bg-red text-white hover:bg-red-hover shadow-[0_1px_2px_rgba(166,43,43,0.25),inset_0_1px_0_rgba(255,255,255,0.14)]',
        dangerSoft:
          'bg-red-soft text-red-text border border-red-border hover:brightness-[0.97]',
      },
      size: {
        sm: 'min-h-[38px] sm:min-h-[36px] px-3 py-1.5 text-[13px]',
        md: 'min-h-[44px] sm:min-h-[40px] px-4 py-2 text-[14px]',
        lg: 'min-h-[48px] px-5 py-2.5 text-[15px]',
        icon: 'min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

/**
 * Splits a formatted monetary string into symbol/prefix, whole digits, and
 * fractional decimal part so cents/decimals can step down slightly in visual
 * weight—creating Mercury/Stripe-grade numeric scannability while remaining
 * a single copyable text string.
 */
interface MoneyFigureProps {
  readonly value: string;
  readonly suffix?: string;
  readonly className?: string;
  readonly decimalClassName?: string;
  readonly suffixClassName?: string;
  readonly title?: string;
  readonly 'data-testid'?: string;
}

export const MoneyFigure: React.FC<MoneyFigureProps> = ({
  value,
  suffix,
  className,
  decimalClassName,
  suffixClassName,
  title,
  'data-testid': testId,
}) => {
  const match = /^(.*?)(\.\d+)$/.exec(value);
  const whole = match ? match[1] : value;
  const decimals = match ? match[2] : null;
  const fullTitle = title ?? (suffix ? `${value}${suffix}` : value);

  return (
    <span
      title={fullTitle}
      data-testid={testId}
      className={cn('font-mono tabular-nums tracking-[-0.025em]', className)}
    >
      <span>{whole}</span>
      {decimals && (
        <span className={cn('opacity-65 font-semibold text-[max(12px,0.78em)]', decimalClassName)}>
          {decimals}
        </span>
      )}
      {suffix && (
        <span
          className={cn(
            'font-sans text-[max(12px,0.68em)] font-medium tracking-normal text-text-secondary ml-0.5',
            suffixClassName,
          )}
        >
          {suffix}
        </span>
      )}
    </span>
  );
};

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly testId?: string;
}

interface SegmentedControlProps<T extends string> {
  readonly value: T;
  readonly options: readonly SegmentedOption<T>[];
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly layoutId: string;
  readonly className?: string;
  readonly fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  layoutId,
  className,
  fullWidth = false,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center p-1 rounded-xl bg-subtle/90 border border-border',
        fullWidth && 'w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative z-10 min-h-[36px] px-3.5 py-1.5 rounded-[9px] text-[13px] font-semibold transition-colors whitespace-nowrap cursor-pointer',
              fullWidth && 'flex-1',
              isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }}
                className="absolute inset-0 -z-10 rounded-[9px] bg-card border border-border/80 shadow-[0_1px_3px_rgba(15,26,23,0.08)]"
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleSwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly ariaLabel: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly 'data-testid'?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onCheckedChange,
  ariaLabel,
  id,
  disabled = false,
  'data-testid': testId,
}) => (
  <SwitchPrimitive.Root
    id={id}
    checked={checked}
    onCheckedChange={onCheckedChange}
    disabled={disabled}
    aria-label={ariaLabel}
    data-testid={testId}
    className={cn(
      'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50',
      checked
        ? 'bg-brand border-brand'
        : 'bg-subtle border-border-strong hover:border-text-secondary/50',
    )}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
        checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
      )}
    />
  </SwitchPrimitive.Root>
);

interface HintTooltipProps {
  readonly content: string;
  readonly children: React.ReactNode;
}

export const HintTooltip: React.FC<HintTooltipProps> = ({ content, children }) => (
  <TooltipPrimitive.Provider delayDuration={220}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-[240px] rounded-lg bg-text-primary text-page px-2.5 py-1.5 text-xs font-medium shadow-lg"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-text-primary" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);
