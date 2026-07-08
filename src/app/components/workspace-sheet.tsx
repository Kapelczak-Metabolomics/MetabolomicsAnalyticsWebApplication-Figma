import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { useLayout } from "../../contexts/layout-context";
import { useApp } from "../../contexts/app-context";
import { ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";

/** Phone-only workspace picker (< 640px) */
export function WorkspaceSheet() {
  const { workspaceOpen, setWorkspaceOpen } = useLayout();
  const {
    projects, datasets, selectedProjectId, selectedDatasetId, selectedLens, groupLenses,
    setSelectedProjectId, setSelectedDatasetId, setSelectedLens,
  } = useApp();

  const projectDatasets = datasets.filter((d) => d.project_id === selectedProjectId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div className="sm:hidden">
      <Sheet open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Workspace</SheetTitle>
            <SheetDescription>Choose project, dataset, and analysis lens</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 overflow-auto px-1 pb-4">
            <WorkspaceSelect
              label="Project"
              value={selectedProject?.name ?? ""}
              options={projects.map((p) => p.name)}
              onChange={(name) => {
                const p = projects.find((x) => x.name === name);
                if (p) {
                  setSelectedProjectId(p.id);
                  const ds = datasets.find((d) => d.project_id === p.id);
                  if (ds) setSelectedDatasetId(ds.id);
                }
              }}
            />
            <WorkspaceSelect
              label="Dataset"
              value={selectedDataset ? `${selectedDataset.name} (n=${selectedDataset.samples_count})` : ""}
              options={(projectDatasets.length ? projectDatasets : datasets).map((d) => `${d.name} (n=${d.samples_count})`)}
              onChange={(label) => {
                const ds = (projectDatasets.length ? projectDatasets : datasets).find((d) => label.startsWith(d.name));
                if (ds) setSelectedDatasetId(ds.id);
              }}
            />
            <WorkspaceSelect
              label="Lens"
              value={selectedLens}
              options={groupLenses}
              onChange={setSelectedLens}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function WorkspaceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
          <Select.Value placeholder={`Select ${label.toLowerCase()}`} />
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="z-[60] max-h-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item key={option} value={option} className="cursor-pointer rounded px-3 py-2.5 text-sm outline-none hover:bg-accent">
                  <Select.ItemText>{option}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
