import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fx-trader-secret-key-123";

const db = new Database("database.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    balance REAL DEFAULT 10000.0,
    role TEXT DEFAULT 'user',
    kyc_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    asset TEXT,
    size REAL, 
    type TEXT, -- 'BUY' or 'SELL'
    entry_price REAL,
    close_price REAL,
    status TEXT DEFAULT 'open', -- 'open', 'closed'
    pnl REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add take_profit and stop_loss if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(positions)").all() as any[];
const hasTakeProfit = tableInfo.some(col => col.name === 'take_profit');
const hasStopLoss = tableInfo.some(col => col.name === 'stop_loss');

if (!hasTakeProfit) {
  db.exec("ALTER TABLE positions ADD COLUMN take_profit REAL");
}
if (!hasStopLoss) {
  db.exec("ALTER TABLE positions ADD COLUMN stop_loss REAL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- 'deposit', 'withdrawal'
    amount REAL,
    status TEXT DEFAULT 'pending',
    method TEXT,
    reference TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

app.use(express.json());

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// --- API Routes ---

// Auth
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
    const info = stmt.run(email, hashedPassword);
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: "User already exists" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email, balance: user.balance, role: user.role } });
});

app.get("/api/user/profile", authenticate, (req: any, res) => {
  const user = db.prepare("SELECT id, email, balance, role, kyc_status FROM users WHERE id = ?").get(req.user.id);
  res.json(user);
});

// Trading (Forex/CFD Style)
app.post("/api/positions/open", authenticate, (req: any, res) => {
  const { asset, size, type, entry_price, take_profit, stop_loss } = req.body;
  const user: any = db.prepare("SELECT balance FROM users WHERE id = ?").get(req.user.id);

  // Margin check (simplified: size * price / leverage)
  const marginRequired = (size * entry_price) / 100; // 1:100 leverage
  if (user.balance < marginRequired) {
    return res.status(400).json({ error: "Insufficient margin" });
  }

  const stmt = db.prepare(`
    INSERT INTO positions (user_id, asset, size, type, entry_price, take_profit, stop_loss)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(req.user.id, asset, size, type, entry_price, take_profit || null, stop_loss || null);
  res.json({ success: true, id: info.lastInsertRowid });
});

app.post("/api/positions/close", authenticate, (req: any, res) => {
  const { position_id, close_price } = req.body;
  const position: any = db.prepare("SELECT * FROM positions WHERE id = ? AND user_id = ?").get(position_id, req.user.id);

  if (!position || position.status !== 'open') {
    return res.status(400).json({ error: "Invalid position" });
  }

  let pnl = 0;
  if (position.type === 'BUY') {
    pnl = (close_price - position.entry_price) * position.size;
  } else {
    pnl = (position.entry_price - close_price) * position.size;
  }

  db.transaction(() => {
    db.prepare("UPDATE positions SET status = 'closed', close_price = ?, pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(close_price, pnl, position_id);
    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(pnl, req.user.id);
  })();

  res.json({ success: true, pnl });
});

app.get("/api/positions/active", authenticate, (req: any, res) => {
  const positions = db.prepare("SELECT * FROM positions WHERE user_id = ? AND status = 'open'").all(req.user.id);
  res.json(positions);
});

app.get("/api/positions/history", authenticate, (req: any, res) => {
  const history = db.prepare("SELECT * FROM positions WHERE user_id = ? AND status = 'closed' ORDER BY closed_at DESC LIMIT 50").all(req.user.id);
  res.json(history);
});

// Wallet
app.post("/api/wallet/deposit", authenticate, (req: any, res) => {
  const { amount, method, reference } = req.body;
  // Mock M-Pesa STK Push logic
  const stmt = db.prepare("INSERT INTO transactions (user_id, type, amount, method, reference, status) VALUES (?, 'deposit', ?, ?, ?, 'pending')");
  stmt.run(req.user.id, amount, method, reference);
  res.json({ success: true, message: "Deposit request submitted" });
});

app.post("/api/wallet/withdraw", authenticate, (req: any, res) => {
  const { amount, method, reference } = req.body;
  const user: any = db.prepare("SELECT balance FROM users WHERE id = ?").get(req.user.id);
  
  if (user.balance < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  db.transaction(() => {
    const stmt = db.prepare("INSERT INTO transactions (user_id, type, amount, method, reference, status) VALUES (?, 'withdrawal', ?, ?, ?, 'pending')");
    stmt.run(req.user.id, amount, method, reference);
    db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(amount, req.user.id);
  })();
  
  res.json({ success: true, message: "Withdrawal request submitted" });
});

app.get("/api/wallet/transactions", authenticate, (req: any, res) => {
  const txs = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(txs);
});

// Admin
app.get("/api/admin/users", authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
  const users = db.prepare("SELECT id, email, balance, role, kyc_status FROM users").all();
  res.json(users);
});

app.get("/api/admin/transactions", authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
  const txs = db.prepare(`
    SELECT t.*, u.email as user_email 
    FROM transactions t 
    JOIN users u ON t.user_id = u.id 
    WHERE t.status = 'pending' 
    ORDER BY t.created_at DESC
  `).all();
  res.json(txs);
});

app.post("/api/admin/transactions/approve", authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
  const { tx_id } = req.body;
  const tx: any = db.prepare("SELECT * FROM transactions WHERE id = ?").get(tx_id);
  if (tx && tx.status === 'pending') {
    db.transaction(() => {
      db.prepare("UPDATE transactions SET status = 'approved' WHERE id = ?").run(tx_id);
      if (tx.type === 'deposit') {
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(tx.amount, tx.user_id);
      }
    })();
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Invalid transaction" });
  }
});

// --- WebSocket for Price Feed ---
const assets = ["EUR/USD", "GBP/USD", "USD/JPY", "BTC/USD", "ETH/USD", "GOLD", "OIL"];
const prices: Record<string, number> = {
  "EUR/USD": 1.08542,
  "GBP/USD": 1.26415,
  "USD/JPY": 150.243,
  "BTC/USD": 62450.50,
  "ETH/USD": 3420.75,
  "GOLD": 2034.50,
  "OIL": 78.45
};

// Simulated Candlestick data
const timeframes = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "3h": 10800,
  "12h": 43200,
  "24h": 86400
};
const candleData: Record<string, Record<string, any[]>> = {};
assets.forEach(a => {
  candleData[a] = {};
  Object.keys(timeframes).forEach(tf => candleData[a][tf] = []);
});

setInterval(() => {
  assets.forEach(asset => {
    const volatility = asset.includes("USD/") ? 0.0001 : 0.001;
    const currentPrice = prices[asset];
    
    if (typeof currentPrice !== 'number' || isNaN(currentPrice)) {
      // Reset to default if somehow corrupted
      const defaults: Record<string, number> = {
        "EUR/USD": 1.08542, "GBP/USD": 1.26415, "USD/JPY": 150.243,
        "BTC/USD": 62450.50, "ETH/USD": 3420.75, "GOLD": 2034.50, "OIL": 78.45
      };
      prices[asset] = defaults[asset] || 1.0;
      return;
    }

    const change = (Math.random() - 0.5) * (currentPrice * volatility);
    prices[asset] += change;

    // Update candle data for all timeframes
    const now = Math.floor(Date.now() / 1000);
    const price = prices[asset];

    Object.entries(timeframes).forEach(([tfKey, tfSeconds]) => {
      const candles = candleData[asset][tfKey];
      const lastCandle = candles[candles.length - 1];
      
      // Calculate the start of the period (e.g., start of the minute, start of 5 mins)
      const periodStart = Math.floor(now / tfSeconds) * tfSeconds;

      if (!lastCandle || lastCandle.time < periodStart) {
        candles.push({
          time: periodStart,
          open: price,
          high: price,
          low: price,
          close: price
        });
        if (candles.length > 200) candles.shift();
      } else {
        lastCandle.high = Math.max(lastCandle.high, price);
        lastCandle.low = Math.min(lastCandle.low, price);
        lastCandle.close = price;
      }
    });
  });

  // Broadcast prices and candles
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "market_update", prices, candleData }));
    }
  });

  // Check for TP/SL hits
  const openPositions = db.prepare("SELECT * FROM positions WHERE status = 'open'").all();
  openPositions.forEach((pos: any) => {
    const currentPrice = prices[pos.asset];
    let shouldClose = false;
    let closePrice = currentPrice;

    if (pos.type === 'BUY') {
      if (pos.take_profit && currentPrice >= pos.take_profit) {
        shouldClose = true;
        closePrice = pos.take_profit;
      } else if (pos.stop_loss && currentPrice <= pos.stop_loss) {
        shouldClose = true;
        closePrice = pos.stop_loss;
      }
    } else { // SELL
      if (pos.take_profit && currentPrice <= pos.take_profit) {
        shouldClose = true;
        closePrice = pos.take_profit;
      } else if (pos.stop_loss && currentPrice >= pos.stop_loss) {
        shouldClose = true;
        closePrice = pos.stop_loss;
      }
    }

    if (shouldClose) {
      let pnl = 0;
      if (pos.type === 'BUY') {
        pnl = (closePrice - pos.entry_price) * pos.size;
      } else {
        pnl = (pos.entry_price - closePrice) * pos.size;
      }

      db.transaction(() => {
        db.prepare("UPDATE positions SET status = 'closed', close_price = ?, pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(closePrice, pnl, pos.id);
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(pnl, pos.user_id);
      })();
    }
  });

}, 1000);

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
