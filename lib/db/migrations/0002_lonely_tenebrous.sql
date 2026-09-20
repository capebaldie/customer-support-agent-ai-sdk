CREATE TABLE "retrievals" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"query" text NOT NULL,
	"chunkIds" integer[] NOT NULL,
	"scores" real[] NOT NULL,
	"k" integer NOT NULL,
	"latencyMs" integer NOT NULL,
	"model" text NOT NULL,
	"inputTokens" integer,
	"outputTokens" integer,
	"feedback" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retrievals_feedback" CHECK ("retrievals"."feedback" in ('up', 'down'))
);
--> statement-breakpoint
CREATE INDEX "retrievals_message_idx" ON "retrievals" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "retrievals_created_idx" ON "retrievals" USING btree ("createdAt");