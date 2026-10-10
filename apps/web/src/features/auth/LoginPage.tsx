import { Alert, Button, Container, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/client.ts';
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
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: (me) => navigate(landingPath(me)) });
  }

  return (
    <Container size="xs" py="xl">
      <Title order={1}>ACME Salary Manager</Title>
      <form onSubmit={submit}>
        <Stack mt="lg">
          {login.isError && (
            <Alert color="red" role="alert">
              {errorMessage(login.error)}
            </Alert>
          )}
          <TextInput
            label="Email"
            type="email"
            autoComplete="username"
            required
            withAsterisk={false}
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            required
            withAsterisk={false}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Button type="submit" loading={login.isPending}>
            Log in
          </Button>
        </Stack>
      </form>
    </Container>
  );
}
