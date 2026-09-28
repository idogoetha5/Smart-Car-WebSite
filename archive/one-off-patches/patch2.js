/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
let code = fs.readFileSync('src/lib/whatsapp-flow.ts', 'utf8');

const target = `        if (existingState?.pickupDate && merged.pickupDate !== existingState.pickupDate && !merged.dropoffDate) {
           merged.dropoffDate = merged.pickupDate;
           merged.pickupDate = existingState.pickupDate;
        }
        if (existingState?.pickupTime && merged.pickupTime !== existingState.pickupTime && !merged.returnTime) {
           merged.returnTime = merged.pickupTime;
           merged.pickupTime = existingState.pickupTime;
        }
        if (existingState?.pickupLocation && merged.pickupLocation !== existingState.pickupLocation && !merged.dropoffLocation) {
           merged.dropoffLocation = merged.pickupLocation;
           merged.pickupLocation = existingState.pickupLocation;
        }`;

const replacement = `        if (existingState?.pickupDate && merged.pickupDate !== existingState.pickupDate) {
           if (!merged.dropoffDate) {
             merged.dropoffDate = merged.pickupDate;
             merged.pickupDate = existingState.pickupDate;
           } else if (!deterministicExtracted.pickupDate) {
             // Gemini overwrote pickupDate but deterministic only found dropoffDate. Revert Gemini's overwrite!
             merged.pickupDate = existingState.pickupDate;
           }
        }
        if (existingState?.pickupTime && merged.pickupTime !== existingState.pickupTime) {
           if (!merged.returnTime) {
             merged.returnTime = merged.pickupTime;
             merged.pickupTime = existingState.pickupTime;
           } else if (!deterministicExtracted.pickupTime) {
             merged.pickupTime = existingState.pickupTime;
           }
        }
        if (existingState?.pickupLocation && merged.pickupLocation !== existingState.pickupLocation) {
           if (!merged.dropoffLocation) {
             merged.dropoffLocation = merged.pickupLocation;
             merged.pickupLocation = existingState.pickupLocation;
           } else if (!deterministicExtracted.pickupLocation) {
             merged.pickupLocation = existingState.pickupLocation;
           }
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/whatsapp-flow.ts', code);
