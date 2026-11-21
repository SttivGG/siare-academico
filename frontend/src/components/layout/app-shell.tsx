import type { ReactNode } from "react";
import { StudentNav } from "../student-nav";
import styles from "./shells.module.css";
export function AppShell({ children, role, user }: { children: ReactNode; role: string; user: { name: string; email: string } }) {
  return <div className={styles.appShell}><StudentNav role={role} user={user} /><div className={styles.appBody}><main id="contenido" tabIndex={-1} className="student-main">{children}</main><footer className={styles.appFooter}>SIARE Académico · Un espacio para aprender</footer></div></div>;
}
