export interface Company {
  symbol: string;
  name: string;
  sector: string;
}

export interface FinancialData {
  _id?: string;
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
}

export interface ExtractedReport {
  group?: Partial<FinancialData>;
  company?: Partial<FinancialData>;
}
