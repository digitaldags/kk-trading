import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every admin server action must start with `await requireAdmin()` (CLAUDE.md). Without
// a session that answers 401 before anything changes; proxy.ts alone isn't protection.
// This reads each app/admin/**/actions.ts and checks every exported function.

const ADMIN_DIR = path.join(import.meta.dirname);

/** Actions that run without a session, and why. */
const UNGUARDED: Record<string, { name: string; reason: string }[]> = {
  "login/actions.ts": [
    { name: "signIn", reason: "starts the session; rate limited instead" },
  ],
};

function actionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return actionFiles(full);
    return entry.name === "actions.ts" ? [full] : [];
  });
}

type Finding = { name: string; guarded: boolean } | { problem: string };

function inspect(file: string): Finding[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const findings: Finding[] = [];

  for (const statement of source.statements) {
    const exported = ts
      .getModifiers(statement as ts.HasModifiers)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const first = statement.body?.statements[0];
      findings.push({
        name: statement.name.text,
        guarded: first ? callsRequireAdmin(first) : false,
      });
    } else if (ts.isVariableStatement(statement)) {
      // `export const x = async () => {}` would dodge the check; keep actions as
      // function declarations.
      findings.push({
        problem: `exports a variable; write actions as \`export async function\``,
      });
    }
  }
  return findings;
}

/** `await requireAdmin();` or `const admin = await requireAdmin();` */
function callsRequireAdmin(statement: ts.Statement): boolean {
  let expression: ts.Expression | undefined;
  if (ts.isExpressionStatement(statement)) {
    expression = statement.expression;
  } else if (ts.isVariableStatement(statement)) {
    const [declaration] = statement.declarationList.declarations;
    expression = declaration?.initializer;
  }
  return (
    expression !== undefined &&
    ts.isAwaitExpression(expression) &&
    ts.isCallExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === "requireAdmin"
  );
}

describe("admin server actions", () => {
  const files = actionFiles(ADMIN_DIR);

  it("are found (the check isn't looking in the wrong place)", () => {
    const relative = files.map((f) =>
      path.relative(ADMIN_DIR, f).replaceAll("\\", "/"),
    );
    expect(relative).toEqual(
      expect.arrayContaining(["actions.ts", "login/actions.ts"]),
    );
  });

  it.each(
    files.map((f) => [path.relative(ADMIN_DIR, f).replaceAll("\\", "/"), f]),
  )(
    "%s: every exported action starts with await requireAdmin()",
    (relative, file) => {
      const allowed = new Set((UNGUARDED[relative] ?? []).map((u) => u.name));
      const problems = inspect(file).flatMap((finding) => {
        if ("problem" in finding) return [finding.problem];
        if (finding.guarded || allowed.has(finding.name)) return [];
        return [`${finding.name} doesn't start with \`await requireAdmin()\``];
      });
      expect(problems).toEqual([]);
    },
  );

  it("allows only the listed actions to skip the check", () => {
    for (const [relative, entries] of Object.entries(UNGUARDED)) {
      const findings = inspect(path.join(ADMIN_DIR, relative));
      for (const { name } of entries) {
        const found = findings.find((f) => "name" in f && f.name === name);
        // An allowlisted action that no longer exists should come off the list.
        expect(found, `${relative}: ${name}`).toBeDefined();
      }
    }
  });
});
