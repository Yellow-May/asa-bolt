import type { ReactNode } from "react";

interface BookingFieldProps {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function BookingField({
  name,
  label,
  required,
  error,
  help,
  children,
  action,
}: BookingFieldProps) {
  return (
    <div className="booking-field">
      <div className="booking-field-heading">
        <label htmlFor={`booking-${name}`}>
          {label}{" "}
          {required ? <span aria-hidden="true">*</span> : <span className="muted">(optional)</span>}
        </label>
        {action}
      </div>
      {children}
      <div id={`booking-${name}-help`}>
        {help && <p className="field-help">{help}</p>}
        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}
