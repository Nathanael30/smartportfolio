# SmartPortfolio 🚀
### *Intelligent Capital Allocator, Live Market Feeds & Premium Dashboard*

SmartPortfolio is a production-grade full-stack fintech system designed to automate low-risk, highly diversified portfolio construction split between **Indian Equities (BSE/NSE)** and **Cryptocurrencies**.

It dynamically evaluates capital thresholds, transaction costs, and user risk settings to provide fractional-aware, fee-optimized allocation plans.

---

## 📁 System Architecture & Directory Layout

The workspace is organized into a clean, modular structure separating backend algorithms, live adapters, deployment config, and our premium dark-mode web dashboard:

```text
TRading/
├── frontend/                 # Option A: Premium React + TS Dashboard UI (Vite)
│   ├── src/
│   │   ├── App.tsx           # Fully reactive Dashboard & quantitative fallback engine
│   │   ├── index.css         # Custom Glassmorphism design system & animations
│   │   └── main.tsx          # React application entry point
│   ├── index.html            # Web template optimized for SEO best practices
│   └── package.json          # Node dependencies
│
├── schema.sql                # Normalized PostgreSQL table schemas, indices, and seeds
├── allocator.py              # Quantitative capital allocator algorithm (Tiers & Risk scores)
├── main.py                   # FastAPI gateway backend exposing three core REST endpoints
├── adapters.py               # Option B: Zerodha Kite Connect & CoinGecko integration adapters
│
├── Dockerfile                # Option C: Multi-stage, secure Python runtime container
├── docker-compose.yml        # Multi-container orchestration (FastAPI + Postgres + Redis)
├── .env.example              # Environment variables template
├── .env                      # Active environment credentials
├── requirements.txt          # Python package requirements
└── README.md                 # System overview and operational guide
```

---

## ⚡ Core Business & Engineering Features

### 1. Indian Equity Non-Fractionality & Cash-Drag
Unlike US markets, Indian stock brokers do not natively support fractional equities. If you allocate ₹10,000 to an ETF trading at ₹275.50:
$$\text{Shares to Buy} = \lfloor \frac{10000}{275.50} \rfloor = 36\text{ units} \quad (\text{Cost: } ₹9,918)$$
The leftover **₹82** is swept back into the portfolio's `cash_balance` rather than vanished or over-allocated.

### 2. Transaction Fee Optimization (Brokerage Cap)
Indian discount brokers charge a flat fee of **₹20** per equity trade. If a low-capital user (₹5,000) buys 6 different stocks, they lose ₹120 (2.4%) instantly to friction.
*   **Tier 1: Low Capital (≤ ₹15,000)**: Allocator caps trades strictly to **2-3 high-liquidity ETFs + BTC** to preserve capital.
*   **Tier 2: Mid-to-High Capital (> ₹15,000)**: Expands allocations to individual Large-Cap stocks, Banking/Gold ETFs, and multiple cryptos (BTC, ETH, SOL) to maximize diversification.

### 3. Variable Risk Profiles
Ensures the aggregate portfolio volatility rating matches the user's risk capacity:
*   **Conservative**: Volatility index target $< 3.5$ (Index ETFs + Gold + minimal Bitcoin).
*   **Moderate**: Volatility index target $4.0 - 5.5$ (Blended ETFs + Nifty Bluechips + Major Crypto).
*   **Aggressive**: Volatility index target $> 6.0$ (High-beta ETFs + Mid-Caps + Cryptos + Altcoins).

---

## 🛠️ Execution & Deployment Guide

You can run SmartPortfolio either natively (locally) or containerized (production Docker).

### 🖥️ Method 1: Local Development (Native)

#### 1. Setup the Python Backend
Ensure you have **Python 3.9+** and are in the project root:
```bash
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
```
*Your REST gateway will be running at **`http://localhost:8000`** with docs at `/docs`.*

#### 2. Start the React Frontend Dashboard
Open a new terminal tab and navigate into the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```
*Vite will start your web dashboard on **`http://localhost:5173`** (or matching port).*

---

### 🐳 Method 2: Multi-Container Production (Docker Compose)

Deploy the complete database, cache, and backend gateway in one single command. Ensure you have **Docker Desktop** running:

```bash
docker-compose up --build
```

#### What Docker Compose Sets Up:
1.  **FastAPI Application (`backend`)**: Exposed on port `8000`.
2.  **PostgreSQL Database (`db`)**: Exposed on port `5432`, utilizing a persistent volume (`postgres_data`) and automatically initializing all tables/seeds via `schema.sql`.
3.  **Redis Cache (`redis`)**: Exposed on port `6379`, caching session states and CoinGecko rates.

---

## 📡 Live Financial Integrations (adapters.py)

We've established high-performance broker adapter interfaces inside **`adapters.py`**:
*   **`KiteConnectAdapter`**: Interacts with the official **Zerodha Kite Connect v4 SDK**.
    *   Authenticates session access keys.
    *   Queries real-time NSE quotes using `kite.ltp`.
    *   Submits Cash-and-Carry (CNC) Market/Limit orders via `kite.place_order`.
*   **`CoinGeckoAdapter`**: Handles REST requests to **CoinGecko Simple Price feeds** for crypto-to-INR conversions, complete with network timeouts and safety fallbacks.
