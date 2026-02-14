import { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(({
  label,
  error,
  hint,
  icon: Icon,
  iconPosition = 'left',
  type = 'text',
  fullWidth = true,
  className,
  ...props
}, ref) => {
  return (
    <div className={clsx('space-y-1', fullWidth && 'w-full')}>
      {label && (
        <label className="block text-sm font-medium text-navy-700">
          {label}
          {props.required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-navy-400" />
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className={clsx(
            'block w-full rounded-lg border transition-smooth',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'placeholder:text-navy-400',
            'disabled:bg-navy-50 disabled:text-navy-500 disabled:cursor-not-allowed',
            error
              ? 'border-error-300 text-error-900 focus:ring-error-500'
              : 'border-navy-200 text-navy-900',
            Icon && iconPosition === 'left' && 'pl-10',
            Icon && iconPosition === 'right' && 'pr-10',
            !Icon && 'px-4',
            'py-2.5 text-base',
            className
          )}
          {...props}
        />
        
        {Icon && iconPosition === 'right' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-navy-400" />
          </div>
        )}
      </div>
      
      {(error || hint) && (
        <p className={clsx(
          'text-sm',
          error ? 'text-error-600' : 'text-navy-500'
        )}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;