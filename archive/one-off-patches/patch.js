/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
let code = fs.readFileSync('src/lib/whatsapp-flow.ts', 'utf8');

const target = `      if (gemini) {
        let merged = { ...(existingState || {}), ...gemini.extractedFields, locale } as FlowState;
        let reply = gemini.humanResponse;`;

const replacement = `      if (gemini) {
        let merged = { ...(existingState || {}), locale } as FlowState;
        const deterministicExtracted = extractRentalDetails(body, existingState || { step: 'menu', locale } as FlowState);
        
        for (const [key, value] of Object.entries(gemini.extractedFields)) {
          if (value) (merged as any)[key] = value;
        }
        for (const [key, value] of Object.entries(deterministicExtracted)) {
          if (value) (merged as any)[key] = value;
        }

        if (existingState?.pickupDate && merged.pickupDate !== existingState.pickupDate && !merged.dropoffDate) {
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
        }
        
        let reply = gemini.humanResponse;`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/whatsapp-flow.ts', code);
