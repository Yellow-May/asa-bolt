import { useCallback, type ChangeEvent } from "react";
import type { FarePreview, OfferPreview } from "../../shared/contracts";
import type { BookingFieldErrors } from "../booking-form";
import { formatNaira } from "../format";
import { BookingField } from "./BookingField";
import { Message } from "./Message";

interface BookingFareFieldsProps {
  fare?: FarePreview;
  quoting: boolean;
  fareError: string;
  priceChoice: "accept" | "negotiate";
  offerAmount: string;
  offerNote: string;
  offer?: OfferPreview;
  offerError?: string;
  submitting: boolean;
  errors: BookingFieldErrors;
  onPriceChoice: (value: "accept" | "negotiate") => void;
  onOfferAmount: (value: string) => void;
  onOfferNote: (value: string) => void;
}

export function BookingFareFields({
  fare,
  quoting,
  fareError,
  priceChoice,
  offerAmount,
  offerNote,
  offer,
  offerError,
  submitting,
  errors,
  onPriceChoice,
  onOfferAmount,
  onOfferNote,
}: BookingFareFieldsProps) {
  const handleMakeOffer = useCallback(() => onPriceChoice("negotiate"), [onPriceChoice]);
  const handleUseFare = useCallback(() => onPriceChoice("accept"), [onPriceChoice]);
  const handleOfferAmount = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onOfferAmount(event.target.value),
    [onOfferAmount],
  );
  const handleOfferNote = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => onOfferNote(event.target.value),
    [onOfferNote],
  );

  return (
    <fieldset className="booking-section" disabled={submitting}>
      <legend className="sr-only">Your fare</legend>
      {quoting && <Message tone="info">Calculating your fare…</Message>}
      {fareError && <Message tone="error">{fareError}</Message>}
      {fare && (
        <>
          <div className="fare-preview" aria-live="polite">
            <span>Quoted fare</span>
            <strong>{formatNaira(fare.amountKobo)}</strong>
            <button
              type="button"
              className="fare-offer-toggle"
              onClick={priceChoice === "accept" ? handleMakeOffer : handleUseFare}
            >
              {priceChoice === "accept" ? "Make an offer" : "Use quoted fare"}
            </button>
          </div>
          {priceChoice === "negotiate" && (
            <div className="offer-form">
              <p className="field-help">One offer per request, subject to acceptance.</p>
              <BookingField
                name="offerAmount"
                label="Your offer (₦)"
                required
                error={errors.offerAmount}
              >
                <input
                  id="booking-offerAmount"
                  name="offerAmount"
                  inputMode="decimal"
                  value={offerAmount}
                  onChange={handleOfferAmount}
                  required
                  maxLength={32}
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  placeholder="Enter amount"
                  aria-invalid={Boolean(errors.offerAmount || offerError)}
                  aria-describedby="booking-offerAmount-help booking-offer-preview"
                />
              </BookingField>
              <div id="booking-offer-preview" aria-live="polite">
                {offer ? (
                  <div className="offer-preview">
                    <strong>Offer to send: {formatNaira(offer.roundedAmountKobo)}</strong>
                    <p>
                      ₦{offer.amountNaira} rounds up to {formatNaira(offer.roundedAmountKobo)}. This
                      will be your agreed fare if accepted.
                    </p>
                  </div>
                ) : offerError ? (
                  <Message tone="error">{offerError}</Message>
                ) : (
                  <p className="field-help">
                    {offerAmount.trim()
                      ? "Calculating your rounded offer…"
                      : "Enter an amount to preview your rounded offer."}
                  </p>
                )}
              </div>
              <details className="booking-extras">
                <summary>Add an offer note</summary>
                <BookingField name="offerNote" label="Offer note">
                  <textarea
                    id="booking-offerNote"
                    name="offerNote"
                    rows={2}
                    maxLength={240}
                    value={offerNote}
                    onChange={handleOfferNote}
                    placeholder="Anything you’d like us to consider?"
                  />
                </BookingField>
              </details>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
