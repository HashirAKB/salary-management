import type { EmployeeDetail } from '@acme/shared';
import type { ReactElement } from 'react';

type Props = { employee: EmployeeDetail; opened: boolean; onClose: () => void };

/** S-6 (04 section 8.5): record a raise, promotion or correction. */
export function SalaryChangeModal(_props: Props): ReactElement {
  throw new Error('not implemented');
}
