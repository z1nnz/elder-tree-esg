import Link from "next/link";
import { ArrowUpRight, Sprout } from "lucide-react";
import { contactHref, navItems } from "./public-data";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="同行成林首頁">
          <span>
            <Sprout size={21} />
          </span>
          同行成林
        </Link>
        <nav aria-label="主要導覽">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <a className="header-cta" href={contactHref("同行成林合作與陪伴計畫")}>
          合作洽詢 <ArrowUpRight size={16} />
        </a>
      </header>
      {children}
      <footer>
        <Link className="brand" href="/">
          <span>
            <Sprout size={18} />
          </span>
          同行成林
        </Link>
        <p>城市探索、陪伴與永續行動平台</p>
        <small>
          Three.js visual direction inspired by the Apache-2.0 licensed
          knight-L/sc-datav project; implementation is rewritten for this
          Next.js public web experience. Interaction patterns are inspired by
          React Bits and rewritten in-project.
        </small>
      </footer>
    </>
  );
}
