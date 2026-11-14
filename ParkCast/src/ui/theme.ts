export const colors = {
  bg: '#F7F8FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F8',
  border: '#E3E7EF',
  text: '#0E1525',
  textSecondary: '#5B6475',
  textMuted: '#98A0AF',
  primary: '#1A73E8',
  primaryPressed: '#1558B0',
  primarySoft: '#E8F0FE',
  success: '#12A150',
  successSoft: '#E6F6EC',
  warning: '#E37400',
  warningSoft: '#FEF3E2',
  danger: '#D93025',
  dangerSoft: '#FCE8E6',
  gold: '#F5B400',
  ink: '#0B1220',
  white: '#FFFFFF',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const space = (n: number) => n * 4;

export const shadow = {
  card: {
    shadowColor: '#0E1525',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#0E1525',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

export const text = {
  hero: { fontSize: 34, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '500' as const, color: colors.text },
  secondary: { fontSize: 14, fontWeight: '500' as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '600' as const, color: colors.textMuted },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
};
