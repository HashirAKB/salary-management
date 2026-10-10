import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { PlaceholderPage } from './components/PlaceholderPage.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';

/** Every screen by URL (04 section 8.1). */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/employees" element={<PlaceholderPage title="Employees" />} />
      <Route path="/insights" element={<PlaceholderPage title="Insights" />} />
    </Routes>
  );
}
