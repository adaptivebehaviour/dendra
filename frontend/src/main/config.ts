import { defaultDestinationConfig, type DestinationConfig } from '@adaptivebehaviour/data/src/destinations/config';
import type { ServiceDeclaration } from '@adaptivebehaviour/desktop/src/net/index';

/**
 * Application-level configuration of the main process. A project scaffolded from this shell edits this file.
 */

/** Shown in the window title. */
export const APP_NAME = 'dendra';

/** This application's type: it decides which data destinations may be selected and which one is the default. */
export const APPLICATION_TYPE = 'electron';

/**
 * Where this application's data goes: exactly one destination (a `kind` plus that kind's `settings`; never credentials).
 * It starts as the default of the application type, the user's local file system (a `data.json` file in the application's
 * user-data folder). Declare another here to send the data elsewhere.
 */
export const destination: DestinationConfig = defaultDestinationConfig(APPLICATION_TYPE);

/**
 * The external services this application may use: its network allow-list. Empty by default, so the application makes
 * no network requests and its CSP allows no remote origin. Declare a service here to use it, e.g. Sanity or an LLM API
 * (the renderer then calls it with `ab.net.call({ service, operation, … })`; credentials come from environment variables).
 */
export const services: ServiceDeclaration[] = [];

/** `https:` origins the OS browser may be opened for when a link is clicked. Empty: links to external sites do nothing. */
export const externalLinkOrigins: string[] = [];
