import React from "react";
import { useLocation } from "react-router-dom";
import { HistoricalValuesPanel } from "../components/historical-values/HistoricalValuesPanel";
import { mfapiMutualFund } from "../types/mfapiMutualFund";
import { Asset } from "../types/asset";

interface HistoricalValuesTabProps {
  funds: mfapiMutualFund[];
  loadNavData: (asset: Asset) => Promise<any[]>;
}

export const HistoricalValuesTab: React.FC<HistoricalValuesTabProps> = ({
  funds,
  loadNavData,
}) => {
  const location = useLocation();

  const isActive = location.pathname === "/historical";

  return (
    <HistoricalValuesPanel
      funds={funds}
      loadNavData={loadNavData}
      isActive={isActive}
    />
  );
}