import { createRequire } from "node:module";
import type { ExtensionContext } from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient | null = null;

/** Start the bundled diagnostics-only Blend65 language server over stdio. */
export async function activate(context: ExtensionContext): Promise<void> {
  const require = createRequire(import.meta.url);
  const serverModule = require.resolve("@blend65/language-server");
  client = new LanguageClient(
    "blend65",
    "Blend65",
    { module: serverModule, transport: TransportKind.stdio },
    { documentSelector: [{ scheme: "file", language: "blend65" }] },
  );
  context.subscriptions.push(client);
  await client.start();
}

/** Stop the owned language client and its server process during extension shutdown. */
export async function deactivate(): Promise<void> {
  const active = client;
  client = null;
  if (active !== null) await active.stop();
}
