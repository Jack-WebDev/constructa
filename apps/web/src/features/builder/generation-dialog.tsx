import { Button } from "@constructa/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@constructa/ui/components/dialog";
import { Input } from "@constructa/ui/components/input";
import { generate } from "constructa-sdk";
import { Download, Sparkles } from "lucide-react";
import { useState } from "react";

import type { BuilderDocumentDraft } from "./state";
import { toGeneratorDocument } from "./state";

/** Keeps final batch generation separate from the always-on design preview. */
export function GenerationDialog({
  draft,
}: {
  readonly draft: BuilderDocumentDraft;
}) {
  const [count, setCount] = useState("100");
  const [result, setResult] = useState<unknown[]>();
  const [error, setError] = useState<string>();
  function createData() {
    const records = Number(count);
    const conversion = toGeneratorDocument(draft);
    if (!conversion.success) {
      setError("Fix the highlighted definition issues before generating data.");
      return;
    }
    if (!Number.isSafeInteger(records) || records < 1 || records > 10_000) {
      setError("Choose a whole number between 1 and 10,000.");
      return;
    }
    try {
      setResult(
        Array.from({ length: records }, () =>
          generate(conversion.document.definition),
        ),
      );
      setError(undefined);
    } catch {
      setError(
        "Constructa could not generate this dataset. Check the field settings.",
      );
    }
  }
  function download() {
    if (result === undefined) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "constructa-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Sparkles /> Generate data
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate data</DialogTitle>
          <DialogDescription>
            Create final records from this definition. The live preview remains
            a separate one-record workspace.
          </DialogDescription>
        </DialogHeader>
        {result === undefined ? (
          <div className="grid gap-1.5">
            <label className="font-medium text-sm" htmlFor="generation-count">
              Records
            </label>
            <Input
              id="generation-count"
              inputMode="numeric"
              min="1"
              max="10000"
              onChange={(event) => setCount(event.target.value)}
              type="number"
              value={count}
            />
            <p className="text-muted-foreground text-xs">
              JSON format · up to 10,000 records
            </p>
          </div>
        ) : (
          <div className="border border-primary/25 bg-primary/5 p-3">
            <p className="font-medium text-sm">
              {result.length.toLocaleString()} records generated
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Your JSON file is ready to download.
            </p>
          </div>
        )}
        {error === undefined ? null : (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          {result === undefined ? (
            <Button onClick={createData} type="button">
              Generate
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setResult(undefined)}
                type="button"
                variant="outline"
              >
                Generate again
              </Button>
              <Button onClick={download} type="button">
                <Download /> Download JSON
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
