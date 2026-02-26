import React, { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries, CandlestickSeries } from 'lightweight-charts';
import { 
  TrendingUp, TrendingDown, Wallet, History, User, Settings, 
  LogOut, Menu, X, ChevronRight, AlertCircle, CheckCircle2,
  ArrowUpRight, ArrowDownLeft, LayoutDashboard, ShieldCheck,
  CreditCard, DollarSign, Clock, Activity, BarChart3, LineChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { User as UserType, Position, Transaction, Candle } from './types';

// --- Components ---

const Navbar = ({ user, onLogout, onTabChange, activeTab }: { 
  user: UserType | null, 
  onLogout: () => void, 
  onTabChange: (tab: string) => void,
  activeTab: string 
}) => {
  return (
    <nav className="h-16 border-b border-white/5 bg-[#0a0b0d] flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-black w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-white">FX<span className="text-amber-500">TRADER</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-1">
          {[
            { id: 'trading', label: 'Trading', icon: LayoutDashboard },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'history', label: 'History', icon: History },
            { id: 'profile', label: 'Profile', icon: User },
            ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : [])
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === item.id 
                  ? "bg-amber-500/10 text-amber-500" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Balance</span>
              <span className="text-sm font-mono font-bold text-amber-500">${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <User className="w-4 h-4 text-amber-500" />
            </div>
          </div>
        )}
        <button onClick={onLogout} className="p-2 text-gray-400 hover:text-white transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

const TradingChart = ({ asset, prices, candleData }: { asset: string, prices: Record<string, number>, candleData: Record<string, Record<string, Candle[]>> }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [chartType, setChartType] = useState<'candlestick' | 'area'>('candlestick');
  const [timeframe, setTimeframe] = useState<string>('1m');

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // 2. Manage Series
  useEffect(() => {
    if (!chartRef.current) return;

    // Clean up existing series
    if (areaSeriesRef.current) {
      try { chartRef.current.removeSeries(areaSeriesRef.current); } catch(e) {}
      areaSeriesRef.current = null;
    }
    if (candleSeriesRef.current) {
      try { chartRef.current.removeSeries(candleSeriesRef.current); } catch(e) {}
      candleSeriesRef.current = null;
    }

    // Add new series based on type
    if (chartType === 'area') {
      areaSeriesRef.current = chartRef.current.addSeries(AreaSeries, {
        lineColor: '#f59e0b',
        topColor: 'rgba(245, 158, 11, 0.2)',
        bottomColor: 'rgba(245, 158, 11, 0)',
        lineWidth: 2,
      });
    } else {
      candleSeriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
    }
  }, [chartType, asset, timeframe]); // Re-create series when type, asset or timeframe changes

  // 3. Update Data
  useEffect(() => {
    if (!chartRef.current) return;

    const currentAssetPrice = prices[asset];
    const currentCandles = candleData[asset]?.[timeframe];

    try {
      if (chartType === 'area' && areaSeriesRef.current && typeof currentAssetPrice === 'number' && !isNaN(currentAssetPrice)) {
        areaSeriesRef.current.update({
          time: Math.floor(Date.now() / 1000) as any,
          value: currentAssetPrice,
        });
      } else if (chartType === 'candlestick' && candleSeriesRef.current && Array.isArray(currentCandles)) {
        const validCandles = currentCandles
          .filter(c => 
            c && 
            typeof c.time === 'number' && 
            typeof c.open === 'number' && !isNaN(c.open) &&
            typeof c.high === 'number' && !isNaN(c.high) &&
            typeof c.low === 'number' && !isNaN(c.low) &&
            typeof c.close === 'number' && !isNaN(c.close)
          )
          .sort((a, b) => a.time - b.time); // Ensure chronological order

        if (validCandles.length > 0) {
          candleSeriesRef.current.setData(validCandles as any);
        }
      }
    } catch (err) {
      // Silent fail for chart updates to prevent UI crash
    }
  }, [prices, candleData, asset, chartType, timeframe]);

  return (
    <div className="relative w-full h-[500px] bg-[#0d0e12] rounded-xl border border-white/5 overflow-hidden">
      <div className="absolute top-4 left-6 z-10 flex items-center justify-between w-[calc(100%-48px)]">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{asset}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-amber-500">${(prices[asset] || 0).toFixed(5)}</span>
              <span className="text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-bold">+0.02%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            {['1m', '5m', '15m', '30m', '1h', '3h', '12h', '24h'].map(tf => (
              <button 
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold transition-all",
                  timeframe === tf ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "text-gray-500 hover:text-white"
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            <button 
              onClick={() => setChartType('candlestick')}
              className={cn(
                "p-2 rounded-md transition-all",
                chartType === 'candlestick' ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"
              )}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setChartType('area')}
              className={cn(
                "p-2 rounded-md transition-all",
                chartType === 'area' ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"
              )}
            >
              <LineChart className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

const TradePanel = ({ asset, currentPrice, onPlaceTrade, balance }: { 
  asset: string, 
  currentPrice: number, 
  onPlaceTrade: (type: 'BUY' | 'SELL', size: number, tp?: number, sl?: number) => void,
  balance: number
}) => {
  const [size, setSize] = useState(0.1);
  const [tp, setTp] = useState<string>('');
  const [sl, setSl] = useState<string>('');

  return (
    <div className="w-80 bg-[#0d0e12] border border-white/5 rounded-xl p-6 flex flex-col gap-6">
      <div>
        <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Volume (Lots)</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[0.01, 0.1, 1.0].map(v => (
            <button 
              key={v} 
              onClick={() => setSize(v)}
              className={cn(
                "py-2 rounded-lg text-xs font-bold border transition-all",
                size === v ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="relative">
          <input 
            type="number" 
            step="0.01"
            value={size} 
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">LOTS</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Take Profit</label>
          <input 
            type="number" 
            step="0.00001"
            placeholder="None"
            value={tp} 
            onChange={(e) => setTp(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Stop Loss</label>
          <input 
            type="number" 
            step="0.00001"
            placeholder="None"
            value={sl} 
            onChange={(e) => setSl(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>
      </div>

      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-gray-500">Margin Required</span>
          <span className="text-white font-mono font-bold">${((size * (currentPrice || 0)) / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Leverage</span>
          <span className="text-amber-500 font-bold">1:100</span>
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 mt-auto">
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => onPlaceTrade('BUY', size, tp ? Number(tp) : undefined, sl ? Number(sl) : undefined)}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg shadow-green-900/20"
          >
            <span className="text-xs opacity-70 mb-1">BUY</span>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-lg">{(currentPrice + 0.00002).toFixed(5)}</span>
            </div>
          </button>
          <button 
            onClick={() => onPlaceTrade('SELL', size, tp ? Number(tp) : undefined, sl ? Number(sl) : undefined)}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg shadow-red-900/20"
          >
            <span className="text-xs opacity-70 mb-1">SELL</span>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              <span className="text-lg">{(currentPrice - 0.00002).toFixed(5)}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState('trading');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedAsset, setSelectedAsset] = useState('EUR/USD');
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionHistory, setPositionHistory] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [candleData, setCandleData] = useState<Record<string, Record<string, Candle[]>>>({});
  const [isAuth, setIsAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<UserType[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile(token);
    }
    
    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'market_update') {
        setPrices(data.prices);
        setCandleData(data.candleData);
      }
    };
    wsRef.current = ws;

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && user?.role === 'admin') {
      fetchAdminUsers();
    }
  }, [activeTab, user]);

  const fetchAdminUsers = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setAdminUsers(await res.json());
  };

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setIsAuth(true);
        fetchHistory(token);
      } else {
        localStorage.removeItem('token');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async (token: string) => {
    const [posRes, historyRes, txsRes] = await Promise.all([
      fetch('/api/positions/active', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/positions/history', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/wallet/transactions', { headers: { Authorization: `Bearer ${token}` } })
    ]);
    if (posRes.ok) setPositions(await posRes.json());
    if (historyRes.ok) setPositionHistory(await historyRes.json());
    if (txsRes.ok) setTransactions(await txsRes.json());
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === 'login') {
          localStorage.setItem('token', data.token);
          setUser(data.user);
          setIsAuth(true);
          fetchHistory(data.token);
        } else {
          setAuthMode('login');
          setError('Registration successful. Please login.');
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPosition = async (type: 'BUY' | 'SELL', size: number, tp?: number, sl?: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/positions/open', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          asset: selectedAsset,
          size,
          type,
          entry_price: prices[selectedAsset],
          take_profit: tp,
          stop_loss: sl
        })
      });
      if (res.ok) {
        fetchHistory(token);
        fetchProfile(token);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeposit = async () => {
    const token = localStorage.getItem('token');
    if (!token || !depositAmount) return;
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(depositAmount),
          method: 'M-Pesa',
          reference: 'DEP-' + Math.random().toString(36).substring(7).toUpperCase()
        })
      });
      if (res.ok) {
        setDepositAmount('');
        fetchHistory(token);
        alert("Deposit request submitted! Please check your phone for the STK push.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWithdrawal = async () => {
    const token = localStorage.getItem('token');
    if (!token || !withdrawalAmount) return;
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(withdrawalAmount),
          method: 'M-Pesa',
          reference: 'WTH-' + Math.random().toString(36).substring(7).toUpperCase()
        })
      });
      if (res.ok) {
        setWithdrawalAmount('');
        fetchHistory(token);
        fetchProfile(token);
        alert("Withdrawal request submitted! It will be processed shortly.");
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClosePosition = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const position = positions.find(p => p.id === id);
    if (!position) return;

    const currentPrice = prices[position.asset];
    if (typeof currentPrice !== 'number' || isNaN(currentPrice)) {
      alert("Market price unavailable. Please try again in a moment.");
      return;
    }

    try {
      const res = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          position_id: id,
          close_price: currentPrice
        })
      });
      if (res.ok) {
        fetchProfile(token);
        fetchHistory(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuth(false);
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-500/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#0d0e12] border border-white/5 rounded-2xl p-8 relative z-10 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
              <TrendingUp className="text-black w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tighter">FX<span className="text-amber-500">TRADER</span></h1>
            <p className="text-gray-500 text-sm mt-2">Premium Binary Options Trading</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-500/10"
            >
              {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Binary trading involves high risk and may result in loss of capital. 
              Please trade responsibly.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      <main className="max-w-[1600px] mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'trading' && (
            <motion.div 
              key="trading"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col lg:flex-row gap-6"
            >
              {/* Asset List */}
              <div className="w-full lg:w-64 flex flex-col gap-2">
                <h3 className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 px-2">Market Assets</h3>
                {Object.keys(prices).map(asset => (
                  <button
                    key={asset}
                    onClick={() => setSelectedAsset(asset)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all",
                      selectedAsset === asset 
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-500" 
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"
                    )}
                  >
                    <span className="font-bold text-sm">{asset}</span>
                    <span className="font-mono text-xs">${prices[asset]?.toFixed(4)}</span>
                  </button>
                ))}
              </div>

              {/* Chart Area */}
              <div className="flex-1 flex flex-col gap-6">
                <TradingChart asset={selectedAsset} prices={prices} candleData={candleData} />
                
                {/* Open Positions Table */}
                <div className="bg-[#0d0e12] border border-white/5 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold">Open Positions</h3>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Live P/L</span>
                      <span className={cn(
                        "text-sm font-mono font-bold",
                        positions.reduce((acc, p) => {
                          const currentPrice = prices[p.asset] || p.entry_price;
                          const pnl = p.type === 'BUY' ? (currentPrice - p.entry_price) * p.size : (p.entry_price - currentPrice) * p.size;
                          return acc + pnl;
                        }, 0) >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        ${positions.reduce((acc, p) => {
                          const currentPrice = prices[p.asset] || p.entry_price;
                          const pnl = p.type === 'BUY' ? (currentPrice - p.entry_price) * p.size : (p.entry_price - currentPrice) * p.size;
                          return acc + pnl;
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/5">
                          <th className="p-4 font-medium">Asset</th>
                          <th className="p-4 font-medium">Type</th>
                          <th className="p-4 font-medium">Size</th>
                          <th className="p-4 font-medium">Entry</th>
                          <th className="p-4 font-medium">TP / SL</th>
                          <th className="p-4 font-medium">Current</th>
                          <th className="p-4 font-medium">Profit/Loss</th>
                          <th className="p-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map(pos => {
                          const currentPrice = prices[pos.asset] || pos.entry_price;
                          const pnl = pos.type === 'BUY' 
                            ? (currentPrice - pos.entry_price) * pos.size 
                            : (pos.entry_price - currentPrice) * pos.size;
                          return (
                            <tr key={pos.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4 font-bold">{pos.asset}</td>
                              <td className="p-4">
                                <span className={cn(
                                  "px-2 py-1 rounded text-[10px] font-bold",
                                  pos.type === 'BUY' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                )}>
                                  {pos.type}
                                </span>
                              </td>
                              <td className="p-4 font-mono">{pos.size} Lots</td>
                              <td className="p-4 font-mono">${pos.entry_price.toFixed(5)}</td>
                              <td className="p-4 font-mono text-[10px]">
                                <div className="text-green-500">TP: {pos.take_profit?.toFixed(5) || '-'}</div>
                                <div className="text-red-500">SL: {pos.stop_loss?.toFixed(5) || '-'}</div>
                              </td>
                              <td className="p-4 font-mono">${currentPrice.toFixed(5)}</td>
                              <td className={cn("p-4 font-mono font-bold", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                                ${pnl.toFixed(2)}
                              </td>
                              <td className="p-4 text-right">
                                <button 
                                  onClick={() => handleClosePosition(pos.id)}
                                  className="text-[10px] font-bold uppercase text-gray-400 hover:text-white transition-colors"
                                >
                                  Close
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Trade Panel */}
              <TradePanel 
                asset={selectedAsset} 
                currentPrice={prices[selectedAsset]} 
                onPlaceTrade={handleOpenPosition}
                balance={user?.balance || 0}
              />
            </motion.div>
          )}

          {activeTab === 'wallet' && (
            <motion.div 
              key="wallet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <div className="bg-[#0d0e12] border border-white/5 rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <CreditCard className="text-amber-500 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Deposit Funds</h2>
                    <p className="text-gray-500 text-sm">Add money to your trading account</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="p-4 rounded-xl border border-amber-500 bg-amber-500/5 flex flex-col items-center gap-2">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold text-xs">M</div>
                        <span className="text-xs font-bold">M-Pesa</span>
                      </button>
                      <button className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col items-center gap-2 opacity-50 cursor-not-allowed">
                        <CreditCard className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-bold">Card</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Amount to Deposit</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                      <input 
                        type="number" 
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white font-mono focus:outline-none focus:border-amber-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleDeposit}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/10"
                  >
                    Initiate STK Push
                  </button>
                </div>
              </div>

              <div className="bg-[#0d0e12] border border-white/5 rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <ArrowDownLeft className="text-blue-500 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Withdrawal</h2>
                    <p className="text-gray-500 text-sm">Transfer funds to your bank/mobile wallet</p>
                  </div>
                </div>

                <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Available for Withdrawal</span>
                    <span className="text-xl font-mono font-bold text-blue-500">${user?.balance.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[80%]" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Withdrawal Amount</label>
                    <input 
                      type="number" 
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-mono focus:outline-none focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <button 
                    onClick={handleWithdrawal}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-xl transition-all active:scale-95"
                  >
                    Request Withdrawal
                  </button>
                </div>
              </div>

              {/* Transaction History */}
              <div className="md:col-span-2 bg-[#0d0e12] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-sm font-bold">Transaction History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/5">
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">Type</th>
                        <th className="p-4 font-medium">Amount</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium text-right">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-gray-400">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="p-4 font-bold uppercase">{tx.type}</td>
                          <td className="p-4 font-mono font-bold">${tx.amount.toFixed(2)}</td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              tx.status === 'completed' ? "bg-green-500/10 text-green-500" : tx.status === 'failed' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="p-4 text-right text-gray-500 font-mono text-xs">{tx.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Trade History</h2>
                  <p className="text-gray-500 text-sm">Review your past performance</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium">All Assets</button>
                  <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium">Last 30 Days</button>
                </div>
              </div>

              <div className="bg-[#0d0e12] border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase font-bold tracking-widest border-b border-white/5">
                      <th className="p-6">Date & Time</th>
                      <th className="p-6">Asset</th>
                      <th className="p-6">Type</th>
                      <th className="p-6">Size</th>
                      <th className="p-6">Entry Price</th>
                      <th className="p-6">Close Price</th>
                      <th className="p-6 text-right">Profit/Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {positionHistory.map(pos => {
                      const pnl = typeof pos.pnl === 'number' ? pos.pnl : 0;
                      const entry = typeof pos.entry_price === 'number' ? pos.entry_price : 0;
                      const close = typeof pos.close_price === 'number' ? pos.close_price : 0;
                      return (
                        <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-6 text-sm text-gray-400">{new Date(pos.closed_at || pos.created_at).toLocaleString()}</td>
                          <td className="p-6 font-bold">{pos.asset}</td>
                          <td className="p-6">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold",
                              pos.type === 'BUY' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="p-6 font-mono">{pos.size} Lots</td>
                          <td className="p-6 font-mono">${entry.toFixed(5)}</td>
                          <td className="p-6 font-mono">${close.toFixed(5)}</td>
                          <td className={cn(
                            "p-6 text-right font-mono font-bold",
                            pnl >= 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-[#0d0e12] border border-white/5 rounded-2xl p-8">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <User className="w-12 h-12 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{user?.email}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">Account ID: #FX-{user?.id.toString().padStart(6, '0')}</span>
                      <span className="w-1 h-1 bg-gray-700 rounded-full" />
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                        user?.kyc_status === 'verified' ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {user?.kyc_status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Total Balance</span>
                    <span className="text-2xl font-mono font-bold text-white">${user?.balance.toLocaleString()}</span>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Trades Won</span>
                    <span className="text-2xl font-mono font-bold text-green-500">
                      {positionHistory.filter(t => typeof t.pnl === 'number' && t.pnl > 0).length}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b border-white/5 pb-2">Account Settings</h3>
                  <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all group">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-gray-400 group-hover:text-amber-500" />
                      <span className="text-sm">Two-Factor Authentication</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all group">
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-gray-400 group-hover:text-amber-500" />
                      <span className="text-sm">Notification Preferences</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all group">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-gray-400 group-hover:text-amber-500" />
                      <span className="text-sm">KYC Verification</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Admin Control Center</h2>
                  <p className="text-gray-500 text-sm">Manage platform users and transactions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-[#0d0e12] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/5">
                      <h3 className="font-bold">User Management</h3>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/5">
                          <th className="p-4">Email</th>
                          <th className="p-4">Balance</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">KYC</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {adminUsers.map(u => (
                          <tr key={u.id} className="hover:bg-white/5">
                            <td className="p-4 font-medium">{u.email}</td>
                            <td className="p-4 font-mono">${u.balance.toLocaleString()}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold uppercase">{u.role}</span>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                "text-[10px] font-bold uppercase",
                                u.kyc_status === 'verified' ? "text-green-500" : "text-amber-500"
                              )}>{u.kyc_status}</span>
                            </td>
                            <td className="p-4 text-right">
                              <button className="text-amber-500 hover:underline font-bold text-xs">Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#0d0e12] border border-white/5 rounded-2xl p-6">
                    <h3 className="font-bold mb-4">Platform Stats</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                        <span className="text-xs text-gray-500">Total Users</span>
                        <span className="font-bold">{adminUsers.length}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                        <span className="text-xs text-gray-500">Active Positions</span>
                        <span className="font-bold text-amber-500">{positions.length}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                        <span className="text-xs text-gray-500">Pending Withdrawals</span>
                        <span className="font-bold text-blue-500">3</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                    <h3 className="font-bold mb-2 text-amber-500">Admin Actions</h3>
                    <p className="text-xs text-gray-500 mb-4">Quick platform adjustments</p>
                    <div className="space-y-2">
                      <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-all">
                        Adjust Payout %
                      </button>
                      <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-all">
                        Maintenance Mode
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Risk Disclaimer Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#0a0b0d] py-8 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Secure Trading Environment</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed max-w-3xl mx-auto">
            Binary trading involves high risk and may result in loss of capital. The products offered on this platform are complex financial instruments. 
            Trading binary options may not be suitable for all investors. You should never invest money that you cannot afford to lose. 
            FX Trader is not responsible for any losses incurred while using our services.
          </p>
          <div className="mt-6 flex items-center justify-center gap-8 text-[10px] text-gray-700 uppercase font-bold tracking-widest">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Risk Disclosure</span>
            <span>Contact Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
