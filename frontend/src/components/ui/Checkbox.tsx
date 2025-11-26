import React, { useRef } from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({ 
  checked, 
  onChange, 
  id, 
  className = '', 
  disabled = false 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      const newChecked = !checked;
      onChange(newChecked);
      // Also update the hidden input for form compatibility
      if (inputRef.current) {
        inputRef.current.checked = newChecked;
      }
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div
        className={`
          w-4 h-4 border-2 rounded flex items-center justify-center cursor-pointer transition-all
          ${checked 
            ? 'bg-primary border-primary' 
            : 'bg-background border-border hover:border-primary/50'
          }
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-muted/50'
          }
        `}
        onClick={handleClick}
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
      >
        {checked && (
          <svg
            className="w-3 h-3 text-primary-foreground"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </div>
  );
};

export default Checkbox;
