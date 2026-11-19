import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/lib/use-error-message';

export function Loading() {
  const { t } = useTranslation();
  return (
    <p className="text-muted-foreground" role="status">
      {t('common.loading')}
    </p>
  );
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage('auth');
  return (
    <div className="flex flex-col items-start gap-3">
      <FormError message={errorMessage(error)} />
      <Button variant="outline" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

export function WorkspaceNotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-3">
      <p>{t('workspaces.notFound')}</p>
      <Button asChild variant="outline">
        <Link to="/w">{t('common.back')}</Link>
      </Button>
    </div>
  );
}
