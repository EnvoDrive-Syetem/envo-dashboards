// What a viewer may send for each filter. Anything else is refused before it
// reaches Zoho, so a filter can never change the SQL around it.

const DATE = /^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const NAME = /^[\p{L}\p{M} .-]{0,60}$/u;

type Rule = { enum?: string[]; pattern?: RegExp; default: string };

export const PARAM_RULES: Record<string, Rule> = {
  start: { pattern: DATE, default: "" },
  end: { pattern: DATE, default: "" },
  hperiod: { enum: ["Month to date", "Quarter to date", "FY to date"], default: "Month to date" },
  hchannel: { enum: ["All channels", "B2B", "B2C", "Costco"], default: "All channels" },
  hline: { enum: ["All lines", "E-Bikes", "LEV", "Parts, shipping and other", "UPT"], default: "All lines" },
  ep_emp: { pattern: NAME, default: "" },
  ep_board: { pattern: NAME, default: "" },
};

export function checkParams(names: string[], given: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const rule = PARAM_RULES[name];
    if (!rule) throw new Error(`No rule for parameter ${name}`);
    const raw = given.get(name);
    const value = raw === null ? rule.default : raw;
    if (rule.enum && !rule.enum.includes(value)) throw new Error(`Value not allowed for ${name}`);
    if (rule.pattern && !rule.pattern.test(value)) throw new Error(`Value not allowed for ${name}`);
    if (value.includes("'") || value.includes("\\")) throw new Error(`Value not allowed for ${name}`);
    out[name] = value;
  }
  return out;
}

export function fillSql(sql: string, values: Record<string, string>): string {
  return sql.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`Missing parameter ${name}`);
    return values[name];
  });
}
