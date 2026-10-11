import type { AskAnswerResponse, AskCannotAnswerResponse, AskResponse } from '@acme/shared';
import { Alert, Button, Card, Group, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { useState, type ReactElement } from 'react';
import { ApiError } from '../../api/client.ts';
import { FxAsOf } from '../../components/FxAsOf.tsx';
import { Money } from '../../components/Money.tsx';
import { useViewer } from '../../components/Shell.tsx';
import { formatGapPct } from '../../format.ts';
import { useAsk } from './api.ts';

const MAX_LENGTH = 500;
const EXAMPLE_CHIPS = [
  'How does total payroll split by country?',
  'How many people are paid outside their band in the US?',
  'What is the gender pay gap for Account Executives by level?',
];
const NOT_SET_UP = "Ask about pay isn't set up on this server. Everything else works without it.";

type Row = AskAnswerResponse['result']['rows'][number];

const resetFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function ValueCell({ row }: { row: Row }): ReactElement {
  const { value } = row;
  if (row.suppressed || value === null) return <Text span>Hidden (fewer than 5)</Text>;
  switch (value.type) {
    case 'count':
      return <Text span>{value.count}</Text>;
    case 'money':
      return (
        <>
          <Money value={value.local ?? value.usd} />
          {value.local ? (
            <>
              {' '}
              (<Money value={value.usd} />)
            </>
          ) : null}
        </>
      );
    case 'outsideBand':
      return <Text span>{`${value.total} (${value.below} below, ${value.above} above)`}</Text>;
    case 'gap':
      return <Text span>{formatGapPct(value.gapPct)}</Text>;
  }
}

function AnswerCard({ response }: { response: AskAnswerResponse }): ReactElement {
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Text>{response.answer}</Text>
        {response.result.groupBy !== 'none' ? (
          <Table aria-label="Answer by group">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Group</Table.Th>
                <Table.Th>Headcount</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {response.result.rows.map((row) => (
                <Table.Tr key={row.key}>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td>{row.headcount ?? ''}</Table.Td>
                  <Table.Td>
                    <ValueCell row={row} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : null}
        <Text fw={600} size="sm">
          How I read your question
        </Text>
        <ul aria-label="How I read your question">
          {response.interpretation.map(({ label, value }) => (
            <li key={label}>
              <Text span fw={500}>
                {label}
              </Text>{' '}
              <Text span>{value}</Text>
            </li>
          ))}
        </ul>
        <FxAsOf date={response.fxAsOf} />
      </Stack>
    </Card>
  );
}

function CannotAnswerCard({
  response,
  onSuggest,
}: {
  response: AskCannotAnswerResponse;
  onSuggest: (text: string) => void;
}): ReactElement {
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Text>{response.message}</Text>
        {response.suggestion ? (
          <Group gap="xs">
            <Text size="sm">Try:</Text>
            <Button
              variant="light"
              size="compact-sm"
              onClick={() => onSuggest(response.suggestion)}
            >
              {response.suggestion}
            </Button>
          </Group>
        ) : null}
        <Text size="sm">Examples:</Text>
        <ul>
          {response.examples.map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      </Stack>
    </Card>
  );
}

function usageOf(response: AskResponse | undefined): string | null {
  return response
    ? `${response.usage.usedToday} of ${response.usage.dailyLimit} questions used today.`
    : null;
}

export function AskPage(): ReactElement {
  const me = useViewer();
  const ask = useAsk();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<AskResponse[]>([]);

  if (!me.askEnabled) {
    return (
      <>
        <Title order={1}>Ask about pay</Title>
        <Text mt="md">{NOT_SET_UP}</Text>
      </>
    );
  }

  const submit = () => {
    ask.mutate(question.trim(), {
      onSuccess: (response) => setHistory((earlier) => [response, ...earlier]),
    });
  };

  const [latest, ...earlier] = history;
  const trimmed = question.trim();
  const error = ask.error instanceof ApiError ? ask.error : null;
  const resetAt =
    error?.retryAfter === undefined ? null : new Date(ask.submittedAt + error.retryAfter * 1000);

  return (
    <Stack>
      <Title order={1}>Ask about pay</Title>
      <Textarea
        label="Your question"
        value={question}
        onChange={(event) => setQuestion(event.currentTarget.value)}
        maxLength={MAX_LENGTH}
        minRows={2}
        description={`${question.length}/${MAX_LENGTH}`}
      />
      {history.length === 0 ? (
        <Group gap="xs">
          {EXAMPLE_CHIPS.map((example) => (
            <Button
              key={example}
              variant="light"
              size="compact-sm"
              onClick={() => setQuestion(example)}
            >
              {example}
            </Button>
          ))}
        </Group>
      ) : null}
      <Group>
        <Button onClick={submit} disabled={ask.isPending || trimmed.length === 0}>
          {ask.isPending ? 'Reading your question...' : 'Ask'}
        </Button>
        {usageOf(latest) ? <Text size="sm">{usageOf(latest)}</Text> : null}
      </Group>
      {error ? (
        <Alert color="red" role="alert">
          <Text>{error.code === 'ASK_UNAVAILABLE' ? NOT_SET_UP : error.message}</Text>
          {error.code === 'ASK_LIMIT_REACHED' && resetAt ? (
            <Text size="sm">{`Resets at ${resetFormatter.format(resetAt)} your time`}</Text>
          ) : null}
          {error.code === 'ASK_UPSTREAM_FAILED' ? (
            <Button mt="xs" size="compact-sm" onClick={submit}>
              Try again
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {latest?.kind === 'answer' ? <AnswerCard response={latest} /> : null}
      {latest?.kind === 'cannot_answer' ? (
        <CannotAnswerCard response={latest} onSuggest={setQuestion} />
      ) : null}
      {earlier.length > 0 ? (
        <Stack gap="xs">
          <Title order={2} size="h4">
            Earlier questions
          </Title>
          {earlier.map((response, index) => (
            <Card key={`${earlier.length - index}`} withBorder>
              <Text fw={500}>{response.question}</Text>
              <Text size="sm">
                {response.kind === 'answer' ? response.answer : response.message}
              </Text>
            </Card>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
