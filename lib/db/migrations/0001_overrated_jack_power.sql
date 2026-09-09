ALTER TABLE "chunks" ADD COLUMN "updated" date NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "contentHash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_ident" UNIQUE("docSlug","headingPath");