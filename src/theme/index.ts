import { createTheme, ThemeOptions } from "@mui/material/styles";

// Color Palette - Modern Fintech Purple
const palette = {
  primary: {
    main: "#7C3AED",
    light: "#A78BFA",
    dark: "#5B21B6",
    contrastText: "#FFFFFF",
    50: "#F5F3FF",
    100: "#EDE9FE",
    200: "#DDD6FE",
  },
  secondary: {
    main: "#6366F1",
    light: "#818CF8",
    dark: "#4F46E5",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#FAFAFA",
    paper: "#FFFFFF",
  },
  text: {
    primary: "#18181B",
    secondary: "#71717A",
    disabled: "#A1A1AA",
  },
  divider: "#E4E4E7",
  success: {
    main: "#10B981",
    light: "#D1FAE5",
    dark: "#059669",
    contrastText: "#FFFFFF",
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
  },
  warning: {
    main: "#F59E0B",
    light: "#FEF3C7",
    dark: "#D97706",
    contrastText: "#FFFFFF",
  },
  error: {
    main: "#EF4444",
    light: "#FEE2E2",
    dark: "#DC2626",
    contrastText: "#FFFFFF",
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
  },
  grey: {
    50: "#FAFAFA",
    100: "#F4F4F5",
    200: "#E4E4E7",
    300: "#D4D4D8",
    400: "#A1A1AA",
    500: "#71717A",
    600: "#52525B",
    700: "#3F3F46",
    800: "#27272A",
    900: "#18181B",
  },
};

const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    ...palette,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: "1.5rem",
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontSize: "0.9375rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.8125rem",
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.4,
    },
    button: {
      fontSize: "0.875rem",
      fontWeight: 500,
      textTransform: "none" as const,
      letterSpacing: "0",
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#FAFAFA",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 16px",
          fontWeight: 500,
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
          color: "#FFFFFF",
          "&:hover": {
            background: "linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)",
          },
        },
        outlined: {
          borderColor: "#E4E4E7",
          "&:hover": {
            borderColor: "#A78BFA",
            backgroundColor: "rgba(124, 58, 237, 0.04)",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: "#FFFFFF",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "#A78BFA",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#7C3AED",
              borderWidth: 2,
            },
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#E4E4E7",
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: "1px solid #E4E4E7",
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          fontSize: "0.75rem",
        },
        sizeSmall: {
          height: 24,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #E4E4E7",
          height: 64,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: "#71717A",
          minWidth: 60,
          padding: "6px 0",
          "&.Mui-selected": {
            color: "#7C3AED",
          },
          "& .MuiBottomNavigationAction-label": {
            fontSize: "0.6875rem",
            fontWeight: 500,
            marginTop: 4,
            "&.Mui-selected": {
              fontSize: "0.6875rem",
            },
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 44,
          height: 24,
          padding: 0,
        },
        switchBase: {
          padding: 2,
          "&.Mui-checked": {
            transform: "translateX(20px)",
            color: "#fff",
            "& + .MuiSwitch-track": {
              backgroundColor: "#7C3AED",
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 20,
          height: 20,
          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        },
        track: {
          borderRadius: 12,
          backgroundColor: "#E4E4E7",
          opacity: 1,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#18181B",
          fontSize: "0.75rem",
          borderRadius: 6,
          padding: "6px 10px",
        },
        arrow: {
          color: "#18181B",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&:hover": {
            backgroundColor: "rgba(124, 58, 237, 0.08)",
          },
        },
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: "1px solid #E4E4E7",
          borderRadius: "12px !important",
          "&:before": {
            display: "none",
          },
          "&.Mui-expanded": {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 48,
          padding: "0 16px",
          "&.Mui-expanded": {
            minHeight: 48,
          },
        },
        content: {
          margin: "12px 0",
          "&.Mui-expanded": {
            margin: "12px 0",
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: "0 16px 16px",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        standardSuccess: {
          backgroundColor: "#D1FAE5",
          color: "#059669",
        },
        standardWarning: {
          backgroundColor: "#FEF3C7",
          color: "#D97706",
        },
        standardError: {
          backgroundColor: "#FEE2E2",
          color: "#DC2626",
        },
      },
    },
    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: "bottom", horizontal: "center" },
      },
    },
  },
};

export const sorbetTheme = createTheme(themeOptions);

// Monospace font for addresses and code
export const monoFontFamily = '"SF Mono", "Fira Code", Consolas, monospace';
