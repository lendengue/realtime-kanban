import { useMutation } from '@tanstack/react-query';
import { getRouteApi, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { safeRedirect } from '@/lib/redirect';
import { session } from '@/lib/session';
import { useErrorMessage } from '@/lib/use-error-message';

const routeApi = getRouteApi('/auth/login');

export function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const search = routeApi.useSearch();
  const errorMessage = useErrorMessage('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: api.auth.login,
    onSuccess: async (response) => {
      session.signIn(response);
      await router.navigate({ href: safeRedirect(search.redirect) });
    },
  });

  const onSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{t('auth.login.title')}</h1>
        </CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="flex flex-col gap-4">
          <FormError message={errorMessage(login.error)} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {t('auth.login.submit')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" search={search} className="font-medium text-foreground underline">
              {t('auth.login.registerLink')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
