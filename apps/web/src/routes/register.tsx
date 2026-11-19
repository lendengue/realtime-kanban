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

const routeApi = getRouteApi('/auth/register');

export function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const search = routeApi.useSearch();
  const errorMessage = useErrorMessage('auth');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const register = useMutation({
    mutationFn: api.auth.register,
    onSuccess: async (response) => {
      session.signIn(response);
      await router.navigate({ href: safeRedirect(search.redirect) });
    },
  });

  const onSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    register.mutate(form);
  };

  const field = (name: keyof typeof form) => ({
    id: name,
    value: form[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{t('auth.register.title')}</h1>
        </CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="flex flex-col gap-4">
          <FormError message={errorMessage(register.error)} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('auth.name')}</Label>
            <Input autoComplete="name" required autoFocus {...field('name')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input type="email" autoComplete="email" required {...field('email')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="password-hint"
              {...field('password')}
            />
            <p id="password-hint" className="text-xs text-muted-foreground">
              {t('auth.register.passwordHint')}
            </p>
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={register.isPending}>
            {t('auth.register.submit')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('auth.register.hasAccount')}{' '}
            <Link to="/login" search={search} className="font-medium text-foreground underline">
              {t('auth.register.loginLink')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
