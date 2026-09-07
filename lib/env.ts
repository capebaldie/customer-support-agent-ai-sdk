import { z } from "zod";

const schema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().startsWith("postgres"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => {
    const name = issue.path.join(".");
    // an absent var arrives as undefined, whose type error reads confusingly
    return issue.code === "invalid_type" && !(name in process.env)
      ? `  ${name} is missing`
      : `  ${name}: ${issue.message}`;
  });
  throw new Error(
    `Invalid environment variables:\n${problems.join("\n")}\n\nSee .env.example for what each one is.\n`,
  );
}

export const env = parsed.data;
