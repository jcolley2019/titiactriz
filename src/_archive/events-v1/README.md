# Events v1 (archived)

These are the pre-rebuild v1 events files:

- `SmartFilmsCard.tsx` — single hardcoded SmartFilms card
- `useEventSettings.ts` — settings hook backing that card
- `EventsManager.tsx` — old admin manager for that single card

They were replaced by the new flexible board:

- `src/hooks/useEventsBoard.ts`
- `src/components/events/EventCard.tsx`
- `src/components/events/EventsGrid.tsx`
- `src/components/admin/EventsBoardManager.tsx`

Kept here for reference only. Not imported anywhere in the active app and
excluded from the TypeScript build via `tsconfig.app.json`'s `exclude`.
