import { motion } from 'framer-motion';
import clsx from 'clsx';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-smooth focus-ring rounded-lg';

  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-premium hover:shadow-premium-lg',
    secondary: 'bg-white text-navy-900 border-2 border-navy-200 hover:border-navy-300 hover:bg-navy-50',
    success: 'bg-success-500 text-white hover:bg-success-600 shadow-premium',
    danger: 'bg-error-500 text-white hover:bg-error-600 shadow-premium',
    ghost: 'text-navy-700 hover:bg-navy-100',
    glass: 'glass text-navy-900 hover:bg-white/90',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-60 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className={clsx('animate-spin', iconSizes[size], iconPosition === 'right' ? 'ml-2' : 'mr-2')}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className={clsx(iconSizes[size], children && 'mr-2')} />
      )}
      
      {children}
      
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={clsx(iconSizes[size], children && 'ml-2')} />
      )}
    </motion.button>
  );
};

export default Button;