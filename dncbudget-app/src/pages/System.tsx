import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MainLayout from "layouts/MainLayout";

type PlaidResult =
  | { ok: true; account: string; count: number; transactions: { date: string; name: string; amount: number }[] }
  | { ok: false; error: string };

type QuotaResult = { ok: true; quotaRemaining?: number } | { ok: false; error: string };

type SendTestResult = { ok: true; sentTo: string; quotaRemaining?: number } | { ok: false; error: string };

type RunSyncResult =
  | {
      ok: true;
      items: { item: string; accountsSynced: number; transactionsAdded: number; error?: string }[];
      recurringMatched: number;
      transfersDetected: number;
      categorized: number;
      unclassified: number;
    }
  | { ok: false; error: string };

const System = () => {
  const [quota, setQuota] = useState<QuotaResult | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<SendTestResult | null>(null);

  const [plaidLoading, setPlaidLoading] = useState<"personal" | "business" | null>(null);
  const [plaidResult, setPlaidResult] = useState<PlaidResult | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<RunSyncResult | null>(null);

  const refreshQuota = async () => {
    setQuotaLoading(true);
    try {
      const response = await fetch("/api/dncbudget/system/sms-quota", { credentials: "same-origin" });
      setQuota((await response.json()) as QuotaResult);
    } catch {
      setQuota({ ok: false, error: "Request failed" });
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    void refreshQuota();
  }, []);

  const handleSendTest = async () => {
    setSendLoading(true);
    setSendResult(null);
    try {
      const response = await fetch("/api/dncbudget/system/send-test-sms", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await response.json()) as SendTestResult;
      setSendResult(data);
      if (data.ok) void refreshQuota();
    } catch {
      setSendResult({ ok: false, error: "Request failed" });
    } finally {
      setSendLoading(false);
    }
  };

  const handleRunSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/dncbudget/system/run-sync", {
        method: "POST",
        credentials: "same-origin",
      });
      setSyncResult((await response.json()) as RunSyncResult);
    } catch {
      setSyncResult({ ok: false, error: "Request failed" });
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePullTransactions = async (account: "personal" | "business") => {
    setPlaidLoading(account);
    setPlaidResult(null);
    try {
      const response = await fetch(`/api/dncbudget/system/plaid-transactions?account=${account}`, {
        credentials: "same-origin",
      });
      setPlaidResult((await response.json()) as PlaidResult);
    } catch {
      setPlaidResult({ ok: false, error: "Request failed" });
    } finally {
      setPlaidLoading(null);
    }
  };

  return (
    <MainLayout>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        System
      </Typography>

      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            SMS
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Textbelt quota remaining
              </Typography>
              {quotaLoading ? (
                <CircularProgress size={20} sx={{ mt: 1 }} />
              ) : quota?.ok ? (
                <Typography variant="h4" fontWeight={700}>
                  {quota.quotaRemaining ?? "—"}
                </Typography>
              ) : (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {quota && !quota.ok ? quota.error : "Unknown"}
                </Alert>
              )}
            </Box>

            <Box>
              <Button variant="contained" onClick={handleSendTest} disabled={sendLoading}>
                {sendLoading ? <CircularProgress size={20} color="inherit" /> : "Send Test SMS"}
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Sends to the default recipient only, not everyone in the table.
              </Typography>
              {sendResult && sendResult.ok && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Sent to {sendResult.sentTo}
                  {sendResult.quotaRemaining !== undefined ? ` — quota remaining: ${sendResult.quotaRemaining}` : ""}
                </Alert>
              )}
              {sendResult && !sendResult.ok && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {sendResult.error}
                </Alert>
              )}
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Sync
          </Typography>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Pulls transactions from both linked Plaid accounts, matches against recurring bills and
              transfers, and applies merchant-category memory. No Cron Trigger yet — this is the manual
              run until that's wired up.
            </Typography>
            <Box>
              <Button variant="contained" onClick={handleRunSync} disabled={syncLoading}>
                {syncLoading ? <CircularProgress size={20} color="inherit" /> : "Run Sync"}
              </Button>
              {syncResult && syncResult.ok && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {syncResult.items.map((item, i) => (
                      <li key={i}>
                        {item.item}: {item.accountsSynced} account(s), {item.transactionsAdded} new transaction(s)
                        {item.error ? ` — error: ${item.error}` : ""}
                      </li>
                    ))}
                  </Box>
                  Matched {syncResult.recurringMatched} recurring, {syncResult.transfersDetected} transfer pair(s),
                  categorized {syncResult.categorized} — {syncResult.unclassified} left unclassified.
                </Alert>
              )}
              {syncResult && !syncResult.ok && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {syncResult.error}
                </Alert>
              )}
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Plaid
          </Typography>
          <Stack spacing={2}>
            <ButtonGroup variant="contained">
              <Button onClick={() => handlePullTransactions("personal")} disabled={plaidLoading !== null}>
                {plaidLoading === "personal" ? <CircularProgress size={20} color="inherit" /> : "Pull Personal"}
              </Button>
              <Button onClick={() => handlePullTransactions("business")} disabled={plaidLoading !== null}>
                {plaidLoading === "business" ? <CircularProgress size={20} color="inherit" /> : "Pull Business"}
              </Button>
            </ButtonGroup>
            {plaidResult && plaidResult.ok && (
              <Alert severity="success">
                {plaidResult.account}: {plaidResult.count} transaction(s)
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
        </Paper>
      </Stack>
    </MainLayout>
  );
};

export default System;
