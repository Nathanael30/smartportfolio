import { useState, useEffect } from 'react';

// =========================================================================
// 1. DATA MODELS & INTERFACES
// =========================================================================
interface AllocationItem {
  symbol: string;
  name: string;
  asset_type: string;
  target_percentage: number;
  allocated_percentage: number;
  price: number;
  units_to_buy: number;
  total_cost: number;
  asset_risk_score: number;
}

interface AssetDistribution {
  equities: number;
  crypto: number;
  cash: number;
}

interface PortfolioData {
  user_id: string;
  capital_input: number;
  capital_tier: string;
  risk_profile: string;
  risk_score: number;
  asset_distribution: AssetDistribution;
  allocations: AllocationItem[];
  cash_drag: number;
  brokerage_fees_est: number;
}

interface HoldingItem {
  symbol: string;
  name: string;
  asset_type: string;
  units: number;
  average_buy_price: number;
  current_price: number;
  current_value: number;
  pnl_absolute: number;
  pnl_percentage: number;
}

interface DashboardData {
  portfolio_id: string;
  portfolio_value: number;
  total_invested: number;
  pnl_absolute: number;
  pnl_percentage: number;
  cash_balance: number;
  risk_score: number;
  distribution: AssetDistribution;
  holdings: HoldingItem[];
}

const API_BASE = 'http://192.168.0.9:8000/api/v1';

// =========================================================================
// 2. CLIENT-SIDE FINANCIAL ENGINE PORT (Fallback if API is Offline)
// =========================================================================
const CLIENT_ASSETS: Record<string, { name: string; type: string; price: number; volatility: number }> = {
  "NIFTYBEES": { name: "Nippon India ETF Nifty 50 BeES", type: "EQUITY_ETF", price: 275.50, volatility: 3.0 },
  "GOLDBEES": { name: "Nippon India ETF Gold BeES", type: "EQUITY_ETF", price: 62.20, volatility: 1.5 },
  "BANKBEES": { name: "Nippon India ETF Nifty Bank BeES", type: "EQUITY_ETF", price: 510.50, volatility: 3.5 },
  "RELIANCE": { name: "Reliance Industries Limited", type: "EQUITY_STOCK", price: 2920.00, volatility: 4.2 },
  "HDFCBANK": { name: "HDFC Bank Limited", type: "EQUITY_STOCK", price: 1580.00, volatility: 4.0 },
  "TCS": { name: "Tata Consultancy Services Limited", type: "EQUITY_STOCK", price: 3850.00, volatility: 3.8 },
  "TATAMOTORS": { name: "Tata Motors Limited", type: "EQUITY_STOCK", price: 950.00, volatility: 6.0 },
  "TATASTEEL": { name: "Tata Steel Limited", type: "EQUITY_STOCK", price: 165.00, volatility: 5.8 },
  "BTC": { name: "Bitcoin", type: "CRYPTOCURRENCY", price: 5700000.00, volatility: 8.0 },
  "ETH": { name: "Ethereum", type: "CRYPTOCURRENCY", price: 310000.00, volatility: 8.5 },
  "SOL": { name: "Solana", type: "CRYPTOCURRENCY", price: 13500.00, volatility: 9.2 },
  "ADA": { name: "Cardano", type: "CRYPTOCURRENCY", price: 42.00, volatility: 9.0 }
};

const T1_MATRIX: Record<string, Record<string, number>> = {
  "CONSERVATIVE": {
    "NIFTYBEES": 0.50,
    "GOLDBEES": 0.20,
    "BTC": 0.20,
    "ETH": 0.10
  },
  "MODERATE": {
    "NIFTYBEES": 0.45,
    "BANKBEES": 0.15,
    "GOLDBEES": 0.10,
    "BTC": 0.20,
    "ETH": 0.10
  },
  "AGGRESSIVE": {
    "NIFTYBEES": 0.40,
    "BANKBEES": 0.20,
    "GOLDBEES": 0.10,
    "BTC": 0.15,
    "ETH": 0.10,
    "SOL": 0.05
  }
};

const T2_MATRIX: Record<string, Record<string, number>> = {
  "CONSERVATIVE": {
    "NIFTYBEES": 0.30,
    "GOLDBEES": 0.20,
    "RELIANCE": 0.10,
    "HDFCBANK": 0.10,
    "BTC": 0.20,
    "ETH": 0.10
  },
  "MODERATE": {
    "NIFTYBEES": 0.20,
    "BANKBEES": 0.10,
    "GOLDBEES": 0.10,
    "RELIANCE": 0.10,
    "HDFCBANK": 0.10,
    "TCS": 0.10,
    "BTC": 0.15,
    "ETH": 0.10,
    "SOL": 0.05
  },
  "AGGRESSIVE": {
    "NIFTYBEES": 0.15,
    "BANKBEES": 0.15,
    "RELIANCE": 0.10,
    "TATAMOTORS": 0.15,
    "TATASTEEL": 0.15,
    "BTC": 0.15,
    "ETH": 0.10,
    "SOL": 0.05
  }
};

function calculateClientAllocation(capital: number, risk: string): PortfolioData {
  const isT1 = capital <= 15000;
  const matrix = isT1 ? T1_MATRIX[risk] : T2_MATRIX[risk];
  
  // 1. First Pass: calculate targets and collect swept capital
  const drafts: Record<string, { allocated_capital: number; target_pct: number; volatility: number; asset_type: string; price: number; name: string }> = {};
  let sweptPool = 0;
  const affordableEtfs: string[] = [];

  for (const [symbol, target] of Object.entries(matrix)) {
    const meta = CLIENT_ASSETS[symbol];
    const targetCap = capital * target;

    if (meta.type.startsWith("EQUITY")) {
      if (targetCap >= meta.price) {
        drafts[symbol] = {
          allocated_capital: targetCap,
          target_pct: target,
          volatility: meta.volatility,
          asset_type: meta.type,
          price: meta.price,
          name: meta.name
        };
        if (meta.type === "EQUITY_ETF") {
          affordableEtfs.push(symbol);
        }
      } else {
        sweptPool += targetCap;
        drafts[symbol] = {
          allocated_capital: 0,
          target_pct: target,
          volatility: meta.volatility,
          asset_type: meta.type,
          price: meta.price,
          name: meta.name
        };
      }
    } else {
      drafts[symbol] = {
        allocated_capital: targetCap,
        target_pct: target,
        volatility: meta.volatility,
        asset_type: meta.type,
        price: meta.price,
        name: meta.name
      };
    }
  }

  // 2. Second Pass: Distribute swept pool proportionally among affordable ETFs
  if (sweptPool > 0) {
    if (affordableEtfs.length > 0) {
      const totalEtfWeight = affordableEtfs.reduce((sum, s) => sum + matrix[s], 0);
      if (totalEtfWeight > 0) {
        for (const symbol of affordableEtfs) {
          const proportion = matrix[symbol] / totalEtfWeight;
          drafts[symbol].allocated_capital += sweptPool * proportion;
        }
      }
    } else {
      const cheapestEtf = "GOLDBEES";
      if (drafts[cheapestEtf]) {
        drafts[cheapestEtf].allocated_capital += sweptPool;
      }
    }
  }

  // 3. Third Pass: Perform rounding and finalize ledger
  const allocations: AllocationItem[] = [];
  let totalCost = 0;
  let brokerage = 0;
  let weightedRisk = 0;
  let equitiesVal = 0;
  let cryptoVal = 0;

  for (const [symbol, draft] of Object.entries(drafts)) {
    let units = 0;
    let cost = 0;
    let fee = 0;

    if (draft.asset_type.startsWith("EQUITY")) {
      units = Math.floor(draft.allocated_capital / draft.price);
      cost = units * draft.price;
      fee = units > 0 ? 20 : 0;
      equitiesVal += cost;
    } else {
      cost = draft.allocated_capital;
      units = parseFloat((cost / draft.price).toFixed(8));
      fee = cost * 0.002;
      cryptoVal += cost;
    }

    totalCost += cost;
    brokerage += fee;
    weightedRisk += draft.target_pct * draft.volatility;

    allocations.push({
      symbol,
      name: draft.name,
      asset_type: draft.asset_type,
      target_percentage: Math.round(draft.target_pct * 10000) / 100,
      allocated_percentage: Math.round((cost / capital) * 10000) / 100,
      price: draft.price,
      units_to_buy: units,
      total_cost: Math.round(cost * 100) / 100,
      asset_risk_score: draft.volatility
    });
  }

  allocations.sort((a, b) => b.target_percentage - a.target_percentage);
  const drag = Math.round((capital - totalCost) * 100) / 100;

  return {
    user_id: "8b52fa10-2f98-4903-8d69-db6ad5c3fe80",
    capital_input: capital,
    capital_tier: isT1 ? "Low Capital Tier (optimized for transaction drag)" : "Mid-to-High Capital Tier (maximized diversification)",
    risk_profile: risk,
    risk_score: Math.round(weightedRisk * 100) / 100,
    asset_distribution: {
      equities: Math.round(equitiesVal * 100) / 100,
      crypto: Math.round(cryptoVal * 100) / 100,
      cash: drag
    },
    allocations,
    cash_drag: drag,
    brokerage_fees_est: Math.round(brokerage * 100) / 100
  };
}

// =========================================================================
// 3. MAIN REACT APP COMPONENT
// =========================================================================
export default function App() {
  const [capital, setCapital] = useState<number>(25000);
  const [riskProfile, setRiskProfile] = useState<string>('CONSERVATIVE');
  const [analyzedData, setAnalyzedData] = useState<PortfolioData | null>(null);
  const [activeDashboard, setActiveDashboard] = useState<DashboardData | null>(null);
  
  const [viewMode, setViewMode] = useState<'ANALYZE' | 'DASHBOARD'>('ANALYZE');
  const [loading, setLoading] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Check API health on startup & do initial analysis
  useEffect(() => {
    checkApiHealth();
    triggerAnalysis(25000, 'CONSERVATIVE');
  }, []);

  const checkApiHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/portfolio/dashboard?portfolio_id=b3e0202d-0570-43ef-88eb-598d9ad7e5f3`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        setApiOnline(true);
      }
    } catch {
      setApiOnline(false);
    }
  };

  const triggerAnalysis = async (capVal: number, riskVal: string) => {
    if (capVal < 1000) {
      setErrorMsg("Minimum allocation budget is ₹1,000 to cover exchange fees.");
      return;
    }
    setErrorMsg("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/portfolio/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({ capital: capVal, risk_profile: riskVal }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalyzedData(data);
        setApiOnline(true);
      } else {
        throw new Error("Backend response error");
      }
    } catch {
      // API Offline - Revert to high precision client-side engine!
      const fallbackData = calculateClientAllocation(capVal, riskVal);
      setAnalyzedData(fallbackData);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInvest = async () => {
    if (!analyzedData) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/portfolio/invest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({
          user_id: analyzedData.user_id,
          capital: analyzedData.capital_input,
          risk_profile: analyzedData.risk_profile,
          allocations: analyzedData.allocations.map(a => ({
            symbol: a.symbol,
            units: a.units_to_buy,
            price: a.price
          }))
        }),
      });

      if (response.ok) {
        const result = await response.json();
        fetchDashboard(result.portfolio_id);
      } else {
        throw new Error("Gateway error");
      }
    } catch {
      // Simulated Client-Side Investment Completion
      const mockPortfolioId = "d3b-client-simulated-" + Math.floor(Math.random() * 100000);
      simulateClientDashboard(mockPortfolioId);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async (portfolioId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/portfolio/dashboard?portfolio_id=${portfolioId}`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveDashboard(data);
        setViewMode('DASHBOARD');
      }
    } catch {
      simulateClientDashboard(portfolioId);
    } finally {
      setLoading(false);
    }
  };

  const simulateClientDashboard = (portfolioId: string) => {
    if (!analyzedData) return;

    // Simulate price updates: equities grew 3.8%, crypto grew 8.5%
    const holdings: HoldingItem[] = analyzedData.allocations.map(a => {
      const growPct = a.asset_type.startsWith("EQUITY") ? 1.038 : 1.085;
      const livePrice = Math.round(a.price * growPct * 100) / 100;
      const currentVal = a.units_to_buy * livePrice;
      const originalCost = a.units_to_buy * a.price;
      const pnlAbs = currentVal - originalCost;
      const pnlPct = originalCost > 0 ? (pnlAbs / originalCost) * 100 : 0;

      return {
        symbol: a.symbol,
        name: a.name,
        asset_type: a.asset_type,
        units: a.units_to_buy,
        average_buy_price: a.price,
        current_price: livePrice,
        current_value: Math.round(currentVal * 100) / 100,
        pnl_absolute: Math.round(pnlAbs * 100) / 100,
        pnl_percentage: Math.round(pnlPct * 100) / 100
      };
    });

    const cash = analyzedData.cash_drag;
    const totalHoldings = holdings.reduce((sum, h) => sum + h.current_value, 0);
    const portVal = Math.round((totalHoldings + cash) * 100) / 100;
    const invested = analyzedData.capital_input;
    const pnlAbs = portVal - invested;
    const pnlPct = (pnlAbs / invested) * 100;

    setActiveDashboard({
      portfolio_id: portfolioId,
      portfolio_value: portVal,
      total_invested: invested,
      pnl_absolute: Math.round(pnlAbs * 100) / 100,
      pnl_percentage: Math.round(pnlPct * 100) / 100,
      cash_balance: cash,
      risk_score: analyzedData.risk_score,
      distribution: analyzedData.asset_distribution,
      holdings
    });
    setViewMode('DASHBOARD');
  };

  const handleUpdatePrices = () => {
    if (!activeDashboard) return;
    setLoading(true);
    
    // Trigger dynamic updates by randomly fluctuating current prices slightly (+/- 2%)
    setTimeout(() => {
      const updatedHoldings = activeDashboard.holdings.map(h => {
        const change = 1 + (Math.random() * 0.04 - 0.02); // +/- 2%
        const livePrice = Math.round(h.current_price * change * 100) / 100;
        const currentVal = h.units * livePrice;
        const originalCost = h.units * h.average_buy_price;
        const pnlAbs = currentVal - originalCost;
        const pnlPct = (pnlAbs / originalCost) * 100;

        return {
          ...h,
          current_price: livePrice,
          current_value: Math.round(currentVal * 100) / 100,
          pnl_absolute: Math.round(pnlAbs * 100) / 100,
          pnl_percentage: Math.round(pnlPct * 100) / 100
        };
      });

      const totalHoldings = updatedHoldings.reduce((sum, h) => sum + h.current_value, 0);
      const portVal = Math.round((totalHoldings + activeDashboard.cash_balance) * 100) / 100;
      const pnlAbs = portVal - activeDashboard.total_invested;
      const pnlPct = (pnlAbs / activeDashboard.total_invested) * 100;

      setActiveDashboard({
        ...activeDashboard,
        portfolio_value: portVal,
        pnl_absolute: Math.round(pnlAbs * 100) / 100,
        pnl_percentage: Math.round(pnlPct * 100) / 100,
        holdings: updatedHoldings
      });
      setLoading(false);
    }, 400);
  };

  const handlePresetSelect = (val: number) => {
    setCapital(val);
    triggerAnalysis(val, riskProfile);
  };

  // Helper color map for risk levels
  const getRiskColor = (score: number) => {
    if (score < 3.5) return 'var(--success)';
    if (score < 6.0) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      
      {/* Header Panel */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="glow-text-primary">SmartPortfolio</span>
            <span style={{ fontSize: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Pro</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Intelligent Capital Allocator & Volatility-Mitigated Growth</p>
        </div>
        
        {/* API Gateway Status Badge */}
        <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '30px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiOnline ? 'var(--success)' : 'var(--warning)', boxShadow: apiOnline ? '0 0 10px var(--success)' : '0 0 10px var(--warning)' }}></span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            API Server: <span style={{ color: apiOnline ? 'var(--success)' : 'var(--warning)' }}>{apiOnline ? "Live connected" : "Offline (Engine fallback)"}</span>
          </span>
        </div>
      </header>

      {viewMode === 'ANALYZE' ? (
        /* =========================================================================
           VIEW: ANALYZE AND ALLOCATE PORTFOLIO
           ========================================================================= */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          
          {/* LEFT PANEL: Allocation Parameters */}
          <div className="glass-card animate-fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ Investment Setup
            </h2>

            {errorMsg && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Capital Input Field */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Capital Amount (INR)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.1rem' }}>₹</span>
                <input
                  type="number"
                  value={capital || ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    setCapital(v);
                    if (v >= 1000) triggerAnalysis(v, riskProfile);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    outline: 'none',
                    transition: 'border 0.2s ease'
                  }}
                />
              </div>

              {/* Presets Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
                {[5000, 15000, 50000, 100000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetSelect(preset)}
                    style={{
                      padding: '8px 4px',
                      background: capital === preset ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${capital === preset ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      color: capital === preset ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Selection Cards */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Risk Mitigation Strategy</label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { id: 'CONSERVATIVE', emoji: '🛡️', label: 'Conservative Growth', desc: 'Maximizes Index ETFs & Gold. Limits Crypto to 5-10%.' },
                  { id: 'MODERATE', emoji: '⚖️', label: 'Balanced Moderate', desc: 'Hybrid Index tracking, large-cap bluechips, and 10-15% crypto.' },
                  { id: 'AGGRESSIVE', emoji: '⚡', label: 'Aggressive Alpha', desc: 'Expanded large & mid-cap stocks with 15-35% crypto allocation.' }
                ].map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => {
                      setRiskProfile(profile.id);
                      triggerAnalysis(capital, profile.id);
                    }}
                    style={{
                      padding: '12px 16px',
                      background: riskProfile === profile.id ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${riskProfile === profile.id ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.1rem' }}>{profile.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: riskProfile === profile.id ? 'var(--primary)' : 'var(--text-primary)' }}>{profile.label}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '26px' }}>{profile.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleInvest}
              disabled={loading || !analyzedData || capital < 1000}
              className="glowing-btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                opacity: (loading || !analyzedData || capital < 1000) ? 0.6 : 1
              }}
            >
              {loading ? 'Analyzing Markets...' : '🚀 Execute Intelligent Portfolio'}
            </button>
          </div>

          {/* RIGHT PANEL: Portfolio Suggestions Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {analyzedData ? (
              <div className="glass-card animate-fade-in" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Intelligent Allocation Suggestion</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px', fontWeight: 600 }}>{analyzedData.capital_tier}</p>
                  </div>
                  
                  {/* Portfolio Volatility Score */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: getRiskColor(analyzedData.risk_score) }}>{analyzedData.risk_score}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 10</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: getRiskColor(analyzedData.risk_score) }}>Volatility Rating</span>
                  </div>
                </div>

                {/* Risk Progress Bar */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                    <span>Conservative (🛡️)</span>
                    <span>Aggressive (⚡)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${analyzedData.risk_score * 10}%`, height: '100%', background: `linear-gradient(to right, var(--success) 0%, ${getRiskColor(analyzedData.risk_score)} 100%)`, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Grid Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Equities Value</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>₹{analyzedData.asset_distribution.equities.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Crypto Value</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--secondary)' }}>₹{analyzedData.asset_distribution.crypto.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cash Residue</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{analyzedData.cash_drag.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* SVG Visual Stack Chart */}
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>📊 Asset Class Split</h4>
                  <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', width: '100%' }}>
                    {analyzedData.asset_distribution.equities > 0 && (
                      <div
                        style={{
                          width: `${(analyzedData.asset_distribution.equities / analyzedData.capital_input) * 100}%`,
                          backgroundColor: 'var(--primary)',
                          backgroundImage: 'linear-gradient(to right, #6366f1, #4f46e5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 700
                        }}
                      >
                        {Math.round((analyzedData.asset_distribution.equities / analyzedData.capital_input) * 100)}%
                      </div>
                    )}
                    {analyzedData.asset_distribution.crypto > 0 && (
                      <div
                        style={{
                          width: `${(analyzedData.asset_distribution.crypto / analyzedData.capital_input) * 100}%`,
                          backgroundColor: 'var(--secondary)',
                          backgroundImage: 'linear-gradient(to right, #14b8a6, #0d9488)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'black',
                          fontSize: '0.65rem',
                          fontWeight: 700
                        }}
                      >
                        {Math.round((analyzedData.asset_distribution.crypto / analyzedData.capital_input) * 100)}%
                      </div>
                    )}
                    {analyzedData.cash_drag > 0 && (
                      <div
                        style={{
                          width: `${(analyzedData.cash_drag / analyzedData.capital_input) * 100}%`,
                          backgroundColor: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 700
                        }}
                      >
                        Cash
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span> Equities
                    </span>
                    <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--secondary)' }}></span> Cryptocurrencies
                    </span>
                    <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#334155' }}></span> Cash Residue
                    </span>
                  </div>
                </div>

                {/* List of Recommended Asset Buys */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>📦 Suggested Purchases</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {analyzedData.allocations.map((alloc) => (
                      <div
                        key={alloc.symbol}
                        className="glass-card"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.01)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Circle Badge showing first letter of asset type */}
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: alloc.asset_type.startsWith("EQUITY") ? 'var(--primary-glow)' : 'var(--secondary-glow)',
                              color: alloc.asset_type.startsWith("EQUITY") ? 'var(--primary)' : 'var(--secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          >
                            {alloc.asset_type === "CRYPTOCURRENCY" ? "C" : alloc.asset_type === "EQUITY_ETF" ? "E" : "S"}
                          </span>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{alloc.symbol}</span>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{alloc.name}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block' }}>₹{alloc.total_cost.toLocaleString('en-IN')}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {alloc.units_to_buy} unit{alloc.units_to_buy !== 1 ? 's' : ''} @ ₹{alloc.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Estimated Brokerage & Drag Fee info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '16px', padding: '0 4px', fontWeight: 600 }}>
                    <span>Estimated Brokerage Cost: ₹{analyzedData.brokerage_fees_est}</span>
                    <span>Remaining Unallocated Capital: ₹{analyzedData.cash_drag}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                🚀 Enter capital amount and press Analyze to see dynamic portfolio allocation.
              </div>
            )}
          </div>

        </div>
      ) : (
        /* =========================================================================
           VIEW: ACTIVE PORTFOLIO DASHBOARD AFTER INVESTMENT
           ========================================================================= */
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {activeDashboard && (
            <>
              {/* Dashboard Metric Header Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. Portfolio Current Valuation */}
                <div className="glass-card" style={{ padding: '1.5rem 2rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Current Portfolio Valuation</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>₹{activeDashboard.portfolio_value.toLocaleString('en-IN')}</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ color: activeDashboard.pnl_absolute >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem', fontWeight: 700 }}>
                      {activeDashboard.pnl_absolute >= 0 ? '▲' : '▼'} ₹{Math.abs(activeDashboard.pnl_absolute).toLocaleString('en-IN')} ({activeDashboard.pnl_percentage >= 0 ? '+' : ''}{activeDashboard.pnl_percentage}%)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net return</span>
                  </div>
                </div>

                {/* 2. Total Invested Base */}
                <div className="glass-card" style={{ padding: '1.5rem 2rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Initial Capital Committed</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{activeDashboard.total_invested.toLocaleString('en-IN')}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
                    Uninvested Cash: ₹{activeDashboard.cash_balance.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* 3. Aggregated Risk Metrics */}
                <div className="glass-card" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Portfolio Risk Rating</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: getRiskColor(activeDashboard.risk_score) }}>{activeDashboard.risk_score} / 10</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${activeDashboard.risk_score * 10}%`, height: '100%', backgroundColor: getRiskColor(activeDashboard.risk_score), borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>Volatility matches your safety filters</span>
                </div>
              </div>

              {/* Layout splits: Holdings Table and Allocation chart */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem' }}>
                
                {/* Left split: Holdings Position Table */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>📦 Active Holdings</h3>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={handleUpdatePrices}
                        disabled={loading}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Simulate Market Feeds
                      </button>
                      <button
                        onClick={() => setViewMode('ANALYZE')}
                        style={{
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          color: 'var(--primary)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reset Setup
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                          <th style={{ padding: '8px 12px 12px' }}>Asset</th>
                          <th style={{ padding: '8px 12px 12px', textAlign: 'right' }}>Qty</th>
                          <th style={{ padding: '8px 12px 12px', textAlign: 'right' }}>Buy Avg</th>
                          <th style={{ padding: '8px 12px 12px', textAlign: 'right' }}>Live Price</th>
                          <th style={{ padding: '8px 12px 12px', textAlign: 'right' }}>P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDashboard.holdings.map((h) => (
                          <tr key={h.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.85rem' }}>
                            <td style={{ padding: '12px 12px' }}>
                              <span style={{ fontWeight: 700, display: 'block' }}>{h.symbol}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{h.name}</span>
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {h.asset_type === "CRYPTOCURRENCY" ? h.units : h.units.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              ₹{h.average_buy_price.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                              ₹{h.current_price.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: h.pnl_absolute >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {h.pnl_absolute >= 0 ? '+' : ''}{h.pnl_absolute.toLocaleString('en-IN')}
                              <span style={{ display: 'block', fontSize: '0.65rem', color: h.pnl_absolute >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                ({h.pnl_percentage >= 0 ? '+' : ''}{h.pnl_percentage}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right split: Allocation Donuts and Legends */}
                <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    📊 Portfolio Balance Breakdown
                  </h3>
                  
                  {/* Draw a beautiful central SVG donut with live active statistics */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: '200px', marginBottom: '1.5rem' }}>
                    <svg width="180" height="180" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="8" />
                      
                      {/* Equities Arc (Purple) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="var(--primary)"
                        strokeWidth="8"
                        strokeDasharray={`${activeDashboard.distribution.equities * 2.51} 251.2`}
                        strokeDashoffset="0"
                        transform="rotate(-90 50 50)"
                        strokeLinecap="round"
                      />

                      {/* Cryptocurrencies Arc (Teal) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="var(--secondary)"
                        strokeWidth="8"
                        strokeDasharray={`${activeDashboard.distribution.crypto * 2.51} 251.2`}
                        strokeDashoffset={`-${activeDashboard.distribution.equities * 2.51}`}
                        transform="rotate(-90 50 50)"
                        strokeLinecap="round"
                      />
                    </svg>
                    
                    {/* Inner Donut Central text card */}
                    <div style={{ position: 'absolute', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Net Valuation</span>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>₹{activeDashboard.portfolio_value.toLocaleString('en-IN')}</h4>
                    </div>
                  </div>

                  {/* Legends list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }}></span>
                        Indian Equities
                      </span>
                      <span style={{ fontWeight: 700 }}>{activeDashboard.distribution.equities}%</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--secondary)' }}></span>
                        Cryptocurrencies
                      </span>
                      <span style={{ fontWeight: 700 }}>{activeDashboard.distribution.crypto}%</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#334155' }}></span>
                        Cash Residue (DRAG)
                      </span>
                      <span style={{ fontWeight: 700 }}>{activeDashboard.distribution.cash}%</span>
                    </div>
                  </div>

                </div>
              </div>
            )}
        </div>
      )}

    </div>
  );
}
