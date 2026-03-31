import { useCallback } from 'react';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { indexService } from '../services/indexService';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { fixedReturnService } from '../services/fixedReturnService';
import { inflationService } from '../services/inflationService';
import { trackSimulation } from '../utils/analytics';

export function useLumpsumPlot({
  lumpsumPortfolios,
  years,
  loadNavData,
  plotState,
  lumpsumAmount,
  chartView,
}) {

  const handlePlotAllPortfolios = useCallback(async () => {

    trackSimulation('Lumpsum', 'Plot');

    plotState.setLoadingNav(true);
    plotState.setLoadingXirr(false);
    plotState.setHasPlotted(false);
    plotState.setNavDatas({});
    plotState.setLumpSumXirrDatas({});
    plotState.setSipXirrDatas({});
    plotState.setXirrError(null);

    try {

      const allNavDatas: Record<string, any[][]> = {};
      const allNavsFlat: Record<string, any[]> = {};

      for (let pIdx = 0; pIdx < lumpsumPortfolios.length; ++pIdx) {

        const navs: any[][] = [];

        if (lumpsumPortfolios[pIdx].selectedAssets?.length) {

          for (const asset of lumpsumPortfolios[pIdx].selectedAssets.filter(Boolean)) {

            let nav: any[] = [];
            let identifier = '';

            try {

              if (asset.type === 'mutual_fund') {

                nav = await loadNavData(asset.schemeCode);
                identifier = `${pIdx}_${asset.schemeCode}`;

              } else if (asset.type === 'index_fund') {

                const indexData = await indexService.fetchIndexData(asset.indexName);

                if (!indexData?.length) continue;

                nav = indexData.map(i => ({
                  date: new Date(i.date),
                  nav: i.nav
                }));

                identifier = `${pIdx}_${asset.indexName}`;

              } else if (asset.type === 'yahoo_finance') {

                const stockData =
                  await yahooFinanceService.fetchStockDataConverted(
                    asset.symbol,
                    asset.convertToINR
                  );

                if (!stockData?.length) continue;

                nav = stockData
               .map(i => ({
                date: new Date(i.date),
                nav: i.nav
                }))
                .sort((a, b) => a.date.getTime() - b.date.getTime());

                identifier = `${pIdx}_${asset.symbol}`;

              } else if (asset.type === 'fixed_return') {

                nav = fixedReturnService.generateFixedReturnData(
                  asset.annualReturnPercentage,
                  1990
                );

                identifier = `${pIdx}_fixed_${asset.annualReturnPercentage}`;

              } else if (asset.type === 'inflation') {

                nav = await inflationService.generateInflationNavData(
                  asset.countryCode,
                  1960
                );

                identifier = `${pIdx}_inflation_${asset.countryCode}`;
              }

              if (!Array.isArray(nav) || nav.length === 0) continue;

              const filled = fillMissingNavDates(nav);

              navs.push(filled);
              allNavsFlat[identifier] = filled;

            } catch (error) {

              console.error(`Error loading ${asset.name}`, error);
            }
          }
        }

        allNavDatas[pIdx] = navs;
      }

      plotState.setNavDatas(allNavsFlat);

      plotState.setLoadingXirr(true);

      const allLumpsumXirrDatas: Record<string, any[]> = {};

      for (let pIdx = 0; pIdx < lumpsumPortfolios.length; ++pIdx) {

        const navDataList = allNavDatas[pIdx];

        if (!navDataList?.length) {

          allLumpsumXirrDatas[`Portfolio ${pIdx + 1}`] = [];
          continue;
        }

        let allocations = lumpsumPortfolios[pIdx].allocations || [];

        if (allocations.length !== navDataList.length) {

          allocations = Array(navDataList.length).fill(
            1 / navDataList.length
          );
        }

        const hasInflation =
          lumpsumPortfolios[pIdx].selectedAssets?.some(
            asset => asset?.type === 'inflation'
          );

        await new Promise<void>((resolve) => {

          const worker = new Worker(
            new URL(
              '../utils/calculations/lumpSumRollingXirr/worker.ts',
              import.meta.url
            )
          );
          allocations = allocations.map(a => a / 100);

          worker.postMessage({
            navDataList,
            years,
            allocations,
            investmentAmount: lumpsumAmount
          });

          worker.onmessage = (event: MessageEvent) => {

            let resultData = event.data;

            if (hasInflation && Array.isArray(resultData)) {

              resultData = resultData.map((entry: any) => {

                const { volatility, ...rest } = entry;
                return rest;
              });
            }

            allLumpsumXirrDatas[`Portfolio ${pIdx + 1}`] = resultData;

            worker.terminate();
            resolve();
          };

          worker.onerror = () => {

            allLumpsumXirrDatas[`Portfolio ${pIdx + 1}`] = [];

            worker.terminate();
            resolve();
          };
        });
      }

      plotState.setLumpSumXirrDatas(allLumpsumXirrDatas);

      plotState.setHasPlotted(true);
      plotState.setLoadingNav(false);
      plotState.setLoadingXirr(false);

    } catch (e) {

      const errorMsg = e instanceof Error ? e.message : String(e);

      plotState.setXirrError('Error loading data: ' + errorMsg);

      plotState.setLoadingNav(false);
      plotState.setLoadingXirr(false);
    }

  }, [lumpsumPortfolios, years, loadNavData, plotState, lumpsumAmount]);

  return { handlePlotAllPortfolios };
}
