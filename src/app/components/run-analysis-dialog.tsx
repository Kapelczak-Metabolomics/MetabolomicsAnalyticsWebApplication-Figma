import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAppOptional } from "../../contexts/app-context";

interface RunAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  analysisName: string;
  analysisType?: string;
  projectId?: number;
  datasetId?: number;
  config?: Record<string, unknown>;
  stages?: string[];
  onComplete?: () => void;
}

const defaultStages = [
  "Submitting analysis job",
  "Loading dataset from database",
  "Preprocessing & normalization",
  "Running statistical model",
  "Saving results",
];

export function RunAnalysisDialog({
  open,
  onClose,
  analysisName,
  analysisType = "PCA",
  projectId,
  datasetId,
  config: configProp,
  stages = defaultStages,
  onComplete,
}: RunAnalysisDialogProps) {
  const app = useAppOptional();
  const [currentStage, setCurrentStage] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const experimentIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrentStage(-1);
      setCompleted(false);
      setFailed(false);
      experimentIdRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      if (projectId && datasetId) {
        setCurrentStage(0);
        try {
          const mergedConfig = { ...(app?.getAnalysisConfig(analysisType) ?? {}), ...(configProp ?? {}) };
          const { id } = await api.runAnalysis({ projectId, datasetId, name: analysisName, type: analysisType, config: mergedConfig });
          experimentIdRef.current = id;
        } catch {
          toast.error("Failed to start analysis");
          setFailed(true);
          return;
        }

        for (let poll = 0; poll < 120 && !cancelled; poll++) {
          const exp = await api.getExperiment(experimentIdRef.current!);
          if (exp.status === "running") {
            setCurrentStage(Math.min(stages.length - 2, 1 + Math.floor(poll / 8)));
          }
          if (exp.status === "completed") {
            setCurrentStage(stages.length - 1);
            setCompleted(true);
            break;
          }
          if (exp.status === "failed") {
            setFailed(true);
            toast.error(String(exp.errorMessage ?? "Analysis failed"));
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        }

        if (!cancelled && !failed && !completed) {
          setFailed(true);
          toast.error("Analysis timed out");
          return;
        }
      } else {
        setCompleted(true);
      }

      if (!cancelled && !failed) {
        setTimeout(() => {
          onClose();
          onComplete?.();
          toast.success(`${analysisName} completed`, { description: "Results saved to database" });
        }, 600);
      }
    })();

    return () => { cancelled = true; };
  }, [open, projectId, datasetId, analysisName, analysisType, configProp, stages, onClose, onComplete, app]);

  const progress = failed ? 0 : completed ? 100 : currentStage < 0 ? 5 : Math.round(((currentStage + 1) / stages.length) * 100);

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
                  {failed ? "Analysis failed" : completed ? "Analysis complete" : "Running on server — polling for results"}
                </Dialog.Description>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="space-y-2.5">
              {stages.map((stage, idx) => {
                const isDone = currentStage > idx || completed;
                const isActive = currentStage === idx && !completed && !failed;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : isActive ? <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-border" />}
                    </div>
                    <span className={`text-xs transition-colors ${isDone ? "text-foreground" : isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
