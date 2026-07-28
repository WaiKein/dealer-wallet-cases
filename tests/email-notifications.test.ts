import { describe, expect, it } from "vitest";
import {
  escapeTemplateValue,
  previewNotificationTemplate,
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/notifications/templates";
import { defaultEmailEventType } from "@/lib/notifications/channels/types";

describe("email templates", () => {
  it("escapes user-controlled values", () => {
    expect(escapeTemplateValue(`<script>alert("x")</script>`)).toContain(
      "&lt;script&gt;"
    );
  });

  it("renders and validates declared variables", () => {
    const rendered = renderTemplate("Hello {{name}}", {
      name: "Alex <ops>",
    });
    expect(rendered).toBe("Hello Alex &lt;ops&gt;");

    expect(
      validateTemplateVariables({
        declared: ["case_number", "title"],
        provided: { case_number: "C-1", title: "T" },
      }).ok
    ).toBe(true);

    expect(
      validateTemplateVariables({
        declared: ["case_number", "title"],
        provided: { case_number: "C-1" },
      }).missing
    ).toEqual(["title"]);
  });

  it("previews templates", () => {
    const preview = previewNotificationTemplate({
      subjectTemplate: "Case {{case_number}}",
      bodyTemplate: "{{title}}",
      variables: { case_number: "C-9", title: "Adj" },
      declaredVariables: ["case_number", "title"],
    });
    expect(preview.ok).toBe(true);
    expect(preview.subject).toBe("Case C-9");
  });

  it("maps notification types to email events", () => {
    expect(defaultEmailEventType("case_assignment")).toBe("case_assigned");
    expect(defaultEmailEventType("approval_request")).toBe(
      "approval_requested"
    );
    expect(defaultEmailEventType("integration_execution", "execution_failed")).toBe(
      "execution_failed"
    );
  });
});
