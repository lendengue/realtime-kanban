export const en = {
  app: {
    name: 'realtime-kanban',
    tagline: 'Local-first, real-time collaborative Kanban.',
  },
  common: {
    loading: 'Loading…',
    cancel: 'Cancel',
    create: 'Create',
    retry: 'Try again',
    back: 'Back',
    unexpectedError: 'Something went wrong. Please try again.',
    networkError: 'Could not reach the server. Check your connection.',
  },
  roles: {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    viewer: 'Viewer',
  },
  auth: {
    email: 'E-mail',
    password: 'Password',
    name: 'Name',
    login: {
      title: 'Sign in to realtime-kanban',
      submit: 'Sign in',
      noAccount: 'No account yet?',
      registerLink: 'Create one',
    },
    register: {
      title: 'Create your account',
      submit: 'Create account',
      passwordHint: 'At least 8 characters.',
      hasAccount: 'Already have an account?',
      loginLink: 'Sign in',
    },
    logout: 'Sign out',
    errors: {
      INVALID_CREDENTIALS: 'E-mail or password is incorrect.',
      EMAIL_TAKEN: 'An account with this e-mail already exists.',
      RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
      VALIDATION_ERROR: 'Please check the fields and try again.',
    },
  },
  workspaces: {
    title: 'Workspaces',
    empty: 'You are not part of any workspace yet. Create one to get started.',
    createTitle: 'New workspace',
    namePlaceholder: 'Workspace name',
    open: 'Open',
    notFound: 'Workspace not found, or you no longer have access to it.',
    members: 'Members',
    boards: 'Boards',
  },
  boards: {
    empty: 'No boards yet.',
    emptyArchived: 'No archived boards.',
    createTitle: 'New board',
    titlePlaceholder: 'Board title',
    archive: 'Archive',
    restore: 'Restore',
    showArchived: 'Show archived',
    showActive: 'Show active',
    readOnly: 'You have read-only access to this workspace.',
    placeholder: 'The collaborative board arrives in the next phase.',
  },
  members: {
    title: 'Members',
    you: 'you',
    remove: 'Remove',
    leave: 'Leave',
    inviteTitle: 'Invite people',
    invite: 'Send invitation',
    invited: 'Invitation sent to {{email}}.',
    errors: {
      ALREADY_MEMBER: 'This person is already a member.',
      FORBIDDEN: 'You do not have permission to do this.',
    },
  },
  invitations: {
    title: 'Workspace invitation',
    description: 'You have been invited to join a workspace on realtime-kanban.',
    accept: 'Accept invitation',
    errors: {
      INVITATION_INVALID: 'This invitation is invalid, expired or has already been used.',
      INVITATION_EMAIL_MISMATCH:
        'This invitation was sent to a different e-mail address. Sign in with that account to accept it.',
      ALREADY_MEMBER: 'You are already a member of this workspace.',
    },
  },
  notFound: {
    title: 'Page not found',
    home: 'Go to your workspaces',
  },
};

export type Resources = typeof en;
