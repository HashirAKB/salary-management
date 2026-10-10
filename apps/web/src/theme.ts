import { createTheme, localStorageColorSchemeManager, Table } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md',
  components: {
    Table: Table.extend({ defaultProps: { striped: true, highlightOnHover: true } }),
  },
});

// The colour scheme survives reloads in localStorage (06 S3).
export const COLOR_SCHEME_KEY = 'acme-color-scheme';
export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_KEY });
