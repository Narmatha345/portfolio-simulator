import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Container } from "./components/common/Container";
import { useMutualFunds } from "./hooks/useMutualFunds";
import { useNavData } from "./hooks/useNavData";
import { useAssetNavData } from "./hooks/useAssetNavData";
import { Block } from "baseui/block";
import { LoadingErrorStates } from "./components/common/LoadingErrorStates";
import { AppNavBar } from "baseui/app-nav-bar";
import { LumpsumSimulatorTab } from "./pages/LumpsumSimulatorTab";
import { SipSimulatorTab } from "./pages/SipSimulatorTab";
import { HistoricalValuesTab } from "./pages/HistoricalValuesTab";
import { BottomBar } from "./components/layout/BottomBar";
import { HelpProvider, HelpDrawer, useHelp } from "./components/help";
import { trackPageView } from "./utils/analytics";
import { ToasterContainer } from "baseui/toast";
import { setGlobalOpenHelp } from "./services/yahooFinanceService";

const AppContent: React.FC = () => {
  const { funds, loading, error } = useMutualFunds();
  const { loadNavData } = useNavData();
  const { loadNavData: loadAssetNavData } = useAssetNavData();

  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useHelp();

  // Track page view
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  // Register help trigger globally
  useEffect(() => {
    setGlobalOpenHelp(openHelp);
  }, [openHelp]);

  // Active tab detection
  const isLumpsumTab = location.pathname === "/lumpsum";
  const isSipTab = location.pathname === "/sip";
  const isHistoricalTab = location.pathname === "/historical";

  return (
    <Container>
      <ToasterContainer autoHideDuration={5000} />

      <AppNavBar
        title="Portfolio Simulator"
        mainItems={[
          { label: "Lumpsum Simulator", active: isLumpsumTab },
          { label: "SIP Simulator", active: isSipTab },
          { label: "Historical Values", active: isHistoricalTab },
          { label: "Help", info: { id: "help" } },
        ]}
        onMainItemSelect={(item) => {
          switch (item.label) {
            case "Lumpsum Simulator":
              navigate("/lumpsum");
              break;
            case "SIP Simulator":
              navigate("/sip");
              break;
            case "Historical Values":
              navigate("/historical");
              break;
            case "Help":
              openHelp("getting-started");
              break;
            default:
              break;
          }
        }}
        overrides={{
          Root: {
            style: {
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            },
          },
        }}
      />

      <Block
        position="relative"
        backgroundColor="white"
        padding="1.5rem"
        flex="1"
        display="flex"
        flexDirection="column"
      >
        <LoadingErrorStates loading={loading} error={error} />

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Navigate to="/lumpsum" replace />} />
          <Route path="/lumpsum" element={null} />
          <Route path="/sip" element={null} />
          <Route path="/historical" element={null} />
          <Route path="/portfolio" element={<Navigate to="/sip" replace />} />
        </Routes>

        {!loading && !error && funds.length > 0 && (
          <>
            <Block display={isLumpsumTab ? "block" : "none"} flex="1">
              <LumpsumSimulatorTab
                funds={funds}
                loadNavData={loadNavData}
              />
            </Block>

            <Block display={isSipTab ? "block" : "none"} flex="1">
              <SipSimulatorTab
                funds={funds}
                loadNavData={loadNavData}
              />
            </Block>

            <Block display={isHistoricalTab ? "block" : "none"} flex="1">
              <HistoricalValuesTab
                funds={funds}
                loadNavData={loadAssetNavData}
              />
            </Block>
          </>
        )}
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