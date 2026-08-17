import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import MainLayout from "layouts/MainLayout";

const COLUMNS = [
  "Month",
  "Total In",
  "Committed Recurring",
  "Spent So Far",
  "Safe to Spend",
  "Status",
  "# Needing Review",
];

const MonthsGrid = () => {
  return (
    <MainLayout>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Months
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell key={col}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={COLUMNS.length}>
                <Box sx={{ py: 3, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    No months yet — this fills in once the sync job and full D1 schema are wired up.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </MainLayout>
  );
};

export default MonthsGrid;
