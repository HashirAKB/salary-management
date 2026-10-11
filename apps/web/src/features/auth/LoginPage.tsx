import { Alert, Button, Container, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client.ts';
import { mayOpen } from '../../routes.ts';
import { landingPath, useLogin } from './useSession.ts';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
    return 'Email or password is incorrect.';
  }
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return `Too many attempts. Try again in ${error.retryAfter ?? 60} seconds.`;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

// S-1 (04 section 8.5).
export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const sessionExpired = (location.state as { sessionExpired?: boolean } | null)?.sessionExpired;
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = {
      email: email.trim() ? undefined : 'Enter your email.',
      password: password ? undefined : 'Enter your password.',
    };
    setMissing(found);
    if (found.email || found.password) return;
    login.mutate(
      { email, password },
      // ?next= only when the viewer may open that route (04 section 8.1).
      { onSuccess: (me) => navigate(next && mayOpen(me, next) ? next : landingPath(me)) },
    );
  }

  return (
    <Container size="xs" py="xl">
      <Title order={1}>ACME Salary Manager</Title>
      <form onSubmit={submit} noValidate>
        <Stack mt="lg">
          {sessionExpired && !login.isError && (
            <Alert color="yellow">Your session expired. Log in again.</Alert>
          )}
          {login.isError && (
            <Alert color="red" role="alert">
              {errorMessage(login.error)}
            </Alert>
          )}
          <TextInput
            label="Email"
            type="email"
            autoComplete="username"
            withAsterisk={false}
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            error={missing.email}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            withAsterisk={false}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={missing.password}
          />
          <Button type="submit" loading={login.isPending}>
            Log in
          </Button>
        </Stack>
      </form>
    </Container>
  );
}
