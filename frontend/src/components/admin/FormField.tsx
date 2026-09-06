/**
 * Uncontrolled form controls wired for `react-hook-form`'s `register`
 * (spec §57). Each renders a `<label>`, the control, and an inline
 * error. Pass `{...register("name")}` plus `error={errors.name?.message}`.
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";

function Wrap({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="form__field">
      <span>{label}</span>
      {children}
      {error && <span className="form__error">{error}</span>}
    </label>
  );
}

type TextProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };
export const TextField = forwardRef<HTMLInputElement, TextProps>(function TextField(
  { label, error, ...rest },
  ref,
) {
  return (
    <Wrap label={label} error={error}>
      <input ref={ref} aria-invalid={error ? true : undefined} {...rest} />
    </Wrap>
  );
});

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };
export const TextAreaField = forwardRef<HTMLTextAreaElement, AreaProps>(function TextAreaField(
  { label, error, rows = 4, ...rest },
  ref,
) {
  return (
    <Wrap label={label} error={error}>
      <textarea ref={ref} rows={rows} aria-invalid={error ? true : undefined} {...rest} />
    </Wrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
};
export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, options, ...rest },
  ref,
) {
  return (
    <Wrap label={label} error={error}>
      <select ref={ref} aria-invalid={error ? true : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
});

type CheckProps = InputHTMLAttributes<HTMLInputElement> & { label: string };
export const CheckboxField = forwardRef<HTMLInputElement, CheckProps>(function CheckboxField(
  { label, ...rest },
  ref,
) {
  return (
    <label className="form__field form__field--checkbox">
      <input ref={ref} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
});
