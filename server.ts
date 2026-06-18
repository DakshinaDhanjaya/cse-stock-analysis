import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import mongoose from 'mongoose';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { CompanyModel, FinancialDataModel } from './src/server/models.js';

const upload = multer({ storage: multer.memoryStorage() });

async function connectDB() {
  if (mongoose.connection.readyState === 1) return true;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI environment variable is missing.");
    return false;
  }
  try {
    await mongoose.connect(uri);
    return true;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to ensure DB connection before API requests
  app.use('/api', async (req, res, next) => {
    // If it's a proxy to CSE, we might not need DB strictly, but let's connect anyway
    const connected = await connectDB();
    if (!connected && !req.path.includes('/proxy/')) {
      return res.status(200).json({ error: 'MONGODB_URI not found. Database is not connected.' });
    }
    next();
  });

  // --- Rate Limiter for CSE Proxies ---
  let lastCseRequestTime = 0;
  const CSE_DELAY_MS = 1000;

  async function rateLimitCse() {
    const now = Date.now();
    const timeSinceLast = now - lastCseRequestTime;
    if (timeSinceLast < CSE_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, CSE_DELAY_MS - timeSinceLast));
    }
    lastCseRequestTime = Date.now();
  }

  // --- CSE API Proxies ---
  const CSE_BASE_URL = 'https://www.cse.lk/api';

  app.get('/api/proxy/dailyMarketSummery', async (req, res) => {
    try {
      await rateLimitCse();
      const response = await fetch(`${CSE_BASE_URL}/dailyMarketSummery`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      
      let topGainers = [];
      try {
        const gainersRes = await fetch(`${CSE_BASE_URL}/topGainers`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (gainersRes.ok) {
          const gData = await gainersRes.json();
          topGainers = gData.map((g: any) => ({ symbol: g.symbol, tradePrice: g.price, percentageChange: g.changePercentage.toFixed(2) }));
        }
      } catch (e) {
        console.error("topGainers err", e);
      }

      res.json({
        reqMarketSummery: [
          { id: 1, value: data[0][0].asi, change: data[0][0].asi - data[1][0].asi, percentageChange: ((data[0][0].asi - data[1][0].asi) / data[1][0].asi) * 100 },
          { id: 2, value: data[0][0].spp, change: data[0][0].spp - data[1][0].spp, percentageChange: ((data[0][0].spp - data[1][0].spp) / data[1][0].spp) * 100 }
        ],
        reqTurnOver: [ { id: 1, value: data[0][0].marketTurnover } ],
        reqTopGainerAndLoser: {
          topGainers: topGainers,
          topLosers: []
        },
        gainersCount: topGainers.length,
        losersCount: 0
      });
    } catch (err: any) {
      res.status(502).json({ error: 'Failed to fetch from CSE API', details: err.message });
    }
  });

  app.get('/api/proxy/allSectors', async (req, res) => {
    try {
      await rateLimitCse();
      const response = await fetch(`${CSE_BASE_URL}/allSectors`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      res.json({ reqSectors: data });
    } catch (err: any) {
      res.status(502).json({ error: 'Failed to fetch from CSE API', details: err.message });
    }
  });

  app.post('/api/proxy/companyInfoSummery', async (req, res) => {
    try {
      await rateLimitCse();
      let symbol = req.body.symbol || '';
      if (!symbol.includes('.')) symbol += '.N0000';
      
      const formData = new URLSearchParams();
      formData.append('symbol', symbol);

      const response = await fetch(`${CSE_BASE_URL}/companyInfoSummery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: 'Failed to fetch from CSE API', details: err.message });
    }
  });

  app.post('/api/proxy/companyChartDataByStock', async (req, res) => {
    try {
      await rateLimitCse();
      let stockId = req.body.symbol || '';
      if (!stockId.includes('.')) stockId += '.N0000';
      
      const formData = new URLSearchParams();
      formData.append('stockId', stockId);

      const response = await fetch(`${CSE_BASE_URL}/companyChartDataByStock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: 'Failed to fetch from CSE API', details: err.message });
    }
  });

  app.post('/api/proxy/getFinancialAnnouncement', async (req, res) => {
    try {
      await rateLimitCse();
      let symbol = req.body.symbol || '';
      if (symbol.includes('.')) symbol = symbol.split('.')[0];

      const formData = new URLSearchParams();
      formData.append('symbol', symbol);

      const response = await fetch(`${CSE_BASE_URL}/getFinancialAnnouncement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : [];
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: 'Failed to fetch from CSE API', details: err.message });
    }
  });

  // --- DB Routes ---

  app.get('/api/companies', async (req, res) => {
    try {
      const companies = await CompanyModel.find().sort({ symbol: 1 });
      res.json(companies);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk sync from frontend
  app.post('/api/companies/sync', async (req, res) => {
    try {
      const { companies } = req.body;
      if (!companies || !Array.isArray(companies)) {
        return res.status(400).json({ error: 'Expected array of companies' });
      }
      
      const bulkOps = companies.map((c: any) => ({
        updateOne: {
          filter: { symbol: c.symbol },
          update: { $set: { symbol: c.symbol, name: c.name, sector: c.sector } },
          upsert: true,
        }
      }));
      
      if (bulkOps.length > 0) {
        await CompanyModel.bulkWrite(bulkOps);
      }
      res.json({ success: true, count: bulkOps.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/financials/:symbol', async (req, res) => {
    try {
      const data = await FinancialDataModel.find({ company_symbol: req.params.symbol }).sort({ fiscal_year: -1 });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/financials', async (req, res) => {
    try {
      const doc = new FinancialDataModel(req.body);
      await doc.save();
      res.json({ success: true, data: doc });
    } catch (err: any) {
      // Check for duplicate key error
      if (err.code === 11000) {
        // Find existing and update? Let's just update
        const query = {
          company_symbol: req.body.company_symbol,
          fiscal_year: req.body.fiscal_year,
          period_type: req.body.period_type,
          reporting_level: req.body.reporting_level
        };
        const updated = await FinancialDataModel.findOneAndUpdate(query, req.body, { new: true, upsert: true });
        res.json({ success: true, data: updated, updated: true });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // --- Gemini Extractor Route ---
  
  app.post('/api/extract-report', upload.array('images'), async (req, res) => {
    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY, 
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } 
      });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
      }

      const parts: any[] = files.map(f => ({
        inlineData: {
          mimeType: f.mimetype,
          data: f.buffer.toString('base64'),
        }
      }));

      const instructionPrompt = `You are extracting structured financial data from an image of a financial statement page (Income Statement, Statement of Financial Position, or Statement of Cash Flows) from a Sri Lankan company's annual/quarterly report.
Return ONLY a single valid JSON object, no markdown formatting, no explanation text before or after... (extract values for "group" and "company" columns if present, otherwise omit them)`;

      parts.push({ text: instructionPrompt });

      const financialSchema = {
        type: Type.OBJECT,
        properties: {
          total_revenue: { type: Type.NUMBER },
          cost_of_sales: { type: Type.NUMBER },
          gross_profit: { type: Type.NUMBER },
          results_from_operating_activities: { type: Type.NUMBER },
          profit_before_tax: { type: Type.NUMBER },
          net_profit: { type: Type.NUMBER },
          profit_attributable_to_parent: { type: Type.NUMBER },
          eps_basic: { type: Type.NUMBER },
          eps_diluted: { type: Type.NUMBER },
          dps: { type: Type.NUMBER },
          total_assets: { type: Type.NUMBER },
          total_current_assets: { type: Type.NUMBER },
          total_equity: { type: Type.NUMBER },
          total_current_liabilities: { type: Type.NUMBER },
          total_non_current_liabilities: { type: Type.NUMBER },
          operating_cash_flow: { type: Type.NUMBER },
          investing_cash_flow: { type: Type.NUMBER },
          financing_cash_flow: { type: Type.NUMBER },
          capex: { type: Type.NUMBER },
          cash_at_end: { type: Type.NUMBER },
        }
      };

      const generateWithRetry = async (aiConfig: any, attempt: number = 1): Promise<any> => {
        try {
          return await ai.models.generateContent(aiConfig);
        } catch (error: any) {
          if (attempt <= 3 && (error.status === 503 || error.message?.includes('503') || error.message?.includes('temporarily overloaded'))) {
            console.warn(`Gemini API 503 error, retrying attempt ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            return generateWithRetry(aiConfig, attempt + 1);
          }
          throw error;
        }
      };

      const response = await generateWithRetry({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              group: financialSchema,
              company: financialSchema,
            }
          }
        }
      });

      const jsonStr = response.text?.trim() || "{}";
      const parsed = JSON.parse(jsonStr);
      res.json(parsed);

    } catch (err: any) {
      console.error(err);
      let status = 500;
      let msg = 'Failed to extract data';
      if (err.status === 503 || err.message?.includes('503')) {
        status = 503;
        msg = 'Gemini Model is currently experiencing high demand. Please try again in a few minutes.';
      }
      res.status(status).json({ error: msg, details: err.message });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
