import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import CorrelationExplorerPage from './CorrelationExplorerPage';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('highcharts', () => ({
  __esModule: true,
  default: { dateFormat: jest.fn(() => ''), chart: jest.fn() },
}));
jest.mock('highcharts/esm/highcharts', () => ({
  __esModule: true,
  default: { dateFormat: jest.fn(() => ''), chart: jest.fn() },
}));
jest.mock('highcharts/esm/modules/heatmap', () => ({}));
jest.mock('highcharts-react-official', () => () => <div data-testid="highcharts-chart" />);
jest.mock('../services/correlationAiService', () => ({
  fetchAiCandidates: jest.fn().mockResolvedValue([]),
}));

function businessDaySeries(count: number, priceFn: (i: number) => number) {
  const out: Array<{ date: Date; nav: number }> = [];
  let d = new Date(Date.UTC(2020, 0, 1));
  let i = 0;
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push({ date: new Date(d.getTime()), nav: priceFn(i) });
      i++;
    }
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

function upward(i: number): number {
  return 100 * Math.pow(1.0004, i) * (1 + 0.01 * Math.sin(i / 3));
}

const PRIMARY_SERIES = businessDaySeries(1000, upward);

const renderPage = (initialPath = '/correlation?ticker=VGT&period=5y&universe=custom&custom=AAPL,GLD') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BaseProvider theme={LightTheme}>
        <CorrelationExplorerPage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] CorrelationExplorerPage — /correlation', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
    jest.spyOn(yahooFinanceService, 'fetchStockData').mockImplementation(async (symbol: string) => {
      if (symbol === 'VGT') return PRIMARY_SERIES;
      if (symbol === 'AAPL') return businessDaySeries(1000, (i) => upward(i) * 3); // scalar multiple -> +1 correlation
      if (symbol === 'GLD') return businessDaySeries(1000, (i) => 1 / upward(i)); // inverted -> -1 correlation
      throw new Error(`Ticker "${symbol}" not found`);
    });
    (window as any).URL.createObjectURL = jest.fn(() => 'blob:mock');
    (window as any).URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => jest.restoreAllMocks());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: restores the primary ticker from URL parameters', () => {
    renderPage();
    expect(screen.getByDisplayValue('VGT')).toBeInTheDocument();
  });

  it('STRUCTURE: Find correlations and Cancel scan controls exist', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /find correlations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel scan/i })).toBeInTheDocument();
  });

  it('INTERACTION + OUTPUT: running a scan shows all four correlation horizons, grouped by category', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /find correlations/i }));

    expect(await screen.findByRole('heading', { name: /strongly correlated/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /strongly negative/i })).toBeInTheDocument();

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GLD')).toBeInTheDocument();

    // Column headers for all four horizons, within the ranked-results table.
    expect(screen.getAllByRole('button', { name: /^Daily/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Weekly/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Monthly/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Long-term/ }).length).toBeGreaterThan(0);
  });

  it('INTERACTION: sorting a correlation column toggles without crashing', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /find correlations/i }));
    await screen.findByText('AAPL');

    const dailyHeader = screen.getAllByRole('button', { name: /^Daily/ })[0];
    await userEvent.click(dailyHeader);
    expect(dailyHeader.textContent).toMatch(/[▲▼]/);
    await userEvent.click(dailyHeader);
    expect(dailyHeader.textContent).toMatch(/[▲▼]/);
  });

  it('INTERACTION: selecting a candidate opens the detail view', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /find correlations/i }));
    await screen.findByText('AAPL');

    await userEvent.click(screen.getByText('AAPL'));
    expect(await screen.findByText(/scatter plot/i)).toBeInTheDocument();
    expect(screen.getByText(/rolling correlation/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
  });

  it('OUTPUT: CSV export triggers a download without crashing', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /find correlations/i }));
    await screen.findByText('AAPL');

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));
    expect((window as any).URL.createObjectURL).toHaveBeenCalled();
  });

  it('INTERACTION: selecting symbols enables sending them to the Portfolio Simulator', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /find correlations/i }));
    await screen.findByText('AAPL');

    const sendButton = screen.getByRole('button', { name: /send selected to portfolio simulator/i });
    expect(sendButton).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', { name: /select aapl/i }));
    expect(sendButton).not.toBeDisabled();
  });
});
