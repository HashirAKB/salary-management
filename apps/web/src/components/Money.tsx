import type { ReactElement } from 'react';
import type { MoneyValue } from '../format.ts';

/** The only place money is formatted for display (04 section 8.4). */
export function Money(_props: { value: MoneyValue }): ReactElement {
  throw new Error('not implemented');
}
