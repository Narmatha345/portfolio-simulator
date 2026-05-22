import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { WeeklyStockPricePage } from './WeeklyStockPricePage';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/WeeklyHighLowChart', () => ({
  WeeklyHighLowChart: () => <div data-testid="weekly-high-low-chart" />,
}));

const fakeOHLCData = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.UTC(2023, 0, 1 + i)),
  open: 100 + i,
  high: 110 + i,
  low: 90 + i,
  close: 105 + i,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/weekly-high-low']}>
      <BaseProvider theme={LightTheme}>
        <WeeklyStockPricePage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] WeeklyStockPricePage — /weekly-high-low', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
    jest.spyOn(yahooFinanceService, 'fetchStockOHLCData').mockResolvedValue(fakeOHLCData as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: ticker input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText('e.g. AAPL')).toBeInTheDocument();
  });

  it('STRUCTURE: Plot button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /plot/i })).toBeInTheDocument();
  });

  it('REGRESSION: Plot button is disabled when ticker is cleared', async () => {
    renderPage();
    await userEvent.clear(screen.getByPlaceholderText('e.g. AAPL'));
    expect(screen.getByRole('button', { name: /plot/i })).toBeDisabled();
  });

  it('INTERACTION: Plot with a ticker renders weekly chart', async () => {
    renderPage();
    await userEvent.clear(screen.getByPlaceholderText('e.g. AAPL'));
    await userEvent.type(screen.getByPlaceholderText('e.g. AAPL'), 'MSFT');
    await userEvent.click(screen.getByRole('button', { name: /plot/i }));
    expect(await screen.findByTestId('weekly-high-low-chart')).toBeInTheDocument();
  });

  it('REGRESSION: Plot button enables after ticker is typed', async () => {
    renderPage();
    await userEvent.clear(screen.getByPlaceholderText('e.g. AAPL'));
    await userEvent.type(screen.getByPlaceholderText('e.g. AAPL'), 'MSFT');
    expect(screen.getByRole('button', { name: /plot/i })).not.toBeDisabled();
  });

  it('REGRESSION: chart does not duplicate on repeated Plot clicks', async () => {
    renderPage();
    const plotBtn = screen.getByRole('button', { name: /plot/i });
    await userEvent.click(plotBtn);
    await screen.findByTestId('weekly-high-low-chart');
    await userEvent.click(plotBtn);
    expect(screen.getAllByTestId('weekly-high-low-chart')).toHaveLength(1);
  });
});
