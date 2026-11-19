import { ASSIGNABLE_ROLES, can, type AssignableRole, type Member } from '@realtime-kanban/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/form-error';
import { LoadError, Loading, WorkspaceNotFound } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { membersQuery, queryKeys } from '@/lib/queries';
import { useErrorMessage } from '@/lib/use-error-message';
import { useSession } from '@/lib/use-session';
import { useWorkspaceBySlug } from '@/lib/use-workspace';

const routeApi = getRouteApi('/authed/w/$workspaceSlug/members');

export function MembersPage() {
  const { t } = useTranslation();
  const { workspaceSlug } = routeApi.useParams();
  const { workspace, isPending, isError, error, refetch } = useWorkspaceBySlug(workspaceSlug);

  if (isPending) return <Loading />;
  if (isError) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (!workspace) return <WorkspaceNotFound />;

  const canManage = can(workspace.role, 'members:manage');

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {workspace.name} · {t('members.title')}
      </h1>
      <MemberList workspaceId={workspace.id} canManage={canManage} />
      {canManage && <InviteForm workspaceId={workspace.id} />}
    </div>
  );
}

function MemberList({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const state = useSession();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage('members');
  const members = useQuery(membersQuery(workspaceId));
  const currentUserId = state.status === 'authenticated' ? state.user.id : null;

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignableRole }) =>
      api.workspaces.updateMember(workspaceId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) }),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.workspaces.removeMember(workspaceId, userId),
    onSuccess: async (_data, userId) => {
      if (userId === currentUserId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        await router.navigate({ to: '/w' });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) });
    },
  });

  if (members.isPending) return <Loading />;
  if (members.isError)
    return <LoadError error={members.error} onRetry={() => void members.refetch()} />;

  const mutationError = updateRole.error ?? remove.error;

  return (
    <section className="flex flex-col gap-3">
      <FormError message={mutationError ? errorMessage(mutationError) : null} />
      <ul className="divide-y rounded-lg border bg-card">
        {members.data.map((member: Member) => {
          const isSelf = member.userId === currentUserId;
          const isOwner = member.role === 'owner';
          return (
            <li key={member.userId} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {member.name}{' '}
                  {isSelf && <span className="text-muted-foreground">({t('members.you')})</span>}
                </span>
                <span className="truncate text-sm text-muted-foreground">{member.email}</span>
              </div>
              {canManage && !isOwner ? (
                <Select
                  value={member.role}
                  onValueChange={(role) =>
                    updateRole.mutate({ userId: member.userId, role: role as AssignableRole })
                  }
                >
                  <SelectTrigger className="w-32" aria-label={`${member.name}: role`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{t(`roles.${member.role}`)}</Badge>
              )}
              {!isOwner && (canManage || isSelf) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(member.userId)}
                >
                  {isSelf ? t('members.leave') : t('members.remove')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage('members');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('member');

  const invite = useMutation({
    mutationFn: () => api.workspaces.invite(workspaceId, { email, role }),
    onSuccess: () => setEmail(''),
  });

  const onSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    invite.mutate();
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>{t('members.inviteTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="invite-email">{t('auth.email')}</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Select value={role} onValueChange={(value) => setRole(value as AssignableRole)}>
              <SelectTrigger className="w-32" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`roles.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={invite.isPending || !email}>
              {t('members.invite')}
            </Button>
          </div>
          <FormError message={invite.error ? errorMessage(invite.error) : null} />
          {invite.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('members.invited', { email: invite.data.email })}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
