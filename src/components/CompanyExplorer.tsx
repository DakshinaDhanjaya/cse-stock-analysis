import { useEffect, useState } from 'react';
import { Search, Activity, AlertCircle, FileText, CheckCircle, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ReportExtractor from './ReportExtractor.js';
import { Company, FinancialData } from '../types.js';

export default function CompanyExplorer() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any>(null);
  
  const [historicalData, setHistoricalData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<FinancialData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ingest' | 'financials' | 'valuation'>('overview');

  useEffect(() => {
    fetch('/api/companies')
      .then(async r => {
         const text = await r.text();
         let data;
         try {
           data = JSON.parse(text);
         } catch(e) {
           throw new Error("Server returned an invalid response (not JSON)");
         }
         if (r.ok && Array.isArray(data)) {
            setCompanies(data);
         } else if (data.error) {
            if (data.error.includes('MONGODB_URI')) {
               setError('Warning: MongoDB is not connected. Autocomplete is disabled. Please set MONGODB_URI in settings, or type exact symbol (e.g. COMB) and press Enter.');
            } else {
               setError('Database Error: ' + data.error);
            }
         }
      })
      .catch(err => console.error(err));
  }, []);

  const selectCompany = async (symbol: string) => {
    if (!symbol.trim()) return;
    const cleanSymbol = symbol.trim().toUpperCase();
    setSelectedSymbol(cleanSymbol);
    setSearch(cleanSymbol);
    setLoading(true);
    setError(null);
    setActiveTab('overview');
    
    try {
      const [infoRes, chartRes, annRes] = await Promise.all([
        fetch('/api/proxy/companyInfoSummery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: cleanSymbol }) }).then(async r => {
          const text = await r.text();
          try {
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error + " - " + (data.details || ''));
            return data;
          } catch (e: any) {
            throw new Error(!text.startsWith('<') ? e.message : "Service Unavailable (502). The server is restarting, please try again.");
          }
        }),
        fetch('/api/proxy/companyChartDataByStock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: cleanSymbol }) }).then(async r => {
          const text = await r.text();
          try {
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error + " - " + (data.details || ''));
            return data;
          } catch (e: any) {
            console.warn("Chart data error: ", e);
            return []; // Fallback empty array instead of failing entire page load
          }
        }),
        fetch('/api/proxy/getFinancialAnnouncement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: cleanSymbol }) }).then(async r => {
          const text = await r.text();
          try {
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error + " - " + (data.details || ''));
            return data;
          } catch (e: any) {
            console.warn("Announcements error: ", e);
            return [];
          }
        })
      ]);
      setCompanyInfo(infoRes);
      setChartData(chartRes);
      setAnnouncements(annRes);
      await fetchFinancials(cleanSymbol);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch company data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancials = async (symbol: string) => {
    try {
      const res = await fetch(`/api/financials/${symbol}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid response format");
      }

      if (data.error) {
         console.warn(data.error);
         setHistoricalData([]);
      } else {
         setHistoricalData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setHistoricalData([]);
    }
  };

  const filtered = search.length > 1 
    ? companies.filter(c => c.symbol.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];

  const parsedChartData = chartData?.priceList?.map((p: any) => ({
    time: new Date(p[0]).toLocaleDateString(),
    price: p[1]
  })) || [];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="relative z-20">
        <div className="flex items-center bg-white border border-gray-300 rounded shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 p-2 transition-shadow">
          <Search size={16} className="text-gray-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search company symbol... (e.g. COMB, HAYL)" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') selectCompany(search);
            }}
            className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-gray-800 placeholder-gray-400"
          />
        </div>
        {filtered.length > 0 && search !== selectedSymbol && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 shadow-md rounded overflow-hidden divide-y divide-gray-100">
            {filtered.map(c => (
              <button 
                key={c.symbol} 
                onClick={() => selectCompany(c.symbol)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex justify-between items-center"
              >
                <div>
                  <span className="font-bold font-mono text-[#1A73E8]">{c.symbol}</span>
                  <span className="text-gray-500 ml-2 text-[11px] uppercase truncate">{c.name}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold uppercase">{c.sector}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedSymbol && (
        <div className="text-center py-20 text-gray-400 border border-dashed border-gray-300 bg-white shadow-sm flex flex-col items-center justify-center font-mono text-[11px] uppercase">
           <Activity size={24} className="mb-2 opacity-50" />
           <p className="font-bold">Awaiting Symbol Selection</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-20 text-gray-500 font-mono text-[11px] uppercase">
          <Activity className="animate-spin mx-auto mb-2 text-[#1A73E8]" size={24} />
          <p>Compiling Dataset...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-3 shadow-sm border border-red-200 flex items-center gap-3 font-mono text-[11px]">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <p className="font-bold">{error}</p>
        </div>
      )}

      {selectedSymbol && !loading && !error && companyInfo && (
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between bg-white border border-gray-200 p-4 shadow-sm">
             <div>
               <div className="text-[11px] text-gray-500 font-bold uppercase mb-1">Active Symbol</div>
               <h2 className="text-2xl font-bold tracking-tighter text-[#202124]">{selectedSymbol}</h2>
               <div className="text-xs text-gray-400 mt-1 uppercase leading-tight">{companyInfo.name} <br/> <span className="font-bold">{companyInfo.sectorName || 'Stock'}</span></div>
             </div>
             <div className="text-right">
                <div className="text-[11px] text-gray-500 font-bold uppercase mb-1">Last Traded</div>
                <p className="text-2xl font-bold font-mono text-blue-600 italic">Rs. {companyInfo.closingPrice?.toFixed(2) || 'N/A'}</p>
                {companyInfo.percentageChange !== undefined && (
                   <p className={`text-xs font-mono font-bold ${companyInfo.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {companyInfo.percentageChange >= 0 ? '+' : ''}{companyInfo.percentageChange}%
                   </p>
                )}
             </div>
          </div>

          <div className="flex border-b border-gray-200 bg-white border shadow-sm p-1 gap-1">
             {['overview', 'financials', 'ingest', 'valuation'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab as any)}
                 className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${activeTab === tab ? 'bg-[#E8F0FE] text-[#1A73E8]' : 'text-gray-500 hover:bg-gray-100'}`}
               >
                 {tab === 'ingest' ? '+ Add Report' : tab}
               </button>
             ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                 <div className="col-span-1 lg:col-span-2 bg-white border border-gray-200 shadow-sm flex flex-col">
                    <div className="p-3 border-b border-gray-200 bg-gray-50 items-center">
                       <h2 className="text-xs font-bold text-gray-700 uppercase">Historical Price Analysis</h2>
                    </div>
                    <div className="h-[250px] w-full p-4">
                       {parsedChartData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={parsedChartData}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                               <XAxis dataKey="time" tick={{fontSize: 10, fill: '#6b7280', fontFamily: 'monospace'}} tickMargin={10} minTickGap={30} />
                               <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#6b7280', fontFamily: 'monospace'}} width={40} />
                               <RechartsTooltip 
                                 contentStyle={{ borderRadius: '0', border: '1px solid #d1d5db', fontSize: '11px', fontFamily: 'monospace' }}
                               />
                               <Line type="monotone" dataKey="price" stroke="#1A73E8" strokeWidth={2} dot={false} />
                            </LineChart>
                         </ResponsiveContainer>
                       ) : (
                         <div className="h-full flex items-center justify-center text-gray-300 text-[11px] uppercase font-bold italic">No chart data</div>
                       )}
                    </div>
                 </div>
                 <div className="col-span-1 bg-white border border-gray-200 shadow-sm flex flex-col">
                    <div className="p-3 border-b border-gray-200 bg-gray-50">
                      <h2 className="text-xs font-bold text-gray-700 uppercase">Recent Filings</h2>
                    </div>
                    <div className="flex-1 overflow-auto p-0">
                       {announcements?.reqFinancialFilings?.length > 0 ? (
                           <ul className="divide-y divide-gray-100">
                             {announcements.reqFinancialFilings.slice(0, 10).map((a: any, i: number) => (
                               <li key={i} className="p-3 hover:bg-gray-50">
                                 <p className="text-[11px] font-bold text-gray-800 leading-tight uppercase">{a.heading}</p>
                                 <p className="text-[10px] text-gray-400 mt-1 font-mono">{a.broadcastDate}</p>
                               </li>
                             ))}
                           </ul>
                       ) : (
                          <div className="p-4 text-center text-[10px] text-gray-400 font-mono uppercase">No filings found</div>
                       )}
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'ingest' && (
              <ReportExtractor symbol={selectedSymbol} onSaved={() => {
                fetchFinancials(selectedSymbol); 
                setActiveTab('financials'); 
              }} />
            )}

            {activeTab === 'financials' && (
              <div className="bg-white border border-gray-200 shadow-sm flex flex-col">
                 <div className="p-3 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-xs font-bold text-gray-700 uppercase">Historical Financial Records</h2>
                 </div>
                 <div className="overflow-x-auto">
                    {historicalData.length > 0 ? (
                        <table className="w-full text-left">
                          <thead className="bg-white text-gray-500 text-[10px] uppercase font-bold sticky top-0 shadow-sm border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 border-b border-gray-200">Period</th>
                              <th className="px-4 py-2 border-b border-gray-200">Level</th>
                              <th className="px-4 py-2 border-b border-gray-200 text-right">Revenue</th>
                              <th className="px-4 py-2 border-b border-gray-200 text-right">Net Profit</th>
                              <th className="px-4 py-2 border-b border-gray-200 text-right">Total Equity</th>
                              <th className="px-4 py-2 border-b border-gray-200 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-mono">
                            {historicalData.map(d => (
                              <tr key={d._id} className="hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                                <td className="px-4 py-2 font-bold text-[#1A73E8]">{d.fiscal_year} {d.period_type}</td>
                                <td className="px-4 py-2 uppercase">{d.reporting_level}</td>
                                <td className="px-4 py-2 text-right">{d.total_revenue?.toLocaleString() || '-'}</td>
                                <td className="px-4 py-2 text-right">{d.net_profit?.toLocaleString() || '-'}</td>
                                <td className="px-4 py-2 text-right">{d.total_equity?.toLocaleString() || '-'}</td>
                                <td className="px-4 py-2 text-center">
                                  <button onClick={() => setSelectedReport(d)} className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 border cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500 ${d.needs_review ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-600 bg-green-50 border-green-200'}`}>
                                     {d.needs_review ? 'Review' : 'Valid'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                          <p className="text-[11px] font-mono uppercase font-bold">No Records Found</p>
                          <button onClick={() => setActiveTab('ingest')} className="mt-3 bg-white border border-gray-300 shadow-sm px-3 py-1 text-[10px] uppercase font-bold hover:bg-gray-50 text-gray-600 rounded">Add First Report</button>
                        </div>
                    )}
                 </div>
              </div>
            )}

            {activeTab === 'valuation' && (
              <div className="bg-white border border-gray-200 shadow-sm flex flex-col items-center">
                <div className="w-full p-4 border-b border-gray-200 bg-gray-50 items-center justify-between flex">
                   <h2 className="text-xs font-bold text-gray-700 uppercase">Intrinsic Valuation Engine</h2>
                   <div className="px-2 py-0.5 bg-blue-100 text-[#1A73E8] border border-blue-200 text-[10px] font-bold uppercase tracking-widest rounded">BETA v1.0</div>
                </div>
                
                <div className="p-8 w-full">
                   {historicalData.filter(d => d.period_type === 'Annual').length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-6">
                            <div>
                               <h3 className="text-[11px] font-bold uppercase text-gray-400 mb-2 tracking-wider border-b border-gray-100 pb-1">Price Metrics</h3>
                               <div className="grid grid-cols-2 gap-4">
                                  <div>
                                     <p className="text-[10px] text-gray-500 font-bold uppercase">Current Price</p>
                                     <p className="text-lg font-mono font-bold text-[#202124]">Rs. {companyInfo.closingPrice?.toFixed(2) || 'N/A'}</p>
                                  </div>
                                  <div>
                                     <p className="text-[10px] text-gray-500 font-bold uppercase">Market Cap</p>
                                     <p className="text-lg font-mono font-bold text-[#202124]">Rs. {companyInfo.marketCap ? (companyInfo.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A'}</p>
                                  </div>
                               </div>
                            </div>
                            
                            <div>
                               <h3 className="text-[11px] font-bold uppercase text-gray-400 mb-2 tracking-wider border-b border-gray-100 pb-1">Derived Fundamentals</h3>
                               <div className="grid grid-cols-2 gap-4">
                                  {(() => {
                                     const latest = historicalData.filter(d => d.period_type === 'Annual').sort((a,b) => b.fiscal_year - a.fiscal_year)[0];
                                     const shares = companyInfo.symbolIndexShareVolume || 1;
                                     const eps = latest.eps_basic || (latest.net_profit ? (latest.net_profit * 1000) / shares : 0);
                                     const pe = eps > 0 && companyInfo.closingPrice ? companyInfo.closingPrice / eps : 0;
                                     
                                     const equity = latest.total_equity ? latest.total_equity * 1000 : 0;
                                     const bvps = equity / shares;
                                     const pb = bvps > 0 && companyInfo.closingPrice ? companyInfo.closingPrice / bvps : 0;

                                     const graham = (eps > 0 && bvps > 0) ? Math.sqrt(22.5 * eps * bvps) : 0;

                                     return (
                                        <>
                                           <div>
                                              <p className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">Implied P/E <span title={"Based on " + latest.fiscal_year + " Earnings"} className="text-gray-300 cu-help">ⓘ</span></p>
                                              <p className="text-lg font-mono font-bold text-blue-600">{pe > 0 ? pe.toFixed(2) + 'x' : 'N/A'}</p>
                                           </div>
                                           <div>
                                              <p className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">Implied P/B <span title={"Based on " + latest.fiscal_year + " Book Value"} className="text-gray-300 cu-help">ⓘ</span></p>
                                              <p className="text-lg font-mono font-bold text-blue-600">{pb > 0 ? pb.toFixed(2) + 'x' : 'N/A'}</p>
                                           </div>
                                           <div className="col-span-2 pt-2">
                                              <div className="bg-gray-50 border border-gray-200 p-3 rounded flex justify-between items-center">
                                                 <div>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Graham Number (Fair Value)</p>
                                                    <p className="text-[9px] text-gray-400 font-mono mt-0.5 max-w-[200px]">SQRT(22.5 × EPS × BVPS)</p>
                                                 </div>
                                                 <p className="text-2xl font-mono font-bold text-[#1E8E3E]">Rs. {graham > 0 ? graham.toFixed(2) : 'N/A'}</p>
                                              </div>
                                              {graham > 0 && companyInfo.closingPrice && (
                                                <div className="mt-2 text-right">
                                                   <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${companyInfo.closingPrice < graham ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                      {companyInfo.closingPrice < graham ? ((graham - companyInfo.closingPrice)/companyInfo.closingPrice * 100).toFixed(1) + '% UNDERVALUED' : ((companyInfo.closingPrice - graham)/graham * 100).toFixed(1) + '% OVERVALUED'}
                                                   </span>
                                                </div>
                                              )}
                                           </div>
                                        </>
                                     );
                                  })()}
                               </div>
                            </div>
                         </div>
                         
                         <div className="border border-gray-200 shadow-sm p-4 text-center flex flex-col justify-center items-center h-full bg-[#f8f9fa] relative overflow-hidden">
                             <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-400 to-emerald-400"></div>
                             <h4 className="font-bold text-gray-800 uppercase tracking-widest text-xs mb-2">Automated Valuation Notice</h4>
                             <p className="text-[11px] text-gray-500 font-mono text-justify mb-4 leading-relaxed">
                                The Intrinsic Valuation Engine uses Graham's formula and historical filings to quickly assess fair pricing. This model does not account for forward-looking growth, complex DCF factors, or qualitative signals.
                             </p>
                             <div className="border border-blue-200 bg-blue-50 text-blue-800 text-[10px] px-3 py-2 uppercase font-bold italic tracking-wider">
                                For Personal Research Only. Not Financial Advice.
                             </div>
                         </div>
                      </div>
                   ) : (
                      <div className="text-center py-8">
                        <h3 className="text-xl font-bold italic tracking-tighter mb-4 text-[#202124]">PROJECTION MODULE <span className="text-sm font-normal not-italic text-gray-400 border border-gray-200 px-1 ml-2 bg-gray-50 relative -top-1">v0.9</span></h3>
                        <p className="text-[11px] text-gray-500 max-w-sm mx-auto mb-6 uppercase leading-relaxed font-bold">
                           System requires at least 1 annual reporting period for base calculations (Graham, P/E, P/B).
                        </p>
                        <div className="border border-gray-200 bg-gray-50 px-8 py-4 inline-flex gap-8 mb-6 shadow-sm mx-auto">
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Stored Annual Records</p>
                            <p className="text-2xl font-bold font-mono text-red-500">0</p>
                          </div>
                        </div>
                        <div>
                           <button onClick={() => setActiveTab('ingest')} className="bg-[#1A73E8] text-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer">
                              Add Annual Report Data
                           </button>
                        </div>
                      </div>
                   )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
               <div>
                  <h3 className="font-bold uppercase tracking-wider text-sm text-gray-800">Financial Report Review</h3>
                  <p className="text-[10px] uppercase font-mono text-[#1A73E8] mt-1 font-bold">{selectedReport.fiscal_year} • {selectedReport.period_type} • {selectedReport.reporting_level}</p>
               </div>
               <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-gray-200 rounded transition-colors focus:outline-none">
                 <X size={16} />
               </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-white min-h-[300px]">
               <div className="border border-gray-200 shadow-sm p-5 relative bg-[#f8f9fa]">
                  {selectedReport.needs_review ? (
                     <div className="absolute -top-3 left-4 bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-sm">
                       <AlertCircle size={10} /> Needs Validation
                     </div>
                  ) : (
                     <div className="absolute -top-3 left-4 bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-sm">
                       <CheckCircle size={10} /> Verified
                     </div>
                  )}
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-sm mt-3">
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Total Revenue</p>
                        <p className="font-mono mt-1 font-bold text-lg text-gray-800">Rs. {selectedReport.total_revenue?.toLocaleString() || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Net Profit</p>
                        <p className="font-mono mt-1 font-bold text-lg text-gray-800">Rs. {selectedReport.net_profit?.toLocaleString() || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Total Assets</p>
                        <p className="font-mono mt-1 font-bold text-lg text-gray-800">Rs. {selectedReport.total_assets?.toLocaleString() || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Total Liabilities</p>
                        <p className="font-mono mt-1 font-bold text-lg text-gray-800">Rs. {selectedReport.total_liabilities?.toLocaleString() || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Total Equity</p>
                        <p className="font-mono mt-1 font-bold text-lg text-[#1A73E8]">Rs. {selectedReport.total_equity?.toLocaleString() || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Basic EPS</p>
                        <p className="font-mono mt-1 font-bold text-lg text-gray-800">Rs. {selectedReport.eps_basic?.toLocaleString() || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 border-t border-gray-200 pt-2 col-span-2">Net Asset Value Per Share</p>
                        <p className="font-mono mt-1 font-bold text-lg text-gray-800">Rs. {selectedReport.net_asset_value_per_share?.toLocaleString() || 'N/A'}</p>
                     </div>
                  </div>
                  
                  {selectedReport.raw_text_used && (
                     <div className="mt-8 pt-4 border-t border-gray-200">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Source Context Segment</p>
                        <div className="bg-white border border-gray-200 p-3 shadow-inner text-[10px] font-mono text-gray-600 max-h-[150px] overflow-auto whitespace-pre-wrap">
                          {selectedReport.raw_text_used}
                        </div>
                     </div>
                  )}
               </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
               <button onClick={() => setSelectedReport(null)} className="px-5 py-2 border border-gray-300 text-gray-700 bg-white text-[11px] font-bold uppercase tracking-wider shadow-sm hover:bg-gray-100 focus:outline-none transition-colors">
                  Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
