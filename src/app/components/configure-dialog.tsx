import { useEffect, useState } from "react";
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
  key?: string;
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
  analysisType?: string;
  onSave?: (config: Record<string, unknown>) => void | Promise<void>;
}

export function ConfigureDialog({ open, onClose, title, groups, onSave }: ConfigureDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, unknown> = {};
      groups.forEach((g) => g.fields.forEach((f) => {
        const key = f.key ?? f.label;
        initial[key] = f.value ?? (f.type === "checkbox" ? false : f.type === "number" ? 0 : "");
      }));
      setValues(initial);
    }
  }, [open, groups]);

  async function handleApply() {
    try {
      await onSave?.(values);
      onClose();
      toast.success("Configuration saved", { description: "Settings will apply on next analysis run" });
    } catch {
      toast.error("Failed to save configuration");
    }
  }

  function handleReset() {
    const initial: Record<string, unknown> = {};
    groups.forEach((g) => g.fields.forEach((f) => {
      const key = f.key ?? f.label;
      initial[key] = f.value ?? (f.type === "checkbox" ? false : f.type === "number" ? 0 : "");
    }));
    setValues(initial);
    toast.info("Settings reset to defaults");
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
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="overflow-auto max-h-[calc(85vh-130px)] p-5 space-y-6">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.title}</h3>
                <div className="space-y-3">
                  {group.fields.map((field) => {
                    const key = field.key ?? field.label;
                    return (
                      <div key={field.label} className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-medium">{field.label}</label>
                          {field.description && <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>}
                        </div>
                        <div className="flex-shrink-0">
                          {field.type === "select" && (
                            <select
                              value={String(values[key] ?? field.value ?? "")}
                              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none"
                            >
                              {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          )}
                          {field.type === "number" && (
                            <input
                              type="number"
                              value={Number(values[key] ?? field.value ?? 0)}
                              onChange={(e) => setValues((v) => ({ ...v, [key]: parseFloat(e.target.value) }))}
                              className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-right outline-none"
                            />
                          )}
                          {field.type === "checkbox" && (
                            <input
                              type="checkbox"
                              checked={!!values[key]}
                              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
                              className="h-4 w-4"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
              <button onClick={handleApply} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                <Check className="h-3.5 w-3.5" /> Apply
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
