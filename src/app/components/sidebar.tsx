import { SidebarBrand, SidebarNav } from "./sidebar-nav";

export function Sidebar() {
  return (
    <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-border bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95 lg:flex">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  );
}
