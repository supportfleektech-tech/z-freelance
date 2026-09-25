import Link from "next/link";
import { PageHeader, Card, CardHeader, StatusBadge, Badge } from "@/components/ui";

export const metadata = { title: "How it works" };
export const dynamic = "force-static";

export default function DocsPage() {
  return (
    <main className="container-page max-w-4xl py-12">
      <PageHeader
        eyebrow="Documentation"
        title="How z-freelance works"
        description="The complete workflow: from posting a project to money landing in a freelancer's account — with escrow holding the middle."
      />

      <div className="space-y-8">
        <Card>
          <CardHeader title="1 · Post or propose" />
          <p className="text-sm leading-7 text-ink-700">
            Clients post a project with a budget range, skills and deadline. Freelancers see it in
            the marketplace and submit proposals: a cover letter, a total bid, and an estimated
            delivery time. One proposal per freelancer per project, so every bid is considered.
          </p>
        </Card>

        <Card>
          <CardHeader title="2 · Shortlist, message, hire" />
          <p className="text-sm leading-7 text-ink-700">
            The client reviews proposals with the freelancer&rsquo;s rating, history and skills
            attached. They can shortlist, start a conversation, or hire. Hiring creates a contract
            at the freelancer&rsquo;s bid, rejects the other proposals, and opens a workspace thread
            between the two parties. The platform fee (10%) is frozen on the contract at hire time.
          </p>
        </Card>

        <Card>
          <CardHeader title="3 · Plan milestones" />
          <p className="text-sm leading-7 text-ink-700">
            The contract value is split into milestones. The plan must total exactly the contract
            value — escrow is balanced by construction, so there is never a remainder to argue
            about. Once any milestone is funded, the plan can grow but not be replaced.
          </p>
        </Card>

        <Card>
          <CardHeader title="4 · The escrow state machine" />
          <p className="mb-4 text-sm leading-7 text-ink-700">
            Every milestone moves through five states, and only six operations can move it. Both
            parties always see the same state:
          </p>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Meaning</th>
                  <th>Who can move it</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <StatusBadge status="PENDING" />
                  </td>
                  <td>Created, awaiting funding</td>
                  <td>
                    Client — <em>Fund escrow</em>
                  </td>
                  <td>
                    <StatusBadge status="FUNDED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <StatusBadge status="FUNDED" />
                  </td>
                  <td>Money locked in escrow</td>
                  <td>
                    Freelancer — <em>Submit work</em>
                  </td>
                  <td>
                    <StatusBadge status="SUBMITTED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <StatusBadge status="SUBMITTED" />
                  </td>
                  <td>Delivered, awaiting review</td>
                  <td>
                    Client — <em>Approve &amp; release</em>
                  </td>
                  <td>
                    <StatusBadge status="RELEASED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <StatusBadge status="RELEASED" />
                  </td>
                  <td>Paid to the freelancer (fee deducted)</td>
                  <td>Terminal state</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>
                    <StatusBadge status="DISPUTED" />
                  </td>
                  <td>Either side escalated; funds frozen</td>
                  <td>
                    Admin — <em>Resolve</em>
                  </td>
                  <td>
                    <StatusBadge status="RELEASED" /> / <StatusBadge status="REFUNDED" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="5 · Money invariants" />
          <ul className="list-inside list-disc space-y-2 text-sm leading-7 text-ink-700">
            <li>
              <Badge tone="blue">Balance</Badge> Σ milestone amounts always equals the contract
              value.
            </li>
            <li>
              <Badge tone="blue">Fee math</Badge> platform fee ={" "}
              <code>⌊amount × feeBps ÷ 10,000⌋</code>, and payout = amount − fee. Rounding always
              favours the freelancer.
            </li>
            <li>
              <Badge tone="blue">Atomic release</Badge> approval flips the milestone, writes fee +
              payout to the ledger, and credits the wallet — in one database transaction.
            </li>
            <li>
              <Badge tone="blue">Ledger</Badge> every deposit, release, fee, refund and payout is an
              immutable row with an escrow reference.
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="6 · Disputes and reviews" />
          <p className="text-sm leading-7 text-ink-700">
            Either party can open a dispute while money is in escrow. An administrator reads the
            thread and ledger, then resolves toward the freelancer (escrow releases) or the client
            (escrow refunds). When every milestone is released, the contract completes, both parties
            review each other, and ratings update their public profiles.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/register" className="btn-primary btn-sm">
              Try it now
            </Link>
            <Link href="/docs/architecture" className="btn-secondary btn-sm">
              Read the architecture doc →
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
