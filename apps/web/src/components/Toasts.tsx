import { Alert, Stack } from '@mantine/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => {});

/** Shows `message` for a few seconds; screens call it instead of a toast library (no dependency). */
export const useToast = () => useContext(ToastContext);

const DURATION_MS = 5000;
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message }]);
    setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      DURATION_MS,
    );
  }, []);
  const value = useMemo(() => show, [show]);

  // A toast sent with a navigation (`navigate(path, { state: { toast } })`) shows once the new
  // page is in place, then leaves the history entry clean.
  const location = useLocation();
  const navigate = useNavigate();
  const shownFor = useRef<string>(undefined);
  useEffect(() => {
    const message = (location.state as { toast?: string } | null)?.toast;
    if (!message || shownFor.current === location.key) return;
    shownFor.current = location.key;
    show(message);
    void navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate, show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Stack pos="fixed" bottom={16} right={16} style={{ zIndex: 1000 }} role="status">
        {toasts.map((toast) => (
          <Alert key={toast.id} color="green" withCloseButton={false}>
            {toast.message}
          </Alert>
        ))}
      </Stack>
    </ToastContext.Provider>
  );
}
