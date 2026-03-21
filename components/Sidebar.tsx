'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  badge?: number;
}

interface Badges {
  payeesWithNoRule: number;
  conflictingRules: number;
  unresolvedDuplicates: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ payeesWithNoRule: 0, conflictingRules: 0, unresolvedDuplicates: 0 });

  // Re-fetch badge counts on every navigation
  useEffect(() => {
    fetch('/api/badges')
      .then((r) => r.json())
      .then((d: Badges) => setBadges(d))
      .catch(() => null);
  }, [pathname]);

  const navItems: NavItem[] = [
    { label: 'Import',        href: '/import' },
    { label: 'Transactions',  href: '/transactions' },
    { label: 'Payee Summary', href: '/payees',     badge: badges.payeesWithNoRule },
    { label: 'Rules',         href: '/rules',      badge: badges.conflictingRules },
    { label: 'Ignored',       href: '/ignored' },
    { label: 'Duplicates',    href: '/duplicates', badge: badges.unresolvedDuplicates },
    { label: 'Reports',       href: '/reports' },
  ];

  return (
    <nav className="w-52 shrink-0 border-r border-gray-200 min-h-screen bg-gray-50 px-3 py-6">
      <div className="mb-6 px-2">
        <h1 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Finance App</h1>
      </div>
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive ? 'bg-blue-400 text-white' : 'bg-red-100 text-red-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
