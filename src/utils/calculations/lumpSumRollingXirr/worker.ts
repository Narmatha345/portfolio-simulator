// worker.ts - Web Worker for Lumpsum XIRR calculation (Vite/TypeScript compatible)

self.onmessage = async function (e) {

  const { navDataList, years, allocations, investmentAmount } = e.data;

  const module = await import('./index');

  const result = module.calculateLumpSumRollingXirr(
    navDataList,
    years,
    allocations,
    investmentAmount
  );

  self.postMessage(result);
};
