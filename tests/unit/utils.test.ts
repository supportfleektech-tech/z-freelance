import { describe, expect, it } from "vitest";
import {
  clamp,
  excerpt,
  formatDate,
  humanize,
  initials,
  normalizeUrl,
  pagination,
  parseList,
  slugify,
  timeAgo,
  totalPages,
  uniqueSlug,
} from "@/lib/utils";

describe("slugify", () => {
  it("produces URL-safe slugs", () => {
    expect(slugify("Build a Next.js App!")).toBe("build-a-next-js-app");
    expect(slugify("  Data & AI — pipelines ")).toBe("data-ai-pipelines");
    expect(slugify("L'Étude du Système")).toBe("letude-du-systeme");
    expect(slugify("designer's guide")).toBe("designers-guide");
  });

  it("handles empty and symbol-only input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("uniqueSlug always differs and keeps the base", () => {
    const a = uniqueSlug("My Project");
    const b = uniqueSlug("My Project");
    expect(a).not.toBe(b);
    expect(a.startsWith("my-project-")).toBe(true);
    expect(uniqueSlug("###")).toMatch(/^project-/);
  });
});

describe("string helpers", () => {
  it("excerpt truncates with an ellipsis", () => {
    expect(excerpt("hello world", 20)).toBe("hello world");
    const long = "a ".repeat(200);
    const short = excerpt(long, 40);
    expect(short.length).toBeLessThanOrEqual(41);
    expect(short.endsWith("…")).toBe(true);
  });

  it("humanize", () => {
    expect(humanize("IN_PROGRESS")).toBe("In Progress");
    expect(humanize("CLIENT_TO_FREELANCER")).toBe("Client To Freelancer");
  });

  it("initials", () => {
    expect(initials("Sofia Lindqvist")).toBe("SL");
    expect(initials("amara")).toBe("A");
    expect(initials("  ")).toBe("");
  });
});

describe("pagination", () => {
  it("clamps into safe ranges", () => {
    const result = pagination({ page: "0", pageSize: "500" }, { pageSize: 12, maxPageSize: 50 });
    expect(result).toEqual({ page: 1, pageSize: 50, offset: 0 });
  });

  it("computes offsets", () => {
    expect(
      pagination({ page: "3", pageSize: "10" }, { pageSize: 12, maxPageSize: 50 }).offset,
    ).toBe(20);
  });

  it("totalPages", () => {
    expect(totalPages(0, 10)).toBe(1);
    expect(totalPages(101, 10)).toBe(11);
    expect(totalPages(100, 0)).toBe(0);
  });

  it("clamp", () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-2, 1, 3)).toBe(1);
  });
});

describe("normalizeUrl", () => {
  it("parses and upgrades bare hosts", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
    expect(normalizeUrl("https://a.b/c?d=e")).toBe("https://a.b/c?d=e");
  });

  it("rejects dangerous and non-http schemes", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://x.y")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
});

describe("parseList", () => {
  it("splits, trims and de-duplicates case-insensitively", () => {
    expect(parseList("React,  react \nNext.js,,React")).toEqual(["React", "Next.js"]);
  });

  it("caps the number of items", () => {
    expect(parseList("a,b,c,d", 2)).toEqual(["a", "b"]);
  });
});

describe("dates", () => {
  it("timeAgo renders human intervals", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 30_000), now)).toBe("just now");
    const fiveMinutesAgo = timeAgo(new Date(now - 5 * 60_000), now);
    expect(fiveMinutesAgo).toMatch(/minute/);
    const twoDaysAgo = timeAgo(new Date(now - 2 * 86_400_000), now);
    expect(twoDaysAgo).toMatch(/day/);
  });

  it("formatDate tolerates junk", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});
