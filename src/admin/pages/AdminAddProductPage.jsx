import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, PackagePlus } from 'lucide-react'
import { AddProductPanel } from '../components/AddProductPanel.jsx'

const canvasClass =
  '-mx-4 min-w-0 rounded-none bg-[#eaeded] px-4 py-5 dark:bg-ink/40 md:-mx-6 md:rounded-xl md:px-6 lg:-mx-0 lg:rounded-xl lg:px-8'

export function AdminAddProductPage() {
  const navigate = useNavigate()

  function handleSuccess(product) {
    navigate('/admin/products', {
      replace: true,
      state: {
        success: true,
        productId: product?.id ?? null,
      },
    })
  }

  return (
    <div className={canvasClass}>
      <div className="mx-auto max-w-[56rem] space-y-5">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-2 rounded-xl border border-steel/70 bg-white px-4 py-2 text-sm font-medium text-mist shadow-sm transition-colors hover:border-accent/50 hover:text-accent dark:bg-slate"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inventory
        </Link>

        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-[#0f1111] dark:text-fog md:text-3xl">
            Add inventory
          </h1>
          <p className="mt-1 text-sm text-[#565959] dark:text-mist">
            Create a new catalog part with pricing, stock, and vehicle fitment
          </p>
        </div>

        <section className="admin-card rounded-2xl p-6 shadow-sm sm:p-8">
          <div className="mb-6 border-b border-steel/40 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent ring-1 ring-accent/30">
                <PackagePlus className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold uppercase tracking-tight text-fog">
                  Inventory details
                </h2>
                <p className="text-xs text-mist">Required fields must be completed before saving</p>
              </div>
            </div>
          </div>

          <AddProductPanel variant="page" onSuccess={handleSuccess} />
        </section>
      </div>
    </div>
  )
}
