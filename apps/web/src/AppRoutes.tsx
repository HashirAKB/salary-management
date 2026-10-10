import type { Action } from '@acme/shared';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { PlaceholderPage } from './components/PlaceholderPage.tsx';
import { NotFoundPage, RoleGate } from './components/RoleGate.tsx';
import { Shell, useViewer } from './components/Shell.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { ROUTES } from './routes.ts';

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
        {ROUTES.map(({ path, action, title }) => (
          <Route key={path} path={path} element={<Gated action={action} title={title} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
