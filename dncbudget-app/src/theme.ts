import { createTheme } from "@mui/material/styles";

// Colors matched to CCG admin's default-light Aurora theme (blue/purple palette,
// Plus Jakarta Sans) so this app reads as visually related without pulling in
// the full Aurora theme system's dependency footprint.
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3385F0" },
    secondary: { main: "#A641FA" },
    error: { main: "#D02241" },
    warning: { main: "#F68D2A" },
    success: { main: "#099F69" },
    info: { main: "#0DA6D6" },
    background: {
      default: "#F7F8FA",
      paper: "#FFFFFF",
    },
  },
  typography: {
    fontFamily: ["Plus Jakarta Sans", "Inter", "Roboto", "sans-serif"].join(","),
  },
  shape: {
    borderRadius: 8,
  },
});

export default theme;
