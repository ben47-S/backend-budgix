import * as process from 'node:process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url));
import * as runtime from "@prisma/client/runtime/client";
import * as $Enums from "./enums";
import * as $Class from "./internal/class";
import * as Prisma from "./internal/prismaNamespace";
export * as $Enums from './enums';
export * from "./enums";
export const PrismaClient = $Class.getPrismaClientClass();
export { Prisma };
//# sourceMappingURL=client.js.map