import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { cn } from '@/utils/cn'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    const actualRightIcon = isPassword ? (
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="focus:outline-none hover:text-slate-600 transition-colors"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    ) : (
      rightIcon
    )

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              'input',
              leftIcon && 'pl-10',
              actualRightIcon && 'pr-10',
              error && 'input-error',
              className
            )}
            {...props}
          />
          {actualRightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {actualRightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
