import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useErrorMessage } from '@/lib/use-error-message';

const routeApi = getRouteApi('/authed/invite/$token');

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const { token } = routeApi.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage('invitations');

  const accept = useMutation({
    mutationFn: () => api.workspaces.acceptInvitation(token),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      await router.navigate({ to: '/w/$workspaceSlug', params: { workspaceSlug: workspace.slug } });
    },
  });

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{t('invitations.title')}</h1>
        </CardTitle>
        <CardDescription>{t('invitations.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormError message={errorMessage(accept.error)} />
      </CardContent>
      <CardFooter>
        <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
          {t('invitations.accept')}
        </Button>
      </CardFooter>
    </Card>
  );
}
