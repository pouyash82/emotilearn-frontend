import Sidebar from './Sidebar'

export default function DashboardLayout({ children, activeTab, onTabChange, unreadCount = 0, title, subtitle, headerRight }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Soft gradient orbs */}
      <div className="fixed top-20 left-60 w-72 h-72 bg-indigo-200/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-80 h-80 bg-blue-200/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 w-96 h-96 bg-violet-100/20 rounded-full blur-[140px] pointer-events-none" />

      <Sidebar activeTab={activeTab} onTabChange={onTabChange} unreadCount={unreadCount} />

      <main className="min-h-screen transition-all duration-300" style={{ marginLeft: 'var(--sidebar-width)' }}>
        {title && (
          <header className="sticky top-0 z-30 glass-sidebar px-8 py-4 border-b border-gray-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
              </div>
              {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
            </div>
          </header>
        )}
        <div className="p-8 relative z-10">{children}</div>
      </main>
    </div>
  )
}
