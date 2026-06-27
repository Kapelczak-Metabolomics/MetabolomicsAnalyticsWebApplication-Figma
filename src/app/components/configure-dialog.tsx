import * as Dialog from "@radix-ui/react-dialog";
import { X, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";

interface ConfigField {
  label: string;
  type: "select" | "number" | "checkbox" | "radio";
  value?: string | number | boolean;
  options?: string[];
  unit?: string;
  description?: string;
}

interface ConfigGroup {
  title: string;
  fields: ConfigField[];
}

interface ConfigureDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  groups: ConfigGroup[];
}

export function ConfigureDialog({ open, onClose, title, groups }: ConfigureDialogProps) {
  function handleApply() {
    onClose();
    toast.success("Configuration saved", {
      description: "Re-run analysis to apply new settings",
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">Adjust parameters for this analysis</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="overflow-auto max-h-[calc(85vh-130px)] p-5 space-y-6">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-3">
                  {group.fields.map((field) => (
                    <div key={field.label} className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-medium">{field.label}</label>
                        {field.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {field.type === "select" && (
                          <select
                            defaultValue={field.value as string}
                            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                          >
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                        {field.type === "number" && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              defaultValue={field.value as number}
                              className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-right outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                            />
                            {field.unit && (
                              <span className="text-xs text-muted-foreground">{field.unit}</span>
                            )}
                          </div>
                        )}
                        {field.type === "checkbox" && (
                          <div className="relative flex h-5 w-9 cursor-pointer items-center rounded-full bg-muted transition-colors has-[:checked]:bg-primary">
                            <input
                              type="checkbox"
                              defaultChecked={field.value as boolean}
                              className="peer sr-only"
                            />
                            <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button
              onClick={() => toast.info("Settings reset to defaults")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset defaults
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3.5 w-3.5" />
                Apply
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
