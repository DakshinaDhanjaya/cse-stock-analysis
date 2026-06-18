import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard({ onExplore }: { onExplore: () => void }) {
  const [summary, setSummary] = useState<any>(null);
  const [sectors, setSectors] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [showApiPreview, setShowApiPreview] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, secRes] = await Promise.all([
        fetch('/api/proxy/dailyMarketSummery').then(async r => {
          const text = await r.text();
          try {
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error + " - " + (data.details || ''));
            return data;
          } catch (e: any) {
            throw new Error(!text.startsWith('<') ? e.message : "Service Unavailable (502). The server is restarting, please try again.");
          }
        }),
        fetch('/api/proxy/allSectors').then(async r => {
          const text = await r.text();
          try {
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error + " - " + (data.details || ''));
            return data;
          } catch (e: any) {
            throw new Error(!text.startsWith('<') ? e.message : "Service Unavailable (502). The server is restarting, please try again.");
          }
        }),
      ]);
      setSummary(sumRes);
      setSectors(secRes);
      
      // Auto-sync sectors/companies to our DB if available
      if (secRes?.reqSectors) {
        syncCompanies(secRes.reqSectors);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const syncCompanies = async (sectorsData: any[]) => {
    try {
      setSyncing(true);
      const companiesList: any[] = [];
      sectorsData.forEach(sector => {
        if (sector.companies) {
          sector.companies.forEach((comp: any) => {
            companiesList.push({
              symbol: comp.symbol,
              name: comp.name,
              sector: sector.name || 'Unknown'
            });
          });
        }
      });
      if (companiesList.length > 0) {
        await fetch('/api/companies/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companies: companiesList })
        });
      }
    } catch (err) {
      console.error('Failed to sync companies', err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 font-mono text-sm">
        <RefreshCw className="animate-spin mb-4 text-[#1A73E8]" size={24} />
        <p>INITIALIZING MARKET DATA...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-red-50 text-red-700 p-4 border border-red-200 shadow-sm flex items-center gap-4 font-mono text-sm">
        <AlertCircle size={20} className="text-red-600 shrink-0" />
        <div>
          <h3 className="font-bold uppercase tracking-wider">Exception: Fetch Failed</h3>
          <p className="text-[11px] opacity-80">{error || 'Unknown error'}</p>
        </div>
        <button onClick={fetchData} className="ml-auto bg-red-100 text-red-800 px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded hover:bg-red-200 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const aspi = summary.reqMarketSummery?.find((s: any) => s.id === 1); // Typically 1 is ASPI
  const snp = summary.reqMarketSummery?.find((s: any) => s.id === 2); // Typically 2 is S&P

  const topGainers = summary.reqTopGainerAndLoser?.topGainers || [];
  const topLosers = summary.reqTopGainerAndLoser?.topLosers || [];

  const COLORS = ['#1A73E8', '#4285F4', '#8AB4F8', '#1E8E3E', '#34A853', '#F9AB00', '#FBBC04', '#D93025', '#EA4335'];

  let sectorChartData = [];
  if (sectors?.reqSectors) {
    sectorChartData = sectors.reqSectors.map((s: any) => ({
      name: s.name,
      value: s.sectorTurnoverToday || 0
    })).filter((s: any) => s.value > 0).sort((a:any, b:any) => b.value - a.value).slice(0, 10);
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-800 uppercase">Main Dashboard</h2>
          <p className="text-[11px] text-gray-500 font-mono uppercase">Live summary from Colombo Stock Exchange</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowApiPreview(!showApiPreview)} className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-1.5 text-[10px] rounded font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 shadow-sm">
            <FileText size={12} />
            {showApiPreview ? 'Hide API Data' : 'View API Data'}
          </button>
          <button onClick={fetchData} className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-1.5 text-[10px] rounded font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 shadow-sm">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Sync Data
          </button>
        </div>
      </div>

      {showApiPreview && (
        <div className="bg-gray-900 border border-gray-700 shadow-sm rounded overflow-hidden">
          <div className="p-3 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-200 uppercase flex items-center gap-2"><FileText size={14}/> Raw Output (CSE.LK)</h2>
            <button onClick={() => setShowApiPreview(false)} className="text-gray-400 hover:text-white px-2 py-0.5 text-xs">Close</button>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-auto custom-scrollbar">
             <div>
                <h3 className="text-[10px] text-blue-400 font-bold uppercase mb-2">/api/proxy/dailyMarketSummery</h3>
                <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap">{JSON.stringify(summary, null, 2)}</pre>
             </div>
             <div>
                <h3 className="text-[10px] text-green-400 font-bold uppercase mb-2">/api/proxy/allSectors</h3>
                <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap">{JSON.stringify(sectors, null, 2)}</pre>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {aspi && (
           <MetricCard 
              title="ASPI Index" 
              value={aspi.value} 
              change={aspi.change} 
              changePercent={aspi.percentageChange} 
            />
        )}
        {snp && (
           <MetricCard 
              title="S&P SL20" 
              value={snp.value} 
              change={snp.change} 
              changePercent={snp.percentageChange} 
            />
        )}
        <div className="bg-white p-4 border border-gray-200 shadow-sm col-span-2 flex flex-col">
           <div className="flex justify-between items-center h-full">
              <div className="space-y-1">
                 <div className="text-[11px] text-gray-500 font-bold uppercase mb-1">Market Turnover</div>
                 <p className="text-3xl font-bold tracking-tighter font-mono">Rs. {((summary.reqTurnOver?.find((t:any) => t.id===1)?.value || 0) / 1000000000).toFixed(2)}B</p>
              </div>
              <div className="flex gap-6">
                 <div className="text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Gainers</p>
                    <p className="text-2xl font-bold font-mono text-green-600">{summary.gainersCount || 0}</p>
                 </div>
                 <div className="w-px h-10 bg-gray-200 self-center"></div>
                 <div className="text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Losers</p>
                    <p className="text-2xl font-bold font-mono text-red-600">{summary.losersCount || 0}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="bg-white border border-gray-200 shadow-sm flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-700 uppercase">Top Gainers</h2>
            <ArrowUpRight size={14} className="text-green-500 leading-none" />
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-2 border-b border-gray-200">Symbol</th>
                  <th className="px-4 py-2 border-b border-gray-200 text-right">Price</th>
                  <th className="px-4 py-2 border-b border-gray-200 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {topGainers.map((g: any, i: number) => (
                  <tr key={i} className="hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0" onClick={onExplore}>
                    <td className="px-4 py-2 font-bold text-[#1A73E8]">{g.symbol}</td>
                    <td className="px-4 py-2 text-right">{g.tradePrice?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-green-600 font-bold">+{g.percentageChange}%</td>
                  </tr>
                ))}
                {topGainers.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-700 uppercase">Top Losers</h2>
            <ArrowDownRight size={14} className="text-red-500 leading-none" />
          </div>
          <div className="flex-1 overflow-auto">
             <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-2 border-b border-gray-200">Symbol</th>
                  <th className="px-4 py-2 border-b border-gray-200 text-right">Price</th>
                  <th className="px-4 py-2 border-b border-gray-200 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {topLosers.map((g: any, i: number) => (
                  <tr key={i} className="hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0" onClick={onExplore}>
                    <td className="px-4 py-2 font-bold text-[#1A73E8]">{g.symbol}</td>
                    <td className="px-4 py-2 text-right">{g.tradePrice?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-bold">{g.percentageChange}%</td>
                  </tr>
                ))}
                {topLosers.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm flex flex-col">
           <div className="p-3 border-b border-gray-200 bg-gray-50">
             <h2 className="text-xs font-bold text-gray-700 uppercase">Sectors by Companies</h2>
           </div>
           <div className="flex-1 min-h-[200px] p-2">
             {sectorChartData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <RechartsPie>
                     <Pie
                        data={sectorChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                     >
                       {sectorChartData.map((entry: any, index: number) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip 
                        contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '11px', fontFamily: 'monospace' }} 
                     />
                   </RechartsPie>
                 </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-[11px] font-mono italic">Chart unavailable</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, changePercent }: { title: string, value: number, change: number, changePercent: number }) {
  const isPos = change > 0;
  const isNeg = change < 0;
  return (
    <div className="bg-white p-4 border border-gray-200 shadow-sm flex flex-col justify-center">
      <div className="text-[11px] text-gray-500 font-bold uppercase mb-1">{title}</div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold tracking-tighter font-mono">{value.toLocaleString()}</p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold">
        <span className={`${isPos ? 'text-green-600' : isNeg ? 'text-red-600' : 'text-gray-500'}`}>
          {isPos ? '+' : ''}{changePercent?.toFixed(2)}%
        </span>
        <span className="text-gray-400 font-normal">({isPos ? '+' : ''}{change?.toFixed(2)})</span>
      </div>
    </div>
  );
}
