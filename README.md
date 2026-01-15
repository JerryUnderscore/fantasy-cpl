# Fantasy CPL

Fantasy CPL is an early-stage fantasy soccer platform for the Canadian Premier League (CPL).

The goal of this project is to build a modern, league-centric fantasy experience with invite-only leagues, async drafts, flexible roster rules, and room to grow into deeper stats, scoring, and historical data.

This repository currently represents a working beta, focused on correctness and structure before polish.

## Current Features

- Authentication and profiles
- Seasons and clubs
- Player database (2026 season)
- Invite-only leagues
- League membership and ownership
- Fantasy teams (one per league)
- Roster slots (15 total)
- Async snake draft
- Draft pick locking
- Starter vs bench designation
- Lineup validation (in progress)
- Scoring engine (planned)

UI polish, moderation tools, and commissioner controls will come later.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Prisma
- Supabase (Postgres)
- Tailwind CSS
- Node.js runtime

Fonts are intentionally kept local/system-based to avoid network-dependent builds.

## Getting Started (Local Development)

Install dependencies:

npm install

Run the dev server:

npm run dev

Then open:

http://localhost:3000

Most pages live under src/app/ and update automatically during development.

## Database and Seeding

This project uses Prisma with Supabase.

Apply migrations:

npx prisma migrate dev

Seed core data (season and clubs only):

npx prisma db seed

Player data is managed directly in Supabase via CSV imports and is not hardcoded in seed files.

## Project Philosophy

This project is being built layer by layer:

1. Identity and structure  
2. Social containers (leagues)  
3. Fantasy mechanics  
4. Data depth and realism  
5. Polish and moderation  

The focus is on correctness over cleverness, structure over shortcuts, and shipping working systems before UI perfection.

## Status

Active development.  
Breaking changes are expected.  
Not production-ready.  
Not yet public.

## Deployment

The app is deployed via Vercel.

Local builds should succeed without requiring external network access.