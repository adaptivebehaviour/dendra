import { resolveDestinationConfig, DestinationConfigError, type DestinationConfig } from '@adaptivebehaviour/data/src/destinations/config';
import type { Destination } from '@adaptivebehaviour/data/src/destinations/types';
import { LOCAL_FILE_KIND, LocalFileDestination } from '@adaptivebehaviour/desktop/src/data/localFile';
import { basename } from 'node:path';
import { APPLICATION_TYPE } from './config';

/**
 * Builds the application's one data destination from its declaration (config.ts). Refuses a kind that may not be used in
 * this type of application. A new destination kind is added here, next to the process it runs in.
 */
export function createDestination(config: DestinationConfig, context: { userData: string }): Destination {
  const { kind, settings = {} } = resolveDestinationConfig(config, APPLICATION_TYPE);
  switch (kind) {
    case LOCAL_FILE_KIND: {
      const fileName = settings['fileName'];
      if (fileName !== undefined && (typeof fileName !== 'string' || fileName === '' || basename(fileName) !== fileName)) {
        throw new DestinationConfigError("The 'local-file' setting 'fileName' must be a file name, not a path.");
      }
      return new LocalFileDestination({ directory: context.userData, fileName });
    }
    default:
      throw new DestinationConfigError(`The '${kind}' data destination is not available in the main process of this application.`);
  }
}
