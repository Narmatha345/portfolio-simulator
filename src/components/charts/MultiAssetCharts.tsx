import React, { useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { mfapiMutualFund } from '../../types/mfapiMutualFund';
import { SipPortfolio } from '../../types/sipPortfolio';
import { LumpsumPortfolio } from '../../types/lumpsumPortfolio';
import { AssetType } from '../../types/asset';
import { Block } from 'baseui/block';
import { HeadingSmall, ParagraphSmall } from 'baseui/typography';
import { useHelp } from '../help';
import { TransactionModal } from '../modals/TransactionModal';
import { CHART_STYLES } from '../../constants';
import { VolatilityChart } from './VolatilityChart';
import { ReturnDistributionChart } from './ReturnDistributionChart';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR, formatDate, getAllDates } from '../../utils/stockChartConfig';
import { recalculateTransactionsForDate } from '../../utils/calculations/sipRollingXirr';
import { recalculateLumpsumTransactionsForDate } from '../../utils/calculations/lumpSumRollingXirr';

interface MultiAssetChartsProps {
  navDatas: Record<string, any[]>;
  lumpsumPortfolioXirrData?: Record<string, any[]>;
  sipPortfolioXirrData?: Record<string, any[]>;
  funds: mfapiMutualFund[];
  COLORS: string[];
  sipPortfolios?: SipPortfolio[];
  lumpsumPortfolios?: LumpsumPortfolio[];
  years: number;
  amount: number;
  chartView: 'xirr' | 'corpus';
  isLumpsum: boolean;
}

interface ModalState {
  visible: boolean;
  transactions: any[];
  date: string;
  xirr: number;
  portfolioName: string;
  portfolioAssets: Array<{ schemeName: string; type: AssetType }>;
  chartView: 'xirr' | 'corpus';
}

const initialModalState: ModalState = {
  visible: false,
  transactions: [],
  date: '',
  xirr: 0,
  portfolioName: '',
  portfolioAssets: [],
  chartView: 'xirr'
};

const getPortfolioSeries = (
  portfolioXirrData: Record<string, any[]>,
  COLORS: string[],
  chartView: 'xirr' | 'corpus'
) => {

  const allDates = getAllDates(portfolioXirrData);

  return Object.entries(portfolioXirrData).map(([portfolioName, data], idx) => {

    const dateToValue: Record<string, number> = {};

    (data || []).forEach((row: any) => {

      let corpusValue = 0;
      let investedAmount = 0;

      if (row.transactions) {

        corpusValue = row.transactions
          .filter((tx: any) => tx.type === 'sell')
          .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

        investedAmount = row.transactions
          .filter((tx: any) => tx.type === 'buy')
          .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
      }

      if (chartView === 'xirr') {

        if (investedAmount > 0) {

          const returnPercent =
            ((corpusValue - investedAmount) / investedAmount) * 100;

          dateToValue[formatDate(row.date)] = returnPercent;
        }

      } else {

        dateToValue[formatDate(row.date)] = corpusValue;
      }
    });

    const seriesData = allDates
      .map(date => {
        const value = dateToValue[date];
        return value !== undefined
          ? [new Date(date).getTime(), value]
          : null;
      })
      .filter(point => point !== null);

    return {
      name: portfolioName,
      data: seriesData,
      type: 'line',
      color: COLORS[idx % COLORS.length],
      marker: { enabled: false },
      showInNavigator: true
    };
  });
};

const getStockChartOptions = (
  portfolioXirrData: Record<string, any[]>,
  chartView: 'xirr' | 'corpus'
) => ({

  chart: {
    backgroundColor: CHART_STYLES.colors.background,
    borderRadius: 8
  },

  title: { text: undefined },

  credits: { enabled: false },

  xAxis: {
    type: 'datetime'
  },

  yAxis: {
    title: {
      text: chartView === 'xirr'
        ? 'Return (%)'
        : 'Corpus Value (₹)'
    },
    labels: {
      formatter: function (this: any) {
        if (chartView === 'xirr') {
          return this.value + ' %';
        }
        return '₹' + new Intl.NumberFormat('en-IN').format(this.value);
      }
    }
  },

  rangeSelector: { enabled: false },

  navigator: STOCK_CHART_NAVIGATOR,
  scrollbar: STOCK_CHART_SCROLLBAR,

  tooltip: {

    shared: true,

    formatter: function (this: any) {

      let html = `<b>${Highcharts.dateFormat('%e %b %Y', this.x)}</b><br/>`;

      this.points.forEach((point: any) => {

        const portfolioName = point.series.name;

        const pointDate = Highcharts.dateFormat('%Y-%m-%d', this.x);

        const entry = portfolioXirrData[portfolioName]?.find(
          (row: any) => formatDate(row.date) === pointDate
        );

        let corpus = 0;
        let invested = 0;

        if (entry?.transactions) {

          corpus = entry.transactions
            .filter((tx: any) => tx.type === 'sell')
            .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

          invested = entry.transactions
            .filter((tx: any) => tx.type === 'buy')
            .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
        }

        const returnPercent =
          invested > 0
            ? (((corpus - invested) / invested) * 100).toFixed(2)
            : '0.00';

        if (chartView === 'xirr') {

          html += `<span style="color:${point.color}">●</span> ${portfolioName}: <b>${returnPercent}%</b><br/>`;

        } else {

          const formatted = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
          }).format(corpus);

          html += `<span style="color:${point.color}">●</span> ${portfolioName}: <b>${formatted}</b> (${returnPercent}%)<br/>`;
        }
      });

      return html;
    }
  }
});

export const MultiAssetCharts: React.FC<MultiAssetChartsProps> = ({
  navDatas,
  lumpsumPortfolioXirrData,
  sipPortfolioXirrData,
  funds,
  COLORS,
  sipPortfolios,
  lumpsumPortfolios,
  years,
  amount,
  chartView,
  isLumpsum
}) => {

  const [modal, setModal] = useState(initialModalState);
  const { openHelp } = useHelp();

  const portfolioXirrData =
    isLumpsum
      ? lumpsumPortfolioXirrData
      : sipPortfolioXirrData;

  const chartOptions = {

    ...getStockChartOptions(portfolioXirrData || {}, chartView),

    series: getPortfolioSeries(
      portfolioXirrData || {},
      COLORS,
      chartView
    ),

    chart: {
      height: 500
    }
  };

  const chartTitle =
    chartView === 'xirr'
      ? `${isLumpsum ? 'Lumpsum' : 'SIP'} Return % - Rolling ${years}Y`
      : `${isLumpsum ? 'Lumpsum' : 'SIP'} Corpus Value - Rolling ${years}Y`;

  return (

    <Block marginTop="2rem">

      <Block marginBottom="scale400" $style={{ textAlign: 'center' }}>

        <HeadingSmall marginTop="0">
          {chartTitle}
        </HeadingSmall>

        <ParagraphSmall color="contentTertiary">
          Each point shows the return if your investment ended on that date.
        </ParagraphSmall>

      </Block>

      <HighchartsReact
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptions}
      />

      {portfolioXirrData && (
        <ReturnDistributionChart
          portfolioXirrData={portfolioXirrData}
          COLORS={COLORS}
          years={years}
          chartView={chartView}
        />
      )}

      {portfolioXirrData && (
        <VolatilityChart
          sipPortfolioXirrData={portfolioXirrData}
          COLORS={COLORS}
          years={years}
        />
      )}

    </Block>
  );
};