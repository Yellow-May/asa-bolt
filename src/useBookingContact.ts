import { useCallback, useState } from "react";
import type { ContactMethod } from "../shared/contracts";
import { CUSTOM_LOCATION, emptyBookingForm } from "./booking-form";
import {
  forgetContact,
  readRememberedContact,
  rememberContact,
  rememberedContactFields,
} from "./remembered-contact";

export function useBookingContact(initialCustomLocation: boolean, resetValidation: () => void) {
  const [savedContact, setSavedContact] = useState(readRememberedContact);
  const [storageError, setStorageError] = useState("");
  const [form, setForm] = useState(() => ({
    ...emptyBookingForm,
    ...rememberedContactFields(savedContact),
    originId: initialCustomLocation ? CUSTOM_LOCATION : "",
  }));
  const handleContactChange = useCallback(
    (name: "email" | "whatsappNumber" | "pickupNote", value: string) => {
      setForm((current) => ({ ...current, [name]: value }));
    },
    [],
  );
  const handleMethodChange = useCallback(
    (method: ContactMethod) => {
      setForm((current) => ({
        ...current,
        ...rememberedContactFields(savedContact?.method === method ? savedContact : undefined),
        contactMethod: method,
      }));
      resetValidation();
    },
    [resetValidation, savedContact],
  );
  const rememberBookingContact = useCallback((record: { email?: string; phone: string }) => {
    const contact = record.email
      ? { method: "email" as const, value: record.email }
      : { method: "whatsapp" as const, value: record.phone };
    if (rememberContact(contact)) setSavedContact(contact);
  }, []);
  const handleForgetContact = useCallback(() => {
    if (!forgetContact()) {
      setStorageError("Could not clear the saved contact. Check your browser storage settings.");
      return;
    }
    setSavedContact(undefined);
    setStorageError("");
    setForm((current) => ({ ...current, email: "", whatsappNumber: "" }));
    resetValidation();
    document
      .getElementById(`booking-${form.contactMethod === "email" ? "email" : "whatsappNumber"}`)
      ?.focus();
  }, [form.contactMethod, resetValidation]);
  const resetTrip = useCallback(() => {
    setForm({ ...emptyBookingForm, ...rememberedContactFields(savedContact) });
  }, [savedContact]);
  return {
    form,
    setForm,
    savedContact,
    storageError,
    handleContactChange,
    handleMethodChange,
    rememberBookingContact,
    handleForgetContact,
    resetTrip,
  };
}
