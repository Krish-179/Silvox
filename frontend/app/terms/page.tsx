import { Scale } from "lucide-react";
import Link from "next/link";
import { LegalLayout } from "@/components/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout
      icon={Scale}
      title="Terms of Service"
      lastUpdated="placeholder"
      crossLinkHref="/privacy"
      crossLinkLabel="Read our Privacy Policy"
      sections={[
        {
          id: "what-is-silvox",
          title: "What Silvox is",
          content: (
            <p>
              Silvox is a proxy that sits between your application and your
              LLM provider (currently Anthropic), tracking token usage and cost
              per request, and optionally enforcing budget rules you configure.
            </p>
          ),
        },
        {
          id: "your-account",
          title: "Your account",
          content: (
            <p>
              You're responsible for keeping your account credentials and API
              keys secure. Requests made with a key you've generated are treated
              as authorized by you.
            </p>
          ),
        },
        {
          id: "billing",
          title: "Billing",
          content: (
            <p>
              Pricing is published on our{" "}
              <Link href="/#pricing" className="text-accent hover:underline">
                pricing page
              </Link>
              . Payment processing is not yet live — accounts are not currently
              billed. This will change before general availability, and existing
              users will be notified in advance.
            </p>
          ),
        },
        {
          id: "availability",
          title: "Service availability",
          content: (
            <p>
              Silvox is under active development. We aim for reliability but
              don't currently guarantee uptime — a formal SLA will be published
              alongside our billing launch.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          content: (
            <p>
              These terms may change as the product develops. Material changes
              will be communicated before they take effect.
            </p>
          ),
        },
      ]}
    />
  );
}
