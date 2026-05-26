import { useCustomer } from "@/lib/customer-context";

export function CustomerSelector() {
  const { customer, customers, setCustomerId } = useCustomer();

  return (
    <select
      value={customer.id}
      onChange={(e) => setCustomerId(e.target.value)}
      className="text-[12px] font-medium bg-white border border-border/60 rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-[#606CF2]"
    >
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.segment})
        </option>
      ))}
    </select>
  );
}
