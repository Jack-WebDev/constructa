import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import { Textarea } from "@constructa/ui/components/textarea";
import { useState } from "react";

import {
  type BuilderDocumentDraft,
  getBuilderDocumentIdentity,
  updateBuilderDocumentIdentity,
} from "./state";

export function BuilderIdentityEditor({
  draft,
  onDraftChange,
}: {
  readonly draft: BuilderDocumentDraft;
  readonly onDraftChange: (draft: BuilderDocumentDraft) => void;
}) {
  const identity = getBuilderDocumentIdentity(draft);
  const [announcement, setAnnouncement] = useState("");
  const [changedProperty, setChangedProperty] = useState<
    "name" | "description" | undefined
  >();

  function updateIdentity(property: "name" | "description", value: string) {
    const result = updateBuilderDocumentIdentity(draft, { [property]: value });
    if (result.success) {
      onDraftChange(result.draft);
      setChangedProperty(property);
    }
  }

  function announceUpdate(property: "name" | "description") {
    if (changedProperty !== property) return;
    setAnnouncement(
      property === "name"
        ? "Document name updated."
        : "Document description updated.",
    );
    setChangedProperty(undefined);
  }

  return (
    <section aria-labelledby="builder-identity-title" className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium text-lg" id="builder-identity-title">
          Generator details
        </h2>
        <p className="text-muted-foreground text-sm">
          These details describe the document, not its nested generators.
        </p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="builder-document-name">Name</Label>
          <Input
            id="builder-document-name"
            onBlur={() => announceUpdate("name")}
            onChange={(event) => updateIdentity("name", event.target.value)}
            placeholder="Employee"
            type="text"
            value={asTextDraft(identity.name)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="builder-document-description">Description</Label>
          <Textarea
            id="builder-document-description"
            onBlur={() => announceUpdate("description")}
            onChange={(event) =>
              updateIdentity("description", event.target.value)
            }
            placeholder="Generates test employees."
            value={asTextDraft(identity.description)}
          />
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

function asTextDraft(value: unknown): string {
  return typeof value === "string" ? value : "";
}
