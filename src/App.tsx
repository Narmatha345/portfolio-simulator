import { Block } from "baseui/block";
import { ToasterContainer } from "baseui/toast";
import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Container } from "./components/common/Container";
import { HelpDrawer, HelpProvider, useHelp } from "./components/help";
import { AppHeader } from "./components/layout/AppHeader";
import { BottomBar } from "./components/layout/BottomBar";
import LumpsumSipCompare from './pages/LumpsumSipCompare';
import { NetworthEstimatorCopyPage } from "./pages/NetworthEstimatorCopyPage";
import { NetworthEstimatorPage } from "./pages/NetworthEstimatorPage";
import NetworthGoldPage from "./pages/NetworthGoldPage"; // ✅ FIXED (default import)
import NetworthCurrencyPage from "./pages/NetworthCurrencyPage";
import { StockPriceTab } from "./pages/StockPriceTab";
import { StockSipTab } from "./pages/StockSipTab";
import { StockSwpTab } from "./pages/StockSwpTab";
import { WeeklyStockPricePage } from "./pages/WeeklyStockPricePage";
import { YahooStockPrice } from "./pages/YahooStockPrice";
import { setGlobalOpenHelp } from "./services/yahooFinanceService";
import { trackPageView } from "./utils/analytics";

const AppContent: React.FC = () => {
  const location = useLocation();
  const { openHelp } = useHelp();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    setGlobalOpenHelp(openHelp);
  }, [openHelp]);

  // Tabs
  const isStockPriceTab = location.pathname === "/stock-price";
  const isStockSipTab = location.pathname === "/stock-sip";
  const isStockSwpTab = location.pathname === "/stock-swp";
  const isYahooStockPrice = location.pathname === "/yahoo-stock-price";
  const isWeeklyHighLow = location.pathname === "/weekly-high-low";
  const isCompareTab = location.pathname === "/compare";
  const isNetworthEstimator = location.pathname === "/networth-estimator";
  const isNetworthEstimatorCopy = location.pathname === "/networth-estimator-copy";

  // ✅ NEW GOLD PAGE
  const isNetworthGold = location.pathname === "/networth-gold";

  const isNetworthCurrency = location.pathname === "/networth-currency";

  return (
    <Container>
      <ToasterContainer autoHideDuration={5000} />
      <AppHeader />

      <Block
        position="relative"
        flex="1"
        display="flex"
        flexDirection="column"
        width="100%"
        maxWidth="1200px"
        margin="0 auto"
        paddingLeft={['scale300', 'scale400', 'scale600']}
        paddingRight={['scale300', 'scale400', 'scale600']}
        paddingTop="scale400"
        paddingBottom="scale800"
      >
        {/* Routes */}
        <Routes>
          <Route path="/" element={<Navigate to="/stock-price" replace />} />
          <Route path="/lumpsum" element={<Navigate to="/stock-price" replace />} />
          <Route path="/sip" element={<Navigate to="/stock-price" replace />} />
          <Route path="/historical" element={<Navigate to="/stock-price" replace />} />
          <Route path="/stock-price" element={null} />
          <Route path="/stock-sip" element={null} />
          <Route path="/stock-swp" element={null} />
          <Route path="/yahoo-stock-price" element={null} />
          <Route path="/weekly-high-low" element={null} />
          <Route path="/compare" element={null} />
          <Route path="/networth-estimator" element={null} />
          <Route path="/networth-estimator-copy" element={null} />

          {/* ✅ NEW ROUTE */}
          <Route path="/networth-gold" element={null} />
          <Route path="/networth-currency" element={null} />

          <Route path="/portfolio" element={<Navigate to="/stock-price" replace />} />
        </Routes>

        <>
          <Block display={isStockPriceTab ? "block" : "none"} flex="1">
            <StockPriceTab />
          </Block>

          <Block display={isStockSipTab ? "block" : "none"} flex="1">
            <StockSipTab />
          </Block>

          <Block display={isStockSwpTab ? "block" : "none"} flex="1">
            <StockSwpTab />
          </Block>

          <Block display={isYahooStockPrice ? "block" : "none"} flex="1">
            <YahooStockPrice />
          </Block>

          <Block display={isWeeklyHighLow ? "block" : "none"} flex="1">
            <WeeklyStockPricePage />
          </Block>

          <Block display={isCompareTab ? "block" : "none"} flex="1">
            <LumpsumSipCompare />
          </Block>

          <Block display={isNetworthEstimator ? "block" : "none"} flex="1">
            <NetworthEstimatorPage />
          </Block>

          <Block display={isNetworthEstimatorCopy ? "block" : "none"} flex="1">
            <NetworthEstimatorCopyPage />
          </Block>

          {/* ✅ GOLD PAGE RENDER */}
          <Block display={isNetworthGold ? "block" : "none"} flex="1">
            <NetworthGoldPage />
          </Block>

          <Block display={isNetworthCurrency ? "block" : "none"} flex="1">
            <NetworthCurrencyPage />
          </Block>
        </>
      </Block>

      <BottomBar />
      <HelpDrawer />
    </Container>
  );
};

const App: React.FC = () => {
  return (
    <HelpProvider>
      <AppContent />
    </HelpProvider>
  );
};

export default App;