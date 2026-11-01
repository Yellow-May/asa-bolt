import type { ContactMethod, MapPoint } from "../shared/contracts";

export const CUSTOM_LOCATION = "__custom__";

export const emptyBookingForm = {
  contactMethod: "email" as ContactMethod,
  email: "",
  whatsappNumber: "",
  originId: "",
  destinationId: "",
  customOrigin: "",
  customDestination: "",
  originPin: undefined as MapPoint | undefined,
  destinationPin: undefined as MapPoint | undefined,
  pickupAt: "",
  pickupNote: "",
};

export type BookingFormValues = typeof emptyBookingForm;
export type BookingFieldErrors = Record<string, string>;
export type BookingControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function isBookingControl(target: unknown): target is BookingControl {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

const requiredMessages: Record<string, string> = {
  originId: "Choose your pickup location.",
  destinationId: "Choose your destination.",
  schedule: "Choose an available pickup day.",
  customOrigin: "Enter your pickup location.",
  customDestination: "Enter your destination.",
  pickupAt: "Choose your pickup time.",
  email: "Enter your email address.",
  whatsappNumber: "Enter your WhatsApp number.",
  offerAmount: "Enter the fare you would like to offer.",
};

export function bookingControlError(control: BookingControl): string {
  if (
    control.name === "whatsappNumber" &&
    control.value &&
    (!/^[+\d\s()-]+$/.test(control.value) ||
      !/^(?:234\d{10}|0\d{10}|\d{10})$/.test(control.value.replace(/\D/g, "")))
  )
    return "Enter a valid Nigerian WhatsApp number.";
  if (!control.willValidate || control.validity.valid) return "";
  if (control.validity.valueMissing)
    return requiredMessages[control.name] ?? "Complete this field.";
  if (control.validity.typeMismatch && control.name === "email")
    return "Enter a valid email address.";
  if (control.name === "offerAmount")
    return "Enter a positive amount with up to two decimal places.";
  if (control.name === "pickupAt") return "Choose a time within the selected pickup window.";
  return control.validationMessage;
}
