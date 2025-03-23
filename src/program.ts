/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { program } from "commander";

import { Server } from "./server";
import * as snapshot from "./tools/snapshot";
import * as common from "./tools/common";
import * as screenshot from "./tools/screenshot";
import { console as consoleResource } from "./resources/console";

import type { LaunchOptions } from "./server";
import type { Tool } from "./tools/tool";
import type { Resource } from "./resources/resource";

const packageJSON = require("../package.json");

program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .option("--headless", "Run browser in headless mode, headed by default")
  .option(
    "--vision",
    "Run server that uses screenshots (Aria snapshots are used by default)"
  )
  .option(
    "--max-lifetime <seconds>",
    "Maximum lifetime in seconds before auto-shutdown (default: 60)",
    (s) => parseInt(s, 10),
    60
  )
  .option(
    "--idle-timeout <seconds>",
    "Shutdown after this many seconds of inactivity (default: 30)",
    (s) => parseInt(s, 10),
    30
  )
  .action(async (options) => {
    const launchOptions: LaunchOptions = {
      headless: !!options.headless,
    };
    const tools = options.vision ? screenshotTools : snapshotTools;
    const server = new Server(
      {
        name: "Playwright",
        version: packageJSON.version,
        tools,
        resources,
      },
      launchOptions
    );

    setupExitWatchdog(server, options.maxLifetime, options.idleTimeout);
    await server.start();
  });

function setupExitWatchdog(
  server: Server,
  maxLifetimeSeconds: number,
  idleTimeoutSeconds: number
) {
  // Flag para evitar múltiplos enceramentos
  let isShuttingDown = false;

  // Função de encerramento
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Definir timeout para forçar saída se algo travar
    const forceExitTimeout = setTimeout(() => process.exit(0), 15000);

    try {
      await server?.stop();
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      // Em caso de erro no shutdown, forçar saída
      process.exit(1);
    }
  };

  // 1. Tempo máximo de vida (em milissegundos)
  const maxLifetimeMs = maxLifetimeSeconds * 1000;
  const maxLifetimeTimeout = setTimeout(() => {
    if (process.env.NODE_ENV !== "test") {
      // Usando process.stderr.write em vez de console.error
      process.stderr.write(
        `Maximum lifetime of ${maxLifetimeSeconds} seconds reached. Shutting down.\n`
      );
      shutdown();
    }
  }, maxLifetimeMs);

  // 2. Tempo de inatividade
  const idleTimeoutMs = idleTimeoutSeconds * 1000;
  let idleTimer: NodeJS.Timeout | null = setTimeout(() => {
    // Usando process.stderr.write em vez de console.error
    process.stderr.write(
      `No activity for ${idleTimeoutSeconds} seconds. Shutting down.\n`
    );
    shutdown();
  }, idleTimeoutMs);

  // Resetar o timer de inatividade quando houver dados no stdin
  process.stdin.on("data", () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Usando process.stderr.write em vez de console.error
        process.stderr.write(
          `No activity for ${idleTimeoutSeconds} seconds. Shutting down.\n`
        );
        shutdown();
      }, idleTimeoutMs);
    }
  });

  // Tratamento para SIGINT e SIGTERM (sinais enviados pelo Docker)
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Quando stdin fechar
  process.stdin.on("close", shutdown);

  // Limpar temporizadores se o processo encerrar de forma inesperada
  process.on("exit", () => {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(maxLifetimeTimeout);
  });
}

const commonTools: Tool[] = [
  common.pressKey,
  common.wait,
  common.pdf,
  common.close,
];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  ...commonTools,
];

const screenshotTools: Tool[] = [
  common.navigate(false),
  common.goBack(false),
  common.goForward(false),
  screenshot.screenshot,
  screenshot.moveMouse,
  screenshot.click,
  screenshot.drag,
  screenshot.type,
  ...commonTools,
];

const resources: Resource[] = [consoleResource];

program.parse(process.argv);
