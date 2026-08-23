import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuIcon from "@mui/icons-material/MoreVertOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MainLayout from "layouts/MainLayout";

// Stable colors assigned per account_id (not per label), so each linked account keeps
// its color as more get added over time — no hardcoded mapping to maintain.
const ACCOUNT_COLOR_PALETTE = [
  "#3385F0", // blue
  "#A641FA", // purple
  "#099F69", // green
  "#F68D2A", // orange
  "#D02241", // red
  "#0DA6D6", // cyan
  "#C2185B", // pink
  "#6D4C41", // brown
];

function colorForAccount(accountId: string | null): string {
  if (!accountId) return "#9E9E9E";
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = (hash * 31 + accountId.charCodeAt(i)) >>> 0;
  }
  return ACCOUNT_COLOR_PALETTE[hash % ACCOUNT_COLOR_PALETTE.length];
}

const AccountBadge = ({ accountId, accountName, accountType }: { accountId: string | null; accountName: string | null; accountType: string | null }) => {
  if (!accountId) return null;
  const Icon = accountType === "credit" ? CreditCardOutlined : AccountBalanceOutlined;
  return (
    <Tooltip title={accountName ?? "Unknown account"}>
      <Avatar sx={{ width: 28, height: 28, bgcolor: colorForAccount(accountId) }}>
        <Icon sx={{ fontSize: 16 }} />
      </Avatar>
    </Tooltip>
  );
};

interface Category {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  posted_date: string;
  amount: number;
  description: string | null;
  merchant: string | null;
  type: string;
  category_id: string | null;
  category_name: string | null;
  recurring_bill_name: string | null;
  account_id: string | null;
  account_name: string | null;
  account_type: string | null;
}

const NEW_CATEGORY = "__new__";

const MonthDetail = () => {
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month") ?? "";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideCategorized, setHideCategorized] = useState(true);

  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; txn: Transaction } | null>(null);
  const [markExpectedTxn, setMarkExpectedTxn] = useState<Transaction | null>(null);
  const [logChargeOpen, setLogChargeOpen] = useState(false);
  const [newCategoryPrompt, setNewCategoryPrompt] = useState<{ txnId: string } | null>(null);

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    setError(null);
    try {
      const [txnRes, catRes] = await Promise.all([
        fetch(`/api/dncbudget/transactions?month=${encodeURIComponent(month)}`, { credentials: "same-origin" }),
        fetch("/api/dncbudget/categories", { credentials: "same-origin" }),
      ]);
      const txnData = await txnRes.json();
      const catData = await catRes.json();
      if (!txnData.ok) throw new Error(txnData.error || "Failed to load transactions");
      if (!catData.ok) throw new Error(catData.error || "Failed to load categories");
      setTransactions(txnData.transactions);
      setCategories(catData.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (request: () => Promise<Response>) => {
    try {
      const response = await request();
      const data = await response.json().catch(() => null);
      if (!response.ok || (data && data.ok === false)) {
        setError((data && data.error) || `Request failed (${response.status})`);
        return;
      }
      void load();
    } catch {
      setError("Request failed — check your connection and try again.");
    }
  };

  const handleCategoryChange = async (txn: Transaction, value: string) => {
    if (value === NEW_CATEGORY) {
      setNewCategoryPrompt({ txnId: txn.id });
      return;
    }
    await runAction(() =>
      fetch(`/api/dncbudget/transactions/${txn.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId: value }),
      }),
    );
  };

  const handleIgnore = async (txn: Transaction) => {
    setMenuAnchor(null);
    await runAction(() =>
      fetch(`/api/dncbudget/transactions/${txn.id}/ignore`, { method: "POST", credentials: "same-origin" }),
    );
  };

  const handleSetType = async (txn: Transaction, type: "income" | "refund") => {
    setMenuAnchor(null);
    await runAction(() =>
      fetch(`/api/dncbudget/transactions/${txn.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type }),
      }),
    );
  };

  const visibleTransactions = hideCategorized
    ? transactions.filter((t) => t.type === "unclassified")
    : transactions;

  return (
    <MainLayout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          {month}
        </Typography>
        <Button variant="contained" onClick={() => setLogChargeOpen(true)}>
          Log a Charge
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormControlLabel
        sx={{ mb: 1 }}
        control={
          <Checkbox checked={hideCategorized} onChange={(e) => setHideCategorized(e.target.checked)} />
        }
        label="Hide Categorized"
      />

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Merchant</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && visibleTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                    {transactions.length === 0
                      ? "No transactions for this month yet."
                      : "Nothing needs attention — uncheck \"Hide Categorized\" to see everything."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleTransactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell padding="checkbox">
                  <AccountBadge accountId={txn.account_id} accountName={txn.account_name} accountType={txn.account_type} />
                </TableCell>
                <TableCell>{txn.posted_date}</TableCell>
                <TableCell>{txn.merchant ?? txn.description ?? "—"}</TableCell>
                <TableCell align="right">${txn.amount.toFixed(2)}</TableCell>
                <TableCell>
                  {txn.type === "recurring" ? (
                    <Chip size="small" label={txn.recurring_bill_name ?? "recurring"} />
                  ) : (
                    <Chip size="small" label={txn.type} variant="outlined" />
                  )}
                </TableCell>
                <TableCell>
                  {txn.type === "recurring" || txn.type === "transfer" || txn.type === "ignored" || txn.type === "income" ? (
                    "—"
                  ) : (
                    <Select
                      size="small"
                      value={txn.category_id ?? ""}
                      displayEmpty
                      onChange={(e) => handleCategoryChange(txn, e.target.value)}
                      sx={{ minWidth: 160 }}
                    >
                      <MenuItem value="">
                        <em>Uncategorized</em>
                      </MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                      <MenuItem value={NEW_CATEGORY}>+ New category…</MenuItem>
                    </Select>
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => setMenuAnchor({ el: e.currentTarget, txn })}>
                    <MenuIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMarkExpectedTxn(menuAnchor!.txn);
            setMenuAnchor(null);
          }}
        >
          Mark as Expected
        </MenuItem>
        <MenuItem onClick={() => handleSetType(menuAnchor!.txn, "income")}>Mark as Income</MenuItem>
        <MenuItem onClick={() => handleSetType(menuAnchor!.txn, "refund")}>Mark as Refund</MenuItem>
        <MenuItem onClick={() => handleIgnore(menuAnchor!.txn)}>Ignore</MenuItem>
      </Menu>

      {markExpectedTxn && (
        <MarkExpectedDialog
          txn={markExpectedTxn}
          onClose={() => setMarkExpectedTxn(null)}
          onSaved={() => {
            setMarkExpectedTxn(null);
            void load();
          }}
        />
      )}

      {newCategoryPrompt && (
        <NewCategoryDialog
          onClose={() => setNewCategoryPrompt(null)}
          onCreated={async (categoryId) => {
            await fetch(`/api/dncbudget/transactions/${newCategoryPrompt.txnId}`, {
              method: "PATCH",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ categoryId }),
            });
            setNewCategoryPrompt(null);
            void load();
          }}
        />
      )}

      {logChargeOpen && (
        <LogChargeDialog
          categories={categories}
          defaultMonth={month}
          onClose={() => setLogChargeOpen(false)}
          onSaved={() => {
            setLogChargeOpen(false);
            void load();
          }}
        />
      )}
    </MainLayout>
  );
};

const MarkExpectedDialog = ({
  txn,
  onClose,
  onSaved,
}: {
  txn: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(txn.merchant ?? "");
  const [expectedAmount, setExpectedAmount] = useState(String(Math.abs(txn.amount)));
  const [isVariable, setIsVariable] = useState(false);
  const [dayMin, setDayMin] = useState("1");
  const [dayMax, setDayMax] = useState("31");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    await fetch(`/api/dncbudget/transactions/${txn.id}/mark-expected`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        expectedAmount: Number(expectedAmount),
        isVariable,
        expectedDayMin: Number(dayMin),
        expectedDayMax: Number(dayMax),
      }),
    });
    setSubmitting(false);
    onSaved();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as Expected</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField
            label="Expected amount"
            type="number"
            value={expectedAmount}
            onChange={(e) => setExpectedAmount(e.target.value)}
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={isVariable} onChange={(e) => setIsVariable(e.target.checked)} />}
            label="Variable amount (e.g. utility)"
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Day of month, earliest"
              type="number"
              value={dayMin}
              onChange={(e) => setDayMin(e.target.value)}
              fullWidth
            />
            <TextField
              label="Day of month, latest"
              type="number"
              value={dayMax}
              onChange={(e) => setDayMax(e.target.value)}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting || !name}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const NewCategoryDialog = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (categoryId: string) => void;
}) => {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    const response = await fetch("/api/dncbudget/categories", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    setSubmitting(false);
    if (data.ok) onCreated(data.id);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New category</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting || !name.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const LogChargeDialog = ({
  categories,
  defaultMonth,
  onClose,
  onSaved,
}: {
  categories: Category[];
  defaultMonth: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [store, setStore] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(`${defaultMonth}-01`);
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    await fetch("/api/dncbudget/transactions/log-charge", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store, amount: Number(amount), date, categoryId: categoryId || undefined }),
    });
    setSubmitting(false);
    onSaved();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Log a Charge</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Store" value={store} onChange={(e) => setStore(e.target.value)} fullWidth />
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
          />
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Select value={categoryId} displayEmpty onChange={(e) => setCategoryId(e.target.value)} fullWidth>
            <MenuItem value="">
              <em>Uncategorized</em>
            </MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting || !store || !amount}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MonthDetail;
