import * as Select from "@radix-ui/react-select";
import { useCallback, useId, useRef, useState, type FormEvent } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  id?: string;
  name?: string;
  label: string;
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onValueChange: (value: string) => void;
}

const emptyValue = "__asa_empty__";

export function Dropdown({
  id,
  name,
  label,
  value,
  options,
  placeholder = "Choose an option",
  emptyMessage = "No options available",
  disabled,
  required,
  invalid,
  describedBy,
  onValueChange,
}: DropdownProps) {
  const generatedId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [validationError, setValidationError] = useState("");
  const handleChange = useCallback(
    (next: string) => {
      setValidationError("");
      onValueChange(next === emptyValue ? "" : next);
    },
    [onValueChange],
  );
  const handleInvalid = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      event.preventDefault();
      setValidationError(`Choose ${label.toLowerCase()}.`);
      trigger.current?.focus();
    },
    [label],
  );
  const hasEmptyOption = options.some((option) => option.value === "");

  return (
    <div className="dropdown" onInvalid={handleInvalid}>
      <Select.Root
        name={name ?? generatedId}
        value={value || (hasEmptyOption ? emptyValue : "")}
        onValueChange={handleChange}
        disabled={disabled}
        required={required}
      >
        <Select.Trigger
          ref={trigger}
          id={id}
          className="dropdown-trigger"
          aria-label={label}
          aria-invalid={invalid || Boolean(validationError)}
          aria-describedby={
            [describedBy, validationError ? `${generatedId}-error` : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          data-field-name={name}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon className="dropdown-chevron" aria-hidden="true">
            ⌄
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="dropdown-content"
            position="popper"
            sideOffset={5}
            collisionPadding={12}
          >
            <Select.ScrollUpButton className="dropdown-scroll" aria-label="Scroll up">
              ⌃
            </Select.ScrollUpButton>
            <Select.Viewport className="dropdown-viewport">
              {options.length ? (
                options.map((option) => (
                  <Select.Item
                    className="dropdown-option"
                    key={option.value}
                    value={option.value || emptyValue}
                    disabled={option.disabled}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="dropdown-check" aria-hidden="true">
                      ✓
                    </Select.ItemIndicator>
                  </Select.Item>
                ))
              ) : (
                <p className="dropdown-empty">{emptyMessage}</p>
              )}
            </Select.Viewport>
            <Select.ScrollDownButton className="dropdown-scroll" aria-label="Scroll down">
              ⌄
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {validationError && (
        <p id={`${generatedId}-error`} className="dropdown-error" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}
