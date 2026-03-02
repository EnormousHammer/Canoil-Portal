/**
 * Lightweight validation schemas for portal forms.
 * No external dependencies — uses plain TypeScript.
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

type Validator = (value: any) => string | null;

function required(label: string): Validator {
  return (v) => (v === undefined || v === null || v === '') ? `${label} is required` : null;
}

function minLength(label: string, min: number): Validator {
  return (v) => (typeof v === 'string' && v.length < min) ? `${label} must be at least ${min} characters` : null;
}

function positiveNumber(label: string): Validator {
  return (v) => {
    const n = Number(v);
    return (isNaN(n) || n <= 0) ? `${label} must be a positive number` : null;
  };
}

function nonNegative(label: string): Validator {
  return (v) => {
    const n = Number(v);
    return (isNaN(n) || n < 0) ? `${label} must be non-negative` : null;
  };
}

function email(label: string): Validator {
  return (v) => {
    if (!v) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : `${label} must be a valid email`;
  };
}

function maxLength(label: string, max: number): Validator {
  return (v) => (typeof v === 'string' && v.length > max) ? `${label} must be ${max} characters or less` : null;
}

function validate(data: Record<string, any>, rules: Record<string, Validator[]>): ValidationResult {
  const errors: Record<string, string> = {};
  for (const [field, validators] of Object.entries(rules)) {
    for (const validator of validators) {
      const err = validator(data[field]);
      if (err) { errors[field] = err; break; }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export const salesOrderSchema = (data: Record<string, any>) =>
  validate(data, {
    customer_name: [required('Customer name'), minLength('Customer name', 2)],
    order_date: [required('Order date')],
  });

export const salesOrderLineSchema = (data: Record<string, any>) =>
  validate(data, {
    item_no: [required('Item number')],
    qty: [required('Quantity'), positiveNumber('Quantity')],
    unit_price: [required('Unit price'), positiveNumber('Unit price')],
  });

export const customerSchema = (data: Record<string, any>) =>
  validate(data, {
    name: [required('Customer name'), minLength('Customer name', 2), maxLength('Customer name', 200)],
    email: [email('Email')],
  });

export const supplierSchema = (data: Record<string, any>) =>
  validate(data, {
    name: [required('Supplier name'), minLength('Supplier name', 2)],
  });

export const shipmentSchema = (data: Record<string, any>) =>
  validate(data, {
    so_no: [required('Sales order number')],
    carrier: [required('Carrier')],
  });

export const shipmentLineSchema = (data: Record<string, any>) =>
  validate(data, {
    item_no: [required('Item number')],
    qty_shipped: [required('Quantity shipped'), positiveNumber('Quantity shipped')],
  });

export const qualitySpecSchema = (data: Record<string, any>) =>
  validate(data, {
    spec_name: [required('Spec name')],
    min_value: [nonNegative('Min value')],
    max_value: [nonNegative('Max value')],
  });

export const workflowRuleSchema = (data: Record<string, any>) =>
  validate(data, {
    entity_type: [required('Entity type')],
    approver_role: [required('Approver role')],
  });

export const alertRuleSchema = (data: Record<string, any>) =>
  validate(data, {
    rule_name: [required('Rule name')],
    rule_type: [required('Rule type')],
  });
