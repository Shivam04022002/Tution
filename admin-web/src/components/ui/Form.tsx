import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';

interface FieldShellProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  required,
  error,
  hint,
  htmlFor,
  children,
  className = '',
}: FieldShellProps) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export function TextInput({ label, error, hint, className = '', ...rest }: TextInputProps) {
  const id = useId();
  return (
    <Field
      label={label}
      required={rest.required}
      error={error}
      hint={hint}
      htmlFor={id}
      className={className}
    >
      <input
        id={id}
        className={`control${error ? ' invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export function TextArea({ label, error, hint, className = '', ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <Field
      label={label}
      required={rest.required}
      error={error}
      hint={hint}
      htmlFor={id}
      className={className}
    >
      <textarea
        id={id}
        className={`control${error ? ' invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  className = '',
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <Field
      label={label}
      required={rest.required}
      error={error}
      hint={hint}
      htmlFor={id}
      className={className}
    >
      <select id={id} className={`control${error ? ' invalid' : ''}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, ...rest }: CheckboxProps) {
  return (
    <label className="check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Compact select used inside table toolbars, with no label above it. */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <select
      className="control filter-select"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
