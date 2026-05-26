import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useCustomer } from "@/lib/customer-context";

export function CustomerSelector() {
  const { customer, customers, setCustomerId } = useCustomer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger Button - Pill style */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full bg-white/80 border border-border/50 pl-3 pr-2 py-1.5 shadow-sm hover:shadow transition-shadow"
      >
        <span className="text-[12px] font-semibold text-foreground leading-none">
          {customer.name}
        </span>
        <span className="text-[10px] text-muted-foreground leading-none">
          {customer.segment}
        </span>
        <ChevronDown className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white border border-border/40 shadow-lg shadow-black/5 py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCustomerId(c.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                c.id === customer.id
                  ? "bg-[#606CF2]/8 text-[#606CF2]"
                  : "hover:bg-muted/50 text-foreground"
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-[12px] font-medium leading-tight ${
                  c.id === customer.id ? "text-[#606CF2]" : ""
                }`}>
                  {c.name}
                </span>
                <span className={`text-[10px] leading-tight ${
                  c.id === customer.id ? "text-[#606CF2]/70" : "text-muted-foreground"
                }`}>
                  {c.segment}
                </span>
              </div>
              {c.id === customer.id && (
                <span className="ml-auto text-[#606CF2] text-[10px]">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
