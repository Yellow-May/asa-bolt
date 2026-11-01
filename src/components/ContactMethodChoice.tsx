import { useCallback, type ChangeEvent } from "react";
import type { ContactMethod } from "../../shared/contracts";

interface ContactMethodChoiceProps {
  value: ContactMethod;
  onChange: (method: ContactMethod) => void;
}

export function ContactMethodChoice({ value, onChange }: ContactMethodChoiceProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value as ContactMethod);
    },
    [onChange],
  );

  return (
    <fieldset className="contact-method-choice">
      <legend>Contact method</legend>
      <div>
        <label>
          <input
            type="radio"
            name="contactMethod"
            value="email"
            checked={value === "email"}
            onChange={handleChange}
          />
          Email
        </label>
        <label>
          <input
            type="radio"
            name="contactMethod"
            value="whatsapp"
            checked={value === "whatsapp"}
            onChange={handleChange}
          />
          WhatsApp
        </label>
      </div>
    </fieldset>
  );
}
