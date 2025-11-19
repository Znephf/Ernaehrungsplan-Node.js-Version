import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronDownIcon } from './IconComponents';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(opt => opt.value === value)?.label || options[0]?.label;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newValue: string | number) => {
    onChange(newValue);
    setIsOpen(false);
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setIsOpen(!isOpen);
      }
  }
  
  const handleOptionKeyDown = (e: KeyboardEvent<HTMLLIElement>, optionValue: string | number) => {
       if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleSelect(optionValue);
          wrapperRef.current?.querySelector('button')?.focus();
      }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="mt-1 block w-full bg-white text-slate-900 rounded-md border border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm px-3 py-2 text-left flex justify-between items-center"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul
          className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          role="listbox"
          tabIndex={-1}
        >
          {options.map(option => (
            <li
              key={option.value}
              onClick={() => handleSelect(option.value)}
              onKeyDown={(e) => handleOptionKeyDown(e, option.value)}
              className={`text-slate-900 cursor-pointer select-none relative py-2 pl-10 pr-4 hover:bg-emerald-100 hover:text-emerald-900 ${value === option.value ? 'bg-emerald-50' : ''}`}
              role="option"
              aria-selected={value === option.value}
              tabIndex={0}
            >
              <span className={`font-normal block truncate ${value === option.value ? 'font-semibold text-emerald-800' : ''}`}>
                {option.label}
              </span>
              {value === option.value && (
                <span className="text-emerald-600 absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" /></svg>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomSelect;
