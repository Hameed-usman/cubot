export function Footer() {
  return (
    <footer className="py-6 px-4 border-t border-slate-200 bg-white">
      <div className="max-w-4xl mx-auto text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} City University Peshawar. All rights reserved.</p>
        <p className="mt-1">Powered by Cubot AI</p>
      </div>
    </footer>
  )
}