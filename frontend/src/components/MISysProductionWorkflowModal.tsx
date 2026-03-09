/**
 * MISys Production Workflow Modal – Enterprise workflow diagram for MO/Production.
 * Two tabs: Work Order (Standard BOMs), Mfg. Order (Build to Order).
 * Clickable steps wire to portal actions. Nothing hidden – full diagram always visible.
 */

import React from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Cog,
  Truck,
  Plus,
  ShoppingCart,
  Cpu,
  RotateCcw,
  HelpCircle,
  ArrowRight,
  Factory,
} from 'lucide-react';

export type MoWorkflowTab = 'work-order' | 'build-to-order';

export interface MISysProductionWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: MoWorkflowTab;
  onTabChange: (tab: MoWorkflowTab) => void;
  onCreateMO: () => void;
  onProcessSalesOrders: () => void;
  onCreateFromMRP: () => void;
}

const StepNode: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  variant: 'entry' | 'process' | 'terminal' | 'print';
  tooltip?: string;
}> = ({ label, icon, onClick, variant, tooltip }) => {
  const base = 'flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 min-w-[140px] justify-center';
  const variants = {
    entry: 'bg-amber-500/20 border-2 border-amber-400/60 text-amber-900 hover:bg-amber-500/30 hover:border-amber-500',
    process: 'bg-violet-500/15 border-2 border-violet-400/40 text-violet-900 hover:bg-violet-500/25 hover:border-violet-500',
    print: 'bg-slate-100 border-2 border-slate-300 text-slate-800 hover:bg-slate-200',
    terminal: 'bg-emerald-500/20 border-2 border-emerald-400/60 text-emerald-900',
  };
  const cn = `${base} ${variants[variant]} ${onClick ? 'cursor-pointer' : 'cursor-default'}`;
  const el = (
    <div className={cn} onClick={onClick} title={tooltip}>
      {icon}
      <span>{label}</span>
      {tooltip && !onClick && (
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" title={tooltip} />
      )}
    </div>
  );
  return el;
};

const Arrow: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex items-center text-slate-400 ${className || ''}`}>
    <ArrowRight className="w-5 h-5" />
  </div>
);

export const MISysProductionWorkflowModal: React.FC<MISysProductionWorkflowModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onCreateMO,
  onProcessSalesOrders,
  onCreateFromMRP,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-modal-title"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-slate-800 via-violet-900/90 to-slate-800 text-white border-b border-violet-400/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/40 flex items-center justify-center">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <h2 id="workflow-modal-title" className="text-xl font-bold tracking-tight">
                MISys Production Workflow
              </h2>
              <p className="text-slate-300 text-sm mt-0.5">
                Click steps to take action · Hover for details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => onTabChange('work-order')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
              activeTab === 'work-order'
                ? 'bg-white text-violet-700 border-b-2 border-violet-500 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Work Order (Standard BOMs)
          </button>
          <button
            onClick={() => onTabChange('build-to-order')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
              activeTab === 'build-to-order'
                ? 'bg-white text-violet-700 border-b-2 border-violet-500 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Mfg. Order (Build to Order)
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-auto p-6 lg:p-8 bg-slate-50/80">
          {/* Quick actions - always visible, enterprise UX */}
          <div className="mb-6 p-4 rounded-xl bg-white border-2 border-violet-200 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-violet-600 mb-3">Quick actions</div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { onClose(); onCreateMO(); }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Order
              </button>
              <button
                onClick={() => { onClose(); onProcessSalesOrders(); }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                Process Sales Orders
              </button>
              <button
                onClick={() => { onClose(); onCreateFromMRP(); }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Cpu className="w-4 h-4" />
                Create from MRP
              </button>
            </div>
          </div>

          {activeTab === 'work-order' && (
            <div className="space-y-6">
              <p className="text-slate-600 text-sm font-medium">
                Standard BOM workflow: Create or source orders → Release → Print → Process → Close
              </p>
              {/* Entry points row */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
                  Entry points
                </span>
                <StepNode
                  label="Create Order"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => { onClose(); onCreateMO(); }}
                  variant="entry"
                />
                <StepNode
                  label="Process Sales Orders"
                  icon={<ShoppingCart className="w-4 h-4" />}
                  onClick={() => { onClose(); onProcessSalesOrders(); }}
                  variant="entry"
                />
                <StepNode
                  label="Create Production Orders from MRP"
                  icon={<Cpu className="w-4 h-4" />}
                  onClick={() => { onClose(); onCreateFromMRP(); }}
                  variant="entry"
                />
              </div>

              {/* Main flow */}
              <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                <StepNode
                  label="Create Order"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => { onClose(); onCreateMO(); }}
                  variant="entry"
                />
                <Arrow />
                <StepNode
                  label="Release Order"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  variant="process"
                  tooltip="Select a Planned MO in the list, then click Release in the detail view"
                />
                <Arrow />
                <StepNode
                  label="Print Order"
                  icon={<Printer className="w-4 h-4" />}
                  variant="print"
                  tooltip="Available in MISys desktop"
                />
                <Arrow />
                <StepNode
                  label="Print Pick List"
                  icon={<Printer className="w-4 h-4" />}
                  variant="print"
                  tooltip="Available in MISys desktop"
                />
                <Arrow />
                <StepNode
                  label="Process Order"
                  icon={<Cog className="w-4 h-4" />}
                  variant="process"
                  tooltip="Select an MO, then use Issue materials / Complete in the detail view"
                />
                <Arrow />
                <StepNode
                  label="Transfer To Sales"
                  icon={<Truck className="w-4 h-4" />}
                  variant="process"
                  tooltip="Coming soon – Tier 5"
                />
                <Arrow />
                <StepNode
                  label="Close Order"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  variant="terminal"
                  tooltip="Complete full quantity to close"
                />
              </div>

              {/* Branch: Process Shop Op */}
              <div className="pl-4 border-l-2 border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Alternative path from Print Pick List
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StepNode
                    label="Process Shop Op"
                    icon={<Cog className="w-4 h-4" />}
                    variant="process"
                    tooltip="Shop floor operations – MISys desktop"
                  />
                  <span className="text-slate-400 text-sm">→ merges into Process Order</span>
                </div>
              </div>

              {/* Entry points flow to Print Order */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Process Sales Orders & Create from MRP
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 text-sm">Both flow directly into</span>
                  <StepNode label="Print Order" icon={<Printer className="w-4 h-4" />} variant="print" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'build-to-order' && (
            <div className="space-y-6">
              <p className="text-slate-600 text-sm font-medium">
                Build to Order: Adds Substitute Alternates and Print Traveler steps
              </p>
              {/* Entry points */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
                  Entry points
                </span>
                <StepNode
                  label="Create Order"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => { onClose(); onCreateMO(); }}
                  variant="entry"
                />
                <StepNode
                  label="Process Sales Orders"
                  icon={<ShoppingCart className="w-4 h-4" />}
                  onClick={() => { onClose(); onProcessSalesOrders(); }}
                  variant="entry"
                />
                <StepNode
                  label="Create Production Orders from MRP"
                  icon={<Cpu className="w-4 h-4" />}
                  onClick={() => { onClose(); onCreateFromMRP(); }}
                  variant="entry"
                />
              </div>

              {/* Main flow - Build to Order */}
              <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                <StepNode
                  label="Create Order"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => { onClose(); onCreateMO(); }}
                  variant="entry"
                />
                <Arrow />
                <StepNode
                  label="Release Order"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  variant="process"
                  tooltip="Select a Planned MO, then click Release in the detail view"
                />
                <Arrow />
                <StepNode
                  label="Print Order"
                  icon={<Printer className="w-4 h-4" />}
                  variant="print"
                  tooltip="Available in MISys desktop"
                />
                <Arrow />
                <StepNode
                  label="Substitute Alternates"
                  icon={<RotateCcw className="w-4 h-4" />}
                  variant="process"
                  tooltip="BOM substitution – coming soon"
                />
                <Arrow />
              </div>

              {/* Branch: Print Pick List | Print Traveler */}
              <div className="pl-4 border-l-2 border-violet-200">
                <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">
                  From Substitute Alternates
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StepNode
                    label="Print Pick List"
                    icon={<Printer className="w-4 h-4" />}
                    variant="print"
                    tooltip="Available in MISys desktop"
                  />
                  <span className="text-slate-400">or</span>
                  <StepNode
                    label="Print Traveler"
                    icon={<Printer className="w-4 h-4" />}
                    variant="print"
                    tooltip="Available in MISys desktop"
                  />
                </div>
              </div>

              {/* Continue flow */}
              <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                <StepNode
                  label="Process Order"
                  icon={<Cog className="w-4 h-4" />}
                  variant="process"
                  tooltip="Select an MO, then use Issue materials / Complete in the detail view"
                />
                <Arrow />
                <div className="flex flex-wrap items-center gap-2">
                  <StepNode
                    label="Transfer To Sales"
                    icon={<Truck className="w-4 h-4" />}
                    variant="process"
                    tooltip="Coming soon"
                  />
                  <span className="text-slate-400 text-sm">or</span>
                  <StepNode
                    label="Process Shop Op"
                    icon={<Cog className="w-4 h-4" />}
                    variant="process"
                    tooltip="MISys desktop"
                  />
                </div>
                <Arrow />
                <StepNode label="Close Order" icon={<CheckCircle2 className="w-4 h-4" />} variant="terminal" />
              </div>

              {/* Entry points to Print Order */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Process Sales Orders & Create from MRP → Print Order
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StepNode
                    label="Process Sales Orders"
                    icon={<ShoppingCart className="w-4 h-4" />}
                    onClick={() => { onClose(); onProcessSalesOrders(); }}
                    variant="entry"
                  />
                  <span className="text-slate-400">and</span>
                  <StepNode
                    label="Create Production Orders from MRP"
                    icon={<Cpu className="w-4 h-4" />}
                    onClick={() => { onClose(); onCreateFromMRP(); }}
                    variant="entry"
                  />
                  <span className="text-slate-600 text-sm">both flow into Print Order</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
