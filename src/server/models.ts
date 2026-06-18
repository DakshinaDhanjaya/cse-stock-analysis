import mongoose, { Schema, Document } from 'mongoose';

export interface ICompany extends Document {
  symbol: string;
  name: string;
  sector: string;
}

const CompanySchema: Schema = new Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  sector: { type: String },
});

export const CompanyModel = mongoose.model<ICompany>('Company', CompanySchema);

export interface IFinancialData extends Document {
  company_symbol: string;
  fiscal_year: number;
  period_type: string;
  reporting_level: string;
  total_revenue?: number;
  cost_of_sales?: number;
  gross_profit?: number;
  results_from_operating_activities?: number;
  profit_before_tax?: number;
  net_profit?: number;
  profit_attributable_to_parent?: number;
  eps_basic?: number;
  eps_diluted?: number;
  dps?: number;
  total_assets?: number;
  total_current_assets?: number;
  total_equity?: number;
  total_current_liabilities?: number;
  total_non_current_liabilities?: number;
  operating_cash_flow?: number;
  investing_cash_flow?: number;
  financing_cash_flow?: number;
  capex?: number;
  free_cash_flow?: number;
  cash_at_end?: number;
  needs_review: boolean;
  created_at: Date;
}

const FinancialDataSchema: Schema = new Schema({
  company_symbol: { type: String, required: true },
  fiscal_year: { type: Number, required: true },
  period_type: { type: String, required: true },
  reporting_level: { type: String, required: true },
  total_revenue: Number,
  cost_of_sales: Number,
  gross_profit: Number,
  results_from_operating_activities: Number,
  profit_before_tax: Number,
  net_profit: Number,
  profit_attributable_to_parent: Number,
  eps_basic: Number,
  eps_diluted: Number,
  dps: Number,
  total_assets: Number,
  total_current_assets: Number,
  total_equity: Number,
  total_current_liabilities: Number,
  total_non_current_liabilities: Number,
  operating_cash_flow: Number,
  investing_cash_flow: Number,
  financing_cash_flow: Number,
  capex: Number,
  free_cash_flow: Number,
  cash_at_end: Number,
  needs_review: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

FinancialDataSchema.index(
  { company_symbol: 1, fiscal_year: 1, period_type: 1, reporting_level: 1 },
  { unique: true }
);

export const FinancialDataModel = mongoose.model<IFinancialData>(
  'FinancialData',
  FinancialDataSchema
);
