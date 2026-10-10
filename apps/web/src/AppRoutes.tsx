import type { Action } from '@acme/shared';
import type { ComponentType, ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './components/PlaceholderPage.tsx';
import { NotFoundPage, RoleGate } from './components/RoleGate.tsx';
import { Shell, useViewer } from './components/Shell.tsx';
import { EmployeeListPage } from './features/employees/EmployeeListPage.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { landingPath } from './features/auth/useSession.ts';
import { ROUTES } from './routes.ts';

// Screens built so far, by path; every other route shows a placeholder.
const SCREENS: Record<string, ComponentType> = { '/employees': EmployeeListPage };

function Gated({
  action,
  title,
  path,
}: {
  action: Action;
  title: string;
  path: string;
}): ReactElement {
  const me = useViewer();
  const Screen = SCREENS[path];
  return (
    <RoleGate me={me} action={action}>
      {Screen ? <Screen /> : <PlaceholderPage title={title} />}
    </RoleGate>
  );
}

function Landing(): ReactElement {
  return <Navigate to={landingPath(useViewer())} replace />;
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
        <Route path="/" element={<Landing />} />
        {ROUTES.map(({ path, action, title }) => (
          <Route
            key={path}
            path={path}
            element={<Gated action={action} title={title} path={path} />}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
