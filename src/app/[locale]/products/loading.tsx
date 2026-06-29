export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-[#faf9f8] text-nh-ink">
      <div className="h-14 border-y border-nh-ink bg-white">
        <div className="site-shell flex h-full items-center justify-between">
          <div className="h-4 w-40 animate-pulse bg-[#e8e4dc]" />
          <div className="h-8 w-24 animate-pulse bg-[#e8e4dc]" />
        </div>
      </div>
      <div className="site-shell flex flex-col gap-8 pb-8 pt-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="hidden w-[212px] shrink-0 flex-col gap-4 lg:flex">
            {Array.from({ length: 10 }, (_, index) => (
              <div className="h-5 w-full animate-pulse bg-[#e8e4dc]" key={index} />
            ))}
          </aside>
          <section className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="hidden gap-4 lg:flex lg:flex-wrap">
              {Array.from({ length: 12 }, (_, index) => (
                <div className="h-7 w-[72px] animate-pulse border border-nh-border bg-white" key={index} />
              ))}
            </div>
            <div className="h-10 w-full animate-pulse border-b border-nh-border bg-white" />
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {Array.from({ length: 12 }, (_, index) => (
                <div className="flex flex-col gap-3 bg-white p-2 sm:p-4" key={index}>
                  <div className="aspect-[4/5] w-full animate-pulse bg-[#e8e4dc]" />
                  <div className="h-3 w-2/3 animate-pulse bg-[#e8e4dc]" />
                  <div className="h-3 w-1/2 animate-pulse bg-[#e8e4dc]" />
                  <div className="h-4 w-24 animate-pulse bg-[#e8e4dc]" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
