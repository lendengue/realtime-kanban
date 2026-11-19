import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';

/** Quick add: Enter creates the card and keeps focus for the next one; Escape clears. */
export function AddCard({
  columnTitle,
  onAdd,
}: {
  columnTitle: string;
  onAdd: (title: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [title, setTitle] = useState('');

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {t('board.addCardTo', { column: columnTitle })}
      </label>
      <Input
        id={id}
        value={title}
        placeholder={t('board.addCard')}
        maxLength={200}
        className="h-8 bg-background"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && title.trim()) {
            onAdd(title.trim());
            setTitle('');
          }
          if (event.key === 'Escape') setTitle('');
        }}
      />
    </div>
  );
}
