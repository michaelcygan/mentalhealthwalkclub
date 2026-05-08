import { createFileRoute, Outlet, useNavigate, useMatches } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GroupsTab } from "./groups.index";

export const Route = createFileRoute("/groups")({ component: GroupsLayout });

function GroupsLayout() {
  const navigate = useNavigate();
  const matches = useMatches();
  const detailMatch = matches.find((m) => m.routeId === "/groups/$slug");
  const open = !!detailMatch;

  return (
    <>
      {/* Always show the list underneath; suppress Outlet's own index render */}
      <GroupsTab />
      <div className="hidden">
        <Outlet />
      </div>
      <Sheet open={open} onOpenChange={(o) => { if (!o) navigate({ to: "/groups" as never }); }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="sr-only">
            <SheetTitle><VisuallyHidden>Group detail</VisuallyHidden></SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  );
}
