import { Text, type TextProps } from '@mantine/core';
import type { ReactElement } from 'react';
import { formatMoney, type MoneyValue } from '../format.ts';

/** The only place money is formatted for display (04 section 8.4). */
export function Money({ value, ...props }: { value: MoneyValue } & TextProps): ReactElement {
  return (
    <Text span {...props}>
      {formatMoney(value)}
    </Text>
  );
}
