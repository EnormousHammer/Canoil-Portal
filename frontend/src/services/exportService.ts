import Papa from 'papaparse';
import { MPSOrder } from '../types/mps';

/**
 * Export service for creating downloadable files on the fly
 * Similar to ChatGPT's file generation - creates files directly in browser
 */

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Clean up the URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Export orders to CSV format
 */
export function exportToCSV(orders: MPSOrder[], filename?: string): void {
  if (orders.length === 0) {
    alert('No data to export');
    return;
  }

  // Flatten the data structure for CSV
  const csvData = orders.map(order => ({
    'Line Number': order.line_number,
    'SO Number': order.so_number,
    'MO Number': order.mo_number,
    'WIP': order.wip,
    'Work Center': order.work_center,
    'Status': order.status,
    'Product': order.product,
    'Customer Code': order.customer_code,
    'Customer': order.so_data?.customer || '',
    'Packaging': order.packaging,
    'Required': order.required,
    'Ready': order.ready,
    'Planned %': order.planned_pct,
    'Actual %': order.actual_pct,
    'Promised Date': order.promised_date,
    'Start Date': order.start_date,
    'End Date': order.end_date,
    'Duration': order.duration,
    'Days to Complete': order.dtc,
    'Action Items': order.action_items,
    // MO Data
    'MO Status': order.mo_data?.status || '',
    'MO Item No': order.mo_data?.item_no || '',
    'MO Qty Ordered': order.mo_data?.qty_ordered || '',
    'MO Qty Completed': order.mo_data?.qty_completed || '',
    'MO Qty Remaining': order.mo_data?.qty_remaining || '',
    'MO Start Date': order.mo_data?.start_date || '',
    'MO Due Date': order.mo_data?.due_date || '',
    // SO Data
    'SO Customer': order.so_data?.customer || '',
    'SO Order Date': order.so_data?.order_date || '',
    'SO Ship Date': order.so_data?.ship_date || '',
    'SO Status': order.so_data?.status || '',
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const defaultFilename = `production_schedule_${new Date().toISOString().split('T')[0]}.csv`;
  downloadBlob(blob, filename || defaultFilename);
}

/**
 * Export orders to JSON format
 */
export function exportToJSON(orders: MPSOrder[], filename?: string): void {
  if (orders.length === 0) {
    alert('No data to export');
    return;
  }

  const jsonData = {
    exportDate: new Date().toISOString(),
    totalOrders: orders.length,
    orders: orders
  };

  const json = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const defaultFilename = `production_schedule_${new Date().toISOString().split('T')[0]}.json`;
  downloadBlob(blob, filename || defaultFilename);
}

/**
 * Export orders to Excel-compatible CSV (tab-separated for better Excel compatibility)
 */
export function exportToExcel(orders: MPSOrder[], filename?: string): void {
  if (orders.length === 0) {
    alert('No data to export');
    return;
  }

  // Create CSV (Excel can open CSV files)
  const csvData = orders.map(order => ({
    'Line Number': order.line_number,
    'SO Number': order.so_number,
    'MO Number': order.mo_number,
    'WIP': order.wip,
    'Work Center': order.work_center,
    'Status': order.status,
    'Product': order.product,
    'Customer Code': order.customer_code,
    'Customer': order.so_data?.customer || '',
    'Packaging': order.packaging,
    'Required': order.required,
    'Ready': order.ready,
    'Planned %': order.planned_pct,
    'Actual %': order.actual_pct,
    'Promised Date': order.promised_date,
    'Start Date': order.start_date,
    'End Date': order.end_date,
    'Duration': order.duration,
    'Days to Complete': order.dtc,
    'Action Items': order.action_items,
    'MO Status': order.mo_data?.status || '',
    'MO Item No': order.mo_data?.item_no || '',
    'MO Qty Ordered': order.mo_data?.qty_ordered || '',
    'MO Qty Completed': order.mo_data?.qty_completed || '',
    'MO Qty Remaining': order.mo_data?.qty_remaining || '',
    'MO Start Date': order.mo_data?.start_date || '',
    'MO Due Date': order.mo_data?.due_date || '',
    'SO Customer': order.so_data?.customer || '',
    'SO Order Date': order.so_data?.order_date || '',
    'SO Ship Date': order.so_data?.ship_date || '',
    'SO Status': order.so_data?.status || '',
  }));

  const csv = Papa.unparse(csvData);
  // Use .xlsx extension but it's actually CSV - Excel will open it fine
  const blob = new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const defaultFilename = `production_schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, filename || defaultFilename);
}

/**
 * Export materials/BOM for a specific order to CSV
 */
export function exportMaterialsToCSV(order: MPSOrder): void {
  if (!order.materials || order.materials.length === 0) {
    alert('No material data to export');
    return;
  }

  const csvData = order.materials.map(mat => ({
    'Component Item No': mat.component_item_no,
    'Description': mat.component_description,
    'Required Qty': mat.required_qty,
    'Released Qty': mat.released_qty,
    'Completed Qty': mat.completed_qty,
    'Unit': mat.unit,
    'Stock On Hand': mat.stock_on_hand,
    'Stock Available': mat.stock_available,
    'Stock Committed': mat.stock_committed,
    'Stock On Order': mat.stock_on_order,
    'WIP': mat.wip || 0,
    'Source Location': mat.source_location,
    'Material Cost': mat.material_cost,
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `materials_${order.mo_number}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadBlob(blob, filename);
}

/**
 * Export all orders with full material details (nested structure)
 */
export function exportFullDataToJSON(orders: MPSOrder[], filename?: string): void {
  if (orders.length === 0) {
    alert('No data to export');
    return;
  }

  const jsonData = {
    exportDate: new Date().toISOString(),
    totalOrders: orders.length,
    orders: orders.map(order => ({
      ...order,
      // Include full nested data
      materials: order.materials || [],
      mo_data: order.mo_data || null,
      so_data: order.so_data || null,
      item_data: order.item_data || null,
    }))
  };

  const json = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const defaultFilename = `production_schedule_full_${new Date().toISOString().split('T')[0]}.json`;
  downloadBlob(blob, filename || defaultFilename);
}
