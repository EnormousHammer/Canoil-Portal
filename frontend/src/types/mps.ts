export interface MPSOrder {
  // Core identifiers
  line_number: string;
  order_number?: string;
  so_number: string;
  mo_number: string;
  wip: string;
  work_center: string;
  status: string;
  
  // Product info
  product: string;
  customer?: string;
  customer_code?: string;
  packaging: string;
  
  // Quantities
  required: number;
  ready: number;
  planned?: number;
  actual?: number;
  
  // Percentages
  planned_pct: string;
  actual_pct: string;
  
  // Dates
  promised_date: string;
  promised?: string;
  start_date: string;
  end_date: string;
  duration: number;
  dtc: number;
  
  // Gantt positioning
  startOffset?: number;
  
  // Flags
  isShortage?: boolean;
  isAtRisk?: boolean;
  action_items: string;
  
  // Related data from MISys
  so_data?: {
    customer?: string;
    ship_to?: string;
    order_date?: string;
    [key: string]: any;
  };
  mo_data?: MOData;
  item_data?: ItemData;
  materials?: MODetail[];
  customer_company?: string;
}

export interface WorkCenterStats {
  name: string;
  totalOrders: number;
  completed: number;
  inProgress: number;
  scheduled: number;
  overdue: number;
  plannedQty: number;
  actualQty: number;
  efficiency: number;
}

export interface DashboardStats {
  totalOrders: number;
  completed: number;
  inProgress: number;
  scheduled: number;
  overdue: number;
  totalPlanned: number;
  totalActual: number;
  overallEfficiency: number;
}

export interface MOData {
  mo_number?: string;
  item_no?: string;
  description?: string;
  qty_to_make?: number;
  qty_made?: number;
  qty_remaining?: number;
  status?: string;
  due_date?: string;
  customer?: string;
  notes?: string;
  material_cost?: number;
  labor_cost?: number;
  overhead_cost?: number;
  [key: string]: any;
}

export interface ItemData {
  item_no?: string;
  description?: string;
  qty_on_hand?: number;
  qty_available?: number;
  qty_on_order?: number;
  qty_committed?: number;
  reorder_level?: number;
  unit?: string;
  recent_cost?: number;
  [key: string]: any;
}

export interface MODetail {
  line: number;
  component_item_no: string;
  component_description: string;
  required_qty: number;
  released_qty: number;
  completed_qty: number;
  material_cost: number;
  wip: number;
  source_location: string;
  stock_on_hand: number;
  stock_available: number;
  stock_committed: number;
  stock_on_order: number;
  unit: string;
}

