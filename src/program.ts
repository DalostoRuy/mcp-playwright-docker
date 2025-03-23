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
import { console } from "./resources/console";

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
    setupExitWatchdog(server);
    await server.start();
  });

function setupExitWatchdog(server: Server) {
  let shuttingDown = false;
  let forceExitTimeout: NodeJS.Timeout | null = null;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    // Clear any existing timeout
    if (forceExitTimeout) {
      clearTimeout(forceExitTimeout);
    }

    // Set a timeout to force exit if graceful shutdown takes too long
    forceExitTimeout = setTimeout(() => {
      console.error("Forcing exit after timeout");
      process.exit(1);
    }, 15000);

    try {
      console.error("Server shutting down gracefully...");
      await server?.stop();
      console.error("Server stopped successfully");

      // Clear the force exit timeout since we're exiting gracefully
      if (forceExitTimeout) {
        clearTimeout(forceExitTimeout);
      }

      process.exit(0);
    } catch (error) {
      console.error("Error during server shutdown:", error);
      process.exit(1);
    }
  };

  // Handle signal events (for Docker)
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Handle stdin close (original behavior)
  process.stdin.on("close", shutdown);

  // Handle unhandled rejections and exceptions
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
    shutdown();
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    shutdown();
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

const resources: Resource[] = [console];

program.parse(process.argv);
