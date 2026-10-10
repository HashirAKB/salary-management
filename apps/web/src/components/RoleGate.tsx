import type { Action, MeResponse } from '@acme/shared';
import { Anchor, Text, Title } from '@mantine/core';
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';
import { landingPath } from '../features/auth/useSession.ts';

/** In-shell page for a route the viewer may not open; no redirect, so the reason shows (04 8.2). */
export function ForbiddenPage({ me }: { me: MeResponse }): ReactElement {
  return (
    <>
      <Title order={1}>No access</Title>
      <Text mt="md">You don&apos;t have access to this page.</Text>
      <Anchor component={Link} to={landingPath(me)} mt="sm" display="block">
        Go to your start page
      </Anchor>
    </>
  );
}

export function NotFoundPage({ me }: { me: MeResponse }): ReactElement {
  return (
    <>
      <Title order={1}>Page not found</Title>
      <Anchor component={Link} to={landingPath(me)} mt="sm" display="block">
        Go to your start page
      </Anchor>
    </>
  );
}

/** Renders the route only when `me` grants the action (04 section 8.1). */
export function RoleGate({
  me,
  action,
  children,
}: {
  me: MeResponse;
  action: Action;
  children: ReactNode;
}): ReactElement {
  return me.permissions.includes(action) ? <>{children}</> : <ForbiddenPage me={me} />;
}
