'use client';

import React from 'react';

export type StepStatus = 'completed' | 'current' | 'pending' | 'locked';

export interface Step {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  isLoading?: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
  onStepClick: (stepId: string) => void;
}

export default function StepIndicator({ steps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const isClickable = step.status === 'completed' || step.status === 'current';
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative">
            {/* Connecting line */}
            {!isLast && (
              <div
                className={`absolute left-[15px] top-[32px] w-0.5 h-6 transition-colors duration-300 ${
                  step.status === 'completed' ? 'bg-green-500' : 'bg-neutral-700'
                }`}
              />
            )}

            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={`w-full flex items-start gap-3 p-2 rounded-lg transition-all duration-200 text-left group ${
                step.status === 'current'
                  ? 'bg-neutral-800 border border-neutral-600'
                  : step.status === 'completed'
                  ? 'hover:bg-neutral-800/50 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {/* Step number/icon */}
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'current'
                    ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white'
                    : 'bg-neutral-700 text-neutral-400'
                }`}
              >
                {step.isLoading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : step.status === 'completed' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === 'locked' ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Step text */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium transition-colors ${
                    step.status === 'current'
                      ? 'text-white'
                      : step.status === 'completed'
                      ? 'text-neutral-300 group-hover:text-white'
                      : 'text-neutral-500'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-neutral-500 truncate">{step.description}</div>
              </div>

              {/* Arrow indicator for completed steps */}
              {step.status === 'completed' && (
                <svg
                  className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
