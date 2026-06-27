import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

interface RunAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  analysisName: string;
  stages?: string[];
}

const defaultStages = [
  "Loading dataset into memory",
  "Preprocessing & normalization",
  "Running analysis algorithm",
  "Generating visualizations",
  "Compiling results",
];

export function RunAnalysisDialog({
  open,
  onClose,
  analysisName,
  stages = defaultStages,
}: RunAnalysisDialogProps) {
  const [currentStage, setCurrentStage] = useState(-1);
  const [completed, setCompleted] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
    toast.success(`${analysisName} completed`, {
      description: "Results updated · 1,247 features processed",
    });
  }, [onClose, analysisName]);

  useEffect(() => {
    if (!open) {
      setCurrentStage(-1);
      setCompleted(false);
      return;
    }

    const durations = [600, 900, 1400, 800, 500];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 100;

    stages.forEach((_, idx) => {
      const t = setTimeout(() => {
        setCurrentStage(idx);
      }, elapsed);
      timeouts.push(t);
      elapsed += (durations[idx] ?? 700);
    });

    const completeT = setTimeout(() => {
      setCompleted(true);
      const closeT = setTimeout(handleClose, 1000);
      timeouts.push(closeT);
    }, elapsed + 200);
    timeouts.push(completeT);

    return () => timeouts.forEach(clearTimeout);
  }, [open, stages, handleClose]);

  const progress = completed
    ? 100
    : currentStage < 0
      ? 0
      : Math.round(((currentStage + 1) / stages.length) * 90);

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
                <Zap className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold">{analysisName}</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  {completed ? "Analysis complete" : "Analysis in progress · please wait"}
                </Dialog.Description>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {stages.map((stage, idx) => {
                const isDone = currentStage > idx || completed;
                const isActive = currentStage === idx && !completed;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-border" />
                      )}
                    </div>
                    <span
                      className={`text-xs transition-colors ${
                        isDone
                          ? "text-foreground"
                          : isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {stage}
                    </span>
                    {isDone && (
                      <span className="ml-auto text-xs text-emerald-500">done</span>
                    )}
                  </div>
                );
              })}
            </div>

            {completed && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                Analysis complete — results updated in the view below
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
