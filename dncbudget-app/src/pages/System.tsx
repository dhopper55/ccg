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

type SendSunshineIntroResult = { ok: true; started: true; parts: number; etaSeconds: number } | { ok: false; error: string };

const System = () => {
  const [quota, setQuota] = useState<QuotaResult | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<SendTestResult | null>(null);

  const [plaidLoading, setPlaidLoading] = useState<"personal" | "business" | null>(null);
  const [plaidResult, setPlaidResult] = useState<PlaidResult | null>(null);

  const [introLoading, setIntroLoading] = useState(false);
  const [introResult, setIntroResult] = useState<SendSunshineIntroResult | null>(null);

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

  const handleSendSunshineIntro = async () => {
    if (!window.confirm("Send Sunshine's intro text to both David and Chrissie now? This actually sends — one-off, can't be undone.")) {
      return;
    }
    setIntroLoading(true);
    setIntroResult(null);
    try {
      const response = await fetch("/api/dncbudget/system/send-sunshine-intro", {
        method: "POST",
        credentials: "same-origin",
      });
      setIntroResult((await response.json()) as SendSunshineIntroResult);
    } catch {
      setIntroResult({ ok: false, error: "Request failed" });
    } finally {
      setIntroLoading(false);
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

        <Paper variant="outlined" sx={{ p: 3, borderColor: "warning.main" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            One-off: Sunshine intro text
          </Typography>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Sends the 7-part pre-launch welcome text to every active recipient (David + Chrissie),
              8 seconds apart. Real send — remove this panel once it's been used.
            </Typography>
            <Box>
              <Button variant="contained" color="warning" onClick={handleSendSunshineIntro} disabled={introLoading}>
                {introLoading ? <CircularProgress size={20} color="inherit" /> : "Send Sunshine Intro"}
              </Button>
              {introResult && introResult.ok && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Started — {introResult.parts} parts, ~{introResult.etaSeconds}s to finish sending.
                </Alert>
              )}
              {introResult && !introResult.ok && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {introResult.error}
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
