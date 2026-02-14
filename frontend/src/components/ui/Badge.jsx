import clsx from 'clsx';

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}) => {
  const variants = {
    default: 'bg-navy-100 text-navy-800',
    primary: 'bg-primary-100 text-primary-800',
    success: 'bg-success-100 text-success-800',
    warning: 'bg-warning-100 text-warning-800',
    error: 'bg-error-100 text-error-800',
    paid: 'bg-success-100 text-success-800',
    partial: 'bg-warning-100 text-warning-800',
    unpaid: 'bg-error-100 text-error-800',
    matched: 'bg-success-100 text-success-800',
    failed: 'bg-error-100 text-error-800',
    unprocessed: 'bg-navy-100 text-navy-800',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const dotColors = {
    default: 'bg-navy-500',
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
    paid: 'bg-success-500',
    partial: 'bg-warning-500',
    unpaid: 'bg-error-500',
    matched: 'bg-success-500',
    failed: 'bg-error-500',
    unprocessed: 'bg-navy-500',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full mr-1.5', dotColors[variant])} />
      )}
      {children}
    </span>
  );
};

export default Badge;