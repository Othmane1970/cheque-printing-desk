import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

interface SelectOption {
  value: string;
  label: string;
}

/** A labelled list of options; `testId` goes on the trigger. */
export function SimpleSelect({
  id,
  items,
  value,
  onChange,
  testId,
  disabled,
  ariaLabel,
  placeholder,
  className = "w-full",
}: {
  id?: string;
  items: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as string);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        data-testid={testId}
        aria-label={ariaLabel}
        className={className}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
