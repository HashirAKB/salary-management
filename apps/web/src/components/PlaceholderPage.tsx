import { Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';

/** A screen that a later slice builds (06 S2 scope). */
export function PlaceholderPage({ title }: { title: string }): ReactElement {
  return (
    <>
      <Title order={1}>{title}</Title>
      <Text mt="md" c="dimmed">
        This screen is coming soon.
      </Text>
    </>
  );
}
