import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/db";
import type { Filters } from "@/lib/filters";

export function FilterBar({ f, set, showStatus = true }: { f: Filters; set: (f: Filters) => void; showStatus?: boolean }) {
  const u = (k: keyof Filters) => (v: string) => set({ ...f, [k]: v });
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Input aria-label="Search" placeholder="Search vendor, number, date…" value={f.q} onChange={(e) => u("q")(e.target.value)} className="lg:col-span-2" />
      <Input aria-label="From date" type="date" value={f.from} onChange={(e) => u("from")(e.target.value)} />
      <Input aria-label="To date" type="date" value={f.to} onChange={(e) => u("to")(e.target.value)} />
      <Input aria-label="Min amount" type="number" placeholder="Min amount" value={f.min} onChange={(e) => u("min")(e.target.value)} />
      <Input aria-label="Max amount" type="number" placeholder="Max amount" value={f.max} onChange={(e) => u("max")(e.target.value)} />
      <Select value={f.category} onValueChange={u("category")}>
        <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={f.payment} onValueChange={u("payment")}>
        <SelectTrigger aria-label="Payment status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any payment status</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="unpaid">Unpaid</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>
      {showStatus && (
        <Select value={f.status} onValueChange={u("status")}>
          <SelectTrigger aria-label="Record status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any record status</SelectItem>
            <SelectItem value="saved">Saved</SelectItem>
            <SelectItem value="review">Needs review</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
