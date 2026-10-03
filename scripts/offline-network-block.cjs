"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preloaders must use synchronous CommonJS imports. */
// Inherited by the isolated webpack build's Node workers. This blocks known Node
// transports before socket creation; it is not an OS-wide native-code sandbox.
const fs = require("node:fs");
const deny = transport => function () {
  if (process.env.TAKEME_OFFLINE_NETWORK_LOG) fs.appendFileSync(process.env.TAKEME_OFFLINE_NETWORK_LOG, `${transport}\n`);
  const error = new Error(`Offline qualification blocked network transport: ${transport}`);
  error.code = "TAKEME_OFFLINE_NETWORK_BLOCKED";
  throw error;
};
globalThis.fetch = deny("fetch");
for (const name of ["node:http", "node:https"]) {
  const transportModule = require(name);
  transportModule.request = deny(`${name}.request`);
  transportModule.get = deny(`${name}.get`);
}
const net = require("node:net");
net.connect = deny("net.connect");
net.createConnection = deny("net.createConnection");
net.Socket.prototype.connect = deny("net.Socket.connect");
require("node:tls").connect = deny("tls.connect");
const dns = require("node:dns");
for (const key of Object.keys(dns)) if (key === "lookup" || key.startsWith("resolve") || key === "reverse") dns[key] = deny(`dns.${key}`);
for (const key of Object.keys(dns.promises)) if (key === "lookup" || key.startsWith("resolve") || key === "reverse") dns.promises[key] = deny(`dns.promises.${key}`);
const child = require("node:child_process");
const guardedEnvironment = env => ({ ...(env || process.env), NODE_OPTIONS: `--require ${JSON.stringify(__filename)}` });
for (const key of ["exec", "execSync"]) child[key] = deny(`child_process.${key}`);
for (const key of ["spawn", "spawnSync", "execFile", "execFileSync"]) {
  const original = child[key];
  child[key] = function (command, ...args) {
    if (command !== process.execPath) return deny(`child_process.${key}`)();
    const parameters = Array.isArray(args[0]) ? args.shift() : [];
    const options = args[0] && typeof args[0] === "object" ? args.shift() : {};
    if (options.shell) return deny(`child_process.${key}.shell`)();
    return original.call(this, command, parameters, { ...options, env: guardedEnvironment(options.env) }, ...args);
  };
}
const fork = child.fork;
child.fork = function (modulePath, ...args) {
  const parameters = Array.isArray(args[0]) ? args.shift() : [];
  const options = args[0] && typeof args[0] === "object" ? args.shift() : {};
  if (options.execPath && options.execPath !== process.execPath) return deny("child_process.fork.execPath")();
  return fork.call(this, modulePath, parameters, { ...options, env: guardedEnvironment(options.env) });
};
const threads = require("node:worker_threads");
const Worker = threads.Worker;
threads.Worker = class OfflineWorker extends Worker {
  constructor(filename, options = {}) {
    super(filename, { ...options, execArgv: [...(options.execArgv || process.execArgv), "--require", __filename] });
  }
};
require("node:module").syncBuiltinESMExports();
