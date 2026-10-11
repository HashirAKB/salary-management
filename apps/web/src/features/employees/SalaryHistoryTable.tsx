import type { SalaryChangeItem } from '@acme/shared';
import { Table } from '@mantine/core';
import type { ReactElement } from 'react';
import { Money } from '../../components/Money.tsx';
import { formatChangePct, formatDate } from '../../format.ts';

const REASONS: Record<SalaryChangeItem['reason'], string> = {
  hire: 'Hire',
  merit: 'Merit increase',
  promotion: 'Promotion',
  market_adjustment: 'Market adjustment',
  correction: 'Correction',
};

const level = ({ code, name }: { code: string; name: string }) => `${code} ${name}`;

// "L2 Intermediate to L3 Senior" when the level moved, otherwise the position as it stands.
function position(item: SalaryChangeItem): string {
  const { previousJobTitle, previousLevel } = item;
  if (!previousJobTitle || !previousLevel) return `${item.jobTitle.name}, ${level(item.level)}`;
  const titleMoved = previousJobTitle.id !== item.jobTitle.id;
  const levelMoved = previousLevel.code !== item.level.code;
  if (titleMoved) {
    return `${previousJobTitle.name}, ${level(previousLevel)} to ${item.jobTitle.name}, ${level(item.level)}`;
  }
  return levelMoved
    ? `${level(previousLevel)} to ${level(item.level)}`
    : `${item.jobTitle.name}, ${level(item.level)}`;
}

/** The history rows of S-3 (04 section 8.5), newest first as served. */
export function SalaryHistoryTable({ items }: { items: SalaryChangeItem[] }): ReactElement {
  return (
    <Table.ScrollContainer minWidth={600}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Effective date</Table.Th>
            <Table.Th>Reason</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Change</Table.Th>
            <Table.Th>Position</Table.Th>
            <Table.Th>Recorded by</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{formatDate(item.effectiveDate)}</Table.Td>
              <Table.Td>{REASONS[item.reason]}</Table.Td>
              <Table.Td>
                <Money value={item.amount} />
              </Table.Td>
              <Table.Td>{formatChangePct(item.changePct)}</Table.Td>
              <Table.Td>{position(item)}</Table.Td>
              <Table.Td>{item.changedBy?.displayName ?? 'Imported'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
