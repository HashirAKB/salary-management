import { Alert } from '@mantine/core';
import { useSyncExternalStore, type ReactElement } from 'react';
import { connection } from '../api/connection.ts';

/** The waking banner under the header (04 section 8.2); content stays visible. */
export function ServerStatusBanner(): ReactElement | null {
  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  if (state === 'ok') return null;
  return (
    <Alert color="yellow" role="status" radius={0}>
      Waking the server. Free hosting sleeps after 15 minutes without use; this can take up to a
      minute.
    </Alert>
  );
}
