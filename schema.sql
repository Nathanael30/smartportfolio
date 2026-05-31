-- SmartPortfolio PostgreSQL Database Schema
-- Version 1.0.0
-- Author: Senior Financial Architect & Full-Stack Engineer

-- Enable UUID extension for robust, non-enumerable resource identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. ENUMS & DOMAINS
-- =========================================================================
CREATE TYPE asset_type_enum AS ENUM ('EQUITY_STOCK', 'EQUITY_ETF', 'CRYPTOCURRENCY');
CREATE TYPE transaction_type_enum AS ENUM ('BUY', 'SELL');
CREATE TYPE order_status_enum AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED');
CREATE TYPE risk_profile_enum AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- =========================================================================
-- 2. TABLES DEFINITIONS
-- =========================================================================

-- A. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    risk_profile risk_profile_enum DEFAULT 'CONSERVATIVE' NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- B. Assets Table (Master catalogue of supported instruments)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(30) UNIQUE NOT NULL,               -- e.g., 'RELIANCE', 'NIFTYBEES', 'BTC'
    name VARCHAR(100) NOT NULL,                        -- e.g., 'Reliance Industries Ltd'
    asset_type asset_type_enum NOT NULL,              -- STOCK, ETF, CRYPTO
    current_price DECIMAL(18, 4) NOT NULL,            -- Latest market price
    volatility_score DECIMAL(4, 2) NOT NULL,          -- Annualized risk score scale (1.0 to 10.0)
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- C. Portfolios Table (User specific capital wrapper)
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Intelligent Portfolio',
    total_capital DECIMAL(18, 2) NOT NULL CHECK (total_capital >= 0.0), -- Cumulative deposits
    cash_balance DECIMAL(18, 2) NOT NULL CHECK (cash_balance >= 0.0),   -- Uninvested cash due to rounding
    risk_score DECIMAL(5, 2) NOT NULL DEFAULT 1.00,                     -- Calculated aggregate volatility rating
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- D. Portfolio Allocations Table (Holds current positions)
CREATE TABLE portfolio_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0.0 AND target_percentage <= 100.0),
    allocated_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (allocated_percentage >= 0.0 AND allocated_percentage <= 100.0),
    current_units DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000 CHECK (current_units >= 0.0), -- Decimals for crypto, integers for equities (enforced in application)
    average_buy_price DECIMAL(18, 4) NOT NULL DEFAULT 0.0000 CHECK (average_buy_price >= 0.0),
    current_value DECIMAL(18, 2) NOT NULL DEFAULT 0.00 CHECK (current_value >= 0.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, asset_id)
);

-- E. Transactions / Order Logs Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    transaction_type transaction_type_enum NOT NULL,
    units DECIMAL(18, 8) NOT NULL CHECK (units > 0.0),
    price_per_unit DECIMAL(18, 4) NOT NULL CHECK (price_per_unit > 0.0),
    total_amount DECIMAL(18, 2) NOT NULL CHECK (total_amount > 0.0), -- units * price_per_unit
    brokerage_fees DECIMAL(10, 2) DEFAULT 0.00 CHECK (brokerage_fees >= 0.0),
    external_order_id VARCHAR(100),                                   -- Gateway transaction reference
    status order_status_enum DEFAULT 'PENDING' NOT NULL,
    error_message TEXT,                                               -- Captured execution errors
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- F. Daily Valuation Snapshots (For high-performance time-series charting)
CREATE TABLE daily_valuation_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_value DECIMAL(18, 2) NOT NULL,                              -- portfolio holdings value + cash balance
    cash_balance DECIMAL(18, 2) NOT NULL,
    equities_value DECIMAL(18, 2) NOT NULL,
    crypto_value DECIMAL(18, 2) NOT NULL,
    unrealized_pnl DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, snapshot_date)
);

-- =========================================================================
-- 3. INDEXES FOR LATENCY REDUCTION
-- =========================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_allocations_portfolio ON portfolio_allocations(portfolio_id);
CREATE INDEX idx_transactions_portfolio_date ON transactions(portfolio_id, executed_at DESC);
CREATE INDEX idx_snapshots_portfolio_date ON daily_valuation_snapshots(portfolio_id, snapshot_date DESC);

-- =========================================================================
-- 4. SEED DATA (Top Indian Stocks/ETFs & Cryptocurrencies)
-- =========================================================================

-- Seed Assets
INSERT INTO assets (symbol, name, asset_type, current_price, volatility_score) VALUES
-- ETFs (Super Stable, Low Brokerage Drag targets)
('NIFTYBEES', 'Nippon India ETF Nifty 50 BeES', 'EQUITY_ETF', 275.5000, 3.0),
('GOLDBEES', 'Nippon India ETF Gold BeES', 'EQUITY_ETF', 62.2000, 1.5),
('LIQUIDBEES', 'Nippon India ETF Liquid BeES', 'EQUITY_ETF', 1000.0000, 1.0),
('BANKBEES', 'Nippon India ETF Nifty Bank BeES', 'EQUITY_ETF', 510.5000, 3.5),

-- Large Cap Equities (BSE/NSE Bluechips - Medium Risk)
('RELIANCE', 'Reliance Industries Limited', 'EQUITY_STOCK', 2920.0000, 4.2),
('HDFCBANK', 'HDFC Bank Limited', 'EQUITY_STOCK', 1580.0000, 4.0),
('TCS', 'Tata Consultancy Services Limited', 'EQUITY_STOCK', 3850.0000, 3.8),
('INFY', 'Infosys Limited', 'EQUITY_STOCK', 1420.0000, 4.5),
('ICICIBANK', 'ICICI Bank Limited', 'EQUITY_STOCK', 1120.0000, 4.1),

-- Select High-Performance Mid Caps (Medium-to-High Risk)
('TATAMOTORS', 'Tata Motors Limited', 'EQUITY_STOCK', 950.0000, 6.0),
('TATASTEEL', 'Tata Steel Limited', 'EQUITY_STOCK', 165.0000, 5.8),
('BEL', 'Bharat Electronics Limited', 'EQUITY_STOCK', 230.0000, 5.5),

-- Cryptocurrencies (High/Extreme Risk)
('BTC', 'Bitcoin', 'CRYPTOCURRENCY', 5700000.0000, 8.0),
('ETH', 'Ethereum', 'CRYPTOCURRENCY', 310000.0000, 8.5),
('SOL', 'Solana', 'CRYPTOCURRENCY', 13500.0000, 9.2),
('ADA', 'Cardano', 'CRYPTOCURRENCY', 42.0000, 9.0),
('DOT', 'Polkadot', 'CRYPTOCURRENCY', 620.0000, 9.1);
