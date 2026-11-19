import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InlineCreateFormProps {
  label: string;
  placeholder: string;
  pending: boolean;
  error: string | null;
  onCreate: (value: string) => Promise<unknown>;
}

/** Single-field form that clears itself after a successful create. */
export function InlineCreateForm({
  label,
  placeholder,
  pending,
  error,
  onCreate,
}: InlineCreateFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const [value, setValue] = useState('');

  const onSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    try {
      await onCreate(value.trim());
      setValue('');
    } catch {
      // The error is surfaced through `error`.
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" disabled={pending || !value.trim()}>
          {t('common.create')}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
