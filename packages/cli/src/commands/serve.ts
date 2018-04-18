/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

// Be careful with these imports. As much as possible should be deferred until
// the command is actually run, in order to minimize startup time from loading
// unused code. Any imports that are only used as types will be removed from the
// output JS and so not result in a require() statement.

import * as logging from 'plylog';
import {ProjectConfig} from 'polymer-project-config';
import {args as polyserveArgs} from 'polyserve/lib/args';
import {ServerOptions} from 'polyserve/lib/start_server';

import {Environment} from '../environment/environment';

import {Command, CommandOptions} from './command';

const logger = logging.getLogger('cli.command.serve');

export class ServeCommand implements Command {
  name = 'serve';
  aliases = [];

  description = 'Runs the polyserve development server';

  args = polyserveArgs;

  async run(options: CommandOptions, config: ProjectConfig) {
    // Defer dependency loading until this specific command is run
    const polyserve = await import('polyserve');
    const startServers = polyserve.startServers;
    const getServerUrls = polyserve.getServerUrls;
    const url = await import('url');

    let openPath: string|undefined;
    if (config.entrypoint && config.shell) {
      openPath = config.entrypoint.substring(config.root.length);
      if (openPath === 'index.html' || openPath === '/index.html') {
        openPath = '/';
      }
    }

    // TODO(justinfagnani): Consolidate args handling between polymer-cli and
    // polyserve's CLI.
    const proxyArgs = {
      path: options['proxy-path'],
      target: options['proxy-target']
    };

    const serverOptions: ServerOptions = {
      root: options['root'],
      entrypoint: config.entrypoint,
      compile: options['compile'],
      port: options['port'],
      hostname: options['hostname'],
      open: options['open'],
      browser: options['browser'],
      openPath: options['open-path'],
      npm: config.npm,
      moduleResolution: config.moduleResolution,
      componentDir: config.componentDir,
      packageName: options['package-name'],
      protocol: options['protocol'],
      keyPath: options['key'],
      certPath: options['cert'],
      pushManifestPath: options['manifest'],
      proxy: proxyArgs.path && proxyArgs.target && proxyArgs,
    };

    logger.debug('serving with options', serverOptions);
    const env: Environment = options['env'];

    if (env && env.serve) {
      logger.debug('env.serve() found in options');
      logger.debug('serving via env.serve()...');
      return env.serve(serverOptions);
    }

    logger.debug('serving via polyserve.startServers()...');
    const serverInfos = await startServers(serverOptions);

    if (serverInfos.kind === 'mainline') {
      const mainlineServer = serverInfos;
      const urls = getServerUrls(serverOptions, mainlineServer.server);
      const serverUrl = url.format(urls.serverUrl);
      const componentUrl = url.format(urls.componentUrl);
      if (serverUrl === componentUrl) {
        logger.info(
            `Files in this directory are available under the following URL:
      ${serverUrl}`);
      } else {
        logger.info(
            `Files in this directory are available under the following URLs:
      applications: ${serverUrl}
      reusable components: ${componentUrl}`);
      }
    } else {
      // We started multiple servers, just tell the user about the control
      // server, it serves out human-readable info on how to access the others.
      const urls = getServerUrls(serverOptions, serverInfos.control.server);
      logger.info(`Started multiple servers with different variants:
      View the Polyserve console here: ${url.format(urls.serverUrl)}`);
    }
  }
}
