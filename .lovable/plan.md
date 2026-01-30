
# Plan: Resize and Reposition Green World Logo

## Objective
Match the logo positioning and size exactly as shown in your reference image - larger logo, perfectly centered in the white area above the swoosh.

## Changes

### 1. Update Logo Positioning and Size (GreenWorld.tsx)

**Current state:**
- Logo height: `h-24` (96px) on mobile, `h-36` on desktop
- Position: `top-[120px]` on mobile

**New values to match reference:**
- **Logo height:** `h-36` (144px) on mobile, `h-48` (192px) on desktop - approximately 1.5x larger
- **Position:** `top-[160px]` on mobile, `top-[170px]` on desktop - to center it vertically in the white space between header and swoosh

### 2. Technical Details

The white area above the swoosh is 280px tall on mobile. With the header taking ~64px, the remaining white space is ~216px. Centering a 144px logo means:
- Top of logo at: 64px + (216px - 144px) / 2 = 64px + 36px = 100px
- Center of logo at: 100px + 72px = 172px

Using `top-[160px]` with `-translate-y-1/2` will position the center at 160px, which is close to the visual center accounting for the swoosh curve starting partway up.

## Files to Modify
- `src/pages/GreenWorld.tsx` - Update logo container positioning and image size classes
