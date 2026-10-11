import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './AppRoutes.tsx';
import { createQueryClient } from './queryClient.ts';
import { COLOR_SCHEME_KEY, colorSchemeManager, theme } from './theme.ts';

const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorSchemeScript localStorageKey={COLOR_SCHEME_KEY} />
    <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
