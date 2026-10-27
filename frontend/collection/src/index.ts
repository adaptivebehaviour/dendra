import { defineCollection } from '@adaptivebehaviour/manifesto/src/registry';
import type { RegistryTarget } from '@adaptivebehaviour/manifesto/src/create';
import { validateRecordsJson } from '@adaptivebehaviour/manifesto/src/schema';
import records from './records.json' with { type: 'json' };

/** Registers this collection's records. Nothing is registered yet. */
export function register(target: RegistryTarget): void {
  for (const record of validateRecordsJson('dendra/records.json', records)) {
    target.recordRegistry.set(record.id as string, record);
  }
}

export const dendra = defineCollection({ id: 'dendra', dependsOn: ['manifesto'], register });
