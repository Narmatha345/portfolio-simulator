self.onmessage=async function(s){const{navDataList:t,years:a,allocations:e,investmentAmount:n}=s.data,o=(await import("./index-ClZm2rhd.js")).calculateLumpSumRollingXirr(t,a,e,n);self.postMessage(o)};
//# sourceMappingURL=worker-CYpD0F4U.js.map
