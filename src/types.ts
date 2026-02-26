export interface User {
  id: number;
  email: string;
  balance: number;
  role: 'user' | 'admin';
  kyc_status: 'pending' | 'verified' | 'rejected';
}

export interface Position {
  id: number;
  user_id: number;
  asset: string;
  size: number;
  type: 'BUY' | 'SELL';
  entry_price: number;
  take_profit: number | null;
  stop_loss: number | null;
  close_price: number | null;
  status: 'open' | 'closed';
  pnl: number;
  created_at: string;
  closed_at: string | null;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  method: string;
  reference: string;
  created_at: string;
}
