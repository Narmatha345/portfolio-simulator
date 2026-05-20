import { AppNavBar } from 'baseui/app-nav-bar';
import { useStyletron } from 'baseui';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHelp } from '../help';

/**
 * Top navigation on a light surface so the menu control stays visible on small screens.
 */
export function AppHeader(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useHelp();
  const [, theme] = useStyletron();

  const isStockPriceTab = location.pathname === '/stock-price';
  const isStockSipTab = location.pathname === '/stock-sip';
  const isStockSwpTab = location.pathname === '/stock-swp';
  const isYahooStockPrice = location.pathname === '/yahoo-stock-price';
  const isWeeklyHighLow = location.pathname === '/weekly-high-low';
  const isCompareTab = location.pathname === '/compare';
  const isNetworthEstimator = location.pathname === '/networth-estimator';
  const isNetworthEstimatorCopy = location.pathname === '/networth-estimator-copy';
  const isNetworthGold = location.pathname === '/networth-gold';
  const isNetworthCurrency = location.pathname === '/networth-currency';
  const isCrossMarketCompare = location.pathname === '/cross-market-compare';

  const overrides = useMemo(
    () => ({
      Root: {
        style: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
        },
      },
      AppName: {
        style: {
          color: theme.colors.contentPrimary,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          whiteSpace: 'nowrap' as const,
          flexShrink: 0,
        },
      },
      DesktopMenu: {
        style: {
          alignItems: 'center',
          flexWrap: 'nowrap' as const,
          flex: '1',
          minWidth: 0,
        },
      },
      DesktopMenuContainer: {
        style: {
          flexWrap: 'nowrap' as const,
          flex: '1',
          minWidth: 0,
        },
      },
      PrimaryMenuContainer: {
        style: {
          flexWrap: 'nowrap' as const,
          justifyContent: 'flex-start',
          alignItems: 'center',
          columnGap: '2px',
          paddingInlineEnd: theme.sizing.scale400,
          flex: '1',
          minWidth: 0,
          overflowX: 'auto' as const,
        },
      },
      MainMenuItem: {
        style: ({ $active }: { $active?: boolean }) => ({
          color: theme.colors.contentPrimary,
          borderBottomWidth: 0,
          borderBottomStyle: 'none',
          marginLeft: '1px',
          marginRight: '1px',
          paddingTop: theme.sizing.scale200,
          paddingBottom: theme.sizing.scale200,
          paddingLeft: theme.sizing.scale300,
          paddingRight: theme.sizing.scale300,
          fontSize: '13px',
          whiteSpace: 'nowrap' as const,
          borderRadius: theme.borders.radius300,
          backgroundColor: $active ? theme.colors.backgroundTertiary : 'transparent',
          fontWeight: $active ? 700 : 500,
          boxShadow: $active ? `inset 0 0 0 1px ${theme.colors.borderOpaque}` : 'none',
          ':hover': {
            color: theme.colors.contentPrimary,
            backgroundColor: theme.colors.backgroundTertiary,
          },
        }),
      },
      SideMenuButton: {
        style: {
          color: theme.colors.contentPrimary,
        },
      },
      MobileDrawer: {
        style: {
          backgroundColor: theme.colors.backgroundPrimary,
        },
      },
    }),
    [theme]
  );

  return (
    <AppNavBar
      title="Portfolio Simulator"
      mainItems={[
        { label: 'Lumpsum', active: isStockPriceTab },
        { label: 'SIP (Stocks)', active: isStockSipTab },
        { label: 'SWP (Stocks)', active: isStockSwpTab },
        { label: 'Yahoo Prices', active: isYahooStockPrice },
        { label: 'Weekly High/Low', active: isWeeklyHighLow },
        { label: 'Compare', active: isCompareTab },
        { label: 'Net worth', active: isNetworthEstimator },
        { label: 'Net worth AI', active: isNetworthEstimatorCopy },
        { label: 'Net worth GOLD', active: isNetworthGold },
        { label: 'FX View', active: isNetworthCurrency },
        { label: 'Cross-Market', active: isCrossMarketCompare },
        { label: 'Help', info: { id: 'help' } },
      ]}
      onMainItemSelect={(item) => {
        switch (item.label) {
          case 'Lumpsum':
            navigate('/stock-price');
            break;
          case 'SIP (Stocks)':
            navigate('/stock-sip');
            break;
          case 'SWP (Stocks)':
            navigate('/stock-swp');
            break;
          case 'Yahoo Prices':
            navigate('/yahoo-stock-price');
            break;
          case 'Weekly High/Low':
            navigate('/weekly-high-low');
            break;
          case 'Compare':
            navigate('/compare');
            break;
          case 'Net worth':
            navigate('/networth-estimator');
            break;
          case 'Net worth AI':
            navigate('/networth-estimator-copy');
            break;
          case 'Net worth GOLD':
            navigate('/networth-gold');
            break;
          case 'FX View':
            navigate('/networth-currency');
            break;
          case 'Cross-Market':
            navigate('/cross-market-compare');
            break;
          case 'Help':
            openHelp('getting-started');
            break;
          default:
            break;
        }
      }}
      overrides={overrides}
    />
  );
}
