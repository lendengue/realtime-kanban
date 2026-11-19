import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { InlineCreateForm } from '@/components/inline-create-form';
import { LoadError, Loading } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { queryKeys, workspacesQuery } from '@/lib/queries';
import { useErrorMessage } from '@/lib/use-error-message';

export function WorkspacesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage('members');
  const workspaces = useQuery(workspacesQuery());

  const create = useMutation({
    mutationFn: api.workspaces.create,
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      await router.navigate({ to: '/w/$workspaceSlug', params: { workspaceSlug: workspace.slug } });
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('workspaces.title')}</h1>

      {workspaces.isPending && <Loading />}
      {workspaces.isError && (
        <LoadError error={workspaces.error} onRetry={() => void workspaces.refetch()} />
      )}
      {workspaces.data?.length === 0 && (
        <p className="text-muted-foreground">{t('workspaces.empty')}</p>
      )}

      {workspaces.data && workspaces.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label={t('workspaces.title')}>
          {workspaces.data.map((workspace) => (
            <li key={workspace.id}>
              <Link
                to="/w/$workspaceSlug"
                params={{ workspaceSlug: workspace.slug }}
                className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{workspace.name}</span>
                  <Badge variant="secondary">{t(`roles.${workspace.role}`)}</Badge>
                </span>
                <ChevronRight className="text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>
            <h2>{t('workspaces.createTitle')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InlineCreateForm
            label={t('workspaces.namePlaceholder')}
            placeholder={t('workspaces.namePlaceholder')}
            pending={create.isPending}
            error={create.error ? errorMessage(create.error) : null}
            onCreate={(name) => create.mutateAsync(name)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
