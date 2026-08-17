import { PropsWithChildren } from "react";
import { Link as RouterLink } from "react-router";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import { useAuth } from "providers/AuthProvider";

const MainLayout = ({ children }: PropsWithChildren) => {
  const { logout } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Typography
            variant="h6"
            fontWeight={700}
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, color: "inherit", textDecoration: "none" }}
          >
            Hopper Budget
          </Typography>
          <Tooltip title="System">
            <IconButton component={RouterLink} to="/system">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Log out">
            <IconButton onClick={() => logout()}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
};

export default MainLayout;
