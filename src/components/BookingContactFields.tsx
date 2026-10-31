import { useCallback, type ChangeEvent } from "react";
import type { ContactMethod } from "../../shared/contracts";
import type { BookingFieldErrors, BookingFormValues } from "../booking-form";
import { BookingField } from "./BookingField";
import { ContactMethodChoice } from "./ContactMethodChoice";

interface BookingContactFieldsProps {
  savedContact: boolean;
  storageError: string;
  onForgetContact: () => void;
  form: BookingFormValues;
  submitting: boolean;
  errors: BookingFieldErrors;
  onChange: (name: "email" | "whatsappNumber" | "pickupNote", value: string) => void;
  onMethodChange: (method: ContactMethod) => void;
}

export function BookingContactFields({
  savedContact,
  storageError,
  onForgetContact,
  form,
  submitting,
  errors,
  onChange,
  onMethodChange,
}: BookingContactFieldsProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.name as "email" | "whatsappNumber", event.target.value);
    },
    [onChange],
  );
  const email = form.contactMethod === "email";
  const name = email ? "email" : "whatsappNumber";

  return (
    <fieldset className="booking-section" disabled={submitting}>
      <legend className="sr-only">Contact details</legend>
      <ContactMethodChoice value={form.contactMethod} onChange={onMethodChange} />
      <BookingField
        name={name}
        label={email ? "Email address" : "WhatsApp number"}
        required
        error={errors[name]}
      >
        <input
          key={name}
          id={`booking-${name}`}
          type={email ? "email" : "tel"}
          name={name}
          autoComplete={email ? "email" : "tel"}
          maxLength={email ? 254 : 20}
          value={form[name]}
          onChange={handleChange}
          required
          placeholder={email ? "you@example.com" : "0801 234 5678"}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={`booking-${name}-help`}
        />
      </BookingField>
      {savedContact && (
        <button className="text-button forget-contact" type="button" onClick={onForgetContact}>
          Clear saved contact
        </button>
      )}
      {storageError && (
        <p className="field-error" role="alert">
          {storageError}
        </p>
      )}
    </fieldset>
  );
}
