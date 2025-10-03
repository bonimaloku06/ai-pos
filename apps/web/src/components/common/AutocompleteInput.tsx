import { useState, useEffect, useRef, KeyboardEvent } from "react";

interface AutocompleteOption {
  id: string;
  label: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption | null) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  loading?: boolean;
  allowCreate?: boolean;
  createLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  options,
  placeholder = "Type to search...",
  loading = false,
  allowCreate = true,
  createLabel = "Create new",
  className = "",
  disabled = false,
}: AutocompleteInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [options]);

  // Show dropdown only when input is focused and there are options
  useEffect(() => {
    if (hasFocus) {
      setShowDropdown(options.length > 0 || (allowCreate && value.trim().length > 0));
    } else {
      setShowDropdown(false);
    }
  }, [options, value, allowCreate, hasFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    const totalOptions = options.length + (allowCreate && value.trim() ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % totalOptions);
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
        break;

      case "Tab":
        e.preventDefault();
        // Select first option on Tab
        if (options.length > 0) {
          onSelect(options[0]);
          setShowDropdown(false);
        } else if (allowCreate && value.trim()) {
          onSelect(null); // Signal to create new
          setShowDropdown(false);
        }
        break;

      case "Enter":
        e.preventDefault();
        // Select highlighted option
        if (highlightedIndex < options.length) {
          onSelect(options[highlightedIndex]);
        } else if (allowCreate && value.trim()) {
          onSelect(null); // Signal to create new
        }
        setShowDropdown(false);
        break;

      case "Escape":
        setShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleOptionClick = (option: AutocompleteOption) => {
    onSelect(option);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleCreateClick = () => {
    onSelect(null);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (dropdownRef.current) {
      const highlighted = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlighted?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedIndex]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setHasFocus(true)}
        onBlur={() => {
          // Delay to allow click events on dropdown
          setTimeout(() => setHasFocus(false), 200);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              data-index={index}
              onClick={() => handleOptionClick(option)}
              className={`w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors ${
                highlightedIndex === index ? "bg-blue-100" : ""
              }`}
            >
              {option.label}
            </button>
          ))}

          {allowCreate && value.trim() && (
            <button
              type="button"
              data-index={options.length}
              onClick={handleCreateClick}
              className={`w-full text-left px-3 py-2 border-t border-gray-200 text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors ${
                highlightedIndex === options.length ? "bg-blue-100" : ""
              }`}
            >
              <span className="font-medium">{createLabel}:</span> "{value}"
            </button>
          )}

          {!loading && options.length === 0 && !allowCreate && (
            <div className="px-3 py-2 text-gray-500 text-sm">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
