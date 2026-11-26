import { Link, NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: '首页' },
  { to: '/compare', label: '数据对比' },
  { to: '/profile', label: '关于' },
]

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="font-semibold text-blue-900">太原中考志愿填报</Link>
        <nav aria-label="主导航" className="flex flex-wrap gap-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium hover:bg-blue-50 ${isActive ? 'bg-blue-100 text-blue-900' : 'text-slate-700'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
