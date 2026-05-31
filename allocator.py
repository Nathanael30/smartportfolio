"""
SmartPortfolio - Intelligent Capital Allocation Engine
Author: Senior Financial Architect & Full-Stack Engineer

This module implements the core quantitative allocation model for building
highly optimized, risk-mitigated, and transaction-fee-friendly portfolios
split between Indian Equities (BSE/NSE) and Cryptocurrency.
It includes a high-performance Dynamic Proportional Sweep (Cash-Drag Optimizer).
"""

from typing import Dict, List, Any
import math

# =========================================================================
# 1. STATIC MOCK MARKET DATA & SENTIMENTS
# =========================================================================
MOCK_ASSETS = {
    # Indian ETFs (Extremely Low to Low Risk)
    "NIFTYBEES": {"name": "Nippon India ETF Nifty 50 BeES", "type": "EQUITY_ETF", "price": 275.50, "volatility": 3.0},
    "GOLDBEES": {"name": "Nippon India ETF Gold BeES", "type": "EQUITY_ETF", "price": 62.20, "volatility": 1.5},
    "LIQUIDBEES": {"name": "Nippon India ETF Liquid BeES", "type": "EQUITY_ETF", "price": 1000.00, "volatility": 1.0},
    "BANKBEES": {"name": "Nippon India ETF Nifty Bank BeES", "type": "EQUITY_ETF", "price": 510.50, "volatility": 3.5},
    
    # Large Cap Equities (BSE/NSE Bluechips - Medium Risk)
    "RELIANCE": {"name": "Reliance Industries Limited", "type": "EQUITY_STOCK", "price": 2920.00, "volatility": 4.2},
    "HDFCBANK": {"name": "HDFC Bank Limited", "type": "EQUITY_STOCK", "price": 1580.00, "volatility": 4.0},
    "TCS": {"name": "Tata Consultancy Services Limited", "type": "EQUITY_STOCK", "price": 3850.00, "volatility": 3.8},
    "INFY": {"name": "Infosys Limited", "type": "EQUITY_STOCK", "price": 1420.00, "volatility": 4.5},
    "ICICIBANK": {"name": "ICICI Bank Limited", "type": "EQUITY_STOCK", "price": 1120.00, "volatility": 4.1},
    
    # Mid Cap Equities (Medium-to-High Risk)
    "TATAMOTORS": {"name": "Tata Motors Limited", "type": "EQUITY_STOCK", "price": 950.00, "volatility": 6.0},
    "TATASTEEL": {"name": "Tata Steel Limited", "type": "EQUITY_STOCK", "price": 165.00, "volatility": 5.8},
    "BEL": {"name": "Bharat Electronics Limited", "type": "EQUITY_STOCK", "price": 230.00, "volatility": 5.5},

    # Cryptocurrencies (High/Extreme Risk)
    "BTC": {"name": "Bitcoin", "type": "CRYPTOCURRENCY", "price": 5700000.00, "volatility": 8.0},
    "ETH": {"name": "Ethereum", "type": "CRYPTOCURRENCY", "price": 310000.00, "volatility": 8.5},
    "SOL": {"name": "Solana", "type": "CRYPTOCURRENCY", "price": 13500.00, "volatility": 9.2},
    "ADA": {"name": "Cardano", "type": "CRYPTOCURRENCY", "price": 42.00, "volatility": 9.0},
    "DOT": {"name": "Polkadot", "type": "CRYPTOCURRENCY", "price": 620.00, "volatility": 9.1}
}

FLAT_BROKERAGE_FEE = 20.0
CRYPTO_TRANSACTION_FEE_PCT = 0.002
CAPITAL_TIER_LIMIT = 15000.0

# =========================================================================
# 2. ALLOCATION MODEL MATRICES (70% Equities / 30% Crypto)
# =========================================================================
TIER1_ALLOCATION_MATRIX = {
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
}

TIER2_ALLOCATION_MATRIX = {
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
}

# =========================================================================
# 3. ALLOCATION CORE ENGINE
# =========================================================================

def generate_portfolio(user_id: str, capital_amount_in_inr: float, risk_profile: str = "CONSERVATIVE") -> Dict[str, Any]:
    risk_profile = risk_profile.upper()
    if risk_profile not in ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]:
        risk_profile = "CONSERVATIVE"
        
    if capital_amount_in_inr < 1000.0:
        raise ValueError("Minimum investment threshold is ₹1,00,000 to cover brokerage and asset prices.")
        
    if capital_amount_in_inr <= CAPITAL_TIER_LIMIT:
        matrix = TIER1_ALLOCATION_MATRIX[risk_profile]
        tier_label = "Low Capital Tier (optimized for transaction drag)"
    else:
        matrix = TIER2_ALLOCATION_MATRIX[risk_profile]
        tier_label = "Mid-to-High Capital Tier (maximized diversification)"

    # 1. First Pass: Calculate ideal targets and identify unaffordable stocks/ETFs
    allocations_draft = {}
    swept_pool = 0.0
    affordable_etfs = []
    
    for symbol, target_pct in matrix.items():
        asset_meta = MOCK_ASSETS[symbol]
        price = asset_meta["price"]
        asset_type = asset_meta["type"]
        
        target_capital = capital_amount_in_inr * target_pct
        
        if asset_type in ["EQUITY_ETF", "EQUITY_STOCK"]:
            if target_capital >= price:
                allocations_draft[symbol] = {
                    "allocated_capital": target_capital,
                    "target_pct": target_pct,
                    "volatility": asset_meta["volatility"],
                    "asset_type": asset_type,
                    "price": price,
                    "name": asset_meta["name"]
                }
                if asset_type == "EQUITY_ETF":
                    affordable_etfs.append(symbol)
            else:
                swept_pool += target_capital
                allocations_draft[symbol] = {
                    "allocated_capital": 0.0,
                    "target_pct": target_pct,
                    "volatility": asset_meta["volatility"],
                    "asset_type": asset_type,
                    "price": price,
                    "name": asset_meta["name"]
                }
        else:
            allocations_draft[symbol] = {
                "allocated_capital": target_capital,
                "target_pct": target_pct,
                "volatility": asset_meta["volatility"],
                "asset_type": asset_type,
                "price": price,
                "name": asset_meta["name"]
            }

    # 2. Second Pass: Distribute swept pool proportionally among affordable ETFs
    if swept_pool > 0.0:
        if affordable_etfs:
            total_etf_weight = sum(matrix[s] for s in affordable_etfs)
            if total_etf_weight > 0:
                for symbol in affordable_etfs:
                    proportion = matrix[symbol] / total_etf_weight
                    allocations_draft[symbol]["allocated_capital"] += swept_pool * proportion
        else:
            cheapest_etf = "GOLDBEES"
            if cheapest_etf in allocations_draft:
                allocations_draft[cheapest_etf]["allocated_capital"] += swept_pool

    # 3. Third Pass: Perform unit rounding and finalize ledger
    allocations_output = []
    total_cost_calculated = 0.0
    brokerage_fees_est = 0.0
    weighted_risk_sum = 0.0
    
    equities_value = 0.0
    crypto_value = 0.0

    for symbol, draft in allocations_draft.items():
        price = draft["price"]
        asset_type = draft["asset_type"]
        volatility = draft["volatility"]
        allocated_cap = draft["allocated_capital"]
        
        if asset_type in ["EQUITY_ETF", "EQUITY_STOCK"]:
            units = math.floor(allocated_cap / price)
            total_asset_cost = units * price
            fee = FLAT_BROKERAGE_FEE if units > 0 else 0.0
            brokerage_fees_est += fee
            equities_value += total_asset_cost
        else:
            total_asset_cost = allocated_cap
            units = round(total_asset_cost / price, 8)
            fee = total_asset_cost * CRYPTO_TRANSACTION_FEE_PCT
            brokerage_fees_est += fee
            crypto_value += total_asset_cost

        total_cost_calculated += total_asset_cost
        weighted_risk_sum += draft["target_pct"] * volatility
        
        allocations_output.append({
            "symbol": symbol,
            "name": draft["name"],
            "asset_type": asset_type,
            "target_percentage": float(round(draft["target_pct"] * 100, 2)),
            "allocated_percentage": float(round((total_asset_cost / capital_amount_in_inr) * 100, 2)),
            "price": price,
            "units_to_buy": int(units) if asset_type in ["EQUITY_ETF", "EQUITY_STOCK"] else float(units),
            "total_cost": float(round(total_asset_cost, 2)),
            "asset_risk_score": volatility
        })

    # Sort allocations by target percentage descending
    allocations_output.sort(key=lambda x: x["target_percentage"], reverse=True)

    cash_drag = float(round(capital_amount_in_inr - total_cost_calculated, 2))
    portfolio_risk_score = float(round(weighted_risk_sum, 2))

    return {
        "user_id": user_id,
        "capital_input": capital_amount_in_inr,
        "capital_tier": tier_label,
        "risk_profile": risk_profile,
        "risk_score": portfolio_risk_score,
        "asset_distribution": {
            "equities": float(round(equities_value, 2)),
            "crypto": float(round(crypto_value, 2)),
            "cash": cash_drag
        },
        "allocations": allocations_output,
        "cash_drag": cash_drag,
        "brokerage_fees_est": float(round(brokerage_fees_est, 2))
    }
