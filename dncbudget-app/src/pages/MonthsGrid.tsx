import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MainLayout from "layouts/MainLayout";

interface MonthSummary {
  month: string;
  totalIn: number | null;
  committedRecurring: number;
  spentSoFar: number;
  safeToSpend: number | null;
  status: "green" | "warning" | "red" | null;
  needingReview: number;
}

const STATUS_COLOR: Record<string, "success" | "warning" | "error"> = {
  green: "success",
  warning: "warning",
  red: "error",
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const fmt = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

const MonthsGrid = () => {
  const navigate = useNavigate();
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/dncbudget/months", { credentials: "same-origin" });
    const data = await response.json();
    if (data.ok) setMonths(data.months);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <MainLayout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Months
        </Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          Set Total In
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Month</TableCell>
              <TableCell align="right">Total In</TableCell>
              <TableCell align="right">Committed Recurring</TableCell>
              <TableCell align="right">Spent So Far</TableCell>
              <TableCell align="right">Safe to Spend</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right"># Needing Review</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && months.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ py: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No months yet — set a Total In to create the current month, or wait for the sync job.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {months.map((m) => (
              <TableRow
                key={m.month}
                hover
                onClick={() => navigate(`/month?month=${m.month}`)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>{m.month}</TableCell>
                <TableCell align="right">{fmt(m.totalIn)}</TableCell>
                <TableCell align="right">{fmt(m.committedRecurring)}</TableCell>
                <TableCell align="right">{fmt(m.spentSoFar)}</TableCell>
                <TableCell align="right">{fmt(m.safeToSpend)}</TableCell>
                <TableCell>
                  {m.status ? <Chip size="small" label={m.status} color={STATUS_COLOR[m.status]} /> : "—"}
                </TableCell>
                <TableCell align="right">{m.needingReview}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {dialogOpen && (
        <SetTotalInDialog
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            void load();
          }}
        />
      )}
    </MainLayout>
  );
};

const SetTotalInDialog = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const [month, setMonth] = useState(currentMonth());
  const [totalIn, setTotalIn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    await fetch(`/api/dncbudget/months/${month}/total-in`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ totalIn: Number(totalIn) }),
    });
    setSubmitting(false);
    onSaved();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Set Total In</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Total In"
            type="number"
            value={totalIn}
            onChange={(e) => setTotalIn(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting || !totalIn}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MonthsGrid;
