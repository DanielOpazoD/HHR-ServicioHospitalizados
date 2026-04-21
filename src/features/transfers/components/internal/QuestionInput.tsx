/**
 * Question Input Component
 * Renders different input types based on TransferQuestion configuration.
 * Supports: boolean, select, multiselect, textarea, time, phone, text
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import { TransferQuestion, QuestionResponse } from '@/types/transferDocuments';
import clsx from 'clsx';

export interface QuestionInputProps {
  question: TransferQuestion;
  value: QuestionResponse['value'];
  onChange: (value: QuestionResponse['value']) => void;
  density?: 'default' | 'compact';
}

const getBaseInputClass = (density: 'default' | 'compact') =>
  clsx(
    'w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
    density === 'compact' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  );

const getLabelClass = (density: 'default' | 'compact') =>
  clsx(
    'block font-semibold text-slate-600',
    density === 'compact' ? 'text-[11px] leading-snug' : 'text-xs'
  );

// ============================================================================
// Boolean Input
// ============================================================================
const BooleanInput: React.FC<QuestionInputProps> = ({
  question,
  value,
  onChange,
  density = 'default',
}) => (
  <div className="space-y-1.5">
    <label className={getLabelClass(density)}>
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={clsx(
          'flex-1 rounded-lg border font-bold transition-all',
          density === 'compact' ? 'py-1 text-[11px]' : 'py-1.5 text-xs',
          value === true
            ? 'border-green-500 bg-green-50 text-green-700'
            : 'border-slate-200 text-slate-500 hover:border-green-300'
        )}
      >
        <div className="flex items-center justify-center gap-1.5">
          {value === true && <Check size={14} />}
          Sí
        </div>
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={clsx(
          'flex-1 rounded-lg border font-bold transition-all',
          density === 'compact' ? 'py-1 text-[11px]' : 'py-1.5 text-xs',
          value === false
            ? 'border-red-500 bg-red-50 text-red-700'
            : 'border-slate-200 text-slate-500 hover:border-red-300'
        )}
      >
        <div className="flex items-center justify-center gap-1.5">
          {value === false && <X size={14} />}
          No
        </div>
      </button>
    </div>
    {question.helpText && <p className="text-[10px] text-slate-400">{question.helpText}</p>}
  </div>
);

// ============================================================================
// Select Input
// ============================================================================
const SelectInput: React.FC<QuestionInputProps & { options: string[] }> = ({
  question,
  value,
  onChange,
  options,
  density = 'default',
}) => (
  <div className="space-y-2">
    <label className={getLabelClass(density)}>
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <select
      value={(value as string) || ''}
      onChange={e => onChange(e.target.value)}
      className={getBaseInputClass(density)}
    >
      <option value="">Seleccione...</option>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

// ============================================================================
// Multiselect Input
// ============================================================================
const MultiselectInput: React.FC<QuestionInputProps & { options: string[] }> = ({
  question,
  value,
  onChange,
  options,
  density = 'default',
}) => {
  const selectedValues = (value as string[]) || [];

  return (
    <div className="space-y-1.5">
      <label className={getLabelClass(density)}>
        {question.label}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isSelected = selectedValues.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (isSelected) {
                  onChange(selectedValues.filter(v => v !== opt));
                } else {
                  onChange([...selectedValues, opt]);
                }
              }}
              className={clsx(
                'rounded-full font-bold transition-all border',
                density === 'compact' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 text-slate-400 hover:border-blue-200 hover:text-slate-600'
              )}
            >
              {isSelected && <Check size={10} className="inline mr-1" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Textarea Input
// ============================================================================
const TextareaInput: React.FC<QuestionInputProps> = ({
  question,
  value,
  onChange,
  density = 'default',
}) => (
  <div className="space-y-2">
    <label className={getLabelClass(density)}>
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <textarea
      value={(value as string) || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={question.placeholder}
      rows={density === 'compact' ? 2 : 3}
      className={clsx(getBaseInputClass(density), 'resize-none')}
    />
  </div>
);

// ============================================================================
// Time Input
// ============================================================================
const TimeInput: React.FC<QuestionInputProps> = ({
  question,
  value,
  onChange,
  density = 'default',
}) => (
  <div className="space-y-2">
    <label className={getLabelClass(density)}>
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type="time"
      value={(value as string) || ''}
      onChange={e => onChange(e.target.value)}
      className={getBaseInputClass(density)}
    />
  </div>
);

// ============================================================================
// Phone Input
// ============================================================================
const PhoneInput: React.FC<QuestionInputProps> = ({
  question,
  value,
  onChange,
  density = 'default',
}) => (
  <div className="space-y-2">
    <label className={getLabelClass(density)}>
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type="tel"
      value={(value as string) || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={question.placeholder || '+56 9 ...'}
      className={getBaseInputClass(density)}
    />
  </div>
);

// ============================================================================
// Text Input (Default)
// ============================================================================
const TextInput: React.FC<QuestionInputProps> = ({
  question,
  value,
  onChange,
  density = 'default',
}) => (
  <div className="space-y-1.5">
    <label className={getLabelClass(density)}>
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type="text"
      value={(value as string) || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={question.placeholder}
      className={getBaseInputClass(density)}
    />
    {question.helpText && <p className="text-[10px] text-slate-400">{question.helpText}</p>}
  </div>
);

// ============================================================================
// Main QuestionInput Component
// ============================================================================
export const QuestionInput: React.FC<QuestionInputProps> = ({
  question,
  value,
  onChange,
  density = 'default',
}) => {
  const options = question.options || [];

  switch (question.type) {
    case 'boolean':
      return (
        <BooleanInput question={question} value={value} onChange={onChange} density={density} />
      );
    case 'select':
      return (
        <SelectInput
          question={question}
          value={value}
          onChange={onChange}
          options={options}
          density={density}
        />
      );
    case 'multiselect':
      return (
        <MultiselectInput
          question={question}
          value={value}
          onChange={onChange}
          options={options}
          density={density}
        />
      );
    case 'textarea':
      return (
        <TextareaInput question={question} value={value} onChange={onChange} density={density} />
      );
    case 'time':
      return <TimeInput question={question} value={value} onChange={onChange} density={density} />;
    case 'phone':
      return <PhoneInput question={question} value={value} onChange={onChange} density={density} />;
    case 'text':
    default:
      return <TextInput question={question} value={value} onChange={onChange} density={density} />;
  }
};

export default QuestionInput;
