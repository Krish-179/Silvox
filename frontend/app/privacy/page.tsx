import { ShieldCheck } from "lucide-react";
import { LegalLayout } from "@/components/LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout
      icon={ShieldCheck}
      title="Privacy Policy"
      lastUpdated="placeholder"
      crossLinkHref="/terms"
      crossLinkLabel="Read our Terms of Service"
      sections={[
        {
          id: "what-we-collect",
          title: "What we collect",
          content: (
            <p>
              Your account email, a hashed version of your password (never
              stored in plain text), and metadata about requests proxied through
              Silvox — model used, token counts, cost, and timestamps. We do
              not store the content of your prompts or your provider's
              responses.
            </p>
          ),
        },
        {
          id: "how-its-used",
          title: "How it's used",
          content: (
            <p>
              Solely to run the product: authenticating you, calculating cost,
              enforcing budget rules you've configured, and sending alerts (e.g.
              via Slack) you've explicitly set up.
            </p>
          ),
        },
        {
          id: "third-parties",
          title: "Third parties",
          content: (
            <p>
              We use Resend to send account-related emails (verification codes,
              password resets) and, if you connect it, Slack to deliver budget
              alerts you've configured. We don't sell or share your data with
              advertisers.
            </p>
          ),
        },
        {
          id: "data-retention",
          title: "Data retention",
          content: (
            <p>
              Request logs are retained according to your plan's retention
              window. You can delete a project at any time, which removes its
              budget rules; request history is retained for billing/audit
              purposes.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          content: (
            <p>
              Questions about this policy can be directed to the contact
              information on our site once billing and support channels are
              live.
            </p>
          ),
        },
      ]}
    />
  );
}
