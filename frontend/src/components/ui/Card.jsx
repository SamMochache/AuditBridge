import { motion } from 'framer-motion';
import clsx from 'clsx';

const Card = ({
  children,
  title,
  subtitle,
  action,
  variant = 'default',
  padding = 'default',
  hover = false,
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-white border border-navy-200 shadow-premium',
    glass: 'glass shadow-glass',
    gradient: 'bg-gradient-to-br from-primary-500 to-primary-700 text-white border-0',
    outline: 'bg-transparent border-2 border-navy-200',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  };

  return (
    <motion.div
      whileHover={hover ? { y: -4, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' } : {}}
      className={clsx(
        'rounded-xl transition-smooth',
        variants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-navy-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-navy-500 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      
      {children}
    </motion.div>
  );
};

export default Card;