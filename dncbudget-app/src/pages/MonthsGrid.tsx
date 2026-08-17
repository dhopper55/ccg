import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
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

// Throwaway test number for the "Send SMS" smoke test button — not read from
// anywhere else, just a fixed target for confirming the Textbelt path works.
const TEST_SMS_PHONE = "3039016435";

type PlaidTestResult =
  | { ok: true; count: number; transactions: { date: string; name: string; amount: number }[] }
  | { ok: false; error: string };

type SmsTestResult = { ok: true; textId?: string; quotaRemaining?: number } | { ok: false; error: string };

const MonthsGrid = () => {
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [plaidResult, setPlaidResult] = useState<PlaidTestResult | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsResult, setSmsResult] = useState<SmsTestResult | null>(null);

  const handleReadTransactions = async () => {
    setPlaidLoading(true);
    setPlaidResult(null);
    try {
      const response = await fetch("/api/dncbudget/test/plaid-transactions", {
        credentials: "same-origin",
      });
      const data = (await response.json()) as PlaidTestResult;
      setPlaidResult(data);
    } catch {
      setPlaidResult({ ok: false, error: "Request failed" });
    } finally {
      setPlaidLoading(false);
    }
  };

  const handleSendSms = async () => {
    setSmsLoading(true);
    setSmsResult(null);
    try {
      const response = await fetch("/api/dncbudget/test/send-sms", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: TEST_SMS_PHONE,
          message: "Hopper Budget test text — if you got this, the SMS path works.",
        }),
      });
      const data = (await response.json()) as SmsTestResult;
      setSmsResult(data);
    } catch {
      setSmsResult({ ok: false, error: "Request failed" });
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <MainLayout>
      <Stack spacing={4}>
        <Box>
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
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                      No months yet — this fills in once the sync job and D1 schema are wired up.
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider />

        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              System Check
            </Typography>
            <Chip label="temporary — throwaway" size="small" color="warning" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Two one-off buttons to confirm the live Plaid and Textbelt paths work once deployed. Not part of the
            real app.
          </Typography>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleReadTransactions}
                  disabled={plaidLoading}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {plaidLoading ? <CircularProgress size={20} color="inherit" /> : "Read Transactions"}
                </Button>
                {plaidResult && plaidResult.ok && (
                  <Alert severity="success">
                    Pulled {plaidResult.count} transaction(s):
                    <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                      {plaidResult.transactions.map((t, i) => (
                        <li key={i}>
                          {t.date} — {t.name} — ${t.amount.toFixed(2)}
                        </li>
                      ))}
                    </Box>
                  </Alert>
                )}
                {plaidResult && !plaidResult.ok && <Alert severity="error">{plaidResult.error}</Alert>}
              </Stack>

              <Stack spacing={1}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleSendSms}
                  disabled={smsLoading}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {smsLoading ? <CircularProgress size={20} color="inherit" /> : "Send SMS"}
                </Button>
                {smsResult && smsResult.ok && (
                  <Alert severity="success">
                    Sent to {TEST_SMS_PHONE}
                    {smsResult.quotaRemaining !== undefined ? ` — quota remaining: ${smsResult.quotaRemaining}` : ""}
                  </Alert>
                )}
                {smsResult && !smsResult.ok && <Alert severity="error">{smsResult.error}</Alert>}
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </MainLayout>
  );
};

export default MonthsGrid;
