import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  label: string;
  value: string;
  icon?: React.ElementType;
}

interface NeonSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  className?: string;
  error?: string;
}

export const NeonSelect: React.FC<NeonSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  label,
  searchable = false,
  className,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={cn("relative w-full space-y-2", className)} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
          {label}
        </label>
      )}
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative h-12 w-full glass rounded-xl border px-4 flex items-center justify-between cursor-pointer transition-all duration-300",
          isOpen ? "border-primary/50 shadow-glow-primary ring-1 ring-primary/20" : "border-border/50 hover:border-primary/30",
          error ? "border-destructive/50" : "",
          "bg-[#0B1120]/80 backdrop-blur-xl"
        )}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedOption?.icon && <selectedOption.icon size={16} className="text-primary" />}
          <span className={cn(
            "text-sm font-medium transition-colors",
            selectedOption ? "text-foreground" : "text-muted-foreground"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "circOut" }}
          className="text-muted-foreground"
        >
          <ChevronDown size={18} />
        </motion.div>
      </div>

      {error && (
        <p className="text-[10px] font-bold text-destructive uppercase tracking-widest ml-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-[100] w-full mt-2 glass rounded-2xl border border-border/50 bg-[#0B1120]/95 backdrop-blur-2xl shadow-2xl overflow-hidden max-h-[300px] flex flex-col"
          >
            {searchable && (
              <div className="p-3 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search options..."
                    className="w-full bg-muted/10 border border-border/40 rounded-lg py-2 pl-10 pr-4 text-xs text-foreground focus:outline-none focus:border-primary/40 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option.value);
                    }}
                    className={cn(
                      "group flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer",
                      value === option.value 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-muted/20 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {option.icon && (
                        <option.icon 
                          size={16} 
                          className={cn(
                            "transition-colors",
                            value === option.value ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                          )} 
                        />
                      )}
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        value === option.value ? "text-primary" : "text-foreground group-hover:text-primary"
                      )}>
                        {option.label}
                      </span>
                    </div>
                    {value === option.value && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check size={16} className="text-primary" />
                      </motion.div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground opacity-50 flex flex-col items-center gap-2">
                  <Search size={24} />
                  <p className="text-[10px] font-black uppercase tracking-widest">No results found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
