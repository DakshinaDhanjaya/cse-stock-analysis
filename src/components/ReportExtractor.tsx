import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { FinancialData } from '../types.js';

export default function ReportExtractor({ symbol, onSaved }: { symbol: string, onSaved: () => void }) {
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
  const [periodType, setPeriodType] = useState('Annual');
  const [reportingLevel, setReportingLevel] = useState('Group');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<FinancialData> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExtract = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setExtractedData(null);

    const formData = new FormData();
    files.forEach(f => formData.append('images', f));

    try {
      const res = await fetch('/api/extract-report', {
        method: 'POST',
        body: formData,
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`API Error: ${res.status}`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || data.details || `API Error: ${res.status}`);
      }
      if (data.error) throw new Error(data.error || data.details);

      // Map group or company based on selection
      const extracted = reportingLevel === 'Group' ? data.group : data.company;
      if (!extracted) {
        throw new Error(`Gemini did not return data for the ${reportingLevel} column.`);
      }

      setExtractedData(extracted);
    } catch (err: any) {
      setError(err.message || 'Failed to extract data');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedData) return;
    setSaving(true);
    setError(null);

    // Validate Total Assets = Total Equity + Total Liabilities
    let needsReview = false;
    const a = Number(extractedData.total_assets) || 0;
    const e_val = Number(extractedData.total_equity) || 0;
    const cl = Number(extractedData.total_current_liabilities) || 0;
    const ncl = Number(extractedData.total_non_current_liabilities) || 0;
    const l = cl + ncl;
    
    if (a !== 0 && Math.abs(a - (e_val + l)) > 10) {
      needsReview = true;
    }

    const payload = {
      ...extractedData,
      company_symbol: symbol,
      fiscal_year: fiscalYear,
      period_type: periodType,
      reporting_level: reportingLevel,
      needs_review: needsReview
    };

    try {
      const res = await fetch('/api/financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let resData;
      try {
        resData = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid response from server when saving");
      }

      if (resData.error) throw new Error(resData.error);
      
      setExtractedData(null);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save data to DB');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm flex flex-col col-span-1">
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
         <h2 className="text-xs font-bold text-gray-700 uppercase">Ingestion: Image Extraction</h2>
      </div>
      
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Fiscal Year</label>
            <input type="number" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono w-full outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Period</label>
            <select value={periodType} onChange={e => setPeriodType(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono w-full outline-none focus:border-blue-500">
               <option>Annual</option>
               <option>Q1</option>
               <option>Q2</option>
               <option>Q3</option>
               <option>Q4</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Level</label>
            <select value={reportingLevel} onChange={e => setReportingLevel(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono w-full outline-none focus:border-blue-500">
               <option>Group</option>
               <option>Company</option>
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => fileInputRef.current?.click()}>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 ? (
             <p className="font-bold text-[#1A73E8] font-mono text-xs">{files.length} FILE(s) SELECTED</p>
          ) : (
             <>
               <div className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-2"><UploadCloud size={16}/> Drop Statement Screenshots</div>
               <div className="text-[10px] text-gray-300 italic font-mono uppercase">PNG/JPG only. Gemini Vision Engine.</div>
             </>
          )}
        </div>

        {files.length > 0 && !extractedData && (
           <button 
             onClick={handleExtract}
             disabled={uploading}
             className="bg-gray-800 text-white px-4 py-3 text-[11px] font-bold uppercase tracking-widest rounded w-full flex justify-center items-center gap-2 hover:bg-gray-900 disabled:opacity-50"
           >
             {uploading ? <><Loader2 size={16} className="animate-spin" /> EXECUTING EXTRACTION...</> : 'EXECUTE EXTRACTION'}
           </button>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 flex items-start gap-2 border border-red-200 font-mono text-[11px]">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-600"/>
            <p className="font-bold uppercase tracking-wide">{error}</p>
          </div>
        )}

        {extractedData && (
          <form onSubmit={handleSave} className="border-t border-gray-200 pt-4 mt-2 animate-in fade-in duration-300">
             <div className="flex justify-between items-center mb-4">
               <h4 className="font-bold text-[11px] text-green-600 uppercase flex items-center gap-1">
                  <CheckCircle size={14} /> Extraction Complete
               </h4>
               <p className="text-[10px] text-gray-400 font-mono italic uppercase">Review mapped fields</p>
             </div>
             
             <div className="space-y-1 mb-4">
                {Object.keys(extractedData).map((key) => {
                   if (key === '_id' || key === 'company_symbol' || key === 'created_at' || typeof (extractedData as any)[key] === 'boolean') return null;
                   return (
                      <div key={key} className="flex justify-between items-center text-[11px] border-b border-gray-100 pb-1 pt-1 group hover:bg-gray-50">
                         <span className="font-mono text-gray-500 uppercase font-bold" title={key.replace(/_/g, ' ')}>
                            {key}
                         </span>
                         <input 
                           type="number" 
                           value={(extractedData as any)[key] || ''} 
                           onChange={(e) => setExtractedData({...extractedData, [key]: Number(e.target.value)})}
                           className="text-right font-mono font-bold w-32 border border-transparent bg-transparent focus:bg-white focus:border-blue-300 px-1 py-0.5 outline-none rounded" 
                         />
                      </div>
                   )
                })}
             </div>

             <div className="flex justify-end">
               <button 
                   type="submit"
                   disabled={saving}
                   className="bg-[#1A73E8] text-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                   {saving ? 'COMMITTING...' : 'SAVE TO DATABASE'}
                </button>
             </div>
          </form>
        )}
      </div>
    </div>
  );
}
