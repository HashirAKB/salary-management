import type { EmployeeDetail } from '@acme/shared';
import type { ReactElement } from 'react';

export function TerminateModal(_props: {
  employee: EmployeeDetail;
  opened: boolean;
  onClose: () => void;
}): ReactElement {
  throw new Error('not implemented');
}
