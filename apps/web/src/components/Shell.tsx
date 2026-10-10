import type { Action, MeResponse, Role } from '@acme/shared';
import { AppShell, Badge, Button, Center, Group, Loader, Menu, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router';
import { useLogout, useMe } from '../features/auth/useSession.ts';

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
          <UserMenu me={me.data} />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet context={me.data} />
      </AppShell.Main>
    </AppShell>
  );
}
