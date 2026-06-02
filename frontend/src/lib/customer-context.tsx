import { createContext, useContext, useState, type ReactNode } from 'react';

type Customer = {
  id: string;
  name: string;
  segment: string;
  segmentCode: string;  // SEG01~SEG04: 백엔드 Genie 프롬프트에 사용
};

const CUSTOMERS: Customer[] = [
  { id: 'CUST0010', name: '송민준', segment: '초보 감성', segmentCode: 'SEG01' },
  { id: 'CUST0006', name: '오주원', segment: '초보 단순', segmentCode: 'SEG02' },
  { id: 'CUST0084', name: '서정우', segment: '고수 감성', segmentCode: 'SEG03' },
  { id: 'CUST0002', name: '서예준', segment: '고수 단순', segmentCode: 'SEG04' },
];

type CustomerContextType = {
  customer: Customer;
  customers: Customer[];
  setCustomerId: (id: string) => void;
};

const CustomerContext = createContext<CustomerContextType | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerId] = useState('CUST0010');
  const customer = CUSTOMERS.find((c) => c.id === customerId) ?? CUSTOMERS[0];

  return (
    <CustomerContext.Provider value={{ customer, customers: CUSTOMERS, setCustomerId }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be inside CustomerProvider');
  return ctx;
}
