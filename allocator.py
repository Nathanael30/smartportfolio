"""
SmartPortfolio - Intelligent Capital Allocation Engine
Author: Senior Financial Architect & Full-Stack Engineer

This module implements the core quantitative allocation model for building
highly optimized, risk-mitigated, and transaction-fee-friendly portfolios
split between Indian Equities (BSE/NSE) and Cryptocurrency.
"""

from typing import Dict, List, Any
import math

# =========================================================================
# 1. STATIC MOCK MARKET DATA & SENTIMENTS
# =========================================================================
# Simulates standard high-stability assets, current prices in INR, and volatility rating (1.0 to 10.0)
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

# Standard Indian Brokerage Flat rate per executed equity trade (INR)
FLAT_BROKERAGE_FEE = 20.0
# Crypto transaction fee rate (0.2% is standard on Indian Crypto Exchanges)
CRYPTO_TRANSACTION_FEE_PCT = 0.002
# Capital threshold below which we trigger strict brokerage cost optimization (Tier 1 vs Tier 2)
CAPITAL_TIER_LIMIT = 15000.0

# =========================================================================
# 2. ALLOCATION MODEL MATRICES
# =========================================================================

# TIER 1: Low Capital (<= ₹15,000)
# Structure: High-concentration in 2-3 assets to limit flat equity brokerage fee eating into yields.
TIER1_ALLOCATION_MATRIX = {
    "CONSERVATIVE": {
        "NIFTYBEES": 0.70,  # 70% Core Nifty Equity Index ETF
        "GOLDBEES": 0.25,   # 25% Gold ETF (Stability Hedge)
        "BTC": 0.05         # 5% Crypto (Strictly Bitcoin)
    },
    "MODERATE": {
        "NIFTYBEES": 0.65,  # 65% Core Equity Index ETF
        "GOLDBEES": 0.25,   # 25% Gold ETF
        "BTC": 0.10         # 10% Crypto (Bitcoin Bluechip)
    },
    "AGGRESSIVE": {
        "NIFTYBEES": 0.60,  # 60% Core Equity Index ETF
        "BANKBEES": 0.25,   # 25% High-Beta Banking ETF
        "BTC": 0.15         # 15% Crypto (Bitcoin Bluechip)
    }
}

# TIER 2: Mid-to-High Capital (> ₹15,000)
# Structure: High diversification across index ETFs, select bluechip stocks, thematic ETFs, and multiple cryptos.
TIER2_ALLOCATION_MATRIX = {
    "CONSERVATIVE": {
        "NIFTYBEES": 0.40,
        "GOLDBEES": 0.20,
        "RELIANCE": 0.10,
        "HDFCBANK": 0.10,
        "TCS": 0.05,
        "BTC": 0.10,
        "ETH": 0.05
    },
    "MODERATE": {
        "NIFTYBEES": 0.25,
        "GOLDBEES": 0.10,
        "BANKBEES": 0.10,
        "RELIANCE": 0.10,
        "HDFCBANK": 0.10,
        "TATAMOTORS": 0.10,
        "BTC": 0.15,
        "ETH": 0.07,
        "SOL": 0.03
    },
    "AGGRESSIVE": {
        "NIFTYBEES": 0.15,
        "BANKBEES": 0.15,
        "RELIANCE": 0.10,
        "TATAMOTORS": 0.15,
        "TATASTEEL": 0.10,
        "BTC": 0.15,
        "ETH": 0.10,
        "SOL": 0.07,
        "ADA": 0.03
    }
}

# =========================================================================
# 3. ALLOCATION CORE ENGINE
# =========================================================================

def generate_portfolio(user_id: str, capital_amount_in_inr: float, risk_profile: str = "CONSERVATIVE") -> Dict[str, Any]:
    """
    Computes an optimal low-risk asset distribution matrix based on input amount,
    risk profile, and structural brokerage optimizations.
    
    Args:
        user_id (str): UUID identifier of the requesting user.
        capital_amount_in_inr (float): Total capital allocation budget in Indian Rupees.
        risk_profile (str): CONSERVATIVE, MODERATE, or AGGRESSIVE. Defaults to CONSERVATIVE.
        
    Returns:
        Dict[str, Any]: A detailed portfolio allocation JSON configuration.
    """
    # 1. Validation & Inputs Cleanse
    risk_profile = risk_profile.upper()
    if risk_profile not in ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]:
        risk_profile = "CONSERVATIVE"
        
    if capital_amount_in_inr < 1000.0:
        raise ValueError("Minimum investment threshold is ₹1,000 to cover brokerage and asset prices.")
        
    # 2. Select Target Matrix based on Capital Tiers
    if capital_amount_in_inr <= CAPITAL_TIER_LIMIT:
        matrix = TIER1_ALLOCATION_MATRIX[risk_profile]
        tier_label = "Low Capital Tier (optimized for transaction drag)"
    else:
        matrix = TIER2_ALLOCATION_MATRIX[risk_profile]
        tier_label = "Mid-to-High Capital Tier (maximized diversification)"

    # 3. Allocate Capital
    allocations_output = []
    total_cost_calculated = 0.0
    brokerage_fees_est = 0.0
    weighted_risk_sum = 0.0
    
    equities_value = 0.0
    crypto_value = 0.0

    # Process Indian Equities first (since they are strictly integers and generate cash residue)
    # Then process crypto assets (which are highly fractionalized and absorb the remaining target)
    sorted_assets = sorted(
        matrix.items(),
        key=lambda x: 0 if MOCK_ASSETS[x[0]]["type"] in ["EQUITY_ETF", "EQUITY_STOCK"] else 1
    )

    for symbol, target_pct in sorted_assets:
        asset_meta = MOCK_ASSETS[symbol]
        price = asset_meta["price"]
        asset_type = asset_meta["type"]
        volatility = asset_meta["volatility"]
        
        # Calculate ideal cash allocation
        target_capital = capital_amount_in_inr * target_pct
        
        if asset_type in ["EQUITY_ETF", "EQUITY_STOCK"]:
            # Real-world Constraint: Shares cannot be fractional!
            # Round down to nearest whole share
            units = math.floor(target_capital / price)
            total_asset_cost = units * price
            
            # Brokerage: Indian equity delivery has a flat fee (₹20) if units > 0
            fee = FLAT_BROKERAGE_FEE if units > 0 else 0.0
            brokerage_fees_est += fee
            
            equities_value += total_asset_cost
        else:
            # Cryptocurrencies are fractionalized (supports 8 decimals)
            # Take the targeted percentage amount and buy decimal units
            total_asset_cost = target_capital
            units = round(total_asset_cost / price, 8)
            
            # Crypto broker transaction fee (0.2% on buy order)
            fee = total_asset_cost * CRYPTO_TRANSACTION_FEE_PCT
            brokerage_fees_est += fee
            
            crypto_value += total_asset_cost

        # Cumulative track
        total_cost_calculated += total_asset_cost
        weighted_risk_sum += target_pct * volatility
        
        # Build asset allocation card
        allocations_output.append({
            "symbol": symbol,
            "name": asset_meta["name"],
            "asset_type": asset_type,
            "target_percentage": float(round(target_pct * 100, 2)),
            "allocated_percentage": float(round((total_asset_cost / capital_amount_in_inr) * 100, 2)),
            "price": price,
            "units_to_buy": int(units) if asset_type in ["EQUITY_ETF", "EQUITY_STOCK"] else float(units),
            "total_cost": float(round(total_asset_cost, 2)),
            "asset_risk_score": volatility
        })

    # Sort allocations by target percentage descending
    allocations_output.sort(key=lambda x: x["target_percentage"], reverse=True)

    # 4. Final Balance Sheet
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
