import { listUsers } from "@/server/services/admin.service";
import { adminUserQuerySchema } from "@/lib/validation";
import { timeAgo, formatDate } from "@/lib/utils";
import { PageHeader, StatusBadge, Card, Pagination, EmptyState, Badge } from "@/components/ui";
import { SuspendUserButton } from "@/components/suspend-user-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : (v ?? "")]),
  );
  const parsed = adminUserQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : adminUserQuerySchema.parse({});

  const result = await listUsers(query);

  return (
    <>
      <PageHeader
        title="User moderation"
        description="Suspension takes effect on the account's next request — their sessions stop resolving immediately."
      />

      <form method="GET" className="card mb-6 grid gap-3 p-4 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Search name or email…"
          className="input sm:col-span-2"
        />
        <select name="role" defaultValue={query.role ?? ""} className="input">
          <option value="">Any role</option>
          <option value="CLIENT">Clients</option>
          <option value="FREELANCER">Freelancers</option>
          <option value="ADMIN">Admins</option>
        </select>
        <div className="flex gap-2">
          <select name="status" defaultValue={query.status ?? ""} className="input">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <button type="submit" className="btn-primary btn-sm">
            Filter
          </button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No users match" />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Joined</th>
                <th className="hidden lg:table-cell">Last login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <p className="font-medium text-ink-900">{user.name}</p>
                    <p className="text-xs text-ink-500">{user.email}</p>
                  </td>
                  <td>
                    <Badge
                      tone={
                        user.role === "ADMIN" ? "violet" : user.role === "CLIENT" ? "blue" : "green"
                      }
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="hidden text-ink-500 sm:table-cell">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="hidden text-ink-500 lg:table-cell">
                    {user.lastLoginAt ? timeAgo(user.lastLoginAt) : "never"}
                  </td>
                  <td>
                    {user.role !== "ADMIN" ? (
                      <SuspendUserButton userId={user.id} status={user.status} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/admin/users"
        params={flat}
      />
    </>
  );
}
