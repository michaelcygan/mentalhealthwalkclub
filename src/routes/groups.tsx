import { createFileRoute, Outlet, useNavigate, useMatches } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GroupsTab } from "@/components/groups-tab";

export const Route = createFileRoute("/groups")({
  component: GroupsLayout,
  head: () => ({ meta: [{ title: "Groups — Mental Health Walk Club" }] }),
});

function GroupsLayout() {
  const navigate = useNavigate();
  const matches = useMatches();
  const open = matches.some((m) => m.routeId === "/groups/$slug");

  return (
    <>
      <GroupsTab />
      <Sheet open={open} onOpenChange={(o) => { if (!o) navigate({ to: "/groups" as never }); }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="sr-only">
            <SheetTitle><VisuallyHidden>Group detail</VisuallyHidden></SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-10 pt-5 md:px-6">
            <Outlet />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
