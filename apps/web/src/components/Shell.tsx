import type { Action, MeResponse, Role } from '@acme/shared';
import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactElement } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router';
import { onUnauthenticated } from '../api/client.ts';
import { ME_KEY, useLogout, useMe } from '../features/auth/useSession.ts';
import { ToastProvider } from './Toasts.tsx';

const NAV: { to: string; label: string; action: Action }[] = [
  { to: '/employees', label: 'Employees', action: 'employee.read' },
  { to: '/insights', label: 'Insights', action: 'insights.read' },
  { to: '/insights/pay-equity', label: 'Pay equity', action: 'insights.read' },
];

const ROLE_LABELS: Record<Role, string> = {
  hr_admin: 'HR Admin',
  hr_viewer: 'HR Viewer',
  finance: 'Finance',
};

/** The viewer for screens inside the shell. */
export const useViewer = () => useOutletContext<MeResponse>();

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function ColorSchemeToggle(): ReactElement {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <ActionIcon
      variant="subtle"
      aria-label={`Switch to ${next} mode`}
      onClick={() => setColorScheme(next)}
    >
      {scheme === 'dark' ? (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg {...iconProps}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </ActionIcon>
  );
}

function UserMenu({ me }: { me: MeResponse }): ReactElement {
  const navigate = useNavigate();
  const logout = useLogout();
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Button variant="subtle">
          {me.user.displayName}
          <Badge ml="xs" variant="light">
            {ROLE_LABELS[me.user.role]}
          </Badge>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// Header with the app name, nav gated by `me.permissions` and the user menu (04 section 8.1).
export function Shell(): ReactElement {
  const me = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const loginWithNext = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  // Session expired: any 401 after login clears the cache and asks to log in again (04 8.2).
  useEffect(
    () =>
      onUnauthenticated(() => {
        if (!queryClient.getQueryData(ME_KEY)) return;
        queryClient.clear();
        navigate(loginWithNext, { state: { sessionExpired: true } });
      }),
    [queryClient, navigate, loginWithNext],
  );

  // Logged out: `me` returned 401 (04 section 8.2).
  if (me.isError) return <Navigate to={loginWithNext} replace />;

  if (!me.data) {
    return (
      <Center h="100vh">
        <Loader aria-label="Checking your session" />
      </Center>
    );
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={4} component="p">
              ACME Salary Manager
            </Title>
            <Group component="nav" gap="sm" aria-label="Main">
              {NAV.filter((item) => me.data.permissions.includes(item.action)).map((item) => (
                <NavLink key={item.to} to={item.to} end>
                  {item.label}
                </NavLink>
              ))}
            </Group>
          </Group>
          <Group gap="xs">
            <ColorSchemeToggle />
            <UserMenu me={me.data} />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <ToastProvider>
          <Outlet context={me.data} />
        </ToastProvider>
      </AppShell.Main>
    </AppShell>
  );
}
