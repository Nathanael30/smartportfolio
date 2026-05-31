"""
Automated Test Suite for SmartPortfolio Allocation Engine
Author: Senior Financial Architect & Full-Stack Engineer

This test script validates the business boundaries, equity integer constraints,
crypto fractional precisions, and brokerage optimizations under various capital tiers.
"""

import unittest
from allocator import generate_portfolio, MOCK_ASSETS, CAPITAL_TIER_LIMIT

class TestPortfolioAllocator(unittest.TestCase):
    
    def setUp(self):
        self.user_id = "8b52fa10-2f98-4903-8d69-db6ad5c3fe80"

    def test_low_capital_brokerage_optimization(self):
        """
        Verify that for low capital (e.g., ₹5,000), the system restricts allocation
        to a few stable ETFs to minimize fee drag, and enforces integer-only units
        for Indian stocks/ETFs.
        """
        capital = 5000.0
        portfolio = generate_portfolio(self.user_id, capital, "CONSERVATIVE")

        # Basic validations
        self.assertEqual(portfolio["user_id"], self.user_id)
        self.assertEqual(portfolio["capital_input"], capital)
        self.assertTrue("Low Capital" in portfolio["capital_tier"])
        
        # Verify that we only have NIFTYBEES, GOLDBEES, BTC (3 assets = ₹60 equity fees + minor crypto fees)
        # NIFTYBEES target: 70%, GOLDBEES: 25%, BTC: 5%
        symbols = [item["symbol"] for item in portfolio["allocations"]]
        self.assertCountEqual(symbols, ["NIFTYBEES", "GOLDBEES", "BTC"])

        # Check integer rounding constraints on ETFs
        for alloc in portfolio["allocations"]:
            symbol = alloc["symbol"]
            units = alloc["units_to_buy"]
            asset_type = alloc["asset_type"]
            
            if asset_type == "EQUITY_ETF":
                # Must be a whole number
                self.assertIsInstance(units, int)
                # Check value cost maps to integer quantity
                self.assertEqual(alloc["total_cost"], units * alloc["price"])
            elif asset_type == "CRYPTOCURRENCY":
                # Crypto can be fractional
                self.assertIsInstance(units, float)
                
        # Confirm cash drag is positive and represents the rounding residues
        self.assertGreaterEqual(portfolio["cash_drag"], 0.0)
        self.assertEqual(portfolio["cash_drag"], portfolio["asset_distribution"]["cash"])

    def test_high_capital_diversification(self):
        """
        Verify that for larger capital (e.g., ₹50,000), the engine diversifies
        across broad equity large-caps, mid-caps, thematic ETFs, and multiple cryptos.
        """
        capital = 50000.0
        portfolio = generate_portfolio(self.user_id, capital, "MODERATE")

        self.assertTrue("Mid-to-High" in portfolio["capital_tier"])
        
        # Verify broader asset list
        allocations = {item["symbol"]: item for item in portfolio["allocations"]}
        
        # In TIER 2 Moderate, we expect NIFTYBEES, GOLDBEES, BANKBEES, RELIANCE, HDFCBANK, TATAMOTORS, BTC, ETH, SOL
        expected_symbols = ["NIFTYBEES", "GOLDBEES", "BANKBEES", "RELIANCE", "HDFCBANK", "TATAMOTORS", "BTC", "ETH", "SOL"]
        self.assertCountEqual(list(allocations.keys()), expected_symbols)
        
        # Check that individual stocks (e.g., RELIANCE price ~₹2920) have integer units
        self.assertIsInstance(allocations["RELIANCE"]["units_to_buy"], int)
        self.assertIsInstance(allocations["HDFCBANK"]["units_to_buy"], int)

        # Check crypto has fractional units
        self.assertIsInstance(allocations["BTC"]["units_to_buy"], float)
        self.assertIsInstance(allocations["SOL"]["units_to_buy"], float)

        # Portfolio Risk Score must be between 1.0 and 10.0
        self.assertTrue(1.0 <= portfolio["risk_score"] <= 10.0)

    def test_minimum_capital_validation(self):
        """
        Verify that input capital below ₹1,000 triggers a validation exception.
        """
        with self.assertRaises(ValueError):
            generate_portfolio(self.user_id, 500.0, "CONSERVATIVE")

    def test_risk_profile_variance(self):
        """
        Verify that aggressive portfolios yield higher risk scores and greater crypto splits
        than conservative ones under the same capital input.
        """
        capital = 30000.0
        portfolio_con = generate_portfolio(self.user_id, capital, "CONSERVATIVE")
        portfolio_agg = generate_portfolio(self.user_id, capital, "AGGRESSIVE")

        # Aggressive risk score should be higher
        self.assertGreater(portfolio_agg["risk_score"], portfolio_con["risk_score"])
        
        # Aggressive crypto distribution should be higher than conservative
        self.assertGreater(
            portfolio_agg["asset_distribution"]["crypto"],
            portfolio_con["asset_distribution"]["crypto"]
        )

if __name__ == "__main__":
    unittest.main()
