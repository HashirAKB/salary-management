import { Alert, Button } from '@mantine/core';
import { useSyncExternalStore, type ReactElement } from 'react';
import { connection } from '../api/connection.ts';

/** The waking and server-down banners under the header (04 section 8.2); content stays visible. */
export function ServerStatusBanner(): ReactElement | null {
  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  if (state === 'ok') return null;
  if (state === 'down') {
    return (
      <Alert color="red" role="alert" radius={0}>
        The server isn't responding.{' '}
        <Button size="compact-sm" variant="light" color="red" onClick={connection.tryAgain}>
          Try again
        </Button>
      </Alert>
    );
  }
  return (
    <Alert color="yellow" role="status" radius={0}>
      Waking the server. Free hosting sleeps after 15 minutes without use; this can take up to a
      minute.
    </Alert>
  );
}
