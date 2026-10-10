import { healthResponseSchema } from '@acme/shared';
import { Container, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

async function fetchHealth() {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error(`Health check failed with ${response.status}`);
  return healthResponseSchema.parse(await response.json());
}

// S0 placeholder: the app name and whether the API answers.
export function App(): ReactElement {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <Container py="xl">
      <Title order={1}>ACME Salary Manager</Title>
      <Text mt="md">API status: {health.data?.status ?? 'unknown'}</Text>
    </Container>
  );
}
