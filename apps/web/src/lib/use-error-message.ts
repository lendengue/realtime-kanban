import { useTranslation } from 'react-i18next';

import { ApiError } from './api-client';

/**
 * Turns an error into a user-facing message, preferring a translation under
 * `<scope>.errors.<code>` when one exists.
 */
export function useErrorMessage(scope: 'auth' | 'members' | 'invitations') {
  const { t, i18n } = useTranslation();
  return (error: unknown): string | null => {
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.code === 'NETWORK_ERROR') return t('common.networkError');
      // Falls back to the server message when there is no translation for this code.
      return i18n.t(`${scope}.errors.${error.code}`, { defaultValue: error.message });
    }
    return t('common.unexpectedError');
  };
}
