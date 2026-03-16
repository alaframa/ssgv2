// app/(dashboard)/customers/page.tsx

export default function CustomersPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pelanggan</h1>
      </div>
      <div className="card">
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="empty-state-title">Pelanggan — Sprint 2</p>
          <p className="empty-state-desc">Halaman ini akan diimplementasikan pada Sprint 2.</p>
        </div>
      </div>
    </div>
  );
}