import {
  createFactoringCompany,
  updateFactoringCompany
} from "@/lib/accounting-actions";

export type FactoringCompanyRow = {
  id: string;
  name: string;
  nameOnCheck: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  status: string;
  carrierCount: number;
};

export function FactoringCompaniesAdmin({ companies }: { companies: FactoringCompanyRow[] }) {
  return (
    <section className="card mt-6">
      <h2 className="section-title">Factoring Companies</h2>
      <p className="muted">
        Assign a factoring company on a carrier so AP bills and QuickBooks vendors use the factor as payee
        and print the check name you set here.
      </p>

      <form action={createFactoringCompany} className="mt-4 grid gap-3 rounded-2xl border border-border p-4">
        <p className="text-sm font-semibold text-foreground">Add Factoring Company</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="name" className="input" placeholder="Company name" required />
          <input name="nameOnCheck" className="input" placeholder="Name to print on check" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="phone" className="input" placeholder="Phone" />
          <input name="email" className="input" placeholder="Email" type="email" />
        </div>
        <input name="address" className="input" placeholder="Remittance address" />
        <div className="grid gap-3 md:grid-cols-3">
          <input name="city" className="input" placeholder="City" />
          <input name="state" className="input" placeholder="State" maxLength={2} />
          <input name="postalCode" className="input" placeholder="Zip" />
        </div>
        <button type="submit" className="btn w-fit">
          Add Factoring Company
        </button>
      </form>

      <div className="mt-4 grid gap-4">
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No factoring companies yet.</p>
        ) : (
          companies.map((company) => (
            <form
              key={company.id}
              action={updateFactoringCompany}
              className="grid gap-3 rounded-2xl border border-border p-4"
            >
              <input type="hidden" name="factoringCompanyId" value={company.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{company.name}</p>
                <p className="text-xs text-muted-foreground">{company.carrierCount} carrier(s)</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="name" className="input" defaultValue={company.name} required />
                <input
                  name="nameOnCheck"
                  className="input"
                  defaultValue={company.nameOnCheck}
                  placeholder="Name to print on check"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="phone" className="input" defaultValue={company.phone ?? ""} placeholder="Phone" />
                <input
                  name="email"
                  className="input"
                  type="email"
                  defaultValue={company.email ?? ""}
                  placeholder="Email"
                />
              </div>
              <input
                name="address"
                className="input"
                defaultValue={company.address ?? ""}
                placeholder="Remittance address"
              />
              <div className="grid gap-3 md:grid-cols-4">
                <input name="city" className="input" defaultValue={company.city ?? ""} placeholder="City" />
                <input
                  name="state"
                  className="input"
                  defaultValue={company.state ?? ""}
                  placeholder="State"
                  maxLength={2}
                />
                <input
                  name="postalCode"
                  className="input"
                  defaultValue={company.postalCode ?? ""}
                  placeholder="Zip"
                />
                <select name="status" className="select" defaultValue={company.status}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <button type="submit" className="btn-secondary w-fit">
                Save Factor
              </button>
            </form>
          ))
        )}
      </div>
    </section>
  );
}
