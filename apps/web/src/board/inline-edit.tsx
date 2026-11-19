import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string;
  label: string;
  disabled?: boolean;
  className?: string;
  onSave: (value: string) => void;
}

/** Text that turns into an input on click; Enter/blur saves, Escape cancels. */
export function InlineEdit({ value, label, disabled = false, className, onSave }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing || disabled) {
    return (
      <button
        type="button"
        className={cn(
          'min-w-0 truncate rounded px-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          !disabled && 'hover:bg-accent',
          className,
        )}
        aria-label={disabled ? value : `${label}: ${value}`}
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
  };

  return (
    <Input
      ref={inputRef}
      aria-label={label}
      value={draft}
      maxLength={200}
      className={cn('h-8', className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setEditing(false);
      }}
    />
  );
}
