import type { Action } from '@acme/shared';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { PlaceholderPage } from './components/PlaceholderPage.tsx';
import { NotFoundPage, RoleGate } from './components/RoleGate.tsx';
import { Shell, useViewer } from './components/Shell.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';

function Gated({ action, title }: { action: Action; title: string }): ReactElement {
  const me = useViewer();
  return (
    <RoleGate me={me} action={action}>
      <PlaceholderPage title={title} />
    </RoleGate>
  );
}

function NotFound(): ReactElement {
  return <NotFoundPage me={useViewer()} />;
}

/** Every screen by URL (04 section 8.1). Screens are placeholders until their slice. */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Shell />}>
        <Route path="/employees" element={<Gated action="employee.read" title="Employees" />} />
        <Route
          path="/employees/new"
          element={<Gated action="employee.write" title="Add employee" />}
        />
        <Route path="/employees/:id" element={<Gated action="employee.read" title="Employee" />} />
        <Route path="/insights" element={<Gated action="insights.read" title="Insights" />} />
        <Route
          path="/insights/pay-equity"
          element={<Gated action="insights.read" title="Pay equity" />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
