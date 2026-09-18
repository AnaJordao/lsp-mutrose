// ── ANSI colours ────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
};

const width = 60;
const line = (ch = "─") => ch.repeat(width);

// ── Helpers ──────────────────────────────────────────────────────────────────
function banner(text: string) {
  const pad = Math.floor((width - text.length - 2) / 2);
  const left = " ".repeat(pad);
  const right = " ".repeat(width - pad - text.length - 2);
  console.log(`\n${c.cyan}${c.bold}┌${line()}┐${c.reset}`);
  console.log(
    `${c.cyan}${c.bold}│${c.reset}${left} ${c.bold}${text}${c.reset}${right} ${c.cyan}${c.bold}│${c.reset}`,
  );
  console.log(`${c.cyan}${c.bold}└${line()}┘${c.reset}\n`);
}

function suiteLine(name: string) {
  console.log(`\n${c.cyan}${c.bold}▶ ${name}${c.reset}`);
  console.log(`${c.dim}${line("·")}${c.reset}`);
}

function stripAnsi(str: string) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function parseResults(rawOutput: string) {
  const output = stripAnsi(rawOutput);

  const time = output.match(/Time:\s*([\d.]+ s)/)?.[1] ?? "?";

  // "Tests: 3 failed, 15 passed, 18 total"  OR  "Tests: 18 passed, 18 total"
  const testsLine = output.match(/^Tests:\s*(.+)$/m)?.[1] ?? "";
  const passedMatch = testsLine.match(/(\d+) passed/);
  const failedMatch = testsLine.match(/(\d+) failed/);
  const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1]) : 0;

  return { time, passed, failed };
}

// ── Run a suite ──────────────────────────────────────────────────────────────
function runSuite(name: string, cwd: string) {
  suiteLine(name);
  let output = "";
  let crashed = false;

  try {
    // Use spawnSync so we can stream Jest's own coloured output to the
    // terminal (stdio: 'inherit') while still capturing it for summary parsing.
    const { spawnSync } = require("child_process");
    const isWin = process.platform === "win32";
    const cmd = isWin ? "npm.cmd" : "npm";

    const result = spawnSync(cmd, ["test"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "1" },
      shell: isWin,
    });

    output = (result.stdout ?? "") + (result.stderr ?? "");
    crashed = result.status !== 0;

    // Print Jest's own output (strip npm notice lines)
    const cleaned = output
      .split("\n")
      .filter((l) => !l.startsWith("npm notice") && !l.startsWith("npm warn"))
      .join("\n");
    process.stdout.write(cleaned + "\n");
  } catch (err: any) {
    output = String(err);
    crashed = true;
    console.log(
      `${c.red}Failed to run tests in ${cwd}: ${err.message}${c.reset}`,
    );
  }

  const results = parseResults(output);
  return { name, ...results, crashed };
}

// ── Main ─────────────────────────────────────────────────────────────────────
banner("Test Runner");

const suites = [
  { name: "Server", cwd: "server" },
  { name: "Client", cwd: "client" },
];

const results = suites.map(({ name, cwd }) => runSuite(name, cwd));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}${line()}${c.reset}`);
console.log(`${c.bold}  Summary${c.reset}`);
console.log(`${c.dim}${line("·")}${c.reset}`);

let totalPassed = 0;
let totalFailed = 0;
let allOk = true;

for (const r of results) {
  totalPassed += r.passed;
  totalFailed += r.failed;
  if (r.failed > 0 || r.crashed) {
    allOk = false;
  }

  const badge =
    r.failed === 0 && !r.crashed
      ? `${c.bgGreen}${c.bold} PASS ${c.reset}`
      : `${c.bgRed}${c.bold} FAIL ${c.reset}`;

  console.log(
    `  ${badge}  ${c.bold}${r.name.padEnd(10)}${c.reset}  ${c.dim}${r.passed} passed, ${r.failed} failed — ${r.time}${c.reset}`,
  );
}

console.log(`${c.dim}${line("·")}${c.reset}`);
console.log(
  `  ${c.bold}Total${c.reset}          ${c.green}${totalPassed} passed${c.reset}, ${totalFailed > 0 ? c.red : c.dim}${totalFailed} failed${c.reset}`,
);
console.log(`${c.cyan}${c.bold}${line()}${c.reset}\n`);

process.exit(allOk ? 0 : 1);
