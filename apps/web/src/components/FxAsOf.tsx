import { Text } from '@mantine/core';
import type { ReactElement } from 'react';
import { formatDate } from '../format.ts';

/** `FX as of 30 Sep 2026`, under every view with converted figures (04 section 8.4). */
export function FxAsOf({ date }: { date: string }): ReactElement {
  return (
    <Text size="xs" c="dimmed">
      {`FX as of ${formatDate(date)}`}
    </Text>
  );
}
