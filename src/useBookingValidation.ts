import { useCallback, useState, type FocusEvent, type FormEvent } from "react";
import { bookingControlError, isBookingControl, type BookingFieldErrors } from "./booking-form";

export function useBookingValidation() {
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});

  const handleBlur = useCallback((event: FocusEvent<HTMLFormElement>) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement && target.getAttribute("aria-expanded") === "true")
      return;
    const name = isBookingControl(target)
      ? target.name
      : target instanceof HTMLButtonElement
        ? target.dataset.fieldName
        : undefined;
    if (!name) return;
    const control = event.currentTarget.elements.namedItem(name);
    if (!control || !isBookingControl(control)) return;
    const message = bookingControlError(control);
    setFieldErrors((current) => ({ ...current, [name]: message }));
  }, []);

  const handleChange = useCallback((event: FormEvent<HTMLFormElement>) => {
    if (!isBookingControl(event.target) || !event.target.name) return;
    const { name } = event.target;
    const message = bookingControlError(event.target);
    setFieldErrors((current) => (current[name] ? { ...current, [name]: message } : current));
  }, []);

  const validate = useCallback((form: HTMLFormElement) => {
    const controls = Array.from(form.elements).filter(isBookingControl);
    const errors = Object.fromEntries(
      controls.map((control) => [control.name, bookingControlError(control)]),
    );
    setFieldErrors(errors);
    const invalid = controls.find((control) => errors[control.name]);
    if (!invalid) return true;
    const target =
      form.querySelector<HTMLElement>(`[data-field-name="${invalid.name}"]`) ?? invalid;
    const disclosure = target.closest("details");
    if (disclosure) disclosure.open = true;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
    return false;
  }, []);

  const resetValidation = useCallback(() => setFieldErrors({}), []);

  return { fieldErrors, handleBlur, handleChange, validate, resetValidation };
}
